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

from fastapi import APIRouter
from pydantic import BaseModel, Field

from domain.evaluation.competency_framework import build_model
from domain.evaluation.eie_scoring import finalize_profile

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
    model = build_model(req.role, req.seniority or req.role)
    ratings = [r.model_dump(exclude_none=True) for r in req.ratings]
    return finalize_profile(model, ratings)
