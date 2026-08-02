"""EIE calibration / outcome loop — Python port parity tests (ref: lib/calibration.js)."""

from __future__ import annotations

from domain.evaluation.calibration import (
    auc,
    brier_score,
    expected_calibration_error,
    point_biserial,
    recalibrate_bar,
    validity_summary,
)

PAIRS = [{"p": (i % 10) / 10 + 0.05, "outcome": 1 if (i % 10) >= 5 else 0} for i in range(60)]
ROWS = [{"theta": (i % 8) - 3.5, "outcome": 1 if (i % 8) - 3.5 > 0 else 0} for i in range(40)]


def test_brier_auc_ece_match_js() -> None:
    assert brier_score(PAIRS) == 0.082
    assert auc(PAIRS) == 1
    assert expected_calibration_error(PAIRS) == 0.25


def test_recalibrate_bar_matches_js() -> None:
    bar = recalibrate_bar(ROWS)
    assert bar["status"] == "ok"
    assert (bar["bar"], bar["j"], bar["accuracy"], bar["n"]) == (0.5, 1, 1, 40)


def test_point_biserial_matches_js() -> None:
    x = [1.2, 0.5, -0.3, 0.8, -1.0, 1.5, 0.1, -0.6, 0.9, -0.2]
    y = [1, 1, 0, 1, 0, 1, 0, 0, 1, 0]
    assert point_biserial(x, y) == 0.887


def test_validity_summary_gates_on_sample_size() -> None:
    assert validity_summary(PAIRS)["status"] == "calibrated"
    assert validity_summary(PAIRS[:10])["status"] == "insufficient_data"


def test_insufficient_outcomes_never_claim_validity() -> None:
    # The scientific-integrity guarantee: small n → labeled prior, no false validity.
    vs = validity_summary(PAIRS[:5])
    assert vs["calibration"] == "uncalibrated_prior"
    assert recalibrate_bar(ROWS[:3])["status"] == "insufficient_data"
