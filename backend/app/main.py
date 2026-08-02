"""FastAPI entrypoint — thin. Wires adapters into ports at startup (DI) and
mounts routers. The app knows nothing about which LLM provider is behind the
gateway."""

from __future__ import annotations

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI

from adapters.gemini_live import GeminiLiveProvider
from adapters.litellm_gateway import LiteLLMGateway
from app.routers import analytics, assessment, demo, evaluate, health, interview, voice
from infra.db import init_models, make_engine, make_sessionmaker
from infra.settings import get_settings
from orchestration.interview_graph import build_interview_graph

log = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    # Compose the object graph once. Everything downstream depends on the PORT
    # (LLMGateway), not this concrete adapter — so this is the only line that
    # would change to swap the whole LLM layer.
    app.state.llm = LiteLLMGateway(settings.models_config_path)
    app.state.interview_graph = build_interview_graph(app.state.llm)
    app.state.voice = GeminiLiveProvider()  # realtime voice (Gemini Live pilot)

    # Database — best-effort at startup. If it's unavailable the AI endpoints
    # still work; persistence just no-ops (app.state.db stays None).
    app.state.db = None
    app.state.db_engine = None
    try:
        engine = make_engine(settings.database_url)
        await init_models(engine)  # create tables if missing (idempotent; prod also runs Alembic)
        app.state.db = make_sessionmaker(engine)
        app.state.db_engine = engine
        log.info("db.ready", url=settings.database_url.split("://")[0])
    except Exception as e:  # noqa: BLE001
        log.warning("db.unavailable", error=str(e)[:200])

    log.info("startup", env=settings.env, gateway="litellm", graph="interview", db=bool(app.state.db))
    yield
    if app.state.db_engine is not None:
        await app.state.db_engine.dispose()
    log.info("shutdown")


app = FastAPI(
    title="JobStream Backend",
    version="0.1.0",
    summary="AI-native spine — provider-independent LLM gateway (P0)",
    lifespan=lifespan,
)

from infra.observability import ObservabilityMiddleware  # noqa: E402

app.add_middleware(ObservabilityMiddleware)  # request id + timing on every request

app.include_router(health.router)
app.include_router(demo.router)
app.include_router(evaluate.router)
app.include_router(interview.router)
app.include_router(assessment.router)
app.include_router(voice.router)
app.include_router(analytics.router)
