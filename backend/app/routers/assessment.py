"""Adaptive assessment endpoint — IRT computerized adaptive testing over the API.

POST /v1/assessment/next: send the item bank + responses so far; get back the
current ability estimate (θ ± SE, percentile, reliability) and the next item to
administer — the one that maximizes Fisher information at the candidate's current
θ — or done=true when the measurement is precise enough. Stateless (the client
holds the response history); a DB-backed session lands with the persistence layer.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from adapters.persistence import repositories as repo
from app.deps import best_effort_db
from domain.assessment.adaptive import AdaptiveSession, StoppingConfig
from domain.assessment.irt import Item

router = APIRouter(prefix="/v1/assessment", tags=["assessment"])


class ItemIn(BaseModel):
    id: str
    a: float = 1.0
    b: float = 0.0
    c: float = 0.0
    skill: str = ""


class ResponseIn(BaseModel):
    item_id: str
    correct: bool


class NextRequest(BaseModel):
    pool: list[ItemIn] = Field(min_length=1)
    responses: list[ResponseIn] = []
    max_se: float = 0.32
    min_items: int = 4
    max_items: int = 30
    min_skills: int = 0
    candidate_id: str | None = None    # if set, persist the cumulative skill graph
    skill_id: str | None = None        # which skill this ability estimate updates


@router.post("/next")
async def next_item(req: NextRequest, request: Request) -> dict[str, Any]:
    items = {i.id: Item(id=i.id, a=i.a, b=i.b, c=i.c, skill=i.skill) for i in req.pool}
    session = AdaptiveSession(
        pool=list(items.values()),
        config=StoppingConfig(max_se=req.max_se, min_items=req.min_items,
                              max_items=req.max_items, min_skills=req.min_skills),
    )
    # Replay the response history to reconstruct ability + administered set.
    for r in req.responses:
        item = items.get(r.item_id)
        if item is None:
            raise HTTPException(status_code=422, detail=f"response references unknown item '{r.item_id}'")
        session.record(item, r.correct)

    # Persist best-effort: the item bank (idempotent upsert) and the candidate's
    # cumulative skill state (θ ± SE) — the durable skill graph. Per-response rows
    # are left to a session-backed flow (this endpoint is stateless).
    async with best_effort_db(request) as db:
        if db is not None:
            await repo.upsert_items(db, [i.model_dump() for i in req.pool])
            if req.candidate_id and req.skill_id:
                await repo.upsert_skill_state(
                    db, req.candidate_id, req.skill_id,
                    theta=session.ability.theta, theta_se=session.ability.se,
                    n_responses=session.n_administered,
                )

    nxt = session.next_item()
    return {
        "ability": {
            "theta": session.ability.theta,
            "se": session.ability.se,
            "reliability": session.ability.reliability,
            "percentile": session.ability.percentile,
        },
        "done": session.is_done(),
        "next_item": None if nxt is None else {"id": nxt.id, "a": nxt.a, "b": nxt.b, "c": nxt.c, "skill": nxt.skill},
        "report": session.report(),
    }


@router.get("/skill/{candidate_id}/{skill_id}")
async def skill_state(candidate_id: str, skill_id: str, request: Request) -> dict[str, Any]:
    """The candidate's persisted ability on a skill (cumulative skill graph)."""
    async with best_effort_db(request) as db:
        state = await repo.get_skill_state(db, candidate_id, skill_id) if db is not None else None
    return {"found": state is not None, "state": state}
