"""FastAPI dependencies + persistence helpers.

The DB is wired at startup into app.state.db (a sessionmaker) and may be None if
the database is unavailable — the AI endpoints keep working and persist
best-effort. Durable-only endpoints use get_db (503 if no DB).
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

import structlog
from fastapi import HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

log = structlog.get_logger(__name__)


async def get_db(request: Request) -> AsyncIterator[AsyncSession]:
    """Required DB session — commits on success, rolls back on error, 503 if no DB."""
    sm: async_sessionmaker[AsyncSession] | None = getattr(request.app.state, "db", None)
    if sm is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    async with sm() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@asynccontextmanager
async def best_effort_db(request: Request) -> AsyncIterator[AsyncSession | None]:
    """Persist if the DB is up; never fail the request if it isn't.

    Usage:
        async with best_effort_db(request) as db:
            if db: await repo.save_...(db, ...)
    Commits on clean exit; swallows + logs any persistence error.
    """
    sm: async_sessionmaker[AsyncSession] | None = getattr(request.app.state, "db", None)
    if sm is None:
        yield None
        return
    session = sm()
    try:
        yield session
        await session.commit()
    except Exception as e:  # noqa: BLE001 — persistence is best-effort here
        await session.rollback()
        log.warning("persist.best_effort_failed", error=str(e)[:200])
    finally:
        await session.close()
