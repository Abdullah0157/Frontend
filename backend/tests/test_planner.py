"""DEIE Interview Planner — Python port parity + behavioral tests
(reference: lib/interview-planner.js)."""

from __future__ import annotations

from domain.evaluation.competency_framework import build_model
from domain.evaluation.eie_scoring import finalize_profile
from domain.interview.planner import (
    build_strategy,
    extract_resume_hooks,
    plan_from_profile,
    required_confidence,
    target_directive,
)

STRATEGY = build_strategy("Senior Backend Engineer", "senior")
MODEL = build_model("Senior Backend Engineer")


def test_strategy_and_required_confidence_match_js() -> None:
    assert len(STRATEGY["objectives"]) == 7
    assert required_confidence("senior", 0.167) == 0.6001000000000001


def test_belief_loop_targets_most_important_least_certain() -> None:
    # Only 2 competencies measured → the planner should target an UNKNOWN one,
    # and must NOT conclude (coverage too low).
    ratings = [
        {"competency_id": "technical_depth", "bars_level": 5, "confidence": 0.9, "evidence": ["e1", "e2"]},
        {"competency_id": "ownership", "bars_level": 4, "confidence": 0.8, "evidence": ["e1"]},
    ]
    profile = finalize_profile(MODEL, ratings)
    plan = plan_from_profile(STRATEGY, profile, answered=2)
    assert plan["next_target"]["name"] == "Structured Problem Solving"
    assert plan["next_target"]["move"] == "open"       # no evidence yet → open probe
    assert plan["ready_to_conclude"] is False
    assert plan["coverage"] == 0.32
    assert plan["decision_stability"]["stable"] is False


def test_resume_hooks_map_claims_to_competencies() -> None:
    hooks = extract_resume_hooks(
        "Led a team of 8 engineers. Architected a distributed system handling 5 million requests. Reduced latency by 40%.",
        MODEL,
    )
    assert set(hooks.keys()) == {"ownership", "technical_depth", "system_design"}
    assert len(hooks["ownership"]) == 3


def test_target_directive_produces_investigation_target() -> None:
    ratings = [{"competency_id": "technical_depth", "bars_level": 5, "confidence": 0.9, "evidence": ["e1", "e2"]}]
    plan = plan_from_profile(STRATEGY, finalize_profile(MODEL, ratings), answered=1)
    directive = target_directive(plan["next_target"])
    assert "INVESTIGATION TARGET" in directive
    assert "ONE natural question" in directive


def test_stable_decision_concludes_early() -> None:
    # A strong, well-covered profile → decision stable → ready to conclude.
    ratings = [
        {"competency_id": c["id"], "bars_level": 5, "confidence": 0.9, "evidence": ["e1", "e2"]}
        for c in MODEL["competencies"]
    ]
    profile = finalize_profile(MODEL, ratings)
    plan = plan_from_profile(STRATEGY, profile, answered=6)
    assert plan["ready_to_conclude"] is True
    assert plan["next_target"] is None           # nothing left worth asking
    assert plan["decision_stability"]["stable"] is True
