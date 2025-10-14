from __future__ import annotations

import os
import re
import io
import gc
import json
import time
import uuid
import shutil
import string
import hashlib
import logging
import unicodedata
from datetime import datetime
from typing import List, Dict, Optional, Tuple

from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

# NLTK 문장 분할기
import nltk
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt', quiet=True)

# 언어 감지기
from langdetect import detect, DetectorFactory
DetectorFactory.seed = 42

# Sentence-Transformers (SBERT)
from sentence_transformers import SentenceTransformer, losses, InputExample
from torch.utils.data import DataLoader

# 경로/환경 기본 설정
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
MODELS_ROOT = os.path.join(BASE_DIR, 'models', 'embeddings')
LATEST_SYMLINK = os.path.join(MODELS_ROOT, 'latest')
LOG_DIR = os.path.join(BASE_DIR, 'logs')

os.makedirs(MODELS_ROOT, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)

# 기본 베이스 모델 (다국어 distiluse) - 유사도 감지
DEFAULT_BASE_MODEL = os.environ.get(
    'BASE_MODEL', 'sentence-transformers/distiluse-base-multilingual-cased-v2'
)


# 도메인 표기 정규화 사전
# 약어/변형 표기를 정규화 - "유사 문장" 쌍
DOMAIN_CANON = {
    # skills
    r"\b(py)\b": "python",
    r"\b(py\.?)torch\b": "pytorch",
    r"\bts\b": "typescript",
    r"\breact ?native\b": "reactnative",
    r"\bnlp\b": "nlp",
    r"\bmlops?\b": "mlops",
    r"\b(k8s|kubernetes)\b": "kubernetes",
    r"\bci/?cd\b": "cicd",
    r"\bgaussian splatting\b": "gaussian-splatting",
    r"\bgs-icp\b": "gs-icp",
    r"\bspring( boot)?\b": "spring-boot",
    r"\bmysql\b": "mysql",
    r"\bpostgres(ql)?\b": "postgresql",
}
DOMAIN_RX = [(re.compile(k, flags=re.I), v) for k, v in DOMAIN_CANON.items()]

# Models - Pydantic 데이터 모델(검증 및 setting 관리 라이브러리)
class Doc(BaseModel):
    id: str
    kind: str = Field(pattern=r"^(user|project)$") # user 또는 project 태그
    text: str
    language: Optional[str] = None # 미제공 자동 감지

class TrainRequest(BaseModel):
    documents: List[Doc] = Field(default_factory=list)
    epochs: int = 1
    batch_size: int = 32
    max_samples: int = 200_000
    learning_rate: float = 2e-5
    warmup_steps: int = 100
    output_tag: Optional[str] = None

class TrainJobStatus(BaseModel):
    job_id: str
    status: str
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    message: Optional[str] = None
    model_path: Optional[str] = None

class EncodeRequest(BaseModel):
    texts: List[str]
    normalize: bool = True

class EncodeResponse(BaseModel):
    embeddings: List[List[float]]
    model_path: str

# 텍스트 전처리 유틸
_url_rx = re.compile(r"https?://\S+|www\.\S+", re.I)
_email_rx = re.compile(r"[\w\.-]+@[\w\.-]+", re.I)
_space_rx = re.compile(r"\s+")
_multidot_rx = re.compile(r"(\.){2,}")
_allowed_punct = set(".,!?;:/-()[]{}'\"@#%&+")

# NFKC, URL/이메일 제거, 다중 공백/마침표 정리, 소문자화
def normalize_text(t: str) -> str:
    t = unicodedata.normalize('NFKC', t)
    t = t.replace('\u200b', ' ').replace('\ufeff', ' ')
    t = _url_rx.sub(' ', t)
    t = _email_rx.sub(' ', t)
    t = _multidot_rx.sub('.', t)
    # common punctuation 유지, 나머지는 drop
    t = ''.join(ch if (ch.isalnum() or ch.isspace() or ch in _allowed_punct) else ' ' for ch in t)
    t = t.lower()
    t = _space_rx.sub(' ', t).strip()
    return t

# 도메인 정규화 사전 적용
def apply_domain_mapping(t: str) -> str:
    for rx, rep in DOMAIN_RX:
        t = rx.sub(rep, t)
    return t

# 예외 안전 언어 감지
def detect_lang_safe(t: str) -> Optional[str]:
    try:
        return detect(t)
    except Exception:
        return None

# 문장 단위 분할 + 정규화
def split_sentences(text: str) -> List[str]:
    # 우선 NLTK 사용, 실패 시 단순 정규식 분할
    try:
        sents = nltk.sent_tokenize(text)
    except Exception:
        sents = re.split(r"(?<=[.!?\n])\s+", text)
    # cleanup - 각 문장 정규화 + 최소 길이 필터
    out = []
    for s in sents:
        s2 = normalize_text(s)
        if len(s2) >= 3:
            out.append(s2)
    return out

# MD5 해시 기반 중복 제거
def dedup_iter(strings: List[str]) -> List[str]:
    seen = set()
    out = []
    for s in strings:
        h = hashlib.md5(s.encode('utf-8')).hexdigest()
        if h not in seen:
            seen.add(h)
            out.append(s)
    return out

# 학습 데이터 생성 (positive 쌍)
def build_training_pairs(docs: List[Doc], max_samples: int = 200_000) -> List[Tuple[str, str]]:
    sentences: List[str] = []
    langs = []
    for d in docs:
        lang = d.language or detect_lang_safe(d.text) or 'unknown'
        for s in split_sentences(d.text):
            sentences.append(s)
            langs.append(lang)
    sentences = dedup_iter(sentences)

    pairs: List[Tuple[str, str]] = []
    for s in sentences:
        # augmentation: domain canonicalization (acts as a near-duplicate positive)
        aug = apply_domain_mapping(s)
        if aug != s:
            pairs.append((s, aug))
        else:
            aug2 = s.replace(' - ', '-').replace(' / ', '/').replace(' ,', ',')
            if aug2 != s:
                pairs.append((s, aug2))
    # 쌍이 너무 적으면 self-pair
    if len(pairs) < 1000:
        pairs.extend((s, s) for s in sentences[: min(len(sentences), 5000)])

    if len(pairs) > max_samples:
        pairs = pairs[:max_samples]
    return pairs

# Trainer - 학습 루틴
def train_embeddings(
    docs: List[Doc],
    epochs: int,
    batch_size: int,
    learning_rate: float,
    warmup_steps: int,
    output_tag: Optional[str],
    job: Dict[str, str],
) -> str:
    job['status'] = 'RUNNING'
    job['started_at'] = datetime.utcnow().isoformat() + 'Z'

    ts = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    out_dir = os.path.join(MODELS_ROOT, f"{ts}{('-' + output_tag) if output_tag else ''}")
    os.makedirs(out_dir, exist_ok=True)

    try:
        logging.info('Building training pairs…')
        pairs = build_training_pairs(docs, max_samples=200_000)
        if len(pairs) < 10:
            raise RuntimeError('Not enough data to train embeddings (need >= 10 pairs).')

        logging.info('Loading base model: %s', DEFAULT_BASE_MODEL)
        model = SentenceTransformer(DEFAULT_BASE_MODEL)

        # dataset build
        examples = [InputExample(texts=[a, b]) for (a, b) in pairs]
        loader = DataLoader(examples, batch_size=batch_size, shuffle=True, drop_last=True)
        loss = losses.MultipleNegativesRankingLoss(model)

        logging.info('Start training: epochs=%d, bs=%d, lr=%.2e', epochs, batch_size, learning_rate)
        model.fit(
            train_objectives=[(loader, loss)],
            epochs=epochs,
            warmup_steps=warmup_steps,
            output_path=out_dir,
            optimizer_params={'lr': learning_rate},
            show_progress_bar=False,
        )

        # 심볼릭 링크 갱신
        try:
            if os.path.islink(LATEST_SYMLINK) or os.path.exists(LATEST_SYMLINK):
                os.unlink(LATEST_SYMLINK)
            os.symlink(out_dir, LATEST_SYMLINK)
        except OSError:
            with open(os.path.join(MODELS_ROOT, 'LATEST.txt'), 'w') as f:
                f.write(out_dir)

        job['status'] = 'DONE'
        job['finished_at'] = datetime.utcnow().isoformat() + 'Z'
        job['model_path'] = out_dir
        job['message'] = f"Trained on {len(pairs)} pairs. Saved to {out_dir}"
        return out_dir

    except Exception as e:
        job['status'] = 'ERROR'
        job['finished_at'] = datetime.utcnow().isoformat() + 'Z'
        job['message'] = f"{type(e).__name__}: {e}"
        logging.exception('Training failed')
        raise
    finally:
        try:
            del model
        except Exception:
            pass
        gc.collect()

# FastAPI App
app = FastAPI(title='Embedding Trainer API')

# Root route
@app.get("/")
def root():
    return {"OK": True, "service": "Embedding Trainer API", "docs": "/docs"}


# in-memory 잡 상태 저장
JOBS: Dict[str, Dict[str, Optional[str]]] = {}

# 최신 모델 경로 조회 유틸
def latest_model_path() -> Optional[str]:
    # 심볼릭 링크 우선
    if os.path.islink(LATEST_SYMLINK):
        return os.readlink(LATEST_SYMLINK)
    # Fallback - 마커 파일
    marker = os.path.join(MODELS_ROOT, 'LATEST.txt')
    if os.path.exists(marker):
        return open(marker).read().strip()
    return None

# 헬스체크 엔드포인트
@app.get('/train/health')
def health():
    return {
        'OK': True,
        'data': {
            'status': 'UP',
            'base_model': DEFAULT_BASE_MODEL,
            'models_root': MODELS_ROOT,
            'latest_model': latest_model_path(),
            'deps': {
                'nltk_punkt': True,
                'langdetect': True,
                'torch': True,
                'sentence_transformers': True,
            }
        }
    }

# 학습 시작 엔드포인트
@app.post('/train/embeddings', response_model=TrainJobStatus)
def start_training(req: TrainRequest, bt: BackgroundTasks):
    if not req.documents:
        raise HTTPException(status_code=400, detail='documents is required and cannot be empty')

    job_id = uuid.uuid4().hex[:12]
    job = {
        'job_id': job_id,
        'status': 'PENDING',
        'started_at': None,
        'finished_at': None,
        'message': None,
        'model_path': None,
    }
    JOBS[job_id] = job

    bt.add_task(
        train_embeddings,
        docs=req.documents,
        epochs=req.epochs,
        batch_size=req.batch_size,
        learning_rate=req.learning_rate,
        warmup_steps=req.warmup_steps,
        output_tag=req.output_tag,
        job=job,
    )

    return TrainJobStatus(**job)

# 잡 상태 조회
@app.get('/train/jobs/{job_id}', response_model=TrainJobStatus)
def job_status(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail='job not found')
    return TrainJobStatus(**job)

# 추론용(인코딩) 모델 캐시
_MODEL = None
_MODEL_PATH = None

def get_model():
    global _MODEL, _MODEL_PATH
    mp = latest_model_path() or DEFAULT_BASE_MODEL
    if _MODEL is None or _MODEL_PATH != mp:
        _MODEL = SentenceTransformer(mp)
        _MODEL_PATH = mp
    return _MODEL, mp


# 텍스트 임베딩 엔드포인트
@app.post('/encode', response_model=EncodeResponse)
def encode(req: EncodeRequest):
    model, mp = get_model()
    texts = [normalize_text(t) if req.normalize else t for t in req.texts]
    vecs = model.encode(texts, convert_to_numpy=True).tolist()
    return EncodeResponse(embeddings=vecs, model_path=mp)

# 코사인 유사도 계산
class SimRequest(BaseModel):
    a: str
    b: str
    normalize: bool = True

@app.post('/similarity')
def similarity(req: SimRequest):
    model, mp = get_model()
    a = normalize_text(req.a) if req.normalize else req.a
    b = normalize_text(req.b) if req.normalize else req.b
    va, vb = model.encode([a, b], convert_to_numpy=True)
    import math
    def _norm(x):
        return math.sqrt(float((x * x).sum()))
    cos = float((va * vb).sum() / (_norm(va) * _norm(vb) + 1e-12))
    return {"similarity": cos, "model_path": mp}


# 최신 모델 경로 조회
@app.get('/models/latest')
def get_latest_model():
    mp = latest_model_path()
    if not mp:
        raise HTTPException(status_code=404, detail='no trained model yet')
    return { 'OK': True, 'data': { 'model_path': mp } }


# 개발용 로컬 실행 진입점
if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8080)

# 평가 엔드포인트 (/train/eval)
class EvalPair(BaseModel):
    a: str
    b: str
    label: Optional[float] = None # 참값 유사도(0~1), 없으면 비지도 통계만
    normalize: Optional[bool] = True

class EvalRequest(BaseModel):
    pairs: List[EvalPair]
    map_cosine_to_unit: Optional[bool] = False # [-1,1] -> [0,1] => MAE/MSE/labels

class EvalResponse(BaseModel):
    n: int
    mean_cosine: float
    std_cosine: float
    spearman_rho: Optional[float]
    mae: Optional[float]
    mse: Optional[float]
    details: List[Dict[str, float]]


def _cosine(u, v) -> float:
    import math
    uu = float((u * u).sum())
    vv = float((v * v).sum())
    if uu <= 0.0 or vv <= 0.0:
        return 0.0
    return float((u * v).sum() / (math.sqrt(uu) * math.sqrt(vv) + 1e-12))


def _spearman_rho(xs: List[float], ys: List[float]) -> Optional[float]:
    # scipy 없이 스피어만 rho 계산(동순위 평균 처리)
    if len(xs) != len(ys) or len(xs) == 0:
        return None
    def ranks(arr: List[float]) -> List[float]:
        # average rank
        idx = sorted(range(len(arr)), key=lambda i: arr[i])
        r = [0.0]*len(arr)
        i = 0
        while i < len(arr):
            j = i
            while j+1 < len(arr) and arr[idx[j+1]] == arr[idx[i]]:
                j += 1
            avg = (i + j + 2) / 2.0  # ranks => 1-based
            for k in range(i, j+1):
                r[idx[k]] = avg
            i = j + 1
        return r
    rx, ry = ranks(xs), ranks(ys)
    # Pearson ranks
    n = len(xs)
    mx = sum(rx)/n
    my = sum(ry)/n
    num = sum((rx[i]-mx)*(ry[i]-my) for i in range(n))
    denx = sum((rx[i]-mx)**2 for i in range(n))
    deny = sum((ry[i]-my)**2 for i in range(n))
    import math
    den = math.sqrt(denx*deny)
    if den == 0:
        return None
    return num/den


@app.post('/train/eval', response_model=EvalResponse)
def eval_pairs(req: EvalRequest):
    if not req.pairs:
        raise HTTPException(status_code=400, detail='pairs is required')
    model, mp = get_model()
    cosines: List[float] = []
    golds: List[float] = []
    details: List[Dict[str, float]] = []

    # 배치 인코딩 준비 
    batch_texts: List[str] = []
    batch_idx: List[Tuple[int, int]] = []  # (pair_i, 0|1)

    def flush_batch():
        nonlocal batch_texts, batch_idx
        if not batch_texts:
            return []
        embs = model.encode(batch_texts, convert_to_numpy=True)
        res = embs
        batch_texts = []
        batch_idx = []
        return res

    # Build flat batch
    for i, p in enumerate(req.pairs):
        a = normalize_text(p.a) if (p.normalize is None or p.normalize) else p.a
        b = normalize_text(p.b) if (p.normalize is None or p.normalize) else p.b
        batch_texts.extend([a, b])
        batch_idx.extend([(i,0), (i,1)])

    # 한 번에 임베딩
    import numpy as np
    embs = model.encode(batch_texts, convert_to_numpy=True)
    # (a,b) 쌍별 코사인 계산
    for i in range(0, len(embs), 2):
        u = embs[i]
        v = embs[i+1]
        c = _cosine(u, v)
        cosines.append(c)
        details.append({"cosine": float(c)})

    import math
    n = len(cosines)
    mean_c = float(sum(cosines)/n)
    std_c = float(math.sqrt(sum((x-mean_c)**2 for x in cosines)/n))

    rho = None
    mae = None
    mse = None

    # 라벨이 있는 항목 -> 한해 지도 지표 계산
    labeled = [(cosines[i], p.label) for i, p in enumerate(req.pairs) if p.label is not None]
    if labeled:
        xs = [c for c, _ in labeled]
        if req.map_cosine_to_unit:
            xs = [(c + 1.0) / 2.0 for c in xs]  # [-1,1] -> [0,1]
        ys = [float(y) for _, y in labeled]
        # 순위상관 - 일관성 측정
        rho = _spearman_rho(xs, ys)
        # MAE / MSE
        diffs = [xs[i] - ys[i] for i in range(len(xs))]
        mae = float(sum(abs(d) for d in diffs) / len(diffs))
        mse = float(sum(d*d for d in diffs) / len(diffs))

    return EvalResponse(
        n=n,
        mean_cosine=mean_c,
        std_cosine=std_c,
        spearman_rho=(None if rho is None else float(rho)),
        mae=mae,
        mse=mse,
        details=details,
    )

