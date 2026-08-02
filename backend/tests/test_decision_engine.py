"""EIE decision engine — Python port parity + behavioral tests.

Reference values produced by the original JS engine (lib/decision-engine.js).
"""

from __future__ import annotations

from domain.evaluation.decision_engine import (
    ability_percentile,
    bar_for_seniority,
    cost_threshold,
    decide_hire,
    probability_of_success,
)


def test_strong_candidate_matches_js() -> None:
    d = decide_hire(theta=1.2, se=0.3, coverage=0.9, seniority="senior")
    assert d.band == "Strong Hire"
    assert d.p_success == 0.99
    assert d.percentile == 88
    assert d.meets_bar is True
    assert d.bar == 0.1 and d.cost_threshold == 0.67 and d.coverage == 0.9
    assert d.reason == "Ability percentile 88 · P(clears bar θ≥0.1) = 99%, at 90% coverage."


def test_medium_candidate_matches_js() -> None:
    d = decide_hire(theta=0.15, se=0.4, coverage=0.8, seniority="senior")
    assert d.band == "Hire with Reservations"
    assert (d.p_success, d.percentile, d.meets_bar) == (0.54, 56, False)


def test_weak_candidate_matches_js() -> None:
    d = decide_hire(theta=-0.6, se=0.4, coverage=0.85, seniority="senior")
    assert d.band == "Strong No Hire"
    assert (d.p_success, d.percentile) == (0.09, 27)


def test_low_coverage_gate_matches_js() -> None:
    d = decide_hire(theta=0.5, se=0.4, coverage=0.4, seniority="senior")
    assert d.band == "Needs More Evidence"
    assert d.p_success == 0.77
    assert d.percentile is None  # no verdict claimed
    assert "40%" in d.reason


def test_critical_failure_overrides_matches_js() -> None:
    d = decide_hire(theta=1.0, se=0.3, coverage=0.9, critical_failures=["integrity"], seniority="senior")
    assert d.band == "Strong No Hire"
    assert d.p_success == 0.97
    assert "integrity" in d.reason


def test_strong_but_narrow_coverage_downgrades_to_hire() -> None:
    # Strong Hire (pct 88) with coverage < 0.8 → downgraded to Hire.
    d = decide_hire(theta=1.2, se=0.3, coverage=0.7, seniority="senior")
    assert d.band == "Hire"
    assert d.percentile == 88 and d.coverage == 0.7


def test_primitives_match_js() -> None:
    assert probability_of_success(0.5, 0.4, 0.1) == 0.77
    assert bar_for_seniority("staff") == 0.4
    assert cost_threshold() == 0.6666666666666666
    assert ability_percentile(0.0) == 50


def test_band_ordering_is_monotonic() -> None:
    # Strictly increasing ability → non-decreasing favourability of the band.
    order = ["Strong No Hire", "No Hire", "Borderline", "Hire with Reservations", "Hire", "Strong Hire"]
    prev = -1
    for theta in [-1.5, -0.7, -0.1, 0.1, 0.4, 1.2]:
        d = decide_hire(theta=theta, se=0.3, coverage=0.9, seniority="senior")
        idx = order.index(d.band)
        assert idx >= prev, f"band went backwards at θ={theta}: {d.band}"
        prev = idx
