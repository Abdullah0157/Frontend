"""Durable runtime: interview turns are event-sourced; assessment updates the
cumulative candidate skill graph. Offline (fake gateway + sqlite)."""

from __future__ import annotations

import json
import os
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
            return Completion(text="What was the hardest trade-off?", model="fake", tier=req.tier, usage=Usage())
        payload = {"verdicts": []} if "verdicts" in req.messages[-1].content else _STRONG
        return Completion(text=json.dumps(payload), model="fake", tier=req.tier, usage=Usage())

    async def stream(self, req: CompletionRequest) -> AsyncIterator[Token]:
        yield Token(text="")


def _fresh() -> None:
    if os.path.exists("jobstream.db"):
        os.remove("jobstream.db")


def test_interview_turns_are_event_sourced() -> None:
    _fresh()
    with TestClient(app) as c:
        app.state.interview_graph = build_interview_graph(FakeGateway())
        sid = "sess_evt"
        messages = [
            {"role": "assistant", "content": "Q1"},
            {"role": "user", "content": "A1 with specifics."},
            {"role": "assistant", "content": "Q2"},
            {"role": "user", "content": "A2 with specifics."},
        ]
        c.post("/v1/interview/turn", json={"session_id": sid, "role": "Senior Backend Engineer",
                                           "seniority": "senior", "messages": messages})
        ev = c.get(f"/v1/interview/{sid}/events").json()
        types = [e["type"] for e in ev["events"]]
        # The transcript is logged as an append-only, ordered event stream.
        assert types == ["QuestionAsked", "CandidateAnswered", "QuestionAsked", "CandidateAnswered"]
        assert [e["seq"] for e in ev["events"]] == [1, 2, 3, 4]
        assert ev["events"][1]["actor"] == "candidate"


def test_conclusion_logs_finish_and_persists_evaluation() -> None:
    _fresh()
    with TestClient(app) as c:
        app.state.interview_graph = build_interview_graph(FakeGateway())
        sid = "sess_done"
        messages = []
        for i in range(5):
            messages.append({"role": "assistant", "content": f"Q{i}"})
            messages.append({"role": "user", "content": f"Strong answer {i}."})
        r = c.post("/v1/interview/turn", json={"session_id": sid, "role": "Senior Backend Engineer",
                                               "seniority": "senior", "candidate_id": "cand_x", "messages": messages})
        assert r.json()["done"] is True
        ev = c.get(f"/v1/interview/{sid}/events").json()
        assert "InterviewFinished" in [e["type"] for e in ev["events"]]
        # The scored profile was persisted → queryable.
        q = c.get("/v1/evaluations").json()
        assert any(row["candidate_id"] == "cand_x" for row in q["results"])


def test_assessment_updates_cumulative_skill_graph() -> None:
    _fresh()
    with TestClient(app) as c:
        pool = [{"id": f"i{i}", "a": 1.4, "b": -3 + i * 0.4, "c": 0.0, "skill": "python"} for i in range(16)]
        responses = [{"item_id": f"i{i}", "correct": True} for i in range(6)]
        c.post("/v1/assessment/next", json={"pool": pool, "responses": responses,
                                            "candidate_id": "cand_y", "skill_id": "python", "max_se": 0.4})
        s = c.get("/v1/assessment/skill/cand_y/python").json()
        assert s["found"] is True
        assert s["state"]["theta"] > 0.3      # all-correct pattern raised ability
        assert s["state"]["n_responses"] == 6
