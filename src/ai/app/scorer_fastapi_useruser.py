from __future__ import annotations
"""
User↔User Matching Scorer API (Ranking / Regression)
and [FRONTEND BRIDGE] /frontend/recommend

- TwoTower user↔user matcher (rank/regression)
- Facet-aware embeddings (skill/trait/activity with fallback to profile_text)
- Reranker (XGBoost) optional
- Frontend bridge that computes (norm, pob) and respects user priorities

Run:
$ uvicorn scorer_fastapi_useruser:app --host 0.0.0.0 --port 8091
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

import requests
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

# ========================
# CONFIG & LOGGING
# ========================
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

BoosterT = Any
DMatrixT = Any
if TYPE_CHECKING:
    from xgboost import Booster as BoosterT
    from xgboost import DMatrix as DMatrixT

# 외부 서비스 엔드포인트 (환경변수로 오버라이드 가능)
ACCEPTOR_URL = os.getenv("ACCEPTOR_URL", "http://localhost:8093")  # acceptor root (expects /score)
TRAITS_URL   = os.getenv("TRAITS_URL",   "http://localhost:8092")  # traits root (expects /score)

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
    metric: str = "cos_sim"
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

# ==========================
# [FRONTEND BRIDGE] 추천 API
# ==========================
import os, re, math, logging
import numpy as np
from typing import List, Optional, Dict, Tuple
from pydantic import BaseModel
from fastapi import HTTPException

# ---- 외부 서비스 엔드포인트 (환경변수로 오버라이드 가능) ----
# export ACCEPTOR_URL="http://127.0.0.1:8091/acceptor"
_DEFAULT_ACCEPTOR = "http://127.0.0.1:8093"
_DEFAULT_TRAITS   = "http://127.0.0.1:8092"  # 미사용시 무시
def _normalize_base(url: str) -> str:
    return (url or "").rstrip("/")

ACCEPTOR_BASE = _normalize_base(os.environ.get("ACCEPTOR_URL", _DEFAULT_ACCEPTOR))
TRAITS_BASE   = _normalize_base(os.environ.get("TRAITS_URL",   _DEFAULT_TRAITS))

# /score와 /train/inference/sandbox 경로 만들기(중복 방지)
def _acceptor_score_url() -> str:
    base = ACCEPTOR_BASE
    # 이미 .../score로 끝나면 그대로 사용
    return base if base.endswith("/score") else f"{base}/score"

def _acceptor_sbx_url() -> str:
    base = ACCEPTOR_BASE
    # 이미 .../train/inference/sandbox로 끝나면 그대로 사용
    sbx = "/train/inference/sandbox"
    return base if base.endswith(sbx) else f"{base}{sbx}"

# ---- 프론트 요청/응답 스키마 ----
class FrontUser(BaseModel):
    userId: int
    job: Optional[str] = None
    address: Optional[str] = None
    mbti: Optional[str] = None
    workStyle: Optional[str] = None
    workTime: Optional[str] = None
    interest: Optional[str] = None
    projectExp: Optional[bool] = None
    coverLetter: Optional[str] = None
    techStack: Optional[str] = None

class FrontProject(BaseModel):
    type: Optional[str] = None
    category: Optional[str] = None
    tech_stack: Optional[str] = None
    recruitment: Optional[int] = None
    description: Optional[str] = None
    address: Optional[str] = None
    mbti: Optional[str] = None
    workStyle: Optional[str] = None
    workTime: Optional[str] = None

class FrontRecommendRequest(BaseModel):
    users: List[FrontUser]
    project: FrontProject
    priority1: Optional[str] = None
    priority2: Optional[str] = None
    priority3: Optional[str] = None
    top_n: int = 4

class FastApiResultItem(BaseModel):
    id: int
    norm: int
    pob: int

class FrontRecommendResponse(BaseModel):
    result: Dict[str, FastApiResultItem]

# ---- 유틸: 텍스트 구성 ----
def _make_user_text(u: FrontUser) -> str:
    parts = []
    if u.job: parts.append(f"[JOB] {u.job}")
    if u.techStack: parts.append(f"[STACK] {u.techStack}")
    if u.interest: parts.append(f"[INTEREST] {u.interest}")
    if u.coverLetter: parts.append(f"[COVER] {u.coverLetter}")
    if u.address: parts.append(f"[ADDR] {u.address}")
    if u.workStyle: parts.append(f"[WORK_STYLE] {u.workStyle}")
    if u.workTime: parts.append(f"[WORK_TIME] {u.workTime}")
    if u.mbti: parts.append(f"[MBTI] {u.mbti}")
    return " ".join(parts).strip()

def _make_project_text(p: FrontProject) -> str:
    parts = []
    if p.description: parts.append(f"[DESC] {p.description}")
    if p.type: parts.append(f"[TYPE] {p.type}")
    if p.category: parts.append(f"[CATEGORY] {p.category}")
    if p.tech_stack: parts.append(f"[STACK] {p.tech_stack}")
    return " ".join(parts).strip()

# ---- 유틸: 코사인 ----
def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    na = float(np.linalg.norm(a)); nb = float(np.linalg.norm(b))
    if na <= 0.0 or nb <= 0.0:
        return 0.0
    v = float((a * b).sum() / (na * nb + 1e-12))
    if not np.isfinite(v):  # NaN/Inf 방어
        return 0.0
    return max(-1.0, min(1.0, v))

PRIORITY_LABELS = [
    "거주지","MBTI 비슷한 성향","MBTI 보완적 성향","선호 업무 방식",
    "선호 시간대","사용 가능 기술 스택","관심 프로젝트 분야","프로젝트 경험 유무",
]

def _priority_weights_from_list(labels_in_order: list[str]) -> dict[str, float]:
    weights = {lbl: 0.0 for lbl in PRIORITY_LABELS}
    for i, lbl in enumerate(labels_in_order[:3]):
        w = 0.5 if i == 0 else (0.3 if i == 1 else 0.2)
        if lbl in weights:
            weights[lbl] = w
    return weights

def _priority_weights_from_req(req: FrontRecommendRequest) -> dict[str, float]:
    labels = [req.priority1, req.priority2, req.priority3]
    return _priority_weights_from_list([x for x in labels if x])

def _normalize_tokens(s: str) -> set[str]:
    return set(t.strip().lower() for t in re.split(r"[,\s/]+", s or "") if t.strip())

def _mbti_similar(a: str|None, b: str|None) -> bool:
    return bool(a and b and len(a)==4 and len(b)==4 and a.upper()==b.upper())

def _mbti_complement(a: str|None, b: str|None) -> bool:
    if not a or not b or len(a)!=4 or len(b)!=4: return False
    a, b = a.upper(), b.upper()
    diff = sum(1 for x, y in zip(a, b) if x != y)
    return diff >= 3

def _priority_bonus(u: FrontUser, p: FrontProject, W: dict[str,float]) -> float:
    bonus = 0.0
    if W["거주지"] > 0 and p and getattr(p, "address", None):
        bonus += W["거주지"] * (1.0 if (u.address and u.address == p.address) else 0.0)
    if W["MBTI 비슷한 성향"] > 0:
        bonus += W["MBTI 비슷한 성향"] * (1.0 if _mbti_similar(u.mbti, getattr(p, "mbti", None)) else 0.0)
    if W["MBTI 보완적 성향"] > 0:
        bonus += W["MBTI 보완적 성향"] * (1.0 if _mbti_complement(u.mbti, getattr(p, "mbti", None)) else 0.0)
    if W["선호 업무 방식"] > 0 and p and getattr(p, "workStyle", None):
        bonus += W["선호 업무 방식"] * (1.0 if (u.workStyle and u.workStyle == p.workStyle) else 0.0)
    if W["선호 시간대"] > 0 and p and getattr(p, "workTime", None):
        bonus += W["선호 시간대"] * (1.0 if (u.workTime and u.workTime == p.workTime) else 0.0)
    if W["사용 가능 기술 스택"] > 0 and p and p.tech_stack and u.techStack:
        ut, pt = _normalize_tokens(u.techStack), _normalize_tokens(p.tech_stack)
        bonus += W["사용 가능 기술 스택"] * (1.0 if ut & pt else 0.0)
    if W["관심 프로젝트 분야"] > 0 and u.interest:
        it = _normalize_tokens(u.interest)
        target = _normalize_tokens(" ".join([
            getattr(p, "category", "") or "",
            getattr(p, "type", "") or "",
            getattr(p, "description", "") or ""
        ]))
        bonus += W["관심 프로젝트 분야"] * (1.0 if it & target else 0.0)
    if W["프로젝트 경험 유무"] > 0:
        bonus += W["프로젝트 경험 유무"] * (1.0 if bool(u.projectExp) else 0.0)
    # 수치 안전화
    if not np.isfinite(bonus): bonus = 0.0
    return float(max(0.0, min(1.0, bonus)))

# ---- traits_fastapi (옵션) ----
def _traits_probs(text: str) -> Dict[str, float]:
    # 현재 미사용. 필요시 예외 포착 후 빈 딕셔너리 반환
    try:
        import requests
        url = f"{TRAITS_BASE}/score"
        r = requests.post(url, json={"text": text}, timeout=3)
        r.raise_for_status()
        js = r.json()
        return dict(js.get("data", {}).get("probs", {}))
    except Exception:
        return {}

def _acceptor_probs(items: List[Dict[str, float]]) -> List[float]:
    import requests
    # score 시도
    url_score = _acceptor_score_url()
    try:
        r = requests.post(url_score, json={"items": items}, timeout=5)
        r.raise_for_status()
        js = r.json()
        probs = [float(x.get("prob", 0.0)) for x in js.get("data", [])]
        probs = [float(np.clip(p, 0.0, 1.0)) if np.isfinite(p) else 0.0 for p in probs]
        if probs:
            return probs
    except Exception as e:
        logging.warning(f"[acceptor] score failed {url_score}: {e}")

    # sandbox 폴백
    url_sbx = _acceptor_sbx_url()
    try:
        r = requests.post(url_sbx, json={"items": items}, timeout=5)
        r.raise_for_status()
        js = r.json()
        out = []
        for x in js.get("data", []):
            if "prob" in x:
                p = float(x["prob"])
            elif "logit" in x:
                z = float(x["logit"])
                z = max(min(z, 30.0), -30.0)
                p = 1.0 / (1.0 + math.exp(-z))
            else:
                p = 0.0
            out.append(float(np.clip(p, 0.0, 1.0)) if np.isfinite(p) else 0.0)
        return out if out else [0.0 for _ in items]
    except Exception as e:
        logging.error(f"[acceptor] sandbox failed {url_sbx}: {e}")
        return [0.0 for _ in items]

def _safe_norm_builder(scores: List[float]):
    arr = np.array([float(s) if np.isfinite(s) else 0.0 for s in scores], dtype=np.float32)
    if arr.size == 0:
        return lambda x: 0
    rmin, rmax = float(np.min(arr)), float(np.max(arr))
    if not np.isfinite(rmin): rmin = 0.0
    if not np.isfinite(rmax): rmax = 0.0
    if rmax == rmin:
        return lambda x: 100
    def _norm(x: float) -> int:
        if not np.isfinite(x): return 0
        v = 100.0 * (x - rmin) / (rmax - rmin)
        if not np.isfinite(v): return 0
        v = max(0.0, min(100.0, v))
        return int(round(v))
    return _norm

@app.post("/frontend/recommend", response_model=FrontRecommendResponse)
def frontend_recommend(req: FrontRecommendRequest):
    try:
        # 입력 검증
        if not req.users:
            raise HTTPException(400, "users[] is empty")
        if req.top_n is None or req.top_n <= 0:
            req.top_n = 4

        # 우선순위 가중치
        W = _priority_weights_from_req(req)

        # 텍스트 → 임베딩
        p_text = _make_project_text(req.project)
        user_texts = [_make_user_text(u) for u in req.users]

        emb_users = encode_texts(user_texts)   # (N,D)
        emb_proj  = encode_texts([p_text])[0]  # (D,)

        def _safe_norm(v): 
            n = float(np.linalg.norm(v)); 
            return v / (n + 1e-12)
        
        u_proj_cos = []  # traits_* 계산에 함께 사용
        for u_emb in emb_users:
            u_proj_cos.append(_cosine(u_emb, emb_proj))

        # MBTI/traits/카운트 파생 유틸
        def _mbti_match_cnt(a, b):
            if not a or not b or len(a) != 4 or len(b) != 4:
                return 0
            a, b = a.upper(), b.upper()
            return sum(1 for x, y in zip(a, b) if x == y)

        def _traits_features(u_vec, p_vec):
            u = _safe_norm(u_vec); p = _safe_norm(p_vec)
            cos = float(np.clip((u * p).sum(), -1.0, 1.0))      # -1..1
            l1  = float(np.mean(np.abs(u - p)))                 # 0..2 (정규화 벡터 기준)
            l2  = float(np.linalg.norm(u - p))                  # 0..sqrt(2)
            # 학습 분포에 맞추려면 cos을 [0,1]로 이동
            cos01 = (cos + 1.0) * 0.5
            return cos01, l1, l2
        
        BONUS_SCALE = 0.4
        rows = []
        acc_items = []

        for u, u_emb in zip(req.users, emb_users):
            base_cos = _cosine(u_emb, emb_proj)               # [-1, 1]
            cos_01   = (base_cos + 1.0) * 0.5                 # [0, 1]
            # 감마 보정: 중간값(0.5~0.7)을 살짝 끌어올림 (모노토닉 유지)
            cos_01_lift = cos_01 ** 0.6                       # 0.6~0.7대 → 체감 상승

            bonus    = _priority_bonus(u, req.project, W)     # [0..1]
            # 보너스는 가운데로 쉬프트해서 너무 0/1 극단으로 안가게
            bonus_mid = 0.5 + 0.5 * bonus                     # [0.5..1.0]

            # rank 스코어도 lift된 코사인 기반으로
            rscore   = float((cos_01_lift * 2.0 - 1.0) + BONUS_SCALE * (bonus))  # back to [-1..1] 근방
            cos_sim_for_acceptor = cos_01 * 2.0 - 1.0
            tcos, tl1, tl2 = _traits_features(u_emb, emb_proj)
            # --- 추가: MBTI 파생 ---
            mm_cnt = _mbti_match_cnt(u.mbti, getattr(req.project, "mbti", None))
            ge3    = 1 if mm_cnt >= 3 else 0

            # --- 추가: 최근 활동 priors ---
            offers_30 = 2
            accepts_30 = 1
            # acceptor 입력용 랭크는 보수적으로 합성 (모델 민감도 고려)
            acc_rank = 0.5 * cos_01_lift + 0.5 * bonus_mid
            acc_rank = float(np.clip(acc_rank, 0.0, 1.0))
            # 활동/수락률 기본값
            act  = 0.85 if (u.projectExp or u.coverLetter or u.techStack) else 0.60
            arat = 0.75 if u.projectExp else 0.55

            acc_items.append({
                "rank_score":   acc_rank,
                "matcher_prob": cos_01_lift,
                "cosine":       cos_01_lift,     # 혹시 'cos_sim'이 아닌 'cosine'로 학습된 경우 대비
                "user_activity_90d":       act,
                "user_accept_rate_global": arat,
                "traits_cosine": tcos,
                "traits_l1":     tl1,
                "traits_l2":     tl2,
                "mbti_match_cnt": mm_cnt,
                "mbti_ge3":       ge3,
                "offers_last_30d":  offers_30,
                "accepts_last_30d": accepts_30,
            })
            rows.append({"userId": u.userId, "rank_score": rscore})
        # 수락확률 요청 (예외/오류 → 0.0)
        probs = _acceptor_probs(acc_items)
        if len(probs) != len(rows):
            # 길이 불일치시 안전 보정
            probs = (probs + [0.0] * len(rows))[:len(rows)]

        # 정규화
        _norm = _safe_norm_builder([r["rank_score"] for r in rows])

        scored = []
        for r, p in zip(rows, probs):
            p = float(np.clip(p, 0.0, 1.0))  # [0..1]
            # 확률 0.00~1.00 → 1~99%로 클램프 (보기 좋게)
            p_disp = p ** 0.6
            pcts  = max(1, min(99, int(round(100.0 * p_disp))))
            pob = max(1, min(99, int(round(100.0 * p_disp))))
            scored.append({"id": int(r["userId"]), "norm": _norm(r["rank_score"]), "pob": pob})

        # norm → pob 순으로 소트 후 top_n
        scored.sort(key=lambda x: (x["norm"], x["pob"]), reverse=True)
        top = scored[: int(req.top_n or 4)]

        # 응답 구성 (키는 "1","2",...)
        out = {str(i+1): FastApiResultItem(**it) for i, it in enumerate(top)}
        return {"result": out}

    except HTTPException:
        raise
    except Exception as e:
        logging.exception("[frontend/recommend] unexpected error")
        # JSON으로 에러 반환해도 FastAPI가 500을 유지하게 하려면 HTTPException 사용
        raise HTTPException(status_code=500, detail=f"frontend_recommend failed: {type(e).__name__}: {e}")
