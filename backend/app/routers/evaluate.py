"""Evaluation endpoint — the ported EIE, live over the API.

POST /v1/evaluate takes a role + anchored competency ratings and returns the
full scored profile (competency posteriors, credible intervals, coverage, and a
utility-derived hiring decision). This is deterministic — no LLM call — so it's
the clean proof that the migrated Evaluation Engine runs end-to-end in Python.

Next phase wires a rater agent (LLM) that turns a raw transcript into these
ratings; this endpoint is the scoring core it will feed.
"""

from __future__ import annotations

from typing import Any

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from adapters.persistence import repositories as repo
from app.deps import best_effort_db, get_db
from domain.evaluation.competency_framework import build_model
from domain.evaluation.eie_rate import score_transcript
from domain.evaluation.eie_scoring import finalize_profile
from ports.llm import LLMGateway

router = APIRouter(prefix="/v1", tags=["evaluation"])


class Rating(BaseModel):
    competency_id: str
    bars_level: int | None = Field(default=None, ge=1, le=5)
    confidence: float | None = Field(default=None, ge=0, le=1)
    evidence: list[str] = []
    state: str | None = None                 # "unknown" to abstain
    failure_triggered: list[str] | str | None = None
    followup: str | None = None


class EvaluateRequest(BaseModel):
    role: str = Field(examples=["Senior Backend Engineer"])
    seniority: str | None = None             # inferred from role if omitted
    ratings: list[Rating]


@router.post("/evaluate")
async def evaluate(req: EvaluateRequest) -> dict[str, Any]:
    """Deterministic: pre-computed ratings → scored profile (no LLM)."""
    model = build_model(req.role, req.seniority or req.role)
    ratings = [r.model_dump(exclude_none=True) for r in req.ratings]
    return finalize_profile(model, ratings)


class Turn(BaseModel):
    role: str  # "assistant" (interviewer) | "user" (candidate)
    content: str


class ScoreRequest(BaseModel):
    role: str = Field(examples=["Senior Backend Engineer"])
    seniority: str | None = None
    name: str = ""                           # blinded out before rating
    candidate_id: str | None = None
    session_id: str | None = None
    messages: list[Turn]


@router.post("/score")
async def score(req: ScoreRequest, request: Request) -> dict[str, Any]:
    """The real product flow: transcript → LLM rater → scored profile + decision.

    Uses the injected provider-independent gateway. Never raises — returns
    {"error": ...} if the provider is unavailable. On success, the profile is
    persisted best-effort (queryable by band/score) and a result_id returned.
    """
    gateway: LLMGateway = request.app.state.llm
    result = await score_transcript(
        gateway,
        role=req.role,
        seniority=req.seniority or req.role,
        messages=[m.model_dump() for m in req.messages],
        name=req.name,
    )
    if result.get("profile"):
        result_id = uuid.uuid4().hex
        async with best_effort_db(request) as db:
            if db is not None:
                await repo.save_evaluation(db, result_id, result["profile"],
                                           candidate_id=req.candidate_id, session_id=req.session_id, role=req.role)
        result["result_id"] = result_id
    return result


@router.get("/evaluations")
async def evaluations(db: Annotated[AsyncSession, Depends(get_db)],
                      band: str | None = None, min_score: int | None = None) -> dict[str, Any]:
    """Query stored evaluations BY band/score — the durable, indexed win over a
    JSON blob you'd have to full-scan (Part 3)."""
    rows = await repo.query_evaluations(db, band=band, min_score=min_score)
    return {"count": len(rows), "results": rows}
