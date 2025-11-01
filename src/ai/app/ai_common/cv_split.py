#K-fold 분할(층화/그룹 보존) => K-fold 인덱스 생성
from typing import List, Optional, Tuple
import numpy as np
from collections import defaultdict
import math, random

def _bin_by_quantile(y: np.ndarray, bins: int = 10):
    qs = np.quantile(y, q=np.linspace(0, 1, bins+1))
    qs[0] -= 1e-9; qs[-1] += 1e-9
    return np.digitize(y, qs[1:-1])

def kfold_indices(
    n: int, k: int, seed: int,
    stratify_y: Optional[np.ndarray] = None,
    group: Optional[np.ndarray] = None
) -> List[Tuple[np.ndarray, np.ndarray]]:
    assert k >= 2 and n >= k, f"invalid k({k}) for n({n})"
    rng = random.Random(seed)

    idx = np.arange(n)
    if group is not None:
        # 그룹 보존: 같은 group은 반드시 동일 fold
        groups = defaultdict(list)
        for i, g in enumerate(group):
            groups[g].append(i)
        gkeys = list(groups.keys())
        rng.shuffle(gkeys)
        buckets = [[] for _ in range(k)]
        # 균형 분배(그룹 단위)
        for gi, gk in enumerate(gkeys):
            buckets[gi % k].extend(groups[gk])
        folds = []
        for vi in range(k):
            val_idx = np.array(sorted(buckets[vi]))
            train_idx = np.array(sorted(list(set(idx) - set(val_idx))))
            folds.append((train_idx, val_idx))
        return folds

    if stratify_y is not None:
        y = np.array(stratify_y)
        if y.dtype.kind in "f":
            yb = _bin_by_quantile(y, bins=min(10, max(3, int(math.sqrt(n)))))
        else:
            yb = y
        # 레이블별 샘플을 k개로 라운드로빈 분배
        label_to_idxs = defaultdict(list)
        for i, label in enumerate(yb):
            label_to_idxs[label].append(i)
        for v in label_to_idxs.values():
            rng.shuffle(v)
        buckets = [[] for _ in range(k)]
        ki = 0
        for _, arr in label_to_idxs.items():
            for a in arr:
                buckets[ki % k].append(a)
                ki += 1
        folds = []
        for vi in range(k):
            val_idx = np.array(sorted(buckets[vi]))
            train_idx = np.array(sorted(list(set(idx) - set(val_idx))))
            folds.append((train_idx, val_idx))
        return folds

    # 기본 K-fold
    ids = list(idx)
    rng.shuffle(ids)
    buckets = [ids[i::k] for i in range(k)]
    folds = []
    for vi in range(k):
        val_idx = np.array(sorted(buckets[vi]))
        train_idx = np.array(sorted(list(set(idx) - set(val_idx))))
        folds.append((train_idx, val_idx))
    return folds
