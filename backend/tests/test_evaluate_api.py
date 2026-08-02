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
