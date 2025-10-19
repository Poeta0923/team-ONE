from __future__ import annotations

"""
Personality / Trait Analysis Trainer API (Multi‑Label Text Classifier)
- Depends on: fastapi, uvicorn, pydantic, torch, sentence-transformers, numpy
- Uses the latest embedding model saved under ./models/embeddings/latest (same convention as your embedding service)
- Trains a light classifier (linear head) on top of frozen SBERT embeddings
- Supports multi‑label (one‑vs‑rest BCE) and single‑label (auto‑detected) tasks
- Saves models under ./models/traits/{timestamp[-tag]}/ with meta.json
- Exposes:
    GET  /train/health
    POST /train/train                 -> start training (labels inferred or provided)
    GET  /train/jobs/{job_id}         -> job status
    GET  /train/models                -> list saved models
    GET  /train/models/{model_id}     -> model metadata
    POST /train/evaluate              -> evaluation (micro/macro F1, ROC‑AUC per label)
    POST /score                       -> predict per‑label probabilities for a text
    POST /train/inference/sandbox     -> batch scoring

HOW TO RUN
----------
$ uvicorn traits_fastapi:app --host 0.0.0.0 --port 8091

Tip: Make sure the embedding service already trained a model and created
      ./models/embeddings/latest  (symlink or marker LATEST.txt)
"""

import os
import io
import gc
import json
import uuid
import math
import time
import logging
from typing import List, Dict, Optional, Union, Tuple
from datetime import datetime

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader

from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

# ----------------------------
# Paths & shared conventions
# ----------------------------
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
EMB_ROOT = os.path.join(BASE_DIR, 'models', 'embeddings')
EMB_LATEST = os.path.join(EMB_ROOT, 'latest')
TRAITS_ROOT = os.path.join(BASE_DIR, 'models', 'traits')
TRAITS_LATEST = os.path.join(TRAITS_ROOT, 'latest')
LOG_DIR = os.path.join(BASE_DIR, 'logs')

os.makedirs(TRAITS_ROOT, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)

DEFAULT_BASE_MODEL = os.environ.get(
    'BASE_MODEL', 'sentence-transformers/distiluse-base-multilingual-cased-v2'
)

# ----------------------------
# Embedding loader (disk-based)
# ----------------------------
try:
    from sentence_transformers import SentenceTransformer as _ST
except Exception:
    _ST = None

_emb_model = None  # type: ignore
_emb_path: Optional[str] = None


def latest_embedding_path() -> str:
    # Prefer symlink if available
    if os.path.islink(EMB_LATEST):
        return os.readlink(EMB_LATEST)
    marker = os.path.join(EMB_ROOT, 'LATEST.txt')
    if os.path.exists(marker):
        return open(marker).read().strip()
    return DEFAULT_BASE_MODEL


def get_embedding_model():
    global _emb_model, _emb_path
    mp = latest_embedding_path()
    if _emb_model is None or _emb_path != mp:
        if _ST is None:
            raise RuntimeError('sentence-transformers is not installed')
        _emb_model = _ST(mp)
        _emb_path = mp
    return _emb_model, mp


@torch.no_grad()
def encode_texts(texts: List[str], batch_size: int = 64) -> np.ndarray:
    model, _ = get_embedding_model()
    arr = model.encode(texts, batch_size=batch_size, convert_to_numpy=True)
    return arr.astype(np.float32)


# ----------------------------
# Data models
# ----------------------------
class Sample(BaseModel):
    text: Optional[str] = None
    emb: Optional[List[float]] = None
    # labels can be: ["leader", "proactive"] (strings) OR indices [0,2]    labels: Optional[List[Optional[Union[int, str]]]] = None


class TrainRequest(BaseModel):
    samples: List[Sample]
    label_space: Optional[List[str]] = None  # if provided, fixes label order
    epochs: int = 5
    batch_size: int = 64
    learning_rate: float = 5e-4
    output_tag: Optional[str] = None
    freeze_embeddings: bool = True  # if False, will fine‑tune SBERT (heavier)


class TrainJobStatus(BaseModel):
    job_id: str
    status: str
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    message: Optional[str] = None
    model_id: Optional[str] = None


class EvalRequest(BaseModel):
    samples: List[Sample]
    model_id: Optional[str] = None


class ScoreRequest(BaseModel):
    text: Optional[str] = None
    emb: Optional[List[float]] = None
    model_id: Optional[str] = None


class SandboxRequest(BaseModel):
    items: List[Sample]
    model_id: Optional[str] = None


# ----------------------------
# Dataset wrappers
# ----------------------------
class TraitDataset(Dataset):
    def __init__(self, X: np.ndarray, Y: np.ndarray):
        assert X.shape[0] == Y.shape[0]
        self.X = X.astype(np.float32)
        self.Y = Y.astype(np.float32)

    def __len__(self):
        return self.X.shape[0]

    def __getitem__(self, idx):
        return self.X[idx], self.Y[idx]


# ----------------------------
# Model
# ----------------------------
class TraitHead(nn.Module):
    def __init__(self, in_dim: int, n_labels: int, hidden: int = 256, dropout: float = 0.1):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, hidden), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(hidden, n_labels)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)  # logits per label


# ----------------------------
# Utilities
# ----------------------------

def _build_label_space(samples: List[Sample], provided: Optional[List[str]]) -> List[str]:
    if provided and len(provided) > 0:
        return list(provided)
    bag = []
    for s in samples:
        if s.labels is None: 
            continue
        for v in s.labels:
            if v is None:
                continue
            if isinstance(v, str):
                bag.append(v)
    uniq = sorted(set(bag))
    if not uniq:
        raise ValueError('Cannot infer label space; please pass label_space')
    return uniq


def _y_to_multi_hot(labels: Optional[List], label_space: List[str]) -> np.ndarray:
    y = np.zeros((len(label_space),), dtype=np.float32)
    if not labels:
        return y
    for v in labels:
        if v is None:
            continue
        if isinstance(v, int):
            if 0 <= v < len(label_space):
                y[v] = 1.0
        elif isinstance(v, str):
            if v in label_space:
                y[label_space.index(v)] = 1.0
    return y


def _make_xy(samples: List[Sample], label_space: List[str]) -> Tuple[np.ndarray, np.ndarray]:
    X_list, Y_list = [], []
    texts_to_embed = []
    idx_need = []
    for i, s in enumerate(samples):
        if s.emb is not None:
            X_list.append(np.asarray(s.emb, dtype=np.float32))
        elif s.text is not None:
            X_list.append(None)  # placeholder
            texts_to_embed.append(s.text)
            idx_need.append(i)
        else:
            raise ValueError('Each sample must have either text or emb')
        Y_list.append(_y_to_multi_hot(s.labels, label_space))

    if idx_need:
        arr = encode_texts(texts_to_embed)
        it = iter(arr)
        for i in range(len(X_list)):
            if X_list[i] is None:
                X_list[i] = next(it)

    X = np.stack(X_list).astype(np.float32)
    Y = np.stack(Y_list).astype(np.float32)
    return X, Y


# ----------------------------
# Training & Eval
# ----------------------------

def _binarize_logits(logits: np.ndarray, threshold: float = 0.5) -> np.ndarray:
    probs = 1.0 / (1.0 + np.exp(-np.clip(logits, -30, 30)))
    return (probs >= threshold).astype(np.int32)


def _f1_micro_macro(y_true: np.ndarray, y_pred: np.ndarray) -> Tuple[float, float]:
    # micro F1
    tp = float((y_true * y_pred).sum())
    fp = float(((1 - y_true) * y_pred).sum())
    fn = float((y_true * (1 - y_pred)).sum())
    prec = tp / max(1.0, tp + fp)
    rec = tp / max(1.0, tp + fn)
    f1_micro = 0.0 if (prec + rec) == 0 else 2 * prec * rec / (prec + rec)
    # macro F1 (per label)
    f1s = []
    for j in range(y_true.shape[1]):
        yt = y_true[:, j]
        yp = y_pred[:, j]
        tp = float((yt * yp).sum())
        fp = float(((1 - yt) * yp).sum())
        fn = float((yt * (1 - yp)).sum())
        prec = tp / max(1.0, tp + fp)
        rec = tp / max(1.0, tp + fn)
        f1 = 0.0 if (prec + rec) == 0 else 2 * prec * rec / (prec + rec)
        f1s.append(f1)
    f1_macro = float(np.mean(f1s)) if f1s else 0.0
    return f1_micro, f1_macro


def _roc_auc_bin(y_true: np.ndarray, y_score: np.ndarray) -> float:
    # Fast AUC for binary labels using Mann–Whitney U
    pos = y_score[y_true == 1]
    neg = y_score[y_true == 0]
    if len(pos) == 0 or len(neg) == 0:
        return float('nan')
    order = np.argsort(np.concatenate([pos, neg]))
    ranks = np.empty_like(order, dtype=float)
    ranks[order] = np.arange(1, len(order) + 1)
    r_pos = ranks[: len(pos)].sum()
    auc = (r_pos - len(pos) * (len(pos) + 1) / 2.0) / (len(pos) * len(neg))
    return float(auc)


def train_once(X: np.ndarray, Y: np.ndarray, epochs: int, batch_size: int, lr: float, out_dir: str) -> None:
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    in_dim = X.shape[1]
    n_labels = Y.shape[1]
    model = TraitHead(in_dim=in_dim, n_labels=n_labels).to(device)

    ds = TraitDataset(X, Y)
    loader = DataLoader(ds, batch_size=batch_size, shuffle=True, drop_last=False)

    criterion = nn.BCEWithLogitsLoss()
    opt = torch.optim.AdamW(model.parameters(), lr=lr)

    model.train()
    for ep in range(epochs):
        total = 0.0
        nsteps = 0
        for xb, yb in loader:
            xb = xb.to(device)
            yb = yb.to(device)
            logits = model(xb)
            loss = criterion(logits, yb)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()
            total += float(loss.item())
            nsteps += 1
        logging.info(f"[traits] epoch {ep+1}/{epochs} loss={total/max(1,nsteps):.4f}")

    # Save
    meta = {
        'objective': 'traits',
        'created_at': datetime.utcnow().strftime('%Y%m%dT%H%M%SZ'),
        'in_dim': in_dim,
        'n_labels': n_labels,
        'labels': None,  # filled by caller
        'base_embeddings': latest_embedding_path(),
    }
    torch.save({'state_dict': model.state_dict(), 'meta': meta}, os.path.join(out_dir, 'model.pt'))

    del model
    gc.collect()


# ----------------------------
# FastAPI app
# ----------------------------
app = FastAPI(title='Trait (Personality) Analysis API')

JOBS: Dict[str, Dict[str, Optional[str]]] = {}


@app.get('/train/health')
def health():
    emb_path = latest_embedding_path()
    cuda = torch.cuda.is_available()
    return {
        'OK': True,
        'data': {
            'status': 'UP',
            'cuda': cuda,
            'base_embeddings': emb_path,
            'models_root': TRAITS_ROOT,
            'latest_model': (os.readlink(TRAITS_LATEST) if os.path.islink(TRAITS_LATEST) else None),
        }
    }


@app.post('/train/train', response_model=TrainJobStatus)
def start_training(req: TrainRequest, bt: BackgroundTasks):
    if not req.samples:
        raise HTTPException(400, 'samples is required and cannot be empty')

    label_space = _build_label_space(req.samples, req.label_space)
    X, Y = _make_xy(req.samples, label_space)
    if X.shape[0] < 10:
        raise HTTPException(400, 'Need at least 10 samples to train traits model')

    ts = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    out_dir = os.path.join(TRAITS_ROOT, f"{ts}{('-' + req.output_tag) if req.output_tag else ''}")
    os.makedirs(out_dir, exist_ok=True)

    job_id = uuid.uuid4().hex[:12]
    job = {
        'job_id': job_id,
        'status': 'PENDING',
        'started_at': None,
        'finished_at': None,
        'message': None,
        'model_id': None,
    }
    JOBS[job_id] = job

    def _run():
        job['status'] = 'RUNNING'
        job['started_at'] = datetime.utcnow().isoformat() + 'Z'
        try:
            train_once(X, Y, req.epochs, req.batch_size, req.learning_rate, out_dir)
            # write meta.json (append labels)
            ck = torch.load(os.path.join(out_dir, 'model.pt'), map_location='cpu')
            meta = ck['meta']
            meta['labels'] = label_space
            json.dump(meta, open(os.path.join(out_dir, 'meta.json'), 'w'), ensure_ascii=False, indent=2)
            torch.save({'state_dict': ck['state_dict'], 'meta': meta}, os.path.join(out_dir, 'model.pt'))

            # Update latest symlink
            try:
                if os.path.islink(TRAITS_LATEST) or os.path.exists(TRAITS_LATEST):
                    os.unlink(TRAITS_LATEST)
                os.symlink(out_dir, TRAITS_LATEST)
            except OSError:
                with open(os.path.join(TRAITS_ROOT, 'LATEST.txt'), 'w') as f:
                    f.write(out_dir)

            job['status'] = 'DONE'
            job['finished_at'] = datetime.utcnow().isoformat() + 'Z'
            job['model_id'] = os.path.basename(out_dir)
            job['message'] = f"Saved model: {job['model_id']} with labels={label_space}"
        except Exception as e:
            logging.exception('Traits training failed')
            job['status'] = 'ERROR'
            job['finished_at'] = datetime.utcnow().isoformat() + 'Z'
            job['message'] = f"{type(e).__name__}: {e}"

    bt.add_task(_run)
    return TrainJobStatus(**job)


@app.get('/train/jobs/{job_id}', response_model=TrainJobStatus)
def job_status(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, 'job not found')
    return TrainJobStatus(**job)


@app.get('/train/models')
def list_models():
    out = []
    if os.path.isdir(TRAITS_ROOT):
        for name in sorted(os.listdir(TRAITS_ROOT)):
            d = os.path.join(TRAITS_ROOT, name)
            if os.path.isdir(d) and os.path.exists(os.path.join(d, 'meta.json')):
                try:
                    meta = json.load(open(os.path.join(d, 'meta.json')))
                except Exception:
                    meta = None
                out.append({'model_id': name, 'meta': meta})
    return {'OK': True, 'data': out}


@app.get('/train/models/{model_id}')
def get_model_meta(model_id: str):
    d = os.path.join(TRAITS_ROOT, model_id)
    if not os.path.isdir(d):
        raise HTTPException(404, 'model not found')
    meta = json.load(open(os.path.join(d, 'meta.json')))
    return {'OK': True, 'data': meta}


# ----------------------------
# Load for inference
# ----------------------------
_loaded_head: Optional[TraitHead] = None
_loaded_meta: Optional[Dict] = None
_loaded_model_id: Optional[str] = None


def _resolve_model_dir(model_id: Optional[str]) -> str:
    if model_id:
        d = os.path.join(TRAITS_ROOT, model_id)
        if not os.path.isdir(d):
            raise HTTPException(404, 'model not found')
        return d
    if os.path.islink(TRAITS_LATEST):
        return os.readlink(TRAITS_LATEST)
    marker = os.path.join(TRAITS_ROOT, 'LATEST.txt')
    if os.path.exists(marker):
        return open(marker).read().strip()
    raise HTTPException(404, 'no trained traits model yet')


def get_traits_model(model_id: Optional[str] = None) -> Tuple[TraitHead, Dict, str]:
    global _loaded_head, _loaded_meta, _loaded_model_id
    model_dir = _resolve_model_dir(model_id)
    if _loaded_head is None or _loaded_model_id != os.path.basename(model_dir):
        ck = torch.load(os.path.join(model_dir, 'model.pt'), map_location='cpu')
        meta = ck['meta']
        m = TraitHead(in_dim=meta['in_dim'], n_labels=meta['n_labels'])
        m.load_state_dict(ck['state_dict'])
        m.eval()
        _loaded_head = m
        _loaded_meta = meta
        _loaded_model_id = os.path.basename(model_dir)
    return _loaded_head, _loaded_meta, _loaded_model_id


# ----------------------------
# Inference endpoints
# ----------------------------
@app.post('/score')
def score(req: ScoreRequest):
    model, meta, mid = get_traits_model(req.model_id)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = model.to(device)

    if req.emb is not None:
        x = np.asarray(req.emb, dtype=np.float32)[None, :]
    elif req.text is not None:
        x = encode_texts([req.text])
    else:
        raise HTTPException(400, 'Provide either text or emb')

    xb = torch.from_numpy(x).to(device)
    logits = model(xb).detach().cpu().numpy()[0]
    probs = 1.0 / (1.0 + np.exp(-np.clip(logits, -30, 30)))

    out = {lbl: float(p) for lbl, p in zip(meta['labels'], probs.tolist())}
    return {'OK': True, 'data': {'model_id': mid, 'labels': meta['labels'], 'probs': out}}


@app.post('/train/inference/sandbox')
def sandbox(req: SandboxRequest):
    model, meta, mid = get_traits_model(req.model_id)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = model.to(device)

    X_list = []
    idx_need = []
    texts_to_embed = []
    for i, it in enumerate(req.items):
        if it.emb is not None:
            X_list.append(np.asarray(it.emb, dtype=np.float32))
        elif it.text is not None:
            X_list.append(None)
            texts_to_embed.append(it.text)
            idx_need.append(i)
        else:
            raise HTTPException(400, 'Each item must provide text or emb')

    if idx_need:
        arr = encode_texts(texts_to_embed)
        it = iter(arr)
        for i in range(len(X_list)):
            if X_list[i] is None:
                X_list[i] = next(it)

    X = torch.from_numpy(np.stack(X_list).astype(np.float32)).to(device)
    logits = model(X).detach().cpu().numpy()
    probs = 1.0 / (1.0 + np.exp(-np.clip(logits, -30, 30)))

    outs = []
    for row in probs.tolist():
        outs.append({lbl: float(p) for lbl, p in zip(meta['labels'], row)})

    return {'OK': True, 'data': outs, 'model_id': mid}


@app.post('/train/evaluate')
def evaluate(req: EvalRequest):
    model, meta, mid = get_traits_model(req.model_id)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = model.to(device)

    if not req.samples:
        raise HTTPException(400, 'samples is required')

    # Build X, Y (Y can be empty if unlabeled)
    label_space = meta['labels']
    X, Y = _make_xy(req.samples, label_space)

    with torch.no_grad():
        logits = []
        B = 256
        for s in range(0, X.shape[0], B):
            xb = torch.from_numpy(X[s:s+B]).to(device)
            lo = model(xb).detach().cpu().numpy()
            logits.append(lo)
        logits = np.concatenate(logits, axis=0)

    y_pred = _binarize_logits(logits)
    f1_micro, f1_macro = _f1_micro_macro(Y, y_pred)

    # per‑label ROC‑AUC
    aucs = []
    for j in range(Y.shape[1]):
        aucs.append(_roc_auc_bin(Y[:, j], logits[:, j]))

    return {
        'OK': True,
        'data': {
            'model_id': mid,
            'n': int(X.shape[0]),
            'labels': label_space,
            'f1_micro': float(f1_micro),
            'f1_macro': float(f1_macro),
            'roc_auc_per_label': [float(a) if not np.isnan(a) else None for a in aucs],
        }
    }


# Dev entry
if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8091)
