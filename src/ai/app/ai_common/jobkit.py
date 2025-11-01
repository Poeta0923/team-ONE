#job_id, 상태/아티팩트 저장 => job_id 생성, 상태/요약 저장, 디렉터리 경로 제공
from datetime import datetime, timezone
import os, json

def make_job_id(service: str, kind: str) -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return f"{ts}-{service}-{kind}"

def make_paths(service: str, job_id: str) -> dict:
    root = os.path.join("models", service, job_id)
    os.makedirs(root, exist_ok=True)
    return {
        "root": root,
        "fold_dir": lambda i: os.path.join(root, f"fold-{i}"),
        "status": os.path.join(root, "status.json"),
        "summary": os.path.join(root, "summary.json"),
    }

def save_status(paths: dict, status: dict):
    with open(paths["status"], "w", encoding="utf-8") as f:
        json.dump(status, f, ensure_ascii=False, indent=2)

def save_summary(paths: dict, data: dict):
    with open(paths["summary"], "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
