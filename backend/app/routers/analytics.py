"""Analytics + CRM projections — read-only role-shaped views over the durable data.

Thin surfaces over the same substrate (Part 6): the recruiter sees a candidate
pipeline, an admin sees hiring analytics, all from the event-sourced evaluations
and the cumulative skill graph. Queryable columns (band/score) make these cheap.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from adapters.persistence import repositories as repo
from app.deps import get_db
from app.security import require_api_key

# Analytics/CRM expose aggregate candidate data → require the API key (when set).
router = APIRouter(prefix="/v1", tags=["analytics", "crm"], dependencies=[Depends(require_api_key)])

Db = Annotated[AsyncSession, Depends(get_db)]


@router.get("/analytics/summary")
async def analytics_summary(db: Db) -> dict[str, Any]:
    """Admin dashboard rollup: totals, band distribution, average composite/coverage."""
    return await repo.analytics_summary(db)


@router.get("/candidates")
async def candidates(db: Db, band: str | None = None) -> dict[str, Any]:
    """Recruiter pipeline: each candidate with their latest evaluation (filter by band)."""
    rows = await repo.candidate_pipeline(db, band=band)
    return {"count": len(rows), "candidates": rows}


@router.get("/candidates/{candidate_id}/skills")
async def candidate_skills(candidate_id: str, db: Db) -> dict[str, Any]:
    """A candidate's cumulative skill graph (θ ± SE per skill)."""
    skills = await repo.candidate_skill_graph(db, candidate_id)
    return {"candidate_id": candidate_id, "skills": skills}
