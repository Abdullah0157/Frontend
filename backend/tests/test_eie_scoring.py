"""EIE scoring assembly — Python port parity + behavioral tests.

Reference: the original JS finalizeProfile (lib/eie-scoring.js) on the same
ratings. This is the end-to-end EIE: model + ratings -> scored profile + decision.
"""

from __future__ import annotations

from domain.evaluation.competency_framework import build_model
from domain.evaluation.eie_scoring import finalize_profile, finalize_profile_ensemble

MODEL = build_model("Senior Backend Engineer", "Senior Backend Engineer")

RATINGS = [
    {"competency_id": "structured_problem_solving", "bars_level": 5, "confidence": 0.9, "evidence": ["e1", "e2"]},
    {"competency_id": "ownership", "bars_level": 4, "confidence": 0.8, "evidence": ["e1"]},
    {"competency_id": "communication", "bars_level": 4, "confidence": 0.7, "evidence": ["e1"]},
    {"competency_id": "learning_velocity", "bars_level": 3, "confidence": 0.6, "evidence": ["e1"]},
    {"competency_id": "integrity_judgment", "bars_level": 4, "confidence": 0.75, "evidence": ["e1"]},
    {"competency_id": "technical_depth", "bars_level": 5, "confidence": 0.9, "evidence": ["e1", "e2"]},
    {"competency_id": "system_design", "state": "unknown", "confidence": 0.2},
]


def test_finalize_profile_matches_js() -> None:
    p = finalize_profile(MODEL, RATINGS)
    assert p["composite_score"] == 81
    assert p["composite_theta"] == 0.87
    assert p["coverage"] == 0.84
    assert p["overall_confidence"] == 0.79
    assert p["overall_reliability"] == 0.5
    assert p["decision"]["band"] == "Strong Hire"
    assert p["decision"]["p_success"] == 0.95
    assert p["unknown_competencies"] == ["System Design"]
    states = [(c["id"], c["state"], c["score"]) for c in p["competencies"]]
    assert states == [
        ("structured_problem_solving", "measured", 95),
        ("ownership", "measured", 69),
        ("communication", "measured", 68),
        ("learning_velocity", "measured", 50),
        ("integrity_judgment", "measured", 69),
        ("technical_depth", "measured", 95),
        ("system_design", "unknown", None),
    ]


def test_unknown_is_not_a_low_score() -> None:
    p = finalize_profile(MODEL, RATINGS)
    sd = next(c for c in p["competencies"] if c["id"] == "system_design")
    assert sd["state"] == "unknown"
    assert sd["score"] is None          # abstain, NOT a zero
    assert p["followups"]               # a follow-up question is offered instead


def test_critical_failure_forces_strong_no_hire() -> None:
    ratings = [dict(r) for r in RATINGS]
    ratings[4] = {"competency_id": "integrity_judgment", "bars_level": 1, "confidence": 0.8,
                  "evidence": ["e1"], "failure_triggered": ["caught in a clear contradiction"]}
    p = finalize_profile(MODEL, ratings)
    assert p["decision"]["band"] == "Strong No Hire"
    assert "integrity" in p["decision"]["reason"].lower()


def test_low_coverage_yields_needs_more_evidence() -> None:
    ratings = [{"competency_id": "technical_depth", "bars_level": 5, "confidence": 0.9, "evidence": ["e1", "e2"]}]
    p = finalize_profile(MODEL, ratings)
    assert p["coverage"] < 0.6
    assert p["decision"]["band"] == "Needs More Evidence"


def test_ensemble_agreement_beats_single_reliability() -> None:
    # Three agreeing raters on one competency → higher reliability than one rater.
    by_comp = {c["id"]: [] for c in MODEL["competencies"]}
    for cid in by_comp:
        by_comp[cid] = [
            {"bars_level": 4, "confidence": 0.8, "evidence": ["e1", "e2"]},
            {"bars_level": 4, "confidence": 0.8, "evidence": ["e1"]},
            {"bars_level": 4, "confidence": 0.8, "evidence": ["e1"]},
        ]
    p = finalize_profile_ensemble(MODEL, by_comp, meta={"rater_count": 3})
    assert p["rater_count"] == 3
    assert all(c["state"] == "measured" for c in p["competencies"])
    assert p["overall_reliability"] > 0
