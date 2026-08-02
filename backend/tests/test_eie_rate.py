"""EIE rater — transcript → ratings → profile, wiring P0 (gateway) into P1 (EIE).

Uses a FAKE gateway (offline, deterministic) so the full pipeline is verified
without any provider key: prompt built → response parsed → engine aggregates.
With any real provider key the same code runs against OpenAI/Anthropic/Gemini/…
"""

from __future__ import annotations

import json
from typing import AsyncIterator

import pytest

from domain.evaluation.eie_rate import build_rater_prompt, score_transcript, score_transcript_ensemble
from domain.evaluation.competency_framework import build_model
from ports.llm import Completion, CompletionRequest, LLMGateway, Token, Usage

TRANSCRIPT = [
    {"role": "assistant", "content": "Walk me through a system you designed."},
    {"role": "user", "content": "I built a payments service on Postgres with read replicas; p99 dropped 900ms→120ms."},
    {"role": "assistant", "content": "What broke?"},
    {"role": "user", "content": "Replication lag caused stale reads; I routed consistency-critical reads to the primary."},
]

# A canned rater output the fake gateway returns for every call.
_RATINGS = {
    "ratings": [
        {"competency_id": "structured_problem_solving", "state": "measured", "bars_level": 4, "confidence": 0.8, "evidence": [{"quote": "routed reads", "turn_ref": 4}]},
        {"competency_id": "ownership", "state": "measured", "bars_level": 4, "confidence": 0.8, "evidence": [{"quote": "I built", "turn_ref": 2}]},
        {"competency_id": "communication", "state": "measured", "bars_level": 4, "confidence": 0.7, "evidence": [{"quote": "clear", "turn_ref": 2}]},
        {"competency_id": "learning_velocity", "state": "unknown", "bars_level": None, "confidence": 0.2, "followup": "Ask about learning."},
        {"competency_id": "integrity_judgment", "state": "measured", "bars_level": 4, "confidence": 0.7, "evidence": [{"quote": "what broke", "turn_ref": 4}]},
        {"competency_id": "technical_depth", "state": "measured", "bars_level": 5, "confidence": 0.9, "evidence": [{"quote": "replication lag", "turn_ref": 4}, {"quote": "p99", "turn_ref": 2}]},
        {"competency_id": "system_design", "state": "measured", "bars_level": 4, "confidence": 0.8, "evidence": [{"quote": "read replicas", "turn_ref": 2}]},
    ]
}


class FakeGateway:
    """Returns canned rater JSON — proves the pipeline without a real provider."""

    def __init__(self) -> None:
        self.calls = 0

    async def complete(self, req: CompletionRequest) -> Completion:
        self.calls += 1
        # The verifier prompt asks for "verdicts"; everything else gets ratings.
        content = req.messages[-1].content
        if "verdicts" in content:
            payload = {"verdicts": []}
        else:
            payload = _RATINGS
        return Completion(text=json.dumps(payload), model="fake/model", tier=req.tier, usage=Usage())

    async def stream(self, req: CompletionRequest) -> AsyncIterator[Token]:
        yield Token(text="")


def test_prompt_includes_anchors_and_competencies() -> None:
    model = build_model("Senior Backend Engineer")
    prompt = build_rater_prompt(model, "Senior Backend Engineer", "transcript here")
    assert "BARS anchors" in prompt
    for c in model["competencies"]:
        assert c["id"] in prompt          # every competency must be rated
    assert "STRICT JSON" in prompt


@pytest.mark.asyncio
async def test_score_transcript_produces_profile_offline() -> None:
    gw: LLMGateway = FakeGateway()
    out = await score_transcript(gw, role="Senior Backend Engineer", messages=TRANSCRIPT, name="John Smith")
    assert "profile" in out, out
    p = out["profile"]
    assert p["framework_version"] == "eie-2025.1"
    assert p["decision"]["band"] in ("Strong Hire", "Hire")
    # learning_velocity was "unknown" → surfaced, not scored as zero.
    assert "Learning Velocity" in p["unknown_competencies"]
    # Blinding ran before rating.
    assert p["audit"]["blinded"] is True


@pytest.mark.asyncio
async def test_score_transcript_handles_bad_json() -> None:
    class BadGateway(FakeGateway):
        async def complete(self, req: CompletionRequest) -> Completion:
            return Completion(text="not json at all", model="fake", tier=req.tier, usage=Usage())

    out = await score_transcript(BadGateway(), role="SWE", messages=TRANSCRIPT)
    assert out.get("error") == "parse failed"  # never raises, returns an error


@pytest.mark.asyncio
async def test_ensemble_runs_multiple_raters_and_grades_interview() -> None:
    gw = FakeGateway()
    out = await score_transcript_ensemble(gw, role="Senior Backend Engineer", messages=TRANSCRIPT, n_raters=2)
    assert "profile" in out, out
    p = out["profile"]
    assert p["rater_count"] == 2
    assert gw.calls >= 2                       # ran multiple raters + a verifier
    assert "interview_quality" in p            # graded the interview itself
    assert p["interview_quality"]["grade"] in ("A+", "A", "B", "C", "D", "F")
