"""Async database engine + session factory (SQLAlchemy 2).

Prod: PostgreSQL via asyncpg (settings.database_url). Tests: in-memory SQLite via
aiosqlite. The models are portable across both. Alembic owns prod schema; tests
use create_all against SQLite.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from adapters.persistence.models import Base


def make_engine(url: str, echo: bool = False) -> AsyncEngine:
    return create_async_engine(url, echo=echo, future=True)


def make_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)


async def init_models(engine: AsyncEngine) -> None:
    """Create all tables (dev/test convenience — prod uses Alembic migrations)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
