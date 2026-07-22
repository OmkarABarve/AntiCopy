"""FastAPI application: health endpoints + the monitoring WebSocket.

Protocol
--------
Browser connects to ``/ws/monitor/{session_id}`` and streams typed inbound
events (transcript / gaze / activity / question / control). The server ingests
them into a :class:`SessionState`, recomputes a :class:`MonitorState` snapshot
on a throttled cadence, and streams it back for the reviewer dashboard.
"""

from __future__ import annotations

import asyncio
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import TypeAdapter, ValidationError

from . import __version__

# Import registries so extractors/detectors self-register at startup.
from . import detectors as _detectors  # noqa: F401
from . import extractors as _extractors  # noqa: F401
from .config import settings
from .pipeline import build_state
from .schemas import (
    AckMessage,
    ActivityEvent,
    ControlEvent,
    ErrorMessage,
    GazeEvent,
    InboundEvent,
    QuestionEvent,
    TranscriptEvent,
)
from .session import registry

@asynccontextmanager
async def lifespan(_: FastAPI):
    # Warm the spaCy model in a background thread so the first analysis request
    # isn't delayed by lazy model loading.
    from .extractors.nlp import get_nlp

    asyncio.get_event_loop().run_in_executor(None, get_nlp)
    yield


app = FastAPI(
    title="Invisible AI Cheater - Passive Interview Monitor",
    version=__version__,
    lifespan=lifespan,
    description=(
        "Passive, browser-only behavioural monitoring that estimates the "
        "probability of real-time AI interview assistance. Explainable, "
        "never-accusatory, interviewer-in-the-loop."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_inbound_adapter: TypeAdapter[InboundEvent] = TypeAdapter(InboundEvent)


@app.get("/health")
async def health() -> dict[str, object]:
    return {
        "status": "ok",
        "version": __version__,
        "extractors": [e.name for e in _extractors.EXTRACTORS],
        "detectors": [d.name for d in _detectors.DETECTORS],
        "whisperlive_enabled": settings.enable_whisperlive,
    }


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": "invisible-ai-cheater-monitor", "docs": "/docs", "health": "/health"}


def _apply_event(session_id: str, event: InboundEvent) -> None:
    session = registry.get_or_create(session_id)
    if isinstance(event, ControlEvent):
        if event.action == "start":
            session.start()
        elif event.action == "stop":
            session.stop()
        elif event.action == "reset":
            session.reset()
        return

    # Auto-start on first data event so the demo "just works".
    if session.status == "idle":
        session.start()

    if isinstance(event, TranscriptEvent):
        session.add_transcript(event)
    elif isinstance(event, GazeEvent):
        session.add_gaze(event)
    elif isinstance(event, ActivityEvent):
        session.add_activity(event)
    elif isinstance(event, QuestionEvent):
        session.add_question(event)


@app.websocket("/ws/monitor/{session_id}")
async def monitor_ws(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()
    session = registry.get_or_create(session_id)
    await websocket.send_text(
        AckMessage(session_id=session_id, message="connected").model_dump_json()
    )

    stop_event = asyncio.Event()

    async def broadcaster() -> None:
        """Periodically push a fresh state snapshot to the dashboard."""
        while not stop_event.is_set():
            try:
                state = build_state(session)
                await websocket.send_text(state.model_dump_json())
            except Exception:
                pass
            try:
                await asyncio.wait_for(
                    stop_event.wait(), timeout=settings.broadcast_interval_s
                )
            except asyncio.TimeoutError:
                continue

    broadcast_task = asyncio.create_task(broadcaster())

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                event = _inbound_adapter.validate_json(raw)
            except ValidationError as exc:
                await websocket.send_text(
                    ErrorMessage(message=f"invalid event: {exc.errors()[:1]}").model_dump_json()
                )
                continue
            _apply_event(session_id, event)
    except WebSocketDisconnect:
        pass
    finally:
        stop_event.set()
        broadcast_task.cancel()
        try:
            await broadcast_task
        except (asyncio.CancelledError, Exception):
            pass


def run() -> None:  # pragma: no cover - convenience entry point
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":  # pragma: no cover
    _ = time  # keep import used if trimmed later
    run()
