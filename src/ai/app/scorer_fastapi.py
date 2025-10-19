from __future__ import annotations

"""
Two‑Tower Matching Scorer (Ranking / Regression)
- Depends only on: fastapi, uvicorn, pydantic, torch, sentence-transformers, nltk, langdetect, orjson (optional)
- Uses the latest embedding model from ./models/embeddings/latest (same convention as your embedding service)
- Trains two objectives:
  (1) pairwise ranking (InfoNCE / in-batch negatives) for candidate generation
  (2) regression / acceptance probability with BCEWithLogits or MSE (auto-chosen from labels)
- Saves models under ./models/matcher/{timestamp[-tag]}/
- Exposes:
    GET  /train/health
    POST /train/train                -> start a training job (objective = 'rank' | 'regression')
    GET  /train/jobs/{job_id}        -> job status
    GET  /train/models               -> list saved models
    GET  /train/models/{model_id}    -> model metadata
    POST /train/evaluate             -> offline evaluation (NDCG/MRR for rank, ROC-AUC/PR-AUC/LogLoss for regression)
    POST /score                      -> single pair scoring
    POST /train/inference/sandbox    -> batch scoring for sandbox/testing

HOW TO RUN
----------
$ uvicorn scorer_fastapi:app --host 0.0.0.0 --port 8090

TIP
---
- Keep your embedding service running so this service can load the same model weights (it loads from disk, not over HTTP).
- If you haven't trained embeddings yet, it will fall back to the base SBERT model.
"""

import os
import io
import gc
import json
import uuid
import math
import time
import logging
from typing import List, Dict, Optional, Literal, Tuple
from datetime import datetime
from typing import TYPE_CHECKING, Optional
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
MATCHER_ROOT = os.path.join(BASE_DIR, 'models', 'matcher')
MATCHER_LATEST = os.path.join(MATCHER_ROOT, 'latest')
LOG_DIR = os.path.join(BASE_DIR, 'logs')

os.makedirs(MATCHER_ROOT, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)

DEFAULT_BASE_MODEL = os.environ.get(
    'BASE_MODEL', 'sentence-transformers/distiluse-base-multilingual-cased-v2'
)

# ----------------------------
# Embedding loader (disk-based)
# ----------------------------
# 런타임엔 별칭으로만 사용
try:
    from sentence_transformers import SentenceTransformer as _ST
except Exception:
    _ST = None

# 타입체커(Pylance, mypy)만 실제 타입 참조
if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer

_emb_model: Optional[SentenceTransformer] = None
_emb_path: Optional[str] = None


def latest_embedding_path() -> str:
    # Prefer symlink if available
    if os.path.islink(EMB_LATEST):
        return os.readlink(EMB_LATEST)
    marker = os.path.join(EMB_ROOT, 'LATEST.txt')
    if os.path.exists(marker):
        return open(marker).read().strip()
    return DEFAULT_BASE_MODEL


def get_embedding_model() -> tuple[SentenceTransformer, str]:
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
# Models
# ----------------------------
class TwoTower(nn.Module):
    """Two small MLP towers; can serve both ranking (dot-product) and regression (extra head)."""
    def __init__(self, in_dim: int, proj_dim: int = 128, hidden: int = 256, dropout: float = 0.2):
        super().__init__()
        self.user = nn.Sequential(
            nn.Linear(in_dim, hidden), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(hidden, proj_dim)
        )
        self.proj = nn.Sequential(
            nn.Linear(in_dim, hidden), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(hidden, proj_dim)
        )
        # Regression head takes concat of [u,p,|u-p|,u*p]
        self.reg_head = nn.Sequential(
            nn.Linear(proj_dim * 4, hidden), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(hidden, hidden // 2), nn.ReLU(),
            nn.Linear(hidden // 2, 1)
        )

    def forward_user(self, x: torch.Tensor) -> torch.Tensor:
        return F.normalize(self.user(x), dim=-1)

    def forward_proj(self, x: torch.Tensor) -> torch.Tensor:
        return F.normalize(self.proj(x), dim=-1)

    def score_matrix(self, u: torch.Tensor, p: torch.Tensor) -> torch.Tensor:
        # (B,D) x (D,B) -> (B,B)
        return u @ p.t()

    def regress(self, u: torch.Tensor, p: torch.Tensor) -> torch.Tensor:
        z = torch.cat([u, p, torch.abs(u - p), u * p], dim=-1)
        return self.reg_head(z).squeeze(-1)  # (B,)


# ----------------------------
# Data utilities
# ----------------------------
class Pair(BaseModel):
    user_id: Optional[str] = None  # for ranking group / evaluation
    project_id: Optional[str] = None
    user_text: Optional[str] = None
    project_text: Optional[str] = None
    user_emb: Optional[List[float]] = None
    project_emb: Optional[List[float]] = None
    label: Optional[float] = None   # 1/0 or [0,1] for regression; positive samples for ranking should have label=1


class TrainRequest(BaseModel):
    objective: Literal['rank', 'regression'] = 'rank'
    pairs: List[Pair]
    epochs: int = 3
    batch_size: int = 64
    learning_rate: float = 1e-3
    margin: float = 0.2  # only used if we switch to margin loss (not used by default)
    output_tag: Optional[str] = None
    # If texts are used, we embed with the latest embeddings model.


class TrainJobStatus(BaseModel):
    job_id: str
    status: str
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    message: Optional[str] = None
    model_id: Optional[str] = None


class ScoreRequest(BaseModel):
    user_text: Optional[str] = None
    project_text: Optional[str] = None
    user_emb: Optional[List[float]] = None
    project_emb: Optional[List[float]] = None
    as_probability: bool = True  # for regression models
    model_id: Optional[str] = None  # choose a specific saved model; otherwise use latest


class SandboxRequest(BaseModel):
    pairs: List[Pair]
    model_id: Optional[str] = None


class EvalRequest(BaseModel):
    objective: Literal['rank', 'regression']
    pairs: List[Pair]
    k: int = 10  # for ranking metrics
    model_id: Optional[str] = None


# ----------------------------
# Dataset wrappers
# ----------------------------
class RankDataset(Dataset):
    """Each sample is a positive (u, p_pos).
    Negatives are other p in the same batch (in-batch negatives, InfoNCE style)."""
    def __init__(self, user_vecs: np.ndarray, proj_vecs: np.ndarray, user_ids: List[str]):
        assert user_vecs.shape == proj_vecs.shape
        self.u = user_vecs
        self.p = proj_vecs
        self.user_ids = user_ids  # may be used later

    def __len__(self):
        return self.u.shape[0]

    def __getitem__(self, idx):
        return self.u[idx], self.p[idx]


class RegDataset(Dataset):
    def __init__(self, user_vecs: np.ndarray, proj_vecs: np.ndarray, labels: np.ndarray):
        assert user_vecs.shape == proj_vecs.shape
        assert user_vecs.shape[0] == labels.shape[0]
        self.u = user_vecs
        self.p = proj_vecs
        self.y = labels.astype(np.float32)

    def __len__(self):
        return self.u.shape[0]

    def __getitem__(self, idx):
        return self.u[idx], self.p[idx], self.y[idx]


# ----------------------------
# Training routines
# ----------------------------

def _make_embs_from_pairs(pairs: List[Pair]) -> Tuple[np.ndarray, np.ndarray, List[str]]:
    """Return aligned user/proj embeddings (only for positive pairs).
    - If emb fields are provided, use them.
    - Else, embed texts via SentenceTransformer.
    - Returns (U, P, user_ids_for_each_pair)
    """
    u_texts, p_texts = [], []
    U_list, P_list = [], []
    user_ids = []
    for r in pairs:
        if r.label is not None and float(r.label) <= 0:
            # for ranking we keep only positives; caller will pass only positives
            pass
        if r.user_emb is not None and r.project_emb is not None:
            U_list.append(np.asarray(r.user_emb, dtype=np.float32))
            P_list.append(np.asarray(r.project_emb, dtype=np.float32))
        elif r.user_text is not None and r.project_text is not None:
            u_texts.append(r.user_text)
            p_texts.append(r.project_text)
            U_list.append(None)  # placeholders
            P_list.append(None)
        else:
            raise ValueError('Each pair must provide either (user_text, project_text) or (user_emb, project_emb).')
        user_ids.append(r.user_id or str(len(user_ids)))

    # Embed missing
    if u_texts:
        u_emb = encode_texts(u_texts)
        p_emb = encode_texts(p_texts)
        it = iter(u_emb)
        jt = iter(p_emb)
        for i in range(len(U_list)):
            if U_list[i] is None:
                U_list[i] = next(it)
                P_list[i] = next(jt)

    U = np.stack(U_list).astype(np.float32)
    P = np.stack(P_list).astype(np.float32)
    return U, P, user_ids


def train_rank(
    pairs_pos: List[Pair], epochs: int, batch_size: int, lr: float, output_tag: Optional[str]
) -> str:
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    U, P, user_ids = _make_embs_from_pairs([r for r in pairs_pos if r.label is None or float(r.label) > 0])
    in_dim = U.shape[1]
    model = TwoTower(in_dim=in_dim).to(device)

    ds = RankDataset(U, P, user_ids)
    loader = DataLoader(ds, batch_size=batch_size, shuffle=True, drop_last=True)

    opt = torch.optim.AdamW(model.parameters(), lr=lr)

    # output dir
    ts = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    out_dir = os.path.join(MATCHER_ROOT, f"{ts}{('-' + output_tag) if output_tag else ''}")
    os.makedirs(out_dir, exist_ok=True)

    model.train()
    for ep in range(epochs):
        total = 0.0
        nsteps = 0
        for (u_np, p_np) in loader:
            u = torch.from_numpy(np.asarray(u_np)).to(device)
            p = torch.from_numpy(np.asarray(p_np)).to(device)
            u = model.forward_user(u)
            p = model.forward_proj(p)
            logits = model.score_matrix(u, p)  # (B,B)
            target = torch.arange(logits.shape[0], device=device)
            loss = F.cross_entropy(logits, target)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()
            total += float(loss.item())
            nsteps += 1
        logging.info(f"[rank] epoch {ep+1}/{epochs} loss={total/max(1,nsteps):.4f}")

    # Save
    meta = {
        'objective': 'rank',
        'created_at': ts,
        'in_dim': in_dim,
        'proj_dim': 128,
        'base_embeddings': latest_embedding_path(),
    }
    torch.save({'state_dict': model.state_dict(), 'meta': meta}, os.path.join(out_dir, 'model.pt'))
    with open(os.path.join(out_dir, 'meta.json'), 'w') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    # Update latest symlink
    try:
        if os.path.islink(MATCHER_LATEST) or os.path.exists(MATCHER_LATEST):
            os.unlink(MATCHER_LATEST)
        os.symlink(out_dir, MATCHER_LATEST)
    except OSError:
        with open(os.path.join(MATCHER_ROOT, 'LATEST.txt'), 'w') as f:
            f.write(out_dir)

    del model
    gc.collect()
    return os.path.basename(out_dir)


def train_reg(
    pairs: List[Pair], epochs: int, batch_size: int, lr: float, output_tag: Optional[str]
) -> str:
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    # keep only labeled
    labeled = [r for r in pairs if r.label is not None]
    if not labeled:
        raise ValueError('Regression requires labels in pairs[].label (0/1 or 0..1).')

    U, P, _ = _make_embs_from_pairs(labeled)
    y = np.array([float(r.label) for r in labeled], dtype=np.float32)

    in_dim = U.shape[1]
    model = TwoTower(in_dim=in_dim).to(device)

    ds = RegDataset(U, P, y)
    loader = DataLoader(ds, batch_size=batch_size, shuffle=True, drop_last=False)

    # Decide loss: if labels ∈ {0,1} -> BCEWithLogits; else -> MSE
    is_binary = np.all((y == 0) | (y == 1))
    if is_binary:
        criterion = nn.BCEWithLogitsLoss()
    else:
        criterion = nn.MSELoss()

    opt = torch.optim.AdamW(model.parameters(), lr=lr)

    ts = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    out_dir = os.path.join(MATCHER_ROOT, f"{ts}{('-' + output_tag) if output_tag else ''}")
    os.makedirs(out_dir, exist_ok=True)

    model.train()
    for ep in range(epochs):
        total = 0.0
        nsteps = 0
        for (u_np, p_np, y_np) in loader:
            u = torch.from_numpy(np.asarray(u_np)).to(device)
            p = torch.from_numpy(np.asarray(p_np)).to(device)
            yb = torch.from_numpy(np.asarray(y_np)).to(device)
            u = model.forward_user(u)
            p = model.forward_proj(p)
            logits = model.regress(u, p)
            loss = criterion(logits, yb)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()
            total += float(loss.item())
            nsteps += 1
        logging.info(f"[reg] epoch {ep+1}/{epochs} loss={total/max(1,nsteps):.4f}")

    meta = {
        'objective': 'regression',
        'created_at': ts,
        'in_dim': in_dim,
        'proj_dim': 128,
        'binary': bool(is_binary),
        'base_embeddings': latest_embedding_path(),
    }
    torch.save({'state_dict': model.state_dict(), 'meta': meta}, os.path.join(out_dir, 'model.pt'))
    with open(os.path.join(out_dir, 'meta.json'), 'w') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    try:
        if os.path.islink(MATCHER_LATEST) or os.path.exists(MATCHER_LATEST):
            os.unlink(MATCHER_LATEST)
        os.symlink(out_dir, MATCHER_LATEST)
    except OSError:
        with open(os.path.join(MATCHER_ROOT, 'LATEST.txt'), 'w') as f:
            f.write(out_dir)

    del model
    gc.collect()
    return os.path.basename(out_dir)


# ----------------------------
# Load saved model for inference
# ----------------------------
_loaded_matcher: Optional[TwoTower] = None
_loaded_meta: Optional[Dict] = None
_loaded_model_id: Optional[str] = None


def _resolve_model_dir(model_id: Optional[str]) -> str:
    if model_id:
        d = os.path.join(MATCHER_ROOT, model_id)
        if not os.path.isdir(d):
            raise HTTPException(404, 'model not found')
        return d
    if os.path.islink(MATCHER_LATEST):
        return os.readlink(MATCHER_LATEST)
    marker = os.path.join(MATCHER_ROOT, 'LATEST.txt')
    if os.path.exists(marker):
        return open(marker).read().strip()
    raise HTTPException(404, 'no trained matcher model yet')


def get_matcher(model_id: Optional[str] = None) -> Tuple[TwoTower, Dict, str]:
    global _loaded_matcher, _loaded_meta, _loaded_model_id
    model_dir = _resolve_model_dir(model_id)
    if _loaded_matcher is None or _loaded_model_id != os.path.basename(model_dir):
        ckpt = torch.load(os.path.join(model_dir, 'model.pt'), map_location='cpu')
        meta = ckpt['meta']
        m = TwoTower(in_dim=meta['in_dim'])
        m.load_state_dict(ckpt['state_dict'])
        m.eval()
        _loaded_matcher = m
        _loaded_meta = meta
        _loaded_model_id = os.path.basename(model_dir)
    return _loaded_matcher, _loaded_meta, _loaded_model_id


# ----------------------------
# Metrics
# ----------------------------

def _roc_auc(y_true: np.ndarray, y_score: np.ndarray) -> float:
    # Mann–Whitney U based fast AUC for binary labels 0/1
    pos = y_score[y_true == 1]
    neg = y_score[y_true == 0]
    if len(pos) == 0 or len(neg) == 0:
        return float('nan')
    # Rank all scores
    order = np.argsort(np.concatenate([pos, neg]))
    ranks = np.empty_like(order, dtype=float)
    ranks[order] = np.arange(1, len(order) + 1)
    r_pos = ranks[: len(pos)].sum()
    auc = (r_pos - len(pos) * (len(pos) + 1) / 2.0) / (len(pos) * len(neg))
    return float(auc)


def _pr_auc(y_true: np.ndarray, y_score: np.ndarray) -> float:
    # Simple PR-AUC via step-wise integration
    order = np.argsort(-y_score)
    y_true = y_true[order]
    tp = 0
    fp = 0
    precisions = []
    recalls = []
    P = float((y_true == 1).sum())
    if P == 0:
        return float('nan')
    for y in y_true:
        if y == 1:
            tp += 1
        else:
            fp += 1
        precisions.append(tp / max(1, (tp + fp)))
        recalls.append(tp / P)
    # Trapezoidal area (recall increases monotonic)
    auc = 0.0
    prev_r, prev_p = 0.0, 1.0
    for r, p in zip(recalls, precisions):
        auc += (r - prev_r) * ((p + prev_p) / 2.0)
        prev_r, prev_p = r, p
    return float(auc)


def _log_loss(y_true: np.ndarray, y_logit: np.ndarray) -> float:
    # y_logit are raw logits; apply sigmoid safely
    y_prob = 1.0 / (1.0 + np.exp(-np.clip(y_logit, -30, 30)))
    eps = 1e-12
    y_prob = np.clip(y_prob, eps, 1 - eps)
    loss = -(y_true * np.log(y_prob) + (1 - y_true) * np.log(1 - y_prob))
    return float(loss.mean())


def _ndcg_at_k(rels: List[float], k: int) -> float:
    k = min(k, len(rels))
    if k == 0:
        return 0.0
    dcg = 0.0
    for i in range(k):
        dcg += (2 ** rels[i] - 1) / math.log2(i + 2)
    # Ideal DCG
    ideal = sorted(rels, reverse=True)
    idcg = 0.0
    for i in range(k):
        idcg += (2 ** ideal[i] - 1) / math.log2(i + 2)
    return float(dcg / idcg) if idcg > 0 else 0.0


def _mrr(rels: List[float]) -> float:
    for i, r in enumerate(rels, start=1):
        if r > 0:
            return 1.0 / i
    return 0.0


# ----------------------------
# FastAPI app
# ----------------------------
app = FastAPI(title='Matching Scorer API')

JOBS: Dict[str, Dict[str, Optional[str]]] = {}


@app.get('/train/health')
def health():
    # basic environment check
    emb_path = latest_embedding_path()
    cuda = torch.cuda.is_available()
    return {
        'OK': True,
        'data': {
            'status': 'UP',
            'cuda': cuda,
            'base_embeddings': emb_path,
            'models_root': MATCHER_ROOT,
            'latest_model': (os.readlink(MATCHER_LATEST) if os.path.islink(MATCHER_LATEST) else None),
        }
    }


@app.post('/train/train', response_model=TrainJobStatus)
def start_training(req: TrainRequest, bt: BackgroundTasks):
    if not req.pairs:
        raise HTTPException(400, 'pairs is required and cannot be empty')

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
            if req.objective == 'rank':
                mid = train_rank(req.pairs, req.epochs, req.batch_size, req.learning_rate, req.output_tag)
            else:
                mid = train_reg(req.pairs, req.epochs, req.batch_size, req.learning_rate, req.output_tag)
            job['status'] = 'DONE'
            job['finished_at'] = datetime.utcnow().isoformat() + 'Z'
            job['model_id'] = mid
            job['message'] = f"Saved model: {mid}"
        except Exception as e:
            logging.exception('Training failed')
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
    if os.path.isdir(MATCHER_ROOT):
        for name in sorted(os.listdir(MATCHER_ROOT)):
            d = os.path.join(MATCHER_ROOT, name)
            if os.path.isdir(d) and os.path.exists(os.path.join(d, 'meta.json')):
                try:
                    meta = json.load(open(os.path.join(d, 'meta.json')))
                except Exception:
                    meta = None
                out.append({'model_id': name, 'meta': meta})
    return {'OK': True, 'data': out}


@app.get('/train/models/{model_id}')
def get_model_meta(model_id: str):
    d = os.path.join(MATCHER_ROOT, model_id)
    if not os.path.isdir(d):
        raise HTTPException(404, 'model not found')
    meta = json.load(open(os.path.join(d, 'meta.json')))
    return {'OK': True, 'data': meta}


@app.post('/score')
def score(req: ScoreRequest):
    model, meta, mid = get_matcher(req.model_id)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = model.to(device)

    # Prepare embeddings
    if req.user_emb is not None and req.project_emb is not None:
        u = np.asarray(req.user_emb, dtype=np.float32)[None, :]
        p = np.asarray(req.project_emb, dtype=np.float32)[None, :]
    elif req.user_text and req.project_text:
        u = encode_texts([req.user_text])
        p = encode_texts([req.project_text])
    else:
        raise HTTPException(400, 'Provide either (user_text, project_text) or (user_emb, project_emb).')

    u_t = torch.from_numpy(u).to(device)
    p_t = torch.from_numpy(p).to(device)

    u_z = model.forward_user(u_t)
    p_z = model.forward_proj(p_t)

    if meta['objective'] == 'rank':
        s = float((u_z @ p_z.t()).item())
        return {'OK': True, 'data': {'model_id': mid, 'objective': 'rank', 'score': s}}
    else:
        logit = float(model.regress(u_z, p_z).item())
        if req.as_probability:
            prob = 1.0 / (1.0 + math.exp(-max(min(logit, 30), -30)))
            return {'OK': True, 'data': {'model_id': mid, 'objective': 'regression', 'logit': logit, 'prob': prob}}
        return {'OK': True, 'data': {'model_id': mid, 'objective': 'regression', 'logit': logit}}


@app.post('/train/inference/sandbox')
def sandbox(req: SandboxRequest):
    model, meta, mid = get_matcher(req.model_id)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = model.to(device)

    # Build batch
    u_list, p_list, ids = [], [], []
    for r in req.pairs:
        if r.user_emb is not None and r.project_emb is not None:
            u_list.append(np.asarray(r.user_emb, dtype=np.float32))
            p_list.append(np.asarray(r.project_emb, dtype=np.float32))
        elif r.user_text and r.project_text:
            u_list.append(None)
            p_list.append(None)
            ids.append((r.user_id, r.project_id))
        else:
            raise HTTPException(400, 'Each pair must provide either embeddings or texts.')

    # Embed missing
    idx_missing = [i for i, v in enumerate(u_list) if v is None]
    if idx_missing:
        u_texts = [req.pairs[i].user_text for i in idx_missing]
        p_texts = [req.pairs[i].project_text for i in idx_missing]
        uu = encode_texts(u_texts)
        pp = encode_texts(p_texts)
        for k, i in enumerate(idx_missing):
            u_list[i] = uu[k]
            p_list[i] = pp[k]

    U = torch.from_numpy(np.stack(u_list).astype(np.float32)).to(device)
    P = torch.from_numpy(np.stack(p_list).astype(np.float32)).to(device)

    u_z = model.forward_user(U)
    p_z = model.forward_proj(P)

    if meta['objective'] == 'rank':
        scores = (u_z * p_z).sum(dim=1).detach().cpu().numpy().tolist()
        out = [{'score': float(s)} for s in scores]
    else:
        logits = model.regress(u_z, p_z).detach().cpu().numpy()
        probs = 1.0 / (1.0 + np.exp(-np.clip(logits, -30, 30)))
        out = [{'logit': float(a), 'prob': float(b)} for a, b in zip(logits.tolist(), probs.tolist())]

    return {'OK': True, 'data': out, 'model_id': mid, 'objective': meta['objective']}


@app.post('/train/evaluate')
def evaluate(req: EvalRequest):
    model, meta, mid = get_matcher(req.model_id)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = model.to(device)

    if req.objective == 'regression':
        labeled = [r for r in req.pairs if r.label is not None]
        if not labeled:
            raise HTTPException(400, 'regression eval requires labeled pairs')
        U, P, _ = _make_embs_from_pairs(labeled)
        U = torch.from_numpy(U).to(device)
        P = torch.from_numpy(P).to(device)
        u_z = model.forward_user(U)
        p_z = model.forward_proj(P)
        logits = model.regress(u_z, p_z).detach().cpu().numpy()
        y = np.array([float(r.label) for r in labeled], dtype=np.float32)
        # Metrics
        auc = _roc_auc((y > 0.5).astype(np.int32), logits)
        pr = _pr_auc((y > 0.5).astype(np.int32), 1.0 / (1.0 + np.exp(-np.clip(logits, -30, 30))))
        logloss = _log_loss((y > 0.5).astype(np.float32), logits)
        mae = float(np.mean(np.abs(1.0 / (1.0 + np.exp(-np.clip(logits, -30, 30))) - y)))
        return {
            'OK': True,
            'data': {
                'model_id': mid,
                'objective': 'regression',
                'n': len(y),
                'roc_auc': auc,
                'pr_auc': pr,
                'log_loss': logloss,
                'mae_prob': mae,
            }
        }
    else:
        # Ranking evaluation expects grouped candidates per user_id
        # Collect by user_id
        by_user: Dict[str, List[Tuple[Pair, float]]] = {}
        # First score all
        # Embed on the fly for memory efficiency
        scored: List[Tuple[str, float]] = []
        # Batch encode to be efficient
        # Build all embeddings
        U_list, P_list, U_ids = [], [], []
        for r in req.pairs:
            if r.user_text and r.project_text:
                U_list.append(r.user_text)
                P_list.append(r.project_text)
            elif r.user_emb is not None and r.project_emb is not None:
                U_list.append(None)
                P_list.append(None)
            else:
                raise HTTPException(400, 'Each pair must provide texts or embeddings')
            U_ids.append(r.user_id or 'u')
        # Embed texts in bulk
        idx_missing = [i for i, v in enumerate(U_list) if v is not None]
        U_emb = [None] * len(U_list)
        P_emb = [None] * len(P_list)
        if idx_missing:
            uu = encode_texts([U_list[i] for i in idx_missing])
            pp = encode_texts([P_list[i] for i in idx_missing])
            for k, i in enumerate(idx_missing):
                U_emb[i] = uu[k]
                P_emb[i] = pp[k]
        # Fill provided embeddings
        for i, r in enumerate(req.pairs):
            if U_emb[i] is None:
                U_emb[i] = np.asarray(r.user_emb, dtype=np.float32)
                P_emb[i] = np.asarray(r.project_emb, dtype=np.float32)
        # Now score in batches
        batch = 256
        scores = []
        for s in range(0, len(U_emb), batch):
            U = torch.from_numpy(np.stack(U_emb[s:s+batch]).astype(np.float32)).to(device)
            P = torch.from_numpy(np.stack(P_emb[s:s+batch]).astype(np.float32)).to(device)
            u_z = model.forward_user(U)
            p_z = model.forward_proj(P)
            sc = (u_z * p_z).sum(dim=1).detach().cpu().numpy().tolist()
            scores.extend(sc)
        # Group and compute metrics
        groups: Dict[str, List[Tuple[float, float]]] = {}
        for r, s, uid in zip(req.pairs, scores, U_ids):
            rel = float(r.label or 0.0)
            groups.setdefault(uid, []).append((s, rel))
        ndcgs = []
        mrrs = []
        for uid, items in groups.items():
            items.sort(key=lambda x: x[0], reverse=True)  # by score desc
            rels = [rel for _, rel in items]
            ndcgs.append(_ndcg_at_k(rels, req.k))
            mrrs.append(_mrr(rels))
        return {
            'OK': True,
            'data': {
                'model_id': mid,
                'objective': 'rank',
                'queries': len(groups),
                'ndcg@{}'.format(req.k): float(np.mean(ndcgs)) if ndcgs else 0.0,
                'mrr': float(np.mean(mrrs)) if mrrs else 0.0,
            }
        }


# Dev entry
if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8090)
