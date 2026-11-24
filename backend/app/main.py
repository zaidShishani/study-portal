import json
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.routers import (
    calendar,
    cards,
    dashboard,
    decks,
    events,
    me,
    notes,
    notifications,
    problems,
    review,
    roadmaps,
)

# shortcut: API docs (/docs, /openapi.json) are public; disable when deployed beyond localhost
app = FastAPI(title="Study Portal")

# A max-size note page (200k chars, <=4 UTF-8 bytes each) stays under this.
MAX_BODY_BYTES = 1_000_000


# Registered before CORS so CORS wraps it and the 413 still carries CORS headers.
@app.middleware("http")
async def limit_body_size(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
    # shortcut: checks Content-Length only, not chunked bodies; stream-count if the API is exposed beyond localhost.
    length = request.headers.get("content-length", "")
    if length.isdigit() and int(length) > MAX_BODY_BYTES:
        return JSONResponse({"detail": "Request body too large"}, status_code=413)
    return await call_next(request)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError) -> Response:
    # FastAPI's default body, but ASCII-escaped: the echoed input may hold a lone surrogate
    # (JSON "\ud83d", already rejected by Pydantic) that can't be UTF-8 encoded -> 500.
    body = json.dumps({"detail": jsonable_encoder(exc.errors())})
    return Response(body, status_code=422, media_type="application/json")


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
app.include_router(cards.router)
app.include_router(review.router)
app.include_router(problems.router)
app.include_router(notes.router)
app.include_router(roadmaps.router)
app.include_router(events.router)
app.include_router(calendar.router)
app.include_router(dashboard.router)
app.include_router(notifications.router)
