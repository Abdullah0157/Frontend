"""FastAPI entrypoint — thin. Wires adapters into ports at startup (DI) and
mounts routers. The app knows nothing about which LLM provider is behind the
gateway."""

from __future__ import annotations

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI

from adapters.litellm_gateway import LiteLLMGateway
from app.routers import demo, health
from infra.settings import get_settings

log = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    # Compose the object graph once. Everything downstream depends on the PORT
    # (LLMGateway), not this concrete adapter — so this is the only line that
    # would change to swap the whole LLM layer.
    app.state.llm = LiteLLMGateway(settings.models_config_path)
    log.info("startup", env=settings.env, gateway="litellm")
    yield
    log.info("shutdown")


app = FastAPI(
    title="JobStream Backend",
    version="0.1.0",
    summary="AI-native spine — provider-independent LLM gateway (P0)",
    lifespan=lifespan,
)

app.include_router(health.router)
app.include_router(demo.router)
