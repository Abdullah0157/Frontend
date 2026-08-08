"""Risk Analysis agent — transcript integrity scan (offline, fake gateway)."""

from __future__ import annotations

import json
from typing import AsyncIterator

import pytest
from starlette.testclient import TestClient

from app.main import app
from domain.interview.risk import analyze_risk, build_risk_prompt
from ports.llm import Completion, CompletionRequest, Token, Usage

TRANSCRIPT = [
    {"role": "assistant", "content": "Walk me through a system you designed."},
    {"role": "user", "content": "We used microservices and it was great."},
    {"role": "assistant", "content": "What broke?"},
    {"role": "user", "content": "Nothing ever broke, everything was perfect."},
]

_FLAGS = {
    "flags": [
        {"type": "evasion", "severity": "medium", "turn_ref": 4, "evidence": "Nothing ever broke", "note": "no real detail under probing"},
        {"type": "bogus_type", "severity": "high", "turn_ref": 2, "evidence": "x"},  # invalid → filtered out
    ],
    "overall_risk": "medium",
    "summary": "Some evasion on failure questions.",
}


class Fake:
    def __init__(self, payload: dict) -> None:
        self.payload = payload

    async def complete(self, req: CompletionRequest) -> Completion:
        return Completion(text=json.dumps(self.payload), model="fake", tier=req.tier, usage=Usage())

    async def stream(self, req: CompletionRequest) -> AsyncIterator[Token]:
        yield Token(text="")


def test_prompt_lists_signal_types() -> None:
    p = build_risk_prompt("SWE", "transcript")
    for t in ("evasion", "memorized", "coached", "contradiction", "fabrication"):
        assert t in p
    assert "STRICT JSON" in p


@pytest.mark.asyncio
async def test_analyze_filters_invalid_types_and_parses() -> None:
    out = await analyze_risk(Fake(_FLAGS), "SWE", TRANSCRIPT)
    assert out["overall_risk"] == "medium"
    types = [f["type"] for f in out["flags"]]
    assert types == ["evasion"]                 # bogus_type filtered out
    assert "evasion" in out["summary"].lower()


@pytest.mark.asyncio
async def test_empty_transcript_is_clean() -> None:
    out = await analyze_risk(Fake(_FLAGS), "SWE", [])
    assert out["overall_risk"] == "low"
    assert out["flags"] == []


@pytest.mark.asyncio
async def test_bad_json_never_raises() -> None:
    class Bad(Fake):
        async def complete(self, req: CompletionRequest) -> Completion:
            return Completion(text="not json", model="fake", tier=req.tier, usage=Usage())

    out = await analyze_risk(Bad({}), "SWE", TRANSCRIPT)
    assert out["overall_risk"] == "low" and out.get("error") is True  # safe default


def test_risk_endpoint() -> None:
    with TestClient(app) as c:
        app.state.llm = Fake(_FLAGS)
        r = c.post("/v1/interview/risk", json={"role": "SWE", "messages": TRANSCRIPT})
        assert r.status_code == 200
        assert r.json()["flags"][0]["type"] == "evasion"
