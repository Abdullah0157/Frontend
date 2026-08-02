"""EIE interview-quality — Python port parity tests (reference: interview-quality.js)."""

from __future__ import annotations

from domain.evaluation.competency_framework import build_model
from domain.evaluation.eie_scoring import finalize_profile
from domain.evaluation.interview_quality import interview_quality

MODEL = build_model("Senior Backend Engineer")
RATINGS = [
    {"competency_id": "structured_problem_solving", "bars_level": 4, "confidence": 0.8, "evidence": ["e1", "e2"]},
    {"competency_id": "ownership", "bars_level": 4, "confidence": 0.8, "evidence": ["e1"]},
    {"competency_id": "communication", "bars_level": 4, "confidence": 0.7, "evidence": ["e1"]},
    {"competency_id": "learning_velocity", "bars_level": 3, "confidence": 0.6, "evidence": ["e1"]},
    {"competency_id": "integrity_judgment", "bars_level": 4, "confidence": 0.7, "evidence": ["e1"]},
    {"competency_id": "technical_depth", "bars_level": 4, "confidence": 0.8, "evidence": ["e1", "e2"]},
    {"competency_id": "system_design", "bars_level": 4, "confidence": 0.75, "evidence": ["e1"]},
]


def test_interview_quality_matches_js() -> None:
    p = finalize_profile(MODEL, RATINGS)
    iq = interview_quality(p, questions_asked=7, evasions=0)
    assert iq["score"] == 84
    assert iq["grade"] == "A"
    assert iq["flags"] == []
    assert iq["efficiency"] == 1


def test_too_short_and_evasion_flags() -> None:
    p = finalize_profile(MODEL, RATINGS[:2])  # thin coverage
    iq = interview_quality(p, questions_asked=2, evasions=1)
    assert "too_short" in iq["flags"]
    assert "unresolved_evasion" in iq["flags"]
    assert iq["grade"] in ("D", "F", "C")  # penalized
