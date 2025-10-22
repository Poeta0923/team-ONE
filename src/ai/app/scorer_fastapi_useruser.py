# -*- coding: utf-8 -*-
from __future__ import annotations
import os, math
from typing import Optional, List, Dict, Literal
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

try:
    from sentence_transformers import SentenceTransformer
except Exception as e:
    SentenceTransformer = None

app = FastAPI(title="User-User Scorer (Smoke Inference Only)")

# ---------- Embedding ----------
_EMB = None
def get_emb_model():
    global _EMB
    if _EMB is None:
        if SentenceTransformer is None:
            raise RuntimeError("sentence-transformers is not installed")
        base = os.environ.get(
            "BASE_MODEL",
            "sentence-transformers/distiluse-base-multilingual-cased-v2"
        )
        _EMB = SentenceTransformer(base)
    return _EMB

def _encode(texts: List[str]) -> np.ndarray:
    model = get_emb_model()
    vecs = model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
    return vecs.astype(np.float32)

def _cos(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.clip((a*b).sum(), -1.0, 1.0))

# ---------- Schemas ----------
class UserFacet(BaseModel):
    id: Optional[str] = None
    skill_text: Optional[str] = None
    trait_text: Optional[str] = None
    activity_text: Optional[str] = None
    profile_text: Optional[str] = None  # 없으면 이걸 3개에 복제

class Priority(BaseModel):
    w1: float = 0.5  # 1순위(스킬)
    w2: float = 0.3  # 2순위(성향)
    w3: float = 0.2  # 3순위(활동)

class PairItem(BaseModel):
    user_q: UserFacet
    user_c: UserFacet
    priority_weights: Optional[Priority] = None

class ScoreReq(BaseModel):
    entity: Literal["user_user"] = "user_user"
    item: PairItem
    as_probability: bool = True

class BatchReq(BaseModel):
    entity: Literal["user_user"] = "user_user"
    items: List[PairItem]
    as_probability: bool = True

# ---------- Helpers ----------
def _prep(u: UserFacet):
    # None 방어: str()로 강제 캐스팅 (안전)
    st = str(u.skill_text or u.profile_text or "")
    tt = str(u.trait_text or u.profile_text or "")
    at = str(u.activity_text or u.profile_text or "")
    return f"[SKILL] {st}", f"[TRAIT] {tt}", f"[ACT] {at}"

def _score_one(it: PairItem):
    w = it.priority_weights or Priority()
    wvec = np.array([w.w1, w.w2, w.w3], dtype=np.float32)

    qs, qt, qa = _prep(it.user_q)
    cs, ct, ca = _prep(it.user_c)

    embs = _encode([qs, qt, qa, cs, ct, ca])
    q_s, q_t, q_a, c_s, c_t, c_a = embs

    s_skill = _cos(q_s, c_s)
    s_trait = _cos(q_t, c_t)
    s_act   = _cos(q_a, c_a)

    facets  = np.array([s_skill, s_trait, s_act], dtype=np.float32)
    weighted = float((facets * wvec).sum())

    scale = 2.0
    logit = float(scale * weighted)
    prob = 1.0 / (1.0 + math.exp(-max(min(logit, 30.0), -30.0)))

    return {
        "facet_scores": {
            "skill": float(s_skill),
            "trait": float(s_trait),
            "activity": float(s_act)
        },
        "weighted_score": weighted,
        "logit": logit,
        "prob": prob,
        "user_q_id": it.user_q.id,
        "user_c_id": it.user_c.id
    }

# ---------- Endpoints ----------
@app.get("/health")
def health():
    ok = True
    try:
        _ = get_emb_model()
    except Exception as e:
        ok = False
        return {"OK": ok, "error": str(e)}
    return {"OK": ok, "model": str(get_emb_model())}

@app.post("/score")
def score(req: ScoreReq):
    if req.entity != "user_user":
        raise HTTPException(400, "entity must be 'user_user' in this smoke server")
    out = _score_one(req.item)
    if not req.as_probability:
        out.pop("prob", None)
    return {"OK": True, "data": out}

@app.post("/score/batch")
def score_batch(req: BatchReq):
    if req.entity != "user_user":
        raise HTTPException(400, "entity must be 'user_user' in this smoke server")
    results = [_score_one(it) for it in req.items]
    if not req.as_probability:
        for r in results: r.pop("prob", None)
    return {"OK": True, "data": results}


# (학습/저장/로드, objective='rank'|'regression' 
#  forward에서 facet별 스코어를 가중합한 S를 손실에 투입하도록 변경.)
