from __future__ import annotations
"""
User↔User Matching Scorer API (Ranking / Regression)
- Mirrors the endpoints/behavior of your two‑tower scorer (user↔project) but specialized for user↔user.
- Facet-aware text inputs (skill / trait / activity / profile) are embedded with the same
  SentenceTransformer used by your existing service. Each user is represented by
  the concatenation [emb(skill), emb(trait), emb(activity)], where missing facets
  fall back to profile_text.

Exposed endpoints
-----------------
GET  /train/health
POST /train/train                -> start a training job (objective = 'rank' | 'regression')
GET  /train/jobs/{job_id}        -> job status
GET  /train/models               -> list saved models
GET  /train/models/{model_id}    -> model metadata
POST /train/evaluate             -> offline evaluation (NDCG/MRR for rank, ROC-AUC/PR-AUC/LogLoss for regression)
POST /score                      -> single pair scoring
POST /train/inference/sandbox    -> batch scoring for sandbox/testing

How to run
----------
$ uvicorn scorer_fastapi_useruser:app --host 0.0.0.0 --port 8091

Notes
-----
- Loads the latest embedding model from ./models/embeddings/latest if present, otherwise BASE_MODEL.
- Saves trained matcher models under ./models/useruser_matcher/{timestamp[-tag]}/ and maintains a 'latest' pointer.
- Compatible with your scorer_fastapi flow and curl usage.
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
from typing import TYPE_CHECKING

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
UUM_ROOT = os.path.join(BASE_DIR, 'models', 'useruser_matcher')
UUM_LATEST = os.path.join(UUM_ROOT, 'latest')
LOG_DIR = os.path.join(BASE_DIR, 'logs')

os.makedirs(UUM_ROOT, exist_ok=True)
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

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer

_emb_model: Optional["SentenceTransformer"] = None
_emb_path: Optional[str] = None


def latest_embedding_path() -> str:
    # Prefer symlink if available
    if os.path.islink(EMB_LATEST):
        return os.readlink(EMB_LATEST)
    marker = os.path.join(EMB_ROOT, 'LATEST.txt')
    if os.path.exists(marker):
        return open(marker).read().strip()
    return DEFAULT_BASE_MODEL


def get_embedding_model() -> tuple["SentenceTransformer", str]:
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
# Facet utilities
# ----------------------------
class UserFacet(BaseModel):
    id: Optional[str] = None
    skill_text: Optional[str] = None
    trait_text: Optional[str] = None
    activity_text: Optional[str] = None
    profile_text: Optional[str] = None  # fallback for missing facets

    # Optional precomputed fused embedding (D*3,) where D is base embedding dim
    fused_emb: Optional[List[float]] = None


def _facet_texts(u: UserFacet) -> tuple[str, str, str]:
    st = u.skill_text or u.profile_text or ''
    tt = u.trait_text or u.profile_text or ''
    at = u.activity_text or u.profile_text or ''
    # Prefix tags help the encoder disambiguate semantics
    return f"[SKILL] {st}", f"[TRAIT] {tt}", f"[ACTIVITY] {at}"


@torch.no_grad()
def fuse_user_embedding(u: UserFacet) -> np.ndarray:
    """Return concatenated facet embedding: [emb(skill), emb(trait), emb(activity)]."""
    if u.fused_emb is not None:
        return np.asarray(u.fused_emb, dtype=np.float32)
    s, t, a = _facet_texts(u)
    embs = encode_texts([s, t, a])  # (3,D)
    return embs.reshape(-1).astype(np.float32)  # (3D,)


# ----------------------------
# Model (two-tower)
# ----------------------------
class TwoTower(nn.Module):
    def __init__(self, in_dim: int, proj_dim: int = 128, hidden: int = 256, dropout: float = 0.2):
        super().__init__()
        self.q = nn.Sequential(
            nn.Linear(in_dim, hidden), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(hidden, proj_dim)
        )
        self.c = nn.Sequential(
            nn.Linear(in_dim, hidden), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(hidden, proj_dim)
        )
        self.reg_head = nn.Sequential(
            nn.Linear(proj_dim * 4, hidden), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(hidden, hidden // 2), nn.ReLU(),
            nn.Linear(hidden // 2, 1)
        )

    def forward_q(self, x: torch.Tensor) -> torch.Tensor:
        return F.normalize(self.q(x), dim=-1)

    def forward_c(self, x: torch.Tensor) -> torch.Tensor:
        return F.normalize(self.c(x), dim=-1)

    def score_matrix(self, q: torch.Tensor, c: torch.Tensor) -> torch.Tensor:
        return q @ c.t()

    def regress(self, q: torch.Tensor, c: torch.Tensor) -> torch.Tensor:
        z = torch.cat([q, c, torch.abs(q - c), q * c], dim=-1)
        return self.reg_head(z).squeeze(-1)


# ----------------------------
# Schemas
# ----------------------------
class Priority(BaseModel):
    w1: float = 0.5  # skill
    w2: float = 0.3  # trait
    w3: float = 0.2  # activity


class UUPair(BaseModel):
    user_q: UserFacet
    user_c: UserFacet
    user_id: Optional[str] = None  # for ranking group / evaluation
    label: Optional[float] = None  # 1/0 or 0..1 (regression)
    priority_weights: Optional[Priority] = None  # used only for reporting in /score


class TrainRequest(BaseModel):
    objective: Literal['rank', 'regression'] = 'rank'
    pairs: List[UUPair]
    epochs: int = 3
    batch_size: int = 64
    learning_rate: float = 1e-3
    output_tag: Optional[str] = None


class TrainJobStatus(BaseModel):
    job_id: str
    status: str
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    message: Optional[str] = None
    model_id: Optional[str] = None


class ScoreRequest(BaseModel):
    item: UUPair
    as_probability: bool = True
    model_id: Optional[str] = None


class SandboxRequest(BaseModel):
    items: List[UUPair]
    as_probability: bool = True
    model_id: Optional[str] = None


class EvalRequest(BaseModel):
    objective: Literal['rank', 'regression']
    pairs: List[UUPair]
    k: int = 10
    model_id: Optional[str] = None


# ----------------------------
# Datasets
# ----------------------------
class RankDataset(Dataset):
    def __init__(self, Q: np.ndarray, C: np.ndarray, user_ids: List[str]):
        assert Q.shape == C.shape
        self.Q = Q
        self.C = C
        self.user_ids = user_ids

    def __len__(self):
        return self.Q.shape[0]

    def __getitem__(self, idx):
        return self.Q[idx], self.C[idx]


class RegDataset(Dataset):
    def __init__(self, Q: np.ndarray, C: np.ndarray, y: np.ndarray):
        assert Q.shape == C.shape
        assert Q.shape[0] == y.shape[0]
        self.Q = Q
        self.C = C
        self.y = y.astype(np.float32)

    def __len__(self):
        return self.Q.shape[0]

    def __getitem__(self, idx):
        return self.Q[idx], self.C[idx], self.y[idx]


# ----------------------------
# Helpers: build embeddings from pairs
# ----------------------------

def _make_embs_from_pairs(pairs: List[UUPair]) -> Tuple[np.ndarray, np.ndarray, List[str]]:
    Q_list: List[np.ndarray] = []
    C_list: List[np.ndarray] = []
    user_ids: List[str] = []
    for r in pairs:
        q = fuse_user_embedding(r.user_q)
        c = fuse_user_embedding(r.user_c)
        Q_list.append(q)
        C_list.append(c)
        user_ids.append(r.user_id or str(len(user_ids)))
    Q = np.stack(Q_list).astype(np.float32)
    C = np.stack(C_list).astype(np.float32)
    return Q, C, user_ids


# ----------------------------
# Training
# ----------------------------

def train_rank(pairs_pos: List[UUPair], epochs: int, batch_size: int, lr: float, output_tag: Optional[str]) -> str:
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    # keep only positives
    pos = [r for r in pairs_pos if r.label is None or float(r.label) > 0]
    if not pos:
        raise ValueError('Ranking requires at least one positive pair (label=1).')
    Q, C, user_ids = _make_embs_from_pairs(pos)
    in_dim = Q.shape[1]

    model = TwoTower(in_dim=in_dim).to(device)
    ds = RankDataset(Q, C, user_ids)
    loader = DataLoader(ds, batch_size=batch_size, shuffle=True, drop_last=True)
    opt = torch.optim.AdamW(model.parameters(), lr=lr)

    ts = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    out_dir = os.path.join(UUM_ROOT, f"{ts}{('-' + output_tag) if output_tag else ''}")
    os.makedirs(out_dir, exist_ok=True)

    model.train()
    for ep in range(epochs):
        total = 0.0
        steps = 0
        for Q_np, C_np in loader:
            q = torch.from_numpy(np.asarray(Q_np)).to(device)
            c = torch.from_numpy(np.asarray(C_np)).to(device)
            qz = model.forward_q(q)
            cz = model.forward_c(c)
            logits = model.score_matrix(qz, cz)
            target = torch.arange(logits.shape[0], device=device)
            loss = F.cross_entropy(logits, target)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()
            total += float(loss.item())
            steps += 1
        logging.info(f"[uu-rank] epoch {ep+1}/{epochs} loss={total/max(1,steps):.4f}")

    meta = {
        'objective': 'rank',
        'created_at': ts,
        'in_dim': in_dim,
        'proj_dim': 128,
        'base_embeddings': latest_embedding_path(),
        'facets': ['skill', 'trait', 'activity'],
    }
    torch.save({'state_dict': model.state_dict(), 'meta': meta}, os.path.join(out_dir, 'model.pt'))
    with open(os.path.join(out_dir, 'meta.json'), 'w') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    # update latest
    try:
        if os.path.islink(UUM_LATEST) or os.path.exists(UUM_LATEST):
            os.unlink(UUM_LATEST)
        os.symlink(out_dir, UUM_LATEST)
    except OSError:
        with open(os.path.join(UUM_ROOT, 'LATEST.txt'), 'w') as f:
            f.write(out_dir)

    del model
    gc.collect()
    return os.path.basename(out_dir)


def train_reg(pairs: List[UUPair], epochs: int, batch_size: int, lr: float, output_tag: Optional[str]) -> str:
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    labeled = [r for r in pairs if r.label is not None]
    if not labeled:
        raise ValueError('Regression requires labels in pairs[].label (0/1 or 0..1).')

    Q, C, _ = _make_embs_from_pairs(labeled)
    y = np.array([float(r.label) for r in labeled], dtype=np.float32)

    in_dim = Q.shape[1]
    model = TwoTower(in_dim=in_dim).to(device)
    ds = RegDataset(Q, C, y)
    loader = DataLoader(ds, batch_size=batch_size, shuffle=True, drop_last=False)

    is_binary = np.all((y == 0) | (y == 1))
    criterion = nn.BCEWithLogitsLoss() if is_binary else nn.MSELoss()
    opt = torch.optim.AdamW(model.parameters(), lr=lr)

    ts = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    out_dir = os.path.join(UUM_ROOT, f"{ts}{('-' + output_tag) if output_tag else ''}")
    os.makedirs(out_dir, exist_ok=True)

    model.train()
    for ep in range(epochs):
        total = 0.0
        steps = 0
        for Q_np, C_np, y_np in loader:
            q = torch.from_numpy(np.asarray(Q_np)).to(device)
            c = torch.from_numpy(np.asarray(C_np)).to(device)
            yb = torch.from_numpy(np.asarray(y_np)).to(device)
            qz = model.forward_q(q)
            cz = model.forward_c(c)
            logits = model.regress(qz, cz)
            loss = criterion(logits, yb)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()
            total += float(loss.item())
            steps += 1
        logging.info(f"[uu-reg] epoch {ep+1}/{epochs} loss={total/max(1,steps):.4f}")

    meta = {
        'objective': 'regression',
        'created_at': ts,
        'in_dim': in_dim,
        'proj_dim': 128,
        'binary': bool(is_binary),
        'base_embeddings': latest_embedding_path(),
        'facets': ['skill', 'trait', 'activity'],
    }
    torch.save({'state_dict': model.state_dict(), 'meta': meta}, os.path.join(out_dir, 'model.pt'))
    with open(os.path.join(out_dir, 'meta.json'), 'w') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    try:
        if os.path.islink(UUM_LATEST) or os.path.exists(UUM_LATEST):
            os.unlink(UUM_LATEST)
        os.symlink(out_dir, UUM_LATEST)
    except OSError:
        with open(os.path.join(UUM_ROOT, 'LATEST.txt'), 'w') as f:
            f.write(out_dir)

    del model
    gc.collect()
    return os.path.basename(out_dir)


# ----------------------------
# Load saved model
# ----------------------------
_loaded_model: Optional[TwoTower] = None
_loaded_meta: Optional[Dict] = None
_loaded_model_id: Optional[str] = None


def _resolve_model_dir(model_id: Optional[str]) -> str:
    if model_id:
        d = os.path.join(UUM_ROOT, model_id)
        if not os.path.isdir(d):
            raise HTTPException(404, 'model not found')
        return d
    if os.path.islink(UUM_LATEST):
        return os.readlink(UUM_LATEST)
    marker = os.path.join(UUM_ROOT, 'LATEST.txt')
    if os.path.exists(marker):
        return open(marker).read().strip()
    raise HTTPException(404, 'no trained user-user matcher model yet')


def get_matcher(model_id: Optional[str] = None) -> Tuple[TwoTower, Dict, str]:
    global _loaded_model, _loaded_meta, _loaded_model_id
    model_dir = _resolve_model_dir(model_id)
    if _loaded_model is None or _loaded_model_id != os.path.basename(model_dir):
        ckpt = torch.load(os.path.join(model_dir, 'model.pt'), map_location='cpu')
        meta = ckpt['meta']
        m = TwoTower(in_dim=meta['in_dim'])
        m.load_state_dict(ckpt['state_dict'])
        m.eval()
        _loaded_model = m
        _loaded_meta = meta
        _loaded_model_id = os.path.basename(model_dir)
    return _loaded_model, _loaded_meta, _loaded_model_id


# ----------------------------
# Metrics (same as project scorer)
# ----------------------------

def _roc_auc(y_true: np.ndarray, y_score: np.ndarray) -> float:
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


def _pr_auc(y_true: np.ndarray, y_prob: np.ndarray) -> float:
    order = np.argsort(-y_prob)
    y_true = y_true[order]
    tp = 0
    fp = 0
    precisions, recalls = [], []
    P = float((y_true == 1).sum())
    if P == 0:
        return float('nan')
    for y in y_true:
        if y == 1: tp += 1
        else: fp += 1
        precisions.append(tp / max(1, tp + fp))
        recalls.append(tp / P)
    auc = 0.0
    prev_r, prev_p = 0.0, 1.0
    for r, p in zip(recalls, precisions):
        auc += (r - prev_r) * ((p + prev_p) / 2.0)
        prev_r, prev_p = r, p
    return float(auc)


def _log_loss(y_true: np.ndarray, y_logit: np.ndarray) -> float:
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
app = FastAPI(title='User↔User Matching Scorer API')

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
            'models_root': UUM_ROOT,
            'latest_model': (os.readlink(UUM_LATEST) if os.path.islink(UUM_LATEST) else None),
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
    if os.path.isdir(UUM_ROOT):
        for name in sorted(os.listdir(UUM_ROOT)):
            d = os.path.join(UUM_ROOT, name)
            if os.path.isdir(d) and os.path.exists(os.path.join(d, 'meta.json')):
                try:
                    meta = json.load(open(os.path.join(d, 'meta.json')))
                except Exception:
                    meta = None
                out.append({'model_id': name, 'meta': meta})
    return {'OK': True, 'data': out}


@app.get('/train/models/{model_id}')
def get_model_meta(model_id: str):
    d = os.path.join(UUM_ROOT, model_id)
    if not os.path.isdir(d):
        raise HTTPException(404, 'model not found')
    meta = json.load(open(os.path.join(d, 'meta.json')))
    return {'OK': True, 'data': meta}


# --------- Scoring helpers for facet report (cosine per facet) ---------
@torch.no_grad()
def _facet_report(uq: UserFacet, uc: UserFacet) -> Dict:
    sq, tq, aq = _facet_texts(uq)
    sc, tc, ac = _facet_texts(uc)
    embs = encode_texts([sq, tq, aq, sc, tc, ac])
    q_s, q_t, q_a, c_s, c_t, c_a = embs
    def _cos(a, b):
        a = a / max(1e-9, np.linalg.norm(a))
        b = b / max(1e-9, np.linalg.norm(b))
        return float(np.clip((a*b).sum(), -1.0, 1.0))
    s_skill = _cos(q_s, c_s)
    s_trait = _cos(q_t, c_t)
    s_act   = _cos(q_a, c_a)
    return {
        'skill': s_skill,
        'trait': s_trait,
        'activity': s_act,
    }


@app.post('/score')
def score(req: ScoreRequest):
    model, meta, mid = get_matcher(req.model_id)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = model.to(device)

    q = fuse_user_embedding(req.item.user_q)
    c = fuse_user_embedding(req.item.user_c)

    Q = torch.from_numpy(q[None, :]).to(device)
    C = torch.from_numpy(c[None, :]).to(device)

    qz = model.forward_q(Q)
    cz = model.forward_c(C)

    if meta['objective'] == 'rank':
        s = float((qz @ cz.t()).item())
        facets = _facet_report(req.item.user_q, req.item.user_c)
        return {'OK': True, 'data': {'model_id': mid, 'objective': 'rank', 'score': s, 'facet_scores': facets}}
    else:
        logit = float(model.regress(qz, cz).item())
        out = {'model_id': mid, 'objective': 'regression', 'logit': logit}
        if req.as_probability:
            prob = 1.0 / (1.0 + math.exp(-max(min(logit, 30), -30)))
            out['prob'] = prob
        out['facet_scores'] = _facet_report(req.item.user_q, req.item.user_c)
        return {'OK': True, 'data': out}


@app.post('/train/inference/sandbox')
def sandbox(req: SandboxRequest):
    model, meta, mid = get_matcher(req.model_id)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = model.to(device)

    Qs, Cs = [], []
    for it in req.items:
        Qs.append(fuse_user_embedding(it.user_q))
        Cs.append(fuse_user_embedding(it.user_c))
    Q = torch.from_numpy(np.stack(Qs).astype(np.float32)).to(device)
    C = torch.from_numpy(np.stack(Cs).astype(np.float32)).to(device)

    qz = model.forward_q(Q)
    cz = model.forward_c(C)

    if meta['objective'] == 'rank':
        scores = (qz * cz).sum(dim=1).detach().cpu().numpy().tolist()
        out = [{'score': float(s)} for s in scores]
    else:
        logits = model.regress(qz, cz).detach().cpu().numpy()
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
        Q, C, _ = _make_embs_from_pairs(labeled)
        Q = torch.from_numpy(Q).to(device)
        C = torch.from_numpy(C).to(device)
        qz = model.forward_q(Q)
        cz = model.forward_c(C)
        logits = model.regress(qz, cz).detach().cpu().numpy()
        y = np.array([float(r.label) for r in labeled], dtype=np.float32)
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
        # group by anchor user_id
        groups: Dict[str, List[Tuple[float, float]]] = {}
        Qs, Cs, Uids = [], [], []
        for r in req.pairs:
            Qs.append(fuse_user_embedding(r.user_q))
            Cs.append(fuse_user_embedding(r.user_c))
            Uids.append(r.user_id or 'u')
        batch = 256
        scores = []
        for s in range(0, len(Qs), batch):
            Q = torch.from_numpy(np.stack(Qs[s:s+batch]).astype(np.float32)).to(device)
            C = torch.from_numpy(np.stack(Cs[s:s+batch]).astype(np.float32)).to(device)
            qz = model.forward_q(Q)
            cz = model.forward_c(C)
            sc = (qz * cz).sum(dim=1).detach().cpu().numpy().tolist()
            scores.extend(sc)
        for r, s, uid in zip(req.pairs, scores, Uids):
            rel = float(r.label or 0.0)
            groups.setdefault(uid, []).append((s, rel))
        ndcgs, mrrs = [], []
        for uid, items in groups.items():
            items.sort(key=lambda x: x[0], reverse=True)
            rels = [rel for _, rel in items]
            ndcgs.append(_ndcg_at_k(rels, req.k))
            mrrs.append(_mrr(rels))
        return {
            'OK': True,
            'data': {
                'model_id': mid,
                'objective': 'rank',
                'queries': len(groups),
                f'ndcg@{req.k}': float(np.mean(ndcgs)) if ndcgs else 0.0,
                'mrr': float(np.mean(mrrs)) if mrrs else 0.0,
            }
        }


# Dev entry
if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8091)
