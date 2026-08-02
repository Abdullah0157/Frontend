"""EIE psychometrics — Python port parity + behavioral tests.

The reference values below were produced by running the ORIGINAL JS engine
(lib/psychometrics.js) on identical inputs. This test proves the Python port is
byte-for-byte equivalent, so the moat's scoring math survived the migration.
"""

from __future__ import annotations

from domain.evaluation.psychometrics import (
    composite_posterior,
    grm_posterior,
    grm_posterior_multi,
    prior_mean_for_seniority,
    profile_dependability,
    rater_agreement,
)


# ── Numerical parity with the JS engine (reference = node lib/psychometrics.js) ─
def test_grm_single_l5_w1_matches_js() -> None:
    p = grm_posterior(level=5, weight=1)
    assert (p.theta, p.se, list(p.ci90), p.reliability, p.percentile) == (1.2, 0.77, [-0.1, 2.5], 0.4, 89)


def test_grm_low_confidence_is_wide_and_matches_js() -> None:
    p = grm_posterior(level=3, weight=0.3)
    assert (p.theta, p.se, list(p.ci90), p.reliability, p.percentile) == (0.0, 0.86, [-1.4, 1.4], 0.26, 50)


def test_grm_high_evidence_is_tight_and_matches_js() -> None:
    p = grm_posterior(level=3, weight=3)
    assert (p.theta, p.se, list(p.ci90), p.reliability, p.percentile) == (0.0, 0.43, [-0.7, 0.7], 0.81, 50)


def test_grm_seniority_prior_matches_js() -> None:
    p = grm_posterior(level=2, weight=1, prior_mean=prior_mean_for_seniority("exec"))
    assert (p.theta, p.se, list(p.ci90), p.reliability, p.percentile) == (-0.42, 0.68, [-1.5, 0.7], 0.53, 34)


def test_multi_agreeing_raters_match_js() -> None:
    p = grm_posterior_multi([{"level": 5, "weight": 1}] * 3)
    assert p is not None
    assert (p.theta, p.se, list(p.ci90), p.reliability, p.percentile) == (1.96, 0.57, [1.1, 2.9], 0.68, 97)


def test_multi_disagreeing_raters_match_js() -> None:
    p = grm_posterior_multi([{"level": 1, "weight": 1}, {"level": 5, "weight": 1}])
    assert p is not None
    assert (p.theta, p.se, list(p.ci90), p.reliability, p.percentile) == (0.0, 0.8, [-1.3, 1.3], 0.37, 50)


def test_composite_matches_js() -> None:
    c = composite_posterior([{"theta": 1.2, "se": 0.4, "weight": 2}, {"theta": -0.3, "se": 0.6, "weight": 1}])
    assert c is not None
    assert (c.theta, c.se, list(c.ci90), c.percentile) == (0.7, 0.33, [0.15, 1.25], 76)


def test_rater_agreement_matches_js() -> None:
    assert rater_agreement([4, 4, 5]) == 0.78
    assert rater_agreement([1, 5, 3]) == 0.33


def test_dependability_matches_js() -> None:
    flat = profile_dependability([[3, 3], [3, 3], [3, 3]])
    assert flat is not None and flat.dependability is None  # flat profile → undefined, not "unreliable"
    varied = profile_dependability([[5, 5, 4], [2, 2, 3], [4, 3, 4]])
    assert varied is not None
    assert (varied.v_comp, varied.v_rater, varied.v_resid, varied.dependability) == (3.667, 0.111, 0.444, 0.95)


# ── Behavioral properties (the science, provider/model-independent) ───────────
def test_agreement_sharpens_disagreement_widens() -> None:
    agree = grm_posterior_multi([{"level": 5, "weight": 1}] * 3)
    disagree = grm_posterior_multi([{"level": 1, "weight": 1}, {"level": 5, "weight": 1}])
    assert agree is not None and disagree is not None
    assert agree.se < disagree.se          # agreeing raters → tighter posterior
    assert agree.reliability > disagree.reliability


def test_well_vs_poorly_measured_differ() -> None:
    well = grm_posterior(level=4, weight=3)     # lots of evidence
    poorly = grm_posterior(level=4, weight=0.3)  # hand-wavy
    assert well.se < poorly.se                   # same level, honest different certainty
