"""Persistence wiring: /v1/score persists a scored profile, /v1/evaluations queries it."""

from __future__ import annotations

import json
import os
from typing import AsyncIterator

from starlette.testclient import TestClient

from app.main import app
from ports.llm import Completion, CompletionRequest, Token, Usage

_STRONG = {"ratings": [
    {"competency_id": cid, "state": "measured", "bars_level": 5, "confidence": 0.9,
     "evidence": [{"quote": "x", "turn_ref": 2}, {"quote": "y", "turn_ref": 4}]}
    for cid in ["structured_problem_solving", "ownership", "communication", "learning_velocity",
                "integrity_judgment", "technical_depth", "system_design"]
]}


class Fake:
    async def complete(self, req: CompletionRequest) -> Completion:
        payload = {"verdicts": []} if "verdicts" in req.messages[-1].content else _STRONG
        return Completion(text=json.dumps(payload), model="fake", tier=req.tier, usage=Usage())

    async def stream(self, req: CompletionRequest) -> AsyncIterator[Token]:
        yield Token(text="")


def test_score_persists_and_is_queryable_by_band() -> None:
    if os.path.exists("jobstream.db"):
        os.remove("jobstream.db")  # fresh DB for isolation
    with TestClient(app) as c:      # lifespan creates the sqlite DB + tables
        app.state.llm = Fake()
        r = c.post("/v1/score", json={
            "role": "Senior Backend Engineer", "candidate_id": "cand_1",
            "messages": [
                {"role": "assistant", "content": "Tell me about a system you built."},
                {"role": "user", "content": "I built a payments service with read replicas."},
            ],
        })
        assert r.status_code == 200
        body = r.json()
        assert "result_id" in body                 # persisted → returns an id
        band = body["profile"]["decision"]["band"]

        # Durable query by band — the indexed win over a JSON blob.
        q = c.get("/v1/evaluations", params={"band": band})
        assert q.status_code == 200
        ids = [row["id"] for row in q.json()["results"]]
        assert body["result_id"] in ids
        assert any(row["candidate_id"] == "cand_1" for row in q.json()["results"])
