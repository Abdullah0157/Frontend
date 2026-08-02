"""Analytics + CRM projections over persisted evaluations."""

from __future__ import annotations

import json
import os
from typing import AsyncIterator

from starlette.testclient import TestClient

from app.main import app
from ports.llm import Completion, CompletionRequest, Token, Usage


def _ratings(level: int) -> dict:
    return {"ratings": [
        {"competency_id": cid, "state": "measured", "bars_level": level, "confidence": 0.9,
         "evidence": [{"quote": "x", "turn_ref": 2}, {"quote": "y", "turn_ref": 4}]}
        for cid in ["structured_problem_solving", "ownership", "communication", "learning_velocity",
                    "integrity_judgment", "technical_depth", "system_design"]
    ]}


class Fake:
    def __init__(self, level: int) -> None:
        self.level = level

    async def complete(self, req: CompletionRequest) -> Completion:
        payload = {"verdicts": []} if "verdicts" in req.messages[-1].content else _ratings(self.level)
        return Completion(text=json.dumps(payload), model="fake", tier=req.tier, usage=Usage())

    async def stream(self, req: CompletionRequest) -> AsyncIterator[Token]:
        yield Token(text="")


_MSGS = [
    {"role": "assistant", "content": "Tell me about a system you built."},
    {"role": "user", "content": "I built a payments service with read replicas."},
]


def test_analytics_and_pipeline() -> None:
    if os.path.exists("jobstream.db"):
        os.remove("jobstream.db")
    with TestClient(app) as c:
        # One strong candidate, one weak.
        app.state.llm = Fake(5)
        c.post("/v1/score", json={"role": "SWE", "candidate_id": "cand_a", "messages": _MSGS})
        app.state.llm = Fake(1)
        c.post("/v1/score", json={"role": "SWE", "candidate_id": "cand_b", "messages": _MSGS})

        summary = c.get("/v1/analytics/summary").json()
        assert summary["total_evaluations"] == 2
        assert summary["candidates_evaluated"] == 2
        assert sum(summary["by_band"].values()) == 2      # band distribution covers both
        assert summary["avg_composite"] is not None

        pipe = c.get("/v1/candidates").json()
        assert pipe["count"] == 2
        ids = {row["candidate_id"] for row in pipe["candidates"]}
        assert ids == {"cand_a", "cand_b"}

        # Filter the recruiter pipeline by band.
        strong_band = next(r["band"] for r in pipe["candidates"] if r["candidate_id"] == "cand_a")
        filtered = c.get("/v1/candidates", params={"band": strong_band}).json()
        assert all(r["band"] == strong_band for r in filtered["candidates"])
