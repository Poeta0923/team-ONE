#공통 CV 러너(훅 호출, 통계 집계) => 공통 CV 러너 + 평균/표준편차 집계 + 과적합 신호 간단 판정
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
import numpy as np
import time, json, os

from .cv_split import kfold_indices

@dataclass
class CVHooks:
    # raw_data: 서비스별 원시 입력(리스트/딕셔너리 등)
    # idxs: fold 내 인덱스
    def build_dataset(self, raw_data: Any, idxs: np.ndarray) -> Any: ...
    def train_model(self, train_ds: Any, cfg: Dict[str, Any]) -> Tuple[Any, Dict[str, Any]]: ...
    def evaluate(self, model: Any, val_ds: Any, metrics: List[str]) -> Dict[str, float]: ...

def _reduce_mean_std(folds: List[Dict[str, Any]]) -> Dict[str, Dict[str, float]]:
    # folds[i]["metrics"]의 공통 키들에 대해 mean/std 계산
    keys = set().union(*(f["metrics"].keys() for f in folds))
    out = {}
    for k in keys:
        arr = [f["metrics"][k] for f in folds if k in f["metrics"]]
        out[k] = {"mean": float(np.mean(arr)), "std": float(np.std(arr, ddof=1)) if len(arr)>1 else 0.0}
    return out

def _detect_overfit(folds: List[Dict[str, Any]], train_logs: List[Dict[str, Any]]) -> Dict[str, Any]:
    # 아주 단순 룰: 마지막 에폭에서 val_metric 하락/표준편차 과대 여부만 체크
    reasons = []
    if len(folds) >= 2:
        for mname, stat in _reduce_mean_std(folds).items():
            if stat["mean"] != 0 and (stat["std"]/abs(stat["mean"]) > 0.15):
                reasons.append(f"high_std_ratio({mname}:{stat['std']:.3f}/{stat['mean']:.3f})")
                break
    # train_logs: {"train_loss_curve":[...], "val_metric_curve":[...]}
    for tl in train_logs:
        vm = tl.get("val_metric_curve")
        if vm and len(vm) >= 3 and vm[-1] < vm[-2] < vm[-3]:
            reasons.append("val_metric_drop_late")
            break
    return {"detected": len(reasons) > 0, "reasons": reasons}

def run_cv(
    raw_data: Any,
    k: int, seed: int,
    stratify: bool,
    group: Optional[List[Any]],
    labels: Optional[List[Any]],
    metrics: List[str],
    cfg: Dict[str, Any],
    hooks: CVHooks,
    job_paths: Dict[str, str],  # {"root":..., "fold_dir": lambda i:...}
    save_artifacts=True,
) -> Dict[str, Any]:
    n = len(raw_data)
    stratify_y = np.array(labels) if stratify and labels is not None else None
    group_arr  = np.array(group) if group is not None else None

    folds = kfold_indices(n, k, seed, stratify_y=stratify_y, group=group_arr)
    fold_results, train_logs = [], []

    for fi, (tr_idx, va_idx) in enumerate(folds):
        t0 = time.time()
        train_ds = hooks.build_dataset(raw_data, tr_idx)
        val_ds   = hooks.build_dataset(raw_data, va_idx)

        model, tlog = hooks.train_model(train_ds, cfg)
        res_metrics = hooks.evaluate(model, val_ds, metrics)
        train_logs.append(tlog or {})

        art = {}
        if save_artifacts:
            fdir = job_paths["fold_dir"](fi)
            os.makedirs(fdir, exist_ok=True)
            with open(os.path.join(fdir, "metrics.json"), "w", encoding="utf-8") as f:
                json.dump(res_metrics, f, ensure_ascii=False, indent=2)
            if "model_saver" in cfg and callable(cfg["model_saver"]):
                mpath = os.path.join(fdir, "model.bin")
                cfg["model_saver"](model, mpath)
                art["model_path"] = mpath

        fold_results.append({
            "fold": fi,
            "sec": round(time.time()-t0, 2),
            "metrics": res_metrics,
            "artifacts": art
        })

    summary = _reduce_mean_std(fold_results)
    overfit = _detect_overfit(fold_results, train_logs)
    return {"k": k, "folds": fold_results, "summary": summary, "overfit_signals": overfit}
