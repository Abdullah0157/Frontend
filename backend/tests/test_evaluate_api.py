"""API-level test: the ported EIE runs end-to-end through FastAPI.

No provider keys / network — the scoring core is deterministic.
"""

from __future__ import annotations

from starlette.testclient import TestClient

from app.main import app

RATINGS = [
    {"competency_id": "structured_problem_solving", "bars_level": 5, "confidence": 0.9, "evidence": ["e1", "e2"]},
    {"competency_id": "ownership", "bars_level": 4, "confidence": 0.8, "evidence": ["e1"]},
    {"competency_id": "communication", "bars_level": 4, "confidence": 0.7, "evidence": ["e1"]},
    {"competency_id": "learning_velocity", "bars_level": 3, "confidence": 0.6, "evidence": ["e1"]},
    {"competency_id": "integrity_judgment", "bars_level": 4, "confidence": 0.75, "evidence": ["e1"]},
    {"competency_id": "technical_depth", "bars_level": 5, "confidence": 0.9, "evidence": ["e1", "e2"]},
    {"competency_id": "system_design", "state": "unknown", "confidence": 0.2},
]


def test_evaluate_endpoint_returns_scored_profile() -> None:
    with TestClient(app) as c:
        r = c.post("/v1/evaluate", json={"role": "Senior Backend Engineer", "ratings": RATINGS})
        assert r.status_code == 200
        p = r.json()
        # Same result as the ported engine — proves the whole stack is wired.
        assert p["composite_score"] == 81
        assert p["decision"]["band"] == "Strong Hire"
        assert p["coverage"] == 0.84
        assert p["unknown_competencies"] == ["System Design"]
        assert p["framework_version"] == "eie-2025.1"


def test_evaluate_validates_input() -> None:
    with TestClient(app) as c:
        # bars_level out of range → 422 from Pydantic, no crash.
        r = c.post("/v1/evaluate", json={"role": "SWE", "ratings": [{"competency_id": "ownership", "bars_level": 9}]})
        assert r.status_code == 422


def test_score_endpoint_uses_injected_gateway() -> None:
    """POST /v1/score: transcript → decision, via the (here faked) gateway."""
    import json as _json
    from ports.llm import Completion, CompletionRequest, Usage

    ratings = {"ratings": [
        {"competency_id": "technical_depth", "state": "measured", "bars_level": 5, "confidence": 0.9, "evidence": [{"quote": "x", "turn_ref": 2}, {"quote": "y", "turn_ref": 2}]},
        {"competency_id": "system_design", "state": "measured", "bars_level": 4, "confidence": 0.8, "evidence": [{"quote": "z", "turn_ref": 2}]},
        {"competency_id": "ownership", "state": "measured", "bars_level": 4, "confidence": 0.8, "evidence": [{"quote": "o", "turn_ref": 2}]},
        {"competency_id": "structured_problem_solving", "state": "measured", "bars_level": 4, "confidence": 0.85, "evidence": [{"quote": "s", "turn_ref": 2}, {"quote": "s2", "turn_ref": 2}]},
        {"competency_id": "communication", "state": "measured", "bars_level": 4, "confidence": 0.7, "evidence": [{"quote": "c", "turn_ref": 2}]},
        {"competency_id": "learning_velocity", "state": "measured", "bars_level": 3, "confidence": 0.6, "evidence": [{"quote": "l", "turn_ref": 2}]},
        {"competency_id": "integrity_judgment", "state": "measured", "bars_level": 4, "confidence": 0.7, "evidence": [{"quote": "i", "turn_ref": 2}]},
    ]}

    class Fake:
        async def complete(self, req: CompletionRequest) -> Completion:
            return Completion(text=_json.dumps(ratings), model="fake", tier=req.tier, usage=Usage())

        async def stream(self, req):  # pragma: no cover - unused
            yield None

    with TestClient(app) as c:
        app.state.llm = Fake()  # override the real gateway for this test
        r = c.post("/v1/score", json={
            "role": "Senior Backend Engineer",
            "name": "John Smith",
            "messages": [
                {"role": "assistant", "content": "Tell me about a system you built."},
                {"role": "user", "content": "I'm John Smith; I built a payments service with read replicas."},
            ],
        })
        assert r.status_code == 200
        p = r.json()["profile"]
        assert p["decision"]["band"] in ("Strong Hire", "Hire", "Hire with Reservations")
        assert p["audit"]["blinded"] is True  # candidate name blinded before rating
