from __future__ import annotations
"""
User↔User Matching Scorer API (Ranking / Regression)
- Mirrors the endpoints/behavior of your two-tower scorer (user↔project) but specialized for user↔user.
- Facet-aware text inputs (skill / trait / activity / profile) are embedded with the same
  SentenceTransformer used by your existing service. Each user is represented by
  the concatenation [emb(skill), emb(trait), emb(activity)], where missing facets
  fall back to profile_text.

Exposed endpoints
-----------------
GET  /train/health
POST /train/train                       -> start a training job (objective = 'rank' | 'regression')
GET  /train/jobs/{job_id}               -> job status
GET  /train/models                      -> list saved models
GET  /train/models/{model_id}           -> model metadata
POST /train/evaluate                    -> offline evaluation (NDCG/MRR/Precision@K for rank, ROC-AUC/PR-AUC/LogLoss for regression)
POST /score                             -> single pair scoring
POST /train/inference/sandbox           -> batch scoring for sandbox/testing
POST /train/evaluate_candidate          -> candidate generation eval (HitRate@K / Recall@K + L2 norm stats)
POST /train/evaluate_candidate_demo     -> DEMO: generate synthetic pool/queries and evaluate Top-K (default: 100 users, K=4)

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
import gc
import json
import uuid
import math
import logging
import random
from typing import List, Dict, Optional, Literal, Tuple, Any, TYPE_CHECKING
from datetime import datetime, timezone

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader

from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

BoosterT = Any
DMatrixT = Any
if TYPE_CHECKING:
    from xgboost import Booster as BoosterT
    from xgboost import DMatrix as DMatrixT
# ----------------------------
# UTC helpers (timezone-aware)
# ----------------------------
def utc_now() -> datetime:
    return datetime.now(timezone.utc)

def utc_iso() -> str:
    return utc_now().isoformat().replace("+00:00", "Z")

def utc_stamp() -> str:
    return utc_now().strftime("%Y%m%dT%H%M%SZ")

# ----------------------------
# Optional XGBoost (for re-ranking)
# ----------------------------
try:
    import xgboost as xgb
except Exception:
    xgb = None  # we'll check at endpoint time and raise nice errors

# ----------------------------
# Metric helpers
# ----------------------------
def l2_norms(X: np.ndarray) -> np.ndarray:
    return np.sqrt((X * X).sum(axis=1))

def precision_at_k(sorted_labels: np.ndarray, k: int) -> float:
    k = min(k, len(sorted_labels))
    if k <= 0: return 0.0
    return float(sorted_labels[:k].sum()) / float(k)

def hitrate_at_k(sorted_labels: np.ndarray, k: int) -> float:
    k = min(k, len(sorted_labels))
    return float(sorted_labels[:k].sum() > 0)

def recall_at_k(sorted_labels: np.ndarray, total_positives: int, k: int) -> float:
    if total_positives <= 0:
        return 0.0
    k = min(k, len(sorted_labels))
    return float(sorted_labels[:k].sum()) / float(total_positives)

def hist_counts(x: np.ndarray, bins: int = 20) -> dict:
    h, edges = np.histogram(x, bins=bins)
    return {"edges": edges.tolist(), "counts": h.astype(int).tolist()}

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
# Paths
# ----------------------------
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
EMB_ROOT = os.path.join(BASE_DIR, 'models', 'embeddings')
EMB_LATEST = os.path.join(EMB_ROOT, 'latest')
UUM_ROOT = os.path.join(BASE_DIR, 'models', 'useruser_matcher')
UUM_LATEST = os.path.join(UUM_ROOT, 'latest')
RERANK_ROOT = os.path.join(BASE_DIR, 'models', 'reranker_xgb')
RERANK_LATEST = os.path.join(RERANK_ROOT, 'latest')
LOG_DIR = os.path.join(BASE_DIR, 'logs')
os.makedirs(UUM_ROOT, exist_ok=True)
os.makedirs(RERANK_ROOT, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)

DEFAULT_BASE_MODEL = os.environ.get(
    'BASE_MODEL', 'sentence-transformers/distiluse-base-multilingual-cased-v2'
)

# ----------------------------
# Embeddings (SentenceTransformer)
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
# Facet & TwoTower
# ----------------------------
class UserFacet(BaseModel):
    id: Optional[str] = None
    skill_text: Optional[str] = None
    trait_text: Optional[str] = None
    activity_text: Optional[str] = None
    profile_text: Optional[str] = None
    fused_emb: Optional[List[float]] = None  # (3D,)

def _facet_texts(u: UserFacet) -> tuple[str, str, str]:
    st = u.skill_text or u.profile_text or ''
    tt = u.trait_text or u.profile_text or ''
    at = u.activity_text or u.profile_text or ''
    return f"[SKILL] {st}", f"[TRAIT] {tt}", f"[ACTIVITY] {at}"

@torch.no_grad()
def fuse_user_embedding(u: UserFacet) -> np.ndarray:
    if u.fused_emb is not None:
        return np.asarray(u.fused_emb, dtype=np.float32)
    s, t, a = _facet_texts(u)
    embs = encode_texts([s, t, a])  # (3,D)
    return embs.reshape(-1).astype(np.float32)  # (3D,)

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
# Schemas (TwoTower train/eval)
# ----------------------------
class Priority(BaseModel):
    w1: float = 0.5
    w2: float = 0.3
    w3: float = 0.2

class UUPair(BaseModel):
    user_q: UserFacet
    user_c: UserFacet
    user_id: Optional[str] = None
    label: Optional[float] = None
    priority_weights: Optional[Priority] = None

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
# Candidate-generation Eval Schemas
# ----------------------------
class CandidateIndex(BaseModel):
    candidate_ids: list[str]
    candidate_embs: list[list[float]]  # [N, D]

class CandidateQuery(BaseModel):
    query_id: str
    query_emb: list[float]
    positive_ids: list[str]

class CandidateEvalRequest(BaseModel):
    index: CandidateIndex
    queries: list[CandidateQuery]
    k: int = 10
    metric: str = "cosine"
    bins: int = 20

# ----------------------------
# Reranker (XGBoostRanker) Schemas
# ----------------------------
class RerankCandidate(BaseModel):
    user_c_id: str
    features: List[float] = Field(..., description="feature vector including candidate-generator score(s) etc.")
    label: Optional[float] = Field(None, description="relevance label, e.g., 0/1 or graded")

class RerankGroup(BaseModel):
    query_id: str
    candidates: List[RerankCandidate]

class RerankTrainRequest(BaseModel):
    train: List[RerankGroup]
    valid: Optional[List[RerankGroup]] = None
    params: Dict[str, Any] = Field(default_factory=lambda: {
        "objective": "rank:pairwise",
        "tree_method": "hist",
        "learning_rate": 0.1,
        "max_depth": 6,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "n_estimators": 500,
        "random_state": 42,
        "eval_metric": "ndcg@10"
    })
    early_stopping_rounds: int = 50
    output_tag: Optional[str] = None

class RerankEvalRequest(BaseModel):
    groups: List[RerankGroup]
    k: int = 10
    model_id: Optional[str] = None

class RerankInferRequest(BaseModel):
    groups: List[RerankGroup]
    model_id: Optional[str] = None
    topk: Optional[int] = None  # if provided, cut per group

# ----------------------------
# Datasets building (TwoTower)
# ----------------------------
class RankDataset(Dataset):
    def __init__(self, Q: np.ndarray, C: np.ndarray, user_ids: List[str]):
        assert Q.shape == C.shape
        self.Q = Q; self.C = C; self.user_ids = user_ids
    def __len__(self): return self.Q.shape[0]
    def __getitem__(self, idx): return self.Q[idx], self.C[idx]

class RegDataset(Dataset):
    def __init__(self, Q: np.ndarray, C: np.ndarray, y: np.ndarray):
        assert Q.shape == C.shape and Q.shape[0] == y.shape[0]
        self.Q = Q; self.C = C; self.y = y.astype(np.float32)
    def __len__(self): return self.Q.shape[0]
    def __getitem__(self, idx): return self.Q[idx], self.C[idx], self.y[idx]

def _make_embs_from_pairs(pairs: List[UUPair]) -> Tuple[np.ndarray, np.ndarray, List[str]]:
    Q_list: List[np.ndarray] = []; C_list: List[np.ndarray] = []; user_ids: List[str] = []
    for r in pairs:
        q = fuse_user_embedding(r.user_q)
        c = fuse_user_embedding(r.user_c)
        Q_list.append(q); C_list.append(c)
        user_ids.append(r.user_id or str(len(user_ids)))
    Q = np.stack(Q_list).astype(np.float32)
    C = np.stack(C_list).astype(np.float32)
    return Q, C, user_ids

# ----------------------------
# Training (TwoTower)
# ----------------------------
def train_rank(pairs_pos: List[UUPair], epochs: int, batch_size: int, lr: float, output_tag: Optional[str]) -> str:
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    pos = [r for r in pairs_pos if r.label is None or float(r.label) > 0]
    if not pos:
        raise ValueError('Ranking requires at least one positive pair (label=1).')
    Q, C, user_ids = _make_embs_from_pairs(pos)
    in_dim = Q.shape[1]
    model = TwoTower(in_dim=in_dim).to(device)
    ds = RankDataset(Q, C, user_ids)
    loader = DataLoader(ds, batch_size=batch_size, shuffle=True, drop_last=True)
    opt = torch.optim.AdamW(model.parameters(), lr=lr)

    ts = utc_stamp()
    out_dir = os.path.join(UUM_ROOT, f"{ts}{('-' + output_tag) if output_tag else ''}")
    os.makedirs(out_dir, exist_ok=True)

    model.train()
    for ep in range(epochs):
        total = 0.0; steps = 0
        for Q_np, C_np in loader:
            q = torch.from_numpy(np.asarray(Q_np)).to(device)
            c = torch.from_numpy(np.asarray(C_np)).to(device)
            qz = model.forward_q(q); cz = model.forward_c(c)
            logits = model.score_matrix(qz, cz)
            target = torch.arange(logits.shape[0], device=device)
            loss = F.cross_entropy(logits, target)
            opt.zero_grad(set_to_none=True); loss.backward(); opt.step()
            total += float(loss.item()); steps += 1
        logging.info(f"[uu-rank] epoch {ep+1}/{epochs} loss={total/max(1,steps):.4f}")

    meta = {'objective':'rank','created_at':ts,'in_dim':in_dim,'proj_dim':128,
            'base_embeddings': latest_embedding_path(),'facets':['skill','trait','activity']}
    torch.save({'state_dict': model.state_dict(), 'meta': meta}, os.path.join(out_dir, 'model.pt'))
    with open(os.path.join(out_dir, 'meta.json'), 'w') as f: json.dump(meta, f, ensure_ascii=False, indent=2)
    try:
        if os.path.islink(UUM_LATEST) or os.path.exists(UUM_LATEST): os.unlink(UUM_LATEST)
        os.symlink(out_dir, UUM_LATEST)
    except OSError:
        with open(os.path.join(UUM_ROOT, 'LATEST.txt'), 'w') as f: f.write(out_dir)
    del model; gc.collect()
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

    ts = utc_stamp()
    out_dir = os.path.join(UUM_ROOT, f"{ts}{('-' + output_tag) if output_tag else ''}")
    os.makedirs(out_dir, exist_ok=True)

    model.train()
    for ep in range(epochs):
        total = 0.0; steps = 0
        for Q_np, C_np, y_np in loader:
            q = torch.from_numpy(np.asarray(Q_np)).to(device)
            c = torch.from_numpy(np.asarray(C_np)).to(device)
            yb = torch.from_numpy(np.asarray(y_np)).to(device)
            qz = model.forward_q(q); cz = model.forward_c(c)
            logits = model.regress(qz, cz)
            loss = criterion(logits, yb)
            opt.zero_grad(set_to_none=True); loss.backward(); opt.step()
            total += float(loss.item()); steps += 1
        logging.info(f"[uu-reg] epoch {ep+1}/{epochs} loss={total/max(1,steps):.4f}")

    meta = {'objective':'regression','created_at':ts,'in_dim':in_dim,'proj_dim':128,
            'binary': bool(is_binary),'base_embeddings': latest_embedding_path(),
            'facets':['skill','trait','activity']}
    torch.save({'state_dict': model.state_dict(), 'meta': meta}, os.path.join(out_dir, 'model.pt'))
    with open(os.path.join(out_dir, 'meta.json'), 'w') as f: json.dump(meta, f, ensure_ascii=False, indent=2)
    try:
        if os.path.islink(UUM_LATEST) or os.path.exists(UUM_LATEST): os.unlink(UUM_LATEST)
        os.symlink(out_dir, UUM_LATEST)
    except OSError:
        with open(os.path.join(UUM_ROOT, 'LATEST.txt'), 'w') as f: f.write(out_dir)
    del model; gc.collect()
    return os.path.basename(out_dir)

# ----------------------------
# Load saved TwoTower
# ----------------------------
_loaded_model: Optional[TwoTower] = None
_loaded_meta: Optional[Dict] = None
_loaded_model_id: Optional[str] = None

def _resolve_model_dir(model_id: Optional[str]) -> str:
    if model_id:
        d = os.path.join(UUM_ROOT, model_id)
        if not os.path.isdir(d): raise HTTPException(404, 'model not found')
        return d
    if os.path.islink(UUM_LATEST): return os.readlink(UUM_LATEST)
    marker = os.path.join(UUM_ROOT, 'LATEST.txt')
    if os.path.exists(marker): return open(marker).read().strip()
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
    job = {'job_id': job_id, 'status': 'PENDING', 'started_at': None,
           'finished_at': None, 'message': None, 'model_id': None}
    JOBS[job_id] = job

    def _run():
        job['status'] = 'RUNNING'
        job['started_at'] = utc_iso()
        try:
            if req.objective == 'rank':
                mid = train_rank(req.pairs, req.epochs, req.batch_size, req.learning_rate, req.output_tag)
            else:
                mid = train_reg(req.pairs, req.epochs, req.batch_size, req.learning_rate, req.output_tag)
            job['status'] = 'DONE'
            job['finished_at'] = utc_iso()
            job['model_id'] = mid
            job['message'] = f"Saved model: {mid}"
        except Exception as e:
            logging.exception('Training failed')
            job['status'] = 'ERROR'
            job['finished_at'] = utc_iso()
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

# --------- Scoring helpers for facet report ---------
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
    return {'skill': _cos(q_s, c_s), 'trait': _cos(q_t, c_t), 'activity': _cos(q_a, c_a)}

@app.post('/score')
def score(req: ScoreRequest):
    model, meta, mid = get_matcher(req.model_id)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = model.to(device)
    q = fuse_user_embedding(req.item.user_q)
    c = fuse_user_embedding(req.item.user_c)
    Q = torch.from_numpy(q[None, :]).to(device)
    C = torch.from_numpy(c[None, :]).to(device)
    qz = model.forward_q(Q); cz = model.forward_c(C)
    if meta['objective'] == 'rank':
        s = float((qz @ cz.t()).item())
        return {'OK': True, 'data': {'model_id': mid, 'objective': 'rank', 'score': s, 'facet_scores': _facet_report(req.item.user_q, req.item.user_c)}}
    else:
        logit = float(model.regress(qz, cz).item())
        out = {'model_id': mid, 'objective': 'regression', 'logit': logit}
        prob = 1.0 / (1.0 + math.exp(-max(min(logit, 30), -30))) if req.as_probability else None
        if prob is not None:
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
    qz = model.forward_q(Q); cz = model.forward_c(C)
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
        qz = model.forward_q(Q); cz = model.forward_c(C)
        logits = model.regress(qz, cz).detach().cpu().numpy()
        y = np.array([float(r.label) for r in labeled], dtype=np.float32)
        auc = _roc_auc((y > 0.5).astype(np.int32), logits)
        pr = _pr_auc((y > 0.5).astype(np.int32), 1.0 / (1.0 + np.exp(-np.clip(logits, -30, 30))))
        logloss = _log_loss((y > 0.5).astype(np.float32), logits)
        mae = float(np.mean(np.abs(1.0 / (1.0 + np.exp(-np.clip(logits, -30, 30))) - y)))
        return {'OK': True, 'data': {'model_id': mid, 'objective': 'regression', 'n': len(y),
                                     'roc_auc': auc, 'pr_auc': pr, 'log_loss': logloss, 'mae_prob': mae}}
    else:
        # rank
        groups: Dict[str, List[Tuple[float, float]]] = {}
        Qs, Cs, Uids = [], [], []
        for r in req.pairs:
            Qs.append(fuse_user_embedding(r.user_q))
            Cs.append(fuse_user_embedding(r.user_c))
            Uids.append(r.user_id or 'u')
        if len(Qs) == 0:
            raise HTTPException(400, "no pairs for rank evaluation")
        batch = 256; scores = []
        for s in range(0, len(Qs), batch):
            Q = torch.from_numpy(np.stack(Qs[s:s+batch]).astype(np.float32)).to(device)
            C = torch.from_numpy(np.stack(Cs[s:s+batch]).astype(np.float32)).to(device)
            qz = model.forward_q(Q); cz = model.forward_c(C)
            sc = (qz * cz).sum(dim=1).detach().cpu().numpy().tolist()
            scores.extend(sc)
        for r, s, uid in zip(req.pairs, scores, Uids):
            rel = float(r.label or 0.0)
            groups.setdefault(uid, []).append((s, rel))
        ndcgs, mrrs, precisions = [], [], []
        for uid, items in groups.items():
            items.sort(key=lambda x: x[0], reverse=True)
            rels = [rel for _, rel in items]
            ndcgs.append(_ndcg_at_k(rels, req.k))
            mrrs.append(_mrr(rels))
            k_eff = min(req.k, len(rels))
            precisions.append((sum(1 for r in rels[:k_eff] if r > 0) / k_eff) if k_eff > 0 else 0.0)
        return {'OK': True, 'data': {'model_id': mid, 'objective': 'rank', 'queries': len(groups),
                                     f'ndcg@{req.k}': float(np.mean(ndcgs)) if ndcgs else 0.0,
                                     'mrr': float(np.mean(mrrs)) if mrrs else 0.0,
                                     f'precision@{req.k}': float(np.mean(precisions)) if precisions else 0.0}}

# ----------------------------
# Candidate-generation evaluation (HitRate@K / Recall@K + L2 norms)
# ----------------------------
@app.post("/train/evaluate_candidate")
def evaluate_candidate(req: CandidateEvalRequest):
    cand_ids = np.array(req.index.candidate_ids)
    C = np.array(req.index.candidate_embs, dtype=np.float32)  # [Nc, D]
    if C.ndim != 2 or len(cand_ids) != C.shape[0]:
        raise HTTPException(400, "candidate_ids and candidate_embs shape mismatch")
    Nc = C.shape[0]
    if Nc == 0:
        raise HTTPException(400, "candidate pool is empty")
    if not req.queries:
        raise HTTPException(400, "queries is empty")

    cand_norm = l2_norms(C)
    eps = 1e-12
    K_req = max(1, int(req.k))
    K_eff_global = min(K_req, Nc)

    hit_list, recall_list = [], []
    q_norms = []

    for q in req.queries:
        qv = np.asarray(q.query_emb, dtype=np.float32).reshape(1, -1)  # [1, D]
        if qv.ndim != 2 or qv.shape[1] != C.shape[1]:
            raise HTTPException(400, f"query_emb dim mismatch (expect D={C.shape[1]})")
        qn_val = float(l2_norms(qv)[0])
        q_norms.append(qn_val)

        if req.metric == "cosine":
            if qn_val < eps:
                sim = np.zeros((Nc,), dtype=np.float32)
            else:
                denom = max(qn_val, eps) * np.maximum(cand_norm, eps)
                sim = (C @ qv.squeeze(0)) / denom
        elif req.metric == "dot":
            sim = (C @ qv.squeeze(0))
        else:
            raise HTTPException(400, "metric must be 'cosine' or 'dot'")

        K_eff = min(K_req, Nc)
        topk_idx = np.argpartition(-sim, K_eff - 1)[:K_eff]
        topk_sorted = topk_idx[np.argsort(-sim[topk_idx])]

        labels = np.isin(cand_ids[topk_sorted], np.array(q.positive_ids)).astype(np.int32)
        total_pos = max(1, len(q.positive_ids))
        hit_list.append(hitrate_at_k(labels, K_eff))
        recall_list.append(recall_at_k(labels, total_pos, K_eff))

    hit = float(np.mean(hit_list)) if hit_list else 0.0
    rec = float(np.mean(recall_list)) if recall_list else 0.0

    cn_stats = {
        "min": float(cand_norm.min()) if cand_norm.size else 0.0,
        "max": float(cand_norm.max()) if cand_norm.size else 0.0,
        "mean": float(cand_norm.mean()) if cand_norm.size else 0.0,
        "std": float(cand_norm.std()) if cand_norm.size else 0.0,
        "hist": hist_counts(cand_norm, bins=req.bins),
    }
    qn = np.array(q_norms, dtype=np.float32)
    qn_stats = {
        "min": float(qn.min()) if qn.size else 0.0,
        "max": float(qn.max()) if qn.size else 0.0,
        "mean": float(qn.mean()) if qn.size else 0.0,
        "std": float(qn.std()) if qn.size else 0.0,
        "hist": hist_counts(qn, bins=req.bins) if qn.size else {"edges": [], "counts": []},
    }

    return {
        "OK": True,
        "k": int(K_eff_global),
        "metrics": {"HitRate@K": hit, "Recall@K": rec},
        "l2_norm": {"candidates": cn_stats, "queries": qn_stats}
    }

# ----------------------------
# DEMO: generate pool & queries internally and evaluate Top-K
# ----------------------------
class DemoEvalRequest(BaseModel):
    n_candidates: int = 100
    n_queries: int = 500
    k: int = 4
    metric: str = "cosine"
    bins: int = 30
    seed: Optional[int] = 42

def _demo_make_candidates(n_candidates: int) -> Dict[str, Any]:
    ids = [f"u{idx:04d}" for idx in range(n_candidates)]
    cats = ["vision","nlp","rl","rec","cv","mlops","data","backend","frontend","mobile"]
    traits = ["leader","detail","creative","team","fast","reliable","curious"]
    acts = ["kaggle","paper","opensource","hackathon","blog","meetup"]
    profiles = ["student","engineer","researcher","designer"]

    skill_texts, trait_texts, act_texts, prof_texts = [], [], [], []
    for _ in range(n_candidates):
        s = " ".join(random.sample(cats, k=random.randint(2,3)))
        t = " ".join(random.sample(traits, k=2))
        a = " ".join(random.sample(acts, k=1))
        p = random.choice(profiles)
        skill_texts.append(s); trait_texts.append(t); act_texts.append(a); prof_texts.append(p)

    fused = []
    for s, t, a, p in zip(skill_texts, trait_texts, act_texts, prof_texts):
        fused.append(fuse_user_embedding(UserFacet(skill_text=s, trait_text=t, activity_text=a, profile_text=p)))
    fused = np.stack(fused)  # (N, 3D)
    return {"candidate_ids": ids, "candidate_embs": fused.tolist()}

def _demo_make_queries(candidates: Dict[str, Any], n_queries: int,
                       positives_per_query=(1, 3)) -> List[Dict[str, Any]]:
    cand_ids = candidates["candidate_ids"]
    cand_embs = np.array(candidates["candidate_embs"], dtype=np.float32)
    N = len(cand_ids); D = cand_embs.shape[1]
    queries = []
    for i in range(n_queries):
        anchor_idx = random.randrange(N)
        q = cand_embs[anchor_idx].copy()
        q += np.random.normal(0, 0.01, size=D).astype(np.float32)  # 작은 노이즈
        pos_cnt = random.randint(positives_per_query[0], positives_per_query[1])
        neighbor_pool = list(range(max(0, anchor_idx-5), min(N, anchor_idx+6)))
        if anchor_idx in neighbor_pool:
            neighbor_pool.remove(anchor_idx)
        random.shuffle(neighbor_pool)
        positives = [cand_ids[anchor_idx]] + [cand_ids[j] for j in neighbor_pool[:max(0, pos_cnt-1)]]
        queries.append({"query_id": f"q{i:05d}", "query_emb": q.tolist(), "positive_ids": positives})
    return queries

@app.post("/train/evaluate_candidate_demo")
def evaluate_candidate_demo(req: DemoEvalRequest):
    if req.seed is not None:
        random.seed(req.seed)
        np.random.seed(req.seed)
    index = _demo_make_candidates(max(1, int(req.n_candidates)))
    queries = _demo_make_queries(index, max(1, int(req.n_queries)))
    payload = CandidateEvalRequest(index=index, queries=queries,
                                   k=max(1, int(req.k)),
                                   metric=req.metric, bins=req.bins)
    return evaluate_candidate(payload)

# ----------------------------
# XGBoost Re-ranker: IO helpers
# ----------------------------
def _groups_to_dmatrix(groups: List[RerankGroup]) -> Tuple[Any, np.ndarray, List[int]]:
    """Return DMatrix, labels, group_sizes"""
    X_list, y_list, group_sizes = [], [], []
    for g in groups:
        feats = [c.features for c in g.candidates]
        X_list.append(np.asarray(feats, dtype=np.float32))
        lbls = [float(c.label or 0.0) for c in g.candidates]
        y_list.append(np.asarray(lbls, dtype=np.float32))
        group_sizes.append(len(g.candidates))
    X = np.vstack(X_list) if X_list else np.zeros((0, 1), dtype=np.float32)
    y = np.concatenate(y_list) if y_list else np.zeros((0,), dtype=np.float32)
    d = xgb.DMatrix(X, label=y)
    d.set_group(group_sizes)
    return d, y, group_sizes

def _save_rerank_model(bst: Any, meta: Dict[str, Any], output_tag: Optional[str]) -> str:
    ts = utc_stamp()
    out_dir = os.path.join(RERANK_ROOT, f"{ts}{('-' + output_tag) if output_tag else ''}")
    os.makedirs(out_dir, exist_ok=True)
    bst.save_model(os.path.join(out_dir, "model.json"))
    with open(os.path.join(out_dir, "meta.json"), "w") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    try:
        if os.path.islink(RERANK_LATEST) or os.path.exists(RERANK_LATEST): os.unlink(RERANK_LATEST)
        os.symlink(out_dir, RERANK_LATEST)
    except OSError:
        with open(os.path.join(RERANK_ROOT, "LATEST.txt"), "w") as f: f.write(out_dir)
    return os.path.basename(out_dir)

def _resolve_rerank_dir(model_id: Optional[str]) -> str:
    if model_id:
        d = os.path.join(RERANK_ROOT, model_id)
        if not os.path.isdir(d): raise HTTPException(404, "rerank model not found")
        return d
    if os.path.islink(RERANK_LATEST): return os.readlink(RERANK_LATEST)
    marker = os.path.join(RERANK_ROOT, 'LATEST.txt')
    if os.path.exists(marker): return open(marker).read().strip()
    raise HTTPException(404, "no trained rerank model yet")

def _load_rerank_model(model_id: Optional[str]) -> Tuple[Any, Dict, str]:
    if xgb is None:
        raise HTTPException(500, "xgboost is not installed. Run: pip install xgboost")
    model_dir = _resolve_rerank_dir(model_id)
    bst = xgb.Booster()
    bst.load_model(os.path.join(model_dir, "model.json"))
    meta = json.load(open(os.path.join(model_dir, "meta.json")))
    return bst, meta, os.path.basename(model_dir)

# ----------------------------
# XGBoost Re-ranker: Endpoints
# ----------------------------
@app.post("/rerank/train")
def rerank_train(req: RerankTrainRequest):
    if xgb is None:
        raise HTTPException(500, "xgboost is not installed. Run: pip install xgboost")
    if not req.train:
        raise HTTPException(400, "train groups are required")

    dtrain, ytrain, gtrain = _groups_to_dmatrix(req.train)
    evals = [(dtrain, "train")]
    params = dict(req.params)

    bst = None
    evals_result = {}
    if req.valid:
        dvalid, yvalid, gvalid = _groups_to_dmatrix(req.valid)
        evals.append((dvalid, "valid"))
        bst = xgb.train(
            params,
            dtrain,
            num_boost_round=int(params.get("n_estimators", 500)),
            evals=evals,
            early_stopping_rounds=req.early_stopping_rounds,
            evals_result=evals_result,
            verbose_eval=False
        )
    else:
        bst = xgb.train(
            params,
            dtrain,
            num_boost_round=int(params.get("n_estimators", 500)),
            evals=evals,
            evals_result=evals_result,
            verbose_eval=False
        )

    meta = {
        "created_at": utc_stamp(),
        "params": params,
        "train_groups": len(gtrain),
        "valid_groups": (len(gvalid) if req.valid else 0),
        "evals_result": evals_result
    }
    model_id = _save_rerank_model(bst, meta, req.output_tag)
    return {"OK": True, "data": {"model_id": model_id, "meta": meta}}

@app.get("/rerank/models")
def rerank_list_models():
    out = []
    if os.path.isdir(RERANK_ROOT):
        for name in sorted(os.listdir(RERANK_ROOT)):
            d = os.path.join(RERANK_ROOT, name)
            if os.path.isdir(d) and os.path.exists(os.path.join(d, "meta.json")):
                try:
                    meta = json.load(open(os.path.join(d, "meta.json")))
                except Exception:
                    meta = None
                out.append({"model_id": name, "meta": meta})
    return {"OK": True, "data": out}

@app.get("/rerank/models/{model_id}")
def rerank_get_model_meta(model_id: str):
    d = os.path.join(RERANK_ROOT, model_id)
    if not os.path.isdir(d):
        raise HTTPException(404, "rerank model not found")
    meta = json.load(open(os.path.join(d, "meta.json")))
    return {"OK": True, "data": meta}

@app.post("/rerank/eval")
def rerank_eval(req: RerankEvalRequest):
    if xgb is None:
        raise HTTPException(500, "xgboost is not installed. Run: pip install xgboost")
    bst, meta, mid = _load_rerank_model(req.model_id)
    ndcgs = []
    precs = []
    K = int(req.k)
    for g in req.groups:
        X = np.asarray([c.features for c in g.candidates], dtype=np.float32)
        d = xgb.DMatrix(X)
        scores = bst.predict(d)
        order = np.argsort(-scores)
        rels = [float(g.candidates[i].label or 0.0) for i in order]
        ndcgs.append(_ndcg_at_k(rels, K))
        k_eff = min(K, len(rels))
        bin_labels = np.asarray([1.0 if r > 0 else 0.0 for r in rels], dtype=np.float32)
        precs.append(precision_at_k(bin_labels, k_eff) if k_eff > 0 else 0.0)
    return {"OK": True, "data": {"model_id": mid, f"ndcg@{K}": float(np.mean(ndcgs)) if ndcgs else 0.0,
                                  f"precision@{K}": float(np.mean(precs)) if precs else 0.0,
                                  "groups": len(req.groups)}}

@app.post("/rerank/infer")
def rerank_infer(req: RerankInferRequest):
    if xgb is None:
        raise HTTPException(500, "xgboost is not installed. Run: pip install xgboost")
    bst, meta, mid = _load_rerank_model(req.model_id)
    out_groups = []
    for g in req.groups:
        X = np.asarray([c.features for c in g.candidates], dtype=np.float32)
        d = xgb.DMatrix(X)
        scores = bst.predict(d)
        order = np.argsort(-scores)
        items = [{"user_c_id": g.candidates[i].user_c_id,
                  "score": float(scores[i]),
                  "label": (float(g.candidates[i].label) if g.candidates[i].label is not None else None)}
                 for i in order]
        if req.topk is not None:
            items = items[: int(req.topk)]
        out_groups.append({"query_id": g.query_id, "items": items})
    return {"OK": True, "data": {"model_id": mid, "groups": out_groups}}

# Dev entry
if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8091)
