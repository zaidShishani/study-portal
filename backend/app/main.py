from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import decks, me

# shortcut: API docs (/docs, /openapi.json) are public; disable when deployed beyond localhost
app = FastAPI(title="Study Portal")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(me.router)
app.include_router(decks.router)
