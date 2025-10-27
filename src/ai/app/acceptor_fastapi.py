# acceptor_fastapi.py
from __future__ import annotations
import os, time, json, shutil, inspect, traceback
from pathlib import Path
from typing import List, Optional, Literal

import numpy as np
import joblib
from fastapi import FastAPI
from pydantic import BaseModel, Field

from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    roc_auc_score, average_precision_score, f1_score,
    precision_score, recall_score, precision_recall_curve,
    log_loss, brier_score_loss,
)

# ---- Optional ML backend (XGBoost) ------------------------------------------
XGB_AVAILABLE = True
XGB_HAS_CALLBACKS = False
try:
    import xgboost as xgb
    from xgboost import XGBClassifier
    try:
        # 콜백형 얼리스톱 유무
        from xgboost.callback import EarlyStopping as XgbEarlyStopping  # type: ignore
        XGB_HAS_CALLBACKS = True
    except Exception:
        XGB_HAS_CALLBACKS = False
except Exception:
    XGB_AVAILABLE = False

# ------------------------------------------------------------------------------
# Config
# ------------------------------------------------------------------------------
APP_NAME = "Acceptance Probability Model Service"
FEATURES = [
    # ⚠️ 실제 피처명/순서에 맞게 수정
    "rank_score",
    "matcher_prob",
    "cos_sim",
    "user_activity_90d",
    "user_accept_rate_global",
]
MODEL_DIR = Path("./models/acceptor")
LATEST_SYMLINK = MODEL_DIR / "latest"
MODEL_FILENAME = "model.joblib"
META_FILENAME = "meta.json"

# ------------------------------------------------------------------------------
# Schemas
# ------------------------------------------------------------------------------
class AcceptX(BaseModel):
    rank_score: Optional[float] = None
    matcher_prob: Optional[float] = None
    cos_sim: Optional[float] = None
    user_activity_90d: Optional[float] = None
    user_accept_rate_global: Optional[float] = None

class AcceptItem(BaseModel):
    x: AcceptX
    y: int = Field(..., ge=0, le=1)

class TrainRequest(BaseModel):
    items: List[AcceptItem]
    test_size: float = 0.2
    valid_size_from_train: float = 0.2
    random_state: int = 42
    # xgboost 옵션
    n_estimators: int = 1000
    learning_rate: float = 0.05
    max_depth: int = 4
    subsample: float = 0.8
    colsample_bytree: float = 0.8
    reg_lambda: float = 2.0
    early_stopping_rounds: int = 50     # 구버전이면 무시됨(호환 래퍼 처리)
    tree_method: Literal["hist", "gpu_hist"] = "hist"

class EvalRequest(BaseModel):
    items: List[AcceptItem]
    n_bins: int = 10

class ScoreOnlyRequest(BaseModel):
    items: List[AcceptX]
    threshold: Optional[float] = 0.5
    
class EvalRequest(BaseModel):
    items: List[AcceptItem]
    n_bins: int = 10
    threshold: Optional[float] = None
# ------------------------------------------------------------------------------
# Utils
# ------------------------------------------------------------------------------
def now_id() -> str:
    return time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())

def ensure_dir(p: Path):
    p.mkdir(parents=True, exist_ok=True)

def to_matrix_and_labels(items: List[AcceptItem]) -> tuple[np.ndarray, np.ndarray]:
    X, y = [], []
    for it in items:
        row = [(getattr(it.x, f) if getattr(it.x, f) is not None else 0.0) for f in FEATURES]
        X.append(row)
        y.append(int(it.y))
    return np.asarray(X, dtype=np.float32), np.asarray(y, dtype=np.int32)

def to_matrix_only(items: List[AcceptX]) -> np.ndarray:
    return np.asarray(
        [[(getattr(it, f) if getattr(it, f) is not None else 0.0) for f in FEATURES] for it in items],
        dtype=np.float32
    )

def expected_calibration_error(y: np.ndarray, p: np.ndarray, n_bins: int = 10):
    bins = np.linspace(0, 1, n_bins + 1)
    idx = np.clip(np.digitize(p, bins) - 1, 0, n_bins - 1)
    ece, mce, N = 0.0, 0.0, len(y)
    per_bin = []
    for b in range(n_bins):
        m = (idx == b)
        cnt = int(m.sum())
        if cnt == 0:
            per_bin.append({"bin": b, "count": 0, "conf_avg": 0.0, "acc": 0.0})
            continue
        conf = float(p[m].mean())
        acc = float(y[m].mean())
        gap = abs(acc - conf)
        ece += (cnt / max(1, N)) * gap
        mce = max(mce, gap)
        per_bin.append({"bin": b, "count": cnt, "conf_avg": conf, "acc": acc})
    return {"ECE": float(ece), "MCE": float(mce), "per_bin": per_bin}

def choose_best_threshold_by_f1(y: np.ndarray, p: np.ndarray) -> float:
    precs, recs, thrs = precision_recall_curve(y, p)
    f1s = 2 * precs * recs / (precs + recs + 1e-12)
    if len(f1s) == 0:
        return 0.5
    best_idx = int(np.nanargmax(f1s))
    if len(thrs) == 0:
        return 0.5
    use_idx = max(0, min(best_idx - 1, len(thrs) - 1))
    return float(thrs[use_idx])

def compute_scale_pos_weight(y_train: np.ndarray) -> float:
    pos = int((y_train == 1).sum())
    neg = int((y_train == 0).sum())
    return max(1.0, neg / max(1, pos))

def _safe_split(X, y, test_size, random_state, stratify_y=True):
    """stratify 실패 시 비-stratify로 폴백."""
    try:
        return train_test_split(
            X, y,
            test_size=test_size,
            random_state=random_state,
            stratify=y if stratify_y else None
        )
    except ValueError:
        return train_test_split(
            X, y,
            test_size=test_size,
            random_state=random_state,
            stratify=None
        )

def _ensure_two_classes(y: np.ndarray, name: str):
    uniq = np.unique(y)
    if len(uniq) < 2:
        raise ValueError(f"{name} has a single class only: {uniq.tolist()}")

def _safe_metric(fn, *args, default=float("nan"), **kwargs):
    try:
        return float(fn(*args, **kwargs))
    except Exception:
        return default

# ------------------------------------------------------------------------------
# Model Wrapper
# ------------------------------------------------------------------------------
class AcceptorModel:
    def __init__(self):
        self.backend = None
        self.model = None
        self.meta = {
            "features": FEATURES,
            "backend": None,
            "best_threshold": 0.5,
        }

    def fit(self,
            X_train: np.ndarray, y_train: np.ndarray,
            X_valid: np.ndarray, y_valid: np.ndarray,
            train_cfg: TrainRequest):
        if XGB_AVAILABLE:
            spw = compute_scale_pos_weight(y_train)
            self.backend = "xgboost"
            self.model = XGBClassifier(
                n_estimators=train_cfg.n_estimators,
                learning_rate=train_cfg.learning_rate,
                max_depth=train_cfg.max_depth,
                subsample=train_cfg.subsample,
                colsample_bytree=train_cfg.colsample_bytree,
                reg_lambda=train_cfg.reg_lambda,
                objective="binary:logistic",
                eval_metric="logloss",
                tree_method=train_cfg.tree_method,
                scale_pos_weight=spw,
                random_state=train_cfg.random_state,
            )

            # --- XGBoost 버전 호환 fit 래퍼 ---
            sig = inspect.signature(self.model.fit)
            kwargs = {
                "X": X_train,
                "y": y_train,
                "eval_set": [(X_valid, y_valid)],
                "verbose": False,
            }
            use_es = bool(getattr(train_cfg, "early_stopping_rounds", 0)) and train_cfg.early_stopping_rounds > 0

            # (A) callbacks 지원 + EarlyStopping 콜백 사용 가능
            if ("callbacks" in sig.parameters) and XGB_HAS_CALLBACKS and use_es:
                kwargs["callbacks"] = [XgbEarlyStopping(
                    rounds=train_cfg.early_stopping_rounds,
                    save_best=True,
                    maximize=False  # eval_metric='logloss' -> 낮을수록 좋음
                )]
            # (B) callbacks는 없지만 early_stopping_rounds 인자 지원
            elif ("early_stopping_rounds" in sig.parameters) and use_es:
                kwargs["early_stopping_rounds"] = train_cfg.early_stopping_rounds
            # (C) 둘 다 미지원 -> 전통 방식으로 전체 n_estimators 학습

            self.model.fit(**kwargs)
            p_valid = self.model.predict_proba(X_valid)[:, 1]

        else:
            self.backend = "logreg"
            self.model = LogisticRegression(class_weight="balanced", max_iter=200)
            self.model.fit(X_train, y_train)
            p_valid = self.model.predict_proba(X_valid)[:, 1]

        best_thr = choose_best_threshold_by_f1(y_valid, p_valid)
        self.meta.update({"backend": self.backend, "best_threshold": best_thr})

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if self.model is None:
            raise RuntimeError("Model not loaded.")
        return self.model.predict_proba(X)[:, 1]

    def save(self, out_dir: Path):
        ensure_dir(out_dir)
        joblib.dump(self.model, out_dir / MODEL_FILENAME)
        with open(out_dir / META_FILENAME, "w") as f:
            json.dump(self.meta, f, ensure_ascii=False, indent=2)

    def load(self, in_dir: Path):
        self.model = joblib.load(in_dir / MODEL_FILENAME)
        with open(in_dir / META_FILENAME, "r") as f:
            self.meta = json.load(f)
        self.backend = self.meta.get("backend", None)

# ------------------------------------------------------------------------------
# Service state
# ------------------------------------------------------------------------------
app = FastAPI(title=APP_NAME)
STATE: dict[str, Optional[AcceptorModel]] = {"model": None}

def load_latest_if_exists():
    if LATEST_SYMLINK.exists() and (LATEST_SYMLINK / MODEL_FILENAME).exists():
        m = AcceptorModel()
        m.load(LATEST_SYMLINK)
        STATE["model"] = m
        return True
    return False

ensure_dir(MODEL_DIR)
load_latest_if_exists()

# ------------------------------------------------------------------------------
# Routes
# ------------------------------------------------------------------------------
@app.get("/train/health")
def health():
    return {
        "OK": True,
        "data": {
            "service": APP_NAME,
            "features": FEATURES,
            "xgboost_available": XGB_AVAILABLE,
            "xgboost_version": getattr(xgb, "__version__", None) if XGB_AVAILABLE else None,
            "model_loaded": STATE["model"] is not None,
            "backend": None if STATE["model"] is None else STATE["model"].backend,
        }
    }

@app.post("/train/train")
def train(req: TrainRequest):
    try:
        if len(req.items) < 10:
            return {"OK": False, "error": "need >= 10 samples to train"}

        X_all, y_all = to_matrix_and_labels(req.items)

        # 분할
        X_train_full, X_test, y_train_full, y_test = _safe_split(
            X_all, y_all,
            test_size=req.test_size,
            random_state=req.random_state,
            stratify_y=True
        )
        X_train, X_valid, y_train, y_valid = _safe_split(
            X_train_full, y_train_full,
            test_size=req.valid_size_from_train,
            random_state=req.random_state,
            stratify_y=True
        )

        # 각 세트에 두 클래스 존재 확인
        _ensure_two_classes(y_train, "y_train")
        _ensure_two_classes(y_valid, "y_valid")
        _ensure_two_classes(y_test,  "y_test")

        # 학습
        model = AcceptorModel()
        model.fit(X_train, y_train, X_valid, y_valid, req)

        # 검증 성능
        p_valid = model.predict_proba(X_valid)
        thr = model.meta["best_threshold"]
        yhat_valid = (p_valid >= thr).astype(int)
        valid_metrics = {
            "pr_auc":  _safe_metric(average_precision_score, y_valid, p_valid),
            "roc_auc": _safe_metric(roc_auc_score, y_valid, p_valid),
            "f1":      _safe_metric(f1_score, y_valid, yhat_valid, zero_division=0),
            "precision": _safe_metric(precision_score, y_valid, yhat_valid, zero_division=0),
            "recall":    _safe_metric(recall_score,    y_valid, yhat_valid, zero_division=0),
            "log_loss":  _safe_metric(log_loss, y_valid, p_valid, labels=[0,1]),
            "brier":     _safe_metric(brier_score_loss, y_valid, p_valid),
        }
        valid_cal = expected_calibration_error(y_valid, p_valid, n_bins=10)

        # 테스트 성능
        p_test = model.predict_proba(X_test)
        yhat_test = (p_test >= thr).astype(int)
        test_metrics = {
            "pr_auc":  _safe_metric(average_precision_score, y_test, p_test),
            "roc_auc": _safe_metric(roc_auc_score, y_test, p_test),
            "f1":      _safe_metric(f1_score, y_test, yhat_test, zero_division=0),
            "precision": _safe_metric(precision_score, y_test, yhat_test, zero_division=0),
            "recall":    _safe_metric(recall_score,    y_test, yhat_test, zero_division=0),
            "log_loss":  _safe_metric(log_loss, y_test, p_test, labels=[0,1]),
            "brier":     _safe_metric(brier_score_loss, y_test, p_test),
        }
        test_cal = expected_calibration_error(y_test, p_test, n_bins=10)

        # 저장
        model_id = f"{now_id()}-xgb" if model.backend == "xgboost" else f"{now_id()}-logreg"
        out_dir = MODEL_DIR / model_id
        model.save(out_dir)

        # latest 갱신
        if LATEST_SYMLINK.exists() or LATEST_SYMLINK.is_symlink():
            try:
                LATEST_SYMLINK.unlink()
            except Exception:
                pass
        try:
            os.symlink(out_dir.resolve(), LATEST_SYMLINK)
        except Exception:
            if LATEST_SYMLINK.exists():
                shutil.rmtree(LATEST_SYMLINK, ignore_errors=True)
            shutil.copytree(out_dir, LATEST_SYMLINK)

        STATE["model"] = model

        return {
            "OK": True,
            "data": {
                "model_id": model_id,
                "backend": model.backend,
                "best_threshold": thr,
                "valid": {"n": int(len(y_valid)), "metrics": valid_metrics, "calibration": valid_cal},
                "test":  {"n": int(len(y_test)),  "metrics": test_metrics,  "calibration": test_cal},
            }
        }
    except Exception as e:
        return {
            "OK": False,
            "error": f"{type(e).__name__}: {str(e)}",
            "traceback": traceback.format_exc()
        }

@app.post("/train/evaluate")
def evaluate(req: EvalRequest):
    if len(req.items) == 0:
        return {"OK": False, "error": "no items"}
    if STATE["model"] is None and not load_latest_if_exists():
        return {"OK": False, "error": "no model loaded"}

    X, y = to_matrix_and_labels(req.items)
    probs = STATE["model"].predict_proba(X)
    thr = float(req.threshold) if req.threshold is not None else float(STATE["model"].meta.get("best_threshold", 0.5))
    yhat = (probs >= thr).astype(int)

    roc = _safe_metric(roc_auc_score, y, probs)
    pr  = _safe_metric(average_precision_score, y, probs)
    f1v = _safe_metric(f1_score, y, yhat, zero_division=0)
    pv  = _safe_metric(precision_score, y, yhat, zero_division=0)
    rv  = _safe_metric(recall_score, y, yhat, zero_division=0)
    ll  = _safe_metric(log_loss, y, probs, labels=[0, 1])
    brier = _safe_metric(brier_score_loss, y, probs)
    cal = expected_calibration_error(y, probs, n_bins=req.n_bins)
    best_thr = choose_best_threshold_by_f1(y, probs)

    return {
        "OK": True,
        "data": {
            "n": int(len(y)),
            "features": FEATURES,
            "backend": STATE["model"].backend,
            "threshold": thr,
            "best_threshold_sweep_on_evalset": best_thr,
            "metrics": {
                "roc_auc": roc,
                "pr_auc": pr,
                "f1": f1v,
                "precision": pv,
                "recall": rv,
                "log_loss": ll,
                "brier": brier,
                "calibration": cal
            }
        }
    }

@app.post("/train/inference/sandbox")
def sandbox(req: ScoreOnlyRequest):
    if STATE["model"] is None and not load_latest_if_exists():
        return {"OK": False, "error": "no model loaded"}
    X = to_matrix_only(req.items)
    probs = STATE["model"].predict_proba(X)
    thr = float(req.threshold if req.threshold is not None else STATE["model"].meta.get("best_threshold", 0.5))
    preds = (probs >= thr).astype(int).tolist()
    out = [{"prob": float(p), "pred": int(h)} for p, h in zip(probs.tolist(), preds)]
    return {"OK": True, "data": out, "threshold": thr}

@app.post("/score")
def score(req: ScoreOnlyRequest):
    return sandbox(req)

# 실행 예)
# uvicorn acceptor_fastapi:app --host 0.0.0.0 --port 8091
