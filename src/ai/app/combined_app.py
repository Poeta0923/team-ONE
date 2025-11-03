# combined_app.py
from fastapi import FastAPI

# 개별 앱 import
from scorer_fastapi_useruser import app as scorer_app
from acceptor_fastapi import app as acceptor_app
from traits_fastapi import app as traits_app
from embedding_fastapi import app as embedding_app

app = FastAPI(title="Team-ONE Unified API")

for route in scorer_app.router.routes:
    app.router.routes.append(route)

app.mount("/acceptor", acceptor_app)   # /acceptor/train/...
app.mount("/traits", traits_app)       # /traits/score ...
app.mount("/embed", embedding_app)     # /embed/encode ...

@app.get("/healthz")
def healthz():
    return {"OK": True, "services": ["scorer(root)", "acceptor(/acceptor)", "traits(/traits)", "embed(/embed)"]}
