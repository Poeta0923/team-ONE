# acceptor_fastapi.py
from __future__ import annotations
import os, time, json, shutil, inspect, traceback
from pathlib import Path
from typing import List, Optional, Literal
from typing import Any, Dict
import numpy as np
import joblib
from fastapi import FastAPI
from pydantic import BaseModel, Field
from ai_common.cv_runner import CVHooks, run_cv
from ai_common.jobkit import make_job_id, make_paths, save_status, save_summary
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.calibration import CalibratedClassifierCV
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
    calibrate: Optional[Literal["isotonic", "sigmoid"]] = None
    calibrate_cv: int = 3
    min_child_weight: int = 1
    max_delta_step: int = 0
    reg_alpha: float = 0.0
    gamma: float = 0.0
    base_score: Optional[float] = None   # 양성비 초기화용 (None이면 자동)
    threshold_fixed: Optional[float] = None
    target_recall: Optional[float] = None

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

def choose_threshold_for_recall(y: np.ndarray, p: np.ndarray, target: float = 0.8) -> float:
    # thresholds는 낮→높 정렬, recall은 일반적으로 낮은 thr에서 높음
    precs, recs, thrs = precision_recall_curve(y, p)
    # recs는 threshold 배열보다 길이가 1 큽니다. threshold와 align 위해 마지막 요소 제거

    if len(thrs) == 0:
        return 0.5
    recs = recs[:-1]
    # recall이 target 이상인 구간의 최소 threshold 선택
    idxs = np.where(recs >= target)[0]
    if len(idxs) > 0:
        return float(thrs[idxs[-1]])

    # 2) target을 달성 못하면, target에 가장 가까운 recall을 주는 threshold로 폴백
    j = int(np.argmin(np.abs(recs - target)))
    return float(thrs[j])


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
            bs = float(train_cfg.base_score) if train_cfg.base_score is not None else float(np.mean(y_train))
            self.backend = "xgboost"
            self.model = XGBClassifier(
                n_estimators=train_cfg.n_estimators,
                learning_rate=train_cfg.learning_rate,
                max_depth=train_cfg.max_depth,
                subsample=train_cfg.subsample,
                colsample_bytree=train_cfg.colsample_bytree,
                reg_lambda=train_cfg.reg_lambda,
                reg_alpha=train_cfg.reg_alpha,
                gamma=train_cfg.gamma,
                min_child_weight=train_cfg.min_child_weight,
                max_delta_step=train_cfg.max_delta_step,  
                objective="binary:logistic",
                eval_metric="logloss",
                tree_method=train_cfg.tree_method,
                scale_pos_weight=spw,
                base_score=bs,
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

        if getattr(train_cfg, "calibrate", None) in ("isotonic", "sigmoid"):
            method = "isotonic" if train_cfg.calibrate == "isotonic" else "sigmoid"
            cv_folds = int(getattr(train_cfg, "calibrate_cv", 3))
            # 기존 학습된 모델을 베이스로 캘리브레이션 래퍼를 씌우고
            self.model = CalibratedClassifierCV(self.model, method=method, cv=cv_folds)
            # 캘리브레이션은 반드시 train 데이터로만 fit
            self.model.fit(X_train, y_train)
            # 검증셋 확률을 캘리브레이션된 모델로 다시 계산
            p_valid = self.model.predict_proba(X_valid)[:, 1]

        if train_cfg.threshold_fixed is not None:
            best_thr = float(train_cfg.threshold_fixed)
        elif train_cfg.target_recall is not None:
            best_thr = choose_threshold_for_recall(y_valid, p_valid, float(train_cfg.target_recall))
        else:
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

# ----- CV 요청 스키마 (간단 공통) -----
class CVData(BaseModel):
    items: List[AcceptItem]

class CVRequest(BaseModel):
    k: int = 5
    seed: int = 42
    stratify: bool = True           # 이진 분류이므로 보통 True
    group_key: Optional[str] = None # acceptor는 보통 None
    metrics: Optional[List[str]] = None
    config: Dict[str, Any] = {}
    data: CVData          

@app.post("/train/cv")
def train_cv(req: CVRequest):
    service = "acceptor"
    job_id = make_job_id(service, "cv")
    paths  = make_paths(service, job_id)
    save_status(paths, {"progress": 0.0, "state": "running"})

    raw_items = req.data.items
    labels    = [int(it["y"]) if isinstance(it, dict) else int(it.y) for it in raw_items]
    hooks = AcceptorCVHooks()
    metrics = req.metrics or ["roc_auc","pr_auc","log_loss","brier","ece","mce"]

    res = run_cv(
        raw_data=raw_items,
        k=req.k, seed=req.seed,
        stratify=req.stratify, group=None, labels=labels,
        metrics=metrics, cfg=req.config,
        hooks=hooks, job_paths=paths, save_artifacts=True
    )
    save_summary(paths, res)
    save_status(paths, {"progress": 1.0, "state": "done"})
    return {"OK": True, "job_id": job_id, "data": res}
# ── CV 훅: 기존 학습/평가 루틴을 그대로 재사용
class AcceptorCVHooks(CVHooks):
    def __init__(self):
        super().__init__()

    def build_dataset(self, raw_data: List[Dict[str, Any]], idxs: np.ndarray):
        """
        raw_data: {"x": {...}, "y": 0/1} 형태의 dict 리스트라고 가정.
        CV 러너는 fold별로 인덱스를 넘겨주므로, 해당 샘플만 추출.
        """
        return [raw_data[i] for i in idxs]

    def train_model(self, train_ds, cfg):
        """
        - train_ds: 현재 fold의 학습용 샘플(list[dict])
        - cfg: /train/cv 요청에서 넘어온 config(dict)
        내부에서 train/valid 분할을 한 뒤, 현재 파일에 이미 있는
        AcceptorModel.fit(...)을 그대로 호출한다.
        """
        # 1) dict -> Pydantic AcceptItem으로 정규화
        items = []
        for d in train_ds:
            if isinstance(d, AcceptItem):
                items.append(d)
            else:
                # dict인 경우를 대비
                items.append(AcceptItem(
                    x=AcceptX(**d["x"]) if isinstance(d.get("x"), dict) else d["x"],
                    y=int(d["y"])
                ))

        # 2) 행렬 변환 및 학습/검증 분할
        X_all, y_all = to_matrix_and_labels(items)
        valid_size = float(cfg.get("valid_size_from_train", 0.2))
        rand_state = int(cfg.get("random_state", 42))
        X_tr, X_va, y_tr, y_va = _safe_split(
            X_all, y_all,
            test_size=valid_size,
            random_state=rand_state,
            stratify_y=True
        )
        _ensure_two_classes(y_tr, "y_train(fold)")
        _ensure_two_classes(y_va, "y_valid(fold)")

        # 3) TrainRequest 인스턴스(기존 fit 시그니처를 만족시키기 위해 생성)
        tr_cfg = TrainRequest(
            items=[],  # fit에서 사용하지 않음
            test_size=0.0,                       # CV 훅에서 테스트셋은 안 씀
            valid_size_from_train=valid_size,
            random_state=rand_state,
            n_estimators=int(cfg.get("n_estimators", 1000)),
            learning_rate=float(cfg.get("learning_rate", 0.05)),
            max_depth=int(cfg.get("max_depth", 4)),
            subsample=float(cfg.get("subsample", 0.8)),
            colsample_bytree=float(cfg.get("colsample_bytree", 0.8)),
            reg_lambda=float(cfg.get("reg_lambda", 2.0)),
            early_stopping_rounds=int(cfg.get("early_stopping_rounds", 50)),
            tree_method=cfg.get("tree_method", "hist"),
            min_child_weight=int(cfg.get("min_child_weight", 1)),
            max_delta_step=int(cfg.get("max_delta_step", 0)),
            reg_alpha=float(cfg.get("reg_alpha", 0.0)),
            gamma=float(cfg.get("gamma", 0.0)),
            base_score=cfg.get("base_score", None),
            calibrate=cfg.get("calibrate", None),
            calibrate_cv=int(cfg.get("calibrate_cv", 3)),
            threshold_fixed=cfg.get("threshold_fixed", None),
            target_recall=cfg.get("target_recall", None),

        )

        # 4) 학습 (기존 클래스 재사용)
        model = AcceptorModel()
        model.fit(X_tr, y_tr, X_va, y_va, tr_cfg)

        # 5) (선택) 과적합 판별용 로그 곡선이 있으면 넣기
        train_log = {"val_metric_curve": None}
        return model, train_log

    def evaluate(self, model, val_ds, metrics: List[str]):
        """
        - /train/evaluate 라우트의 계산식을 재사용하여 fold 검증지표 산출.
        """
        # dict → AcceptItem 정규화
        items = []
        for d in val_ds:
            if isinstance(d, AcceptItem):
                items.append(d)
            else:
                items.append(AcceptItem(
                    x=AcceptX(**d["x"]) if isinstance(d.get("x"), dict) else d["x"],
                    y=int(d["y"])
                ))

        X, y = to_matrix_and_labels(items)
        probs = model.predict_proba(X)

        # threshold: 요청에서 지정 없으면 모델이 학습 중 저장한 best_threshold 사용
        thr = float(model.meta.get("best_threshold", 0.5))
        yhat = (probs >= thr).astype(int)
        cal_all = expected_calibration_error(y, probs, n_bins=10)
        # /train/evaluate와 동일 계산(필요한 항목만)
        out = {}
        for m in (metrics or []):
            if m == "roc_auc":
                out[m] = _safe_metric(roc_auc_score, y, probs)
            elif m == "pr_auc":
                out[m] = _safe_metric(average_precision_score, y, probs)
            elif m == "f1":
                out[m] = _safe_metric(f1_score, y, yhat, zero_division=0)
            elif m == "precision":
                out[m] = _safe_metric(precision_score, y, yhat, zero_division=0)
            elif m == "recall":
                out[m] = _safe_metric(recall_score, y, yhat, zero_division=0)
            elif m == "log_loss":
                out[m] = _safe_metric(log_loss, y, probs, labels=[0, 1])
            elif m == "brier":
                out[m] = _safe_metric(brier_score_loss, y, probs)
            elif m == "ece":
                out[m] = cal_all["ECE"]
            elif m == "mce":
                out[m] = cal_all["MCE"]
            # 필요시 추가 metric 처리
        out["_threshold_used"] = thr
        return out