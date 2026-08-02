"""API test: the interview runtime endpoint drives the LangGraph turn loop."""

from __future__ import annotations

import json
from typing import AsyncIterator

from starlette.testclient import TestClient

from app.main import app
from orchestration.interview_graph import build_interview_graph
from ports.llm import Completion, CompletionRequest, Token, Usage

_STRONG = {"ratings": [
    {"competency_id": cid, "state": "measured", "bars_level": 5, "confidence": 0.9,
     "evidence": [{"quote": "x", "turn_ref": 2}, {"quote": "y", "turn_ref": 4}]}
    for cid in ["structured_problem_solving", "ownership", "communication", "learning_velocity",
                "integrity_judgment", "technical_depth", "system_design"]
]}


class FakeGateway:
    async def complete(self, req: CompletionRequest) -> Completion:
        if req.tier == "presenter":
            return Completion(text="What was the hardest trade-off you made?", model="fake", tier=req.tier, usage=Usage())
        payload = {"verdicts": []} if "verdicts" in req.messages[-1].content else _STRONG
        return Completion(text=json.dumps(payload), model="fake", tier=req.tier, usage=Usage())

    async def stream(self, req: CompletionRequest) -> AsyncIterator[Token]:
        yield Token(text="")


def test_interview_turn_endpoint_presents_then_concludes() -> None:
    with TestClient(app) as c:
        # Swap in an offline graph for this test.
        app.state.interview_graph = build_interview_graph(FakeGateway())

        # First turn — no answers yet → a question is returned.
        r1 = c.post("/v1/interview/turn", json={
            "session_id": "sess_1", "role": "Senior Backend Engineer", "seniority": "senior", "messages": [],
        })
        assert r1.status_code == 200
        b1 = r1.json()
        assert b1["done"] is False
        assert b1["question"]
        assert b1["next_target"] is not None

        # Later turn — enough strong answers → concludes with a decision.
        messages = []
        for i in range(5):
            messages.append({"role": "assistant", "content": f"Q{i}"})
            messages.append({"role": "user", "content": f"Strong, specific answer {i} with real outcomes."})
        r2 = c.post("/v1/interview/turn", json={
            "session_id": "sess_1", "role": "Senior Backend Engineer", "seniority": "senior", "messages": messages,
        })
        b2 = r2.json()
        assert b2["done"] is True
        assert b2["question"] is None
        assert b2["decision"]["band"] in ("Strong Hire", "Hire")
