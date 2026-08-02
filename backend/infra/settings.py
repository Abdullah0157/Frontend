"""12-factor settings via Pydantic. All config from env; secrets never in code."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="JS_", extra="ignore")

    env: str = "local"
    models_config_path: str = str(_BACKEND_ROOT / "config" / "models.yaml")

    # Datastores (P0 only needs these declared; wired in later phases).
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/jobstream"
    redis_url: str = "redis://localhost:6379/0"

    # Provider keys are read by LiteLLM straight from the environment
    # (OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, GROQ_API_KEY, …) —
    # we deliberately do NOT re-declare them here so no secret is ever logged.


@lru_cache
def get_settings() -> Settings:
    return Settings()
