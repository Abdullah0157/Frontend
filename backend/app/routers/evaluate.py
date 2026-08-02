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

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

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
    messages: list[Turn]


@router.post("/score")
async def score(req: ScoreRequest, request: Request) -> dict[str, Any]:
    """The real product flow: transcript → LLM rater → scored profile + decision.

    Uses the injected provider-independent gateway. Never raises — returns
    {"error": ...} if the provider is unavailable, so callers degrade gracefully.
    """
    gateway: LLMGateway = request.app.state.llm
    return await score_transcript(
        gateway,
        role=req.role,
        seniority=req.seniority or req.role,
        messages=[m.model_dump() for m in req.messages],
        name=req.name,
    )
