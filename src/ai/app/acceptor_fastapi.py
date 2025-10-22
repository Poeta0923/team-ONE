from __future__ import annotations
import os, json, gc, uuid, math, logging
from datetime import datetime
from typing import List, Optional, Dict, Tuple, Literal
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

# ----------------------------
# Paths
# ----------------------------
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
EMB_ROOT = os.path.join(BASE_DIR, "models", "embeddings")
EMB_LATEST = os.path.join(EMB_ROOT, "latest")
ACCEPT_ROOT = os.path.join(BASE_DIR, "models", "acceptor")
ACCEPT_LATEST = os.path.join(ACCEPT_ROOT, "latest")
LOG_DIR = os.path.join(BASE_DIR, "logs")
os.makedirs(ACCEPT_ROOT, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)

DEFAULT_BASE_MODEL = os.environ.get(
    "BASE_MODEL", "sentence-transformers/distiluse-base-multilingual-cased-v2"
)

# ----------------------------
# Embedding loader (same convention as other services)
# ----------------------------
try:
    from sentence_transformers import SentenceTransformer as _ST
except Exception:
    _ST = None

_emb_model = None
_emb_path: Optional[str] = None

def latest_embedding_path() -> str:
    if os.path.islink(EMB_LATEST):
        return os.readlink(EMB_LATEST)
    marker = os.path.join(EMB_ROOT, "LATEST.txt")
    if os.path.exists(marker):
        return open(marker).read().strip()
    return DEFAULT_BASE_MODEL

def get_embedding_model():
    global _emb_model, _emb_path
    mp = latest_embedding_path()
    if _emb_model is None or _emb_path != mp:
        if _ST is None:
            raise RuntimeError("sentence-transformers is not installed")
        _emb_model = _ST(mp)
        _emb_path = mp
    return _emb_model, mp

@torch.no_grad()
def encode_texts(texts: List[str], batch_size: int = 64) -> np.ndarray:
    model, _ = get_embedding_model()
    vecs = model.encode(texts, batch_size=batch_size, convert_to_numpy=True)
    return vecs.astype(np.float32)

# ----------------------------
# Feature builder
# ----------------------------
def _cosine(u: np.ndarray, v: np.ndarray) -> float:
    uu = float((u*u).sum()); vv = float((v*v).sum())
    if uu <= 0 or vv <= 0: return 0.0
    return float((u*v).sum() / (math.sqrt(uu)*math.sqrt(vv) + 1e-12))

def mbti_match_count(a: str, b: str) -> int:
    # a,b in {INTJ, ENFP, ...} length=4 ; robust fallback
    if not a or not b or len(a) != 4 or len(b) != 4: return 0
    return sum(1 for i in range(4) if a[i].upper()==b[i].upper())

def safe_sigmoid(x: float) -> float:
    x = max(min(x, 30.0), -30.0)
    return 1.0/(1.0+math.exp(-x))

# ----------------------------
# Data models
# ----------------------------
class PairFeatures(BaseModel):
    # Option A: raw texts or embeddings to derive cosine etc.
    user_text: Optional[str] = None
    project_text: Optional[str] = None
    user_emb: Optional[List[float]] = None
    project_emb: Optional[List[float]] = None

    # Option B: external providers' outputs (already computed)
    matcher_logit: Optional[float] = None
    matcher_prob: Optional[float] = None
    rank_score: Optional[float] = None

    # Traits: probability dicts aligned to same label_space on both sides (optional)
    trait_probs_user: Optional[Dict[str, float]] = None
    trait_probs_project: Optional[Dict[str, float]] = None

    # MBTI / meta
    user_mbti: Optional[str] = None
    project_mbti: Optional[str] = None  # or owner/lead’s MBTI for the project
    # Activity logs (normalized)
    user_activity_90d: Optional[float] = None
    user_accept_rate_global: Optional[float] = None
    user_accept_rate_group: Optional[float] = None
    offers_last_30d: Optional[float] = None
    accepts_last_30d: Optional[float] = None

class LabeledExample(BaseModel):
    x: PairFeatures
    y: int = Field(ge=0, le=1)  # accepted? 1/0

class TrainRequest(BaseModel):
    samples: List[LabeledExample]
    epochs: int = 5
    batch_size: int = 128
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
    item: PairFeatures
    model_id: Optional[str] = None
    as_probability: bool = True

class SandboxRequest(BaseModel):
    items: List[PairFeatures]
    model_id: Optional[str] = None

class EvalRequest(BaseModel):
    items: List[LabeledExample]
    model_id: Optional[str] = None

# ----------------------------
# Tabular feature vectorization
# ----------------------------
FEAT_NAMES = [
    "cosine", "matcher_logit", "matcher_prob", "rank_score",
    "mbti_match_cnt", "mbti_ge3",
    "traits_cosine", "traits_l1", "traits_l2",
    "user_activity_90d", "user_accept_rate_global","user_accept_rate_group",
    "offers_last_30d","accepts_last_30d"
]

def traits_to_vec(u: Dict[str, float], p: Dict[str, float]) -> Tuple[float,float,float]:
    if not u or not p: return (0.0,0.0,0.0)
    # align label space
    labels = sorted(set(u.keys()) & set(p.keys()))
    if not labels: return (0.0,0.0,0.0)
    uu = np.array([u[k] for k in labels], dtype=np.float32)
    pp = np.array([p[k] for k in labels], dtype=np.float32)
    cos = _cosine(uu, pp)
    l1 = float(np.mean(np.abs(uu-pp)))
    l2 = float(np.sqrt(np.mean((uu-pp)**2)))
    return (cos, l1, l2)

def ensure_embs(x: PairFeatures) -> Optional[Tuple[np.ndarray,np.ndarray]]:
    if x.user_emb is not None and x.project_emb is not None:
        return (np.asarray(x.user_emb, dtype=np.float32), np.asarray(x.project_emb, dtype=np.float32))
    if x.user_text and x.project_text:
        U = encode_texts([x.user_text])[0]
        P = encode_texts([x.project_text])[0]
        return (U,P)
    return None

def vectorize(x: PairFeatures) -> np.ndarray:
    feats = dict((k, 0.0) for k in FEAT_NAMES)

    # cosine
    embs = ensure_embs(x)
    if embs:
        feats["cosine"] = _cosine(embs[0], embs[1])

    # matcher
    if x.matcher_logit is not None:
        feats["matcher_logit"] = float(x.matcher_logit)
    if x.matcher_prob is not None:
        feats["matcher_prob"] = float(x.matcher_prob)
    if x.rank_score is not None:
        feats["rank_score"] = float(x.rank_score)

    # MBTI
    mc = mbti_match_count(x.user_mbti or "", x.project_mbti or "")
    feats["mbti_match_cnt"] = float(mc)
    feats["mbti_ge3"] = 1.0 if mc >= 3 else 0.0

    # traits
    tcos, tl1, tl2 = traits_to_vec(x.trait_probs_user or {}, x.trait_probs_project or {})
    feats["traits_cosine"] = tcos
    feats["traits_l1"] = tl1
    feats["traits_l2"] = tl2

    # activity/meta (already normalized upstream)
    for k in ["user_activity_90d","user_accept_rate_global","user_accept_rate_group","offers_last_30d","accepts_last_30d"]:
        v = getattr(x, k)
        if v is not None:
            feats[k] = float(v)

    return np.array([feats[k] for k in FEAT_NAMES], dtype=np.float32)

# ----------------------------
# Model (simple MLP logistic head)
# ----------------------------
class MLP(nn.Module):
    def __init__(self, in_dim: int, hidden: int = 64, p: float = 0.2):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, hidden), nn.ReLU(), nn.Dropout(p),
            nn.Linear(hidden, hidden), nn.ReLU(), nn.Dropout(p),
            nn.Linear(hidden, 1)
        )
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x).squeeze(-1)  # logits

_loaded: Optional[MLP] = None
_loaded_meta: Optional[Dict] = None
_loaded_id: Optional[str] = None

def _resolve_model_dir(model_id: Optional[str]) -> str:
    if model_id:
        d = os.path.join(ACCEPT_ROOT, model_id)
        if not os.path.isdir(d):
            raise HTTPException(404, "model not found")
        return d
    if os.path.islink(ACCEPT_LATEST):
        return os.readlink(ACCEPT_LATEST)
    marker = os.path.join(ACCEPT_ROOT, "LATEST.txt")
    if os.path.exists(marker):
        return open(marker).read().strip()
    raise HTTPException(404, "no trained acceptor model yet")

def get_model(model_id: Optional[str]=None) -> Tuple[MLP, Dict, str]:
    global _loaded, _loaded_meta, _loaded_id
    d = _resolve_model_dir(model_id)
    mid = os.path.basename(d)
    if _loaded is None or _loaded_id != mid:
        ck = torch.load(os.path.join(d, "model.pt"), map_location="cpu")
        meta = ck["meta"]
        m = MLP(in_dim=meta["in_dim"])
        m.load_state_dict(ck["state_dict"])
        m.eval()
        _loaded, _loaded_meta, _loaded_id = m, meta, mid
    return _loaded, _loaded_meta, _loaded_id

# ----------------------------
# FastAPI
# ----------------------------
app = FastAPI(title="Acceptance Predictor API")
JOBS: Dict[str, Dict[str, Optional[str]]] = {}

@app.get("/train/health")
def health():
    return {
        "OK": True,
        "data": {
            "status": "UP",
            "cuda": torch.cuda.is_available(),
            "base_embeddings": (os.readlink(EMB_LATEST) if os.path.islink(EMB_LATEST) else DEFAULT_BASE_MODEL),
            "models_root": ACCEPT_ROOT,
            "latest_model": (os.readlink(ACCEPT_LATEST) if os.path.islink(ACCEPT_LATEST) else None),
            "feature_names": FEAT_NAMES,
        }
    }

def _train(samples: List[LabeledExample], epochs: int, batch: int, lr: float, out_dir: str):
    X = np.stack([vectorize(s.x) for s in samples]).astype(np.float32)
    y = np.array([float(s.y) for s in samples], dtype=np.float32)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    ds = torch.utils.data.TensorDataset(torch.from_numpy(X), torch.from_numpy(y))
    loader = torch.utils.data.DataLoader(ds, batch_size=batch, shuffle=True, drop_last=False)

    model = MLP(in_dim=X.shape[1]).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=lr)
    loss_fn = nn.BCEWithLogitsLoss()

    model.train()
    for ep in range(epochs):
        tot, n = 0.0, 0
        for xb, yb in loader:
            xb, yb = xb.to(device), yb.to(device)
            logit = model(xb)
            loss = loss_fn(logit, yb)
            opt.zero_grad(set_to_none=True); loss.backward(); opt.step()
            tot += float(loss.item()); n += 1
        logging.info(f"[acceptor] epoch {ep+1}/{epochs} loss={tot/max(1,n):.4f}")

    meta = {
        "objective": "acceptance",
        "created_at": datetime.utcnow().strftime("%Y%m%dT%H%M%SZ"),
        "in_dim": int(X.shape[1]),
        "features": FEAT_NAMES,
        "base_embeddings": latest_embedding_path(),
    }
    torch.save({"state_dict": model.state_dict(), "meta": meta}, os.path.join(out_dir, "model.pt"))
    with open(os.path.join(out_dir, "meta.json"), "w") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    del model; gc.collect()

@app.post("/train/train", response_model=TrainJobStatus)
def start_training(req: TrainRequest, bt: BackgroundTasks):
    if not req.samples or len(req.samples) < 20:
        raise HTTPException(400, "Need >=20 labeled samples")
    ts = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    out_dir = os.path.join(ACCEPT_ROOT, f"{ts}{('-'+req.output_tag) if req.output_tag else ''}")
    os.makedirs(out_dir, exist_ok=True)

    job_id = uuid.uuid4().hex[:12]
    job = {"job_id": job_id, "status": "PENDING", "started_at": None,
           "finished_at": None, "message": None, "model_id": None}
    JOBS[job_id] = job

    def _run():
        job["status"]="RUNNING"; job["started_at"]=datetime.utcnow().isoformat()+"Z"
        try:
            _train(req.samples, req.epochs, req.batch_size, req.learning_rate, out_dir)
            # update latest
            try:
                if os.path.islink(ACCEPT_LATEST) or os.path.exists(ACCEPT_LATEST):
                    os.unlink(ACCEPT_LATEST)
                os.symlink(out_dir, ACCEPT_LATEST)
            except OSError:
                with open(os.path.join(ACCEPT_ROOT,"LATEST.txt"),"w") as f:
                    f.write(out_dir)
            job["status"]="DONE"; job["finished_at"]=datetime.utcnow().isoformat()+"Z"
            job["model_id"]=os.path.basename(out_dir); job["message"]="Saved model"
        except Exception as e:
            job["status"]="ERROR"; job["finished_at"]=datetime.utcnow().isoformat()+"Z"
            job["message"]=f"{type(e).__name__}: {e}"
    bt.add_task(_run)
    return TrainJobStatus(**job)

@app.get("/train/jobs/{job_id}", response_model=TrainJobStatus)
def job_status(job_id: str):
    job = JOBS.get(job_id); 
    if not job: raise HTTPException(404, "job not found")
    return TrainJobStatus(**job)

@app.get("/train/models")
def list_models():
    out=[]
    if os.path.isdir(ACCEPT_ROOT):
        for name in sorted(os.listdir(ACCEPT_ROOT)):
            d=os.path.join(ACCEPT_ROOT,name)
            if os.path.isdir(d) and os.path.exists(os.path.join(d,"meta.json")):
                try: meta=json.load(open(os.path.join(d,"meta.json")))
                except Exception: meta=None
                out.append({"model_id": name, "meta": meta})
    return {"OK": True, "data": out}

@app.get("/train/models/{model_id}")
def get_model_meta(model_id: str):
    d = os.path.join(ACCEPT_ROOT, model_id)
    if not os.path.isdir(d): raise HTTPException(404,"model not found")
    meta = json.load(open(os.path.join(d,"meta.json")))
    return {"OK": True, "data": meta}

@app.post("/score")
def score(req: ScoreRequest):
    model, meta, mid = get_model(req.model_id)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)
    x = vectorize(req.item)[None, :]
    logit = float(model(torch.from_numpy(x).to(device)).item())
    if req.as_probability:
        prob = safe_sigmoid(logit)
        return {"OK": True, "data": {"model_id": mid, "logit": logit, "prob": prob}}
    return {"OK": True, "data": {"model_id": mid, "logit": logit}}

@app.post("/train/inference/sandbox")
def sandbox(req: SandboxRequest):
    model, meta, mid = get_model(req.model_id)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)
    X = np.stack([vectorize(it) for it in req.items]).astype(np.float32)
    with torch.no_grad():
        logits = model(torch.from_numpy(X).to(device)).cpu().numpy()
    probs = 1.0/(1.0+np.exp(-np.clip(logits,-30,30)))
    return {"OK": True, "data": [{"logit": float(a), "prob": float(b)} for a,b in zip(logits.tolist(), probs.tolist())],
            "model_id": mid}

def _roc_auc_bin(y_true: np.ndarray, y_logit: np.ndarray) -> float:
    pos = y_logit[y_true==1]; neg = y_logit[y_true==0]
    if len(pos)==0 or len(neg)==0: return float("nan")
    order = np.argsort(np.concatenate([pos,neg]))
    ranks = np.empty_like(order, dtype=float); ranks[order]=np.arange(1,len(order)+1)
    r_pos = ranks[:len(pos)].sum()
    return float((r_pos - len(pos)*(len(pos)+1)/2.0)/(len(pos)*len(neg)))

def _pr_auc(y_true: np.ndarray, y_prob: np.ndarray) -> float:
    order = np.argsort(-y_prob)
    y = y_true[order]; tp=fp=0; P=float((y==1).sum())
    if P==0: return float("nan")
    precs=[]; recs=[]
    for v in y:
        if v==1: tp+=1
        else: fp+=1
        precs.append(tp/max(1,tp+fp)); recs.append(tp/P)
    auc=0.0; pr=1.0; rr=0.0
    for p,r in zip(precs,recs):
        auc += (r-rr)*((p+pr)/2.0); pr,rr=p,r
    return float(auc)

@app.post("/train/evaluate")
def evaluate(req: EvalRequest):
    model, meta, mid = get_model(req.model_id)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)
    X = np.stack([vectorize(s.x) for s in req.items]).astype(np.float32)
    y = np.array([float(s.y) for s in req.items], dtype=np.float32)
    with torch.no_grad():
        logits = model(torch.from_numpy(X).to(device)).cpu().numpy()
    probs = 1.0/(1.0+np.exp(-np.clip(logits,-30,30)))
    # metrics
    roc = _roc_auc_bin((y>0.5).astype(np.int32), logits)
    pr  = _pr_auc((y>0.5).astype(np.int32), probs)
    eps = 1e-12; p = np.clip(probs, eps, 1-eps)
    logloss = float((- (y*np.log(p)+(1-y)*np.log(1-p))).mean())
    brier = float(((probs - y)**2).mean())
    return {"OK": True, "data": {"model_id": mid, "n": int(len(y)),
            "roc_auc": roc, "pr_auc": pr, "log_loss": logloss, "brier": brier}}
