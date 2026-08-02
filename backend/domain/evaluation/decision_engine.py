"""Decision Engine — EIE (ported from lib/decision-engine.js).

Turns the composite θ posterior into a defensible hiring decision using decision
theory, not arbitrary score bands:

  • "Success" = the candidate's true ability clears a role/seniority BAR (τ).
  • P(success) = P(θ ≥ τ | posterior) — integrates the FULL uncertainty.
  • Bayes-optimal action: HIRE when P(success) ≥ cost threshold
        c* = cost(bad hire) / (cost(bad hire) + cost(missed good hire)).
  • 7 bands map from the ability percentile, gated on coverage.

SCIENTIFIC INTEGRITY: until outcome data calibrates τ, the bar is a LABELED
PRIOR ASSUMPTION ('uncalibrated_prior'), never a claim of predictive validity.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from domain.evaluation.psychometrics import _js_round, normal_cdf

# Ability bar τ (θ units) to "succeed" at a seniority. LABELED PRIOR.
DEFAULT_BAR = {"ic3": -0.3, "senior": 0.1, "staff": 0.4, "exec": 0.6}

# Model-uncertainty floor added in quadrature to the measurement SE so P(success)
# doesn't saturate to ~100% for a tightly-measured candidate above the bar.
MODEL_SE_FLOOR = 0.35

# A bad hire is ~2× as costly as missing a good candidate → threshold ≈ 0.67.
DEFAULT_COST = {"bad_hire": 2, "missed_good": 1}


def bar_for_seniority(seniority: str, override: float | None = None) -> float:
    if override is not None and math.isfinite(override):
        return override
    return DEFAULT_BAR.get(seniority, 0.0)


def cost_threshold(cost: dict | None = None) -> float:
    cost = cost or DEFAULT_COST
    b = cost.get("bad_hire", 2)
    m = cost.get("missed_good", 1)
    return b / (b + m)


def probability_of_success(theta: float | None, se: float | None, bar: float) -> float | None:
    """P(θ ≥ bar | N(theta, se)), with the model-uncertainty floor."""
    if theta is None or se is None or not math.isfinite(theta) or not math.isfinite(se) or se < 0:
        return None
    se_decision = math.sqrt(se * se + MODEL_SE_FLOOR * MODEL_SE_FLOOR)
    return _js_round(1 - normal_cdf((bar - theta) / se_decision), 2)


def ability_percentile(theta: float) -> int:
    return _js_round(normal_cdf(theta) * 100)


@dataclass
class Decision:
    band: str
    p_success: float | None
    bar: float
    cost_threshold: float
    calibration: str
    reason: str
    percentile: int | None = None
    meets_bar: bool | None = None
    coverage: float | None = None


def decide_hire(
    theta: float | None,
    se: float | None,
    coverage: float,
    critical_failures: list[str] | None = None,
    seniority: str = "senior",
    bar_override: float | None = None,
    cost: dict | None = None,
) -> Decision:
    critical_failures = critical_failures or []
    cost = cost or DEFAULT_COST
    bar = bar_for_seniority(seniority, bar_override)
    c = _js_round(cost_threshold(cost), 2)

    # Coverage gate: too little decision weight measured → don't pretend.
    if theta is None or not math.isfinite(theta) or coverage < 0.6:
        return Decision(
            band="Needs More Evidence",
            p_success=probability_of_success(theta, se, bar),
            bar=bar, cost_threshold=c, calibration="uncalibrated_prior",
            reason=(
                f"Only {_js_round((coverage or 0) * 100)}% of decision-relevant competencies "
                f"were adequately evidenced — insufficient to decide."
            ),
        )
    if critical_failures:
        return Decision(
            band="Strong No Hire",
            p_success=probability_of_success(theta, se, bar),
            bar=bar, cost_threshold=c, calibration="uncalibrated_prior",
            reason=f"Critical failure signal in: {', '.join(critical_failures)}.",
        )

    p = probability_of_success(theta, se, bar)
    # Band on the ability PERCENTILE (robustly ordered), not the saturating
    # probability. P(success) is still reported.
    pct = ability_percentile(theta)
    if pct >= 68:
        band = "Strong Hire"
    elif pct >= 60:
        band = "Hire"
    elif pct >= 52:
        band = "Hire with Reservations"
    elif pct >= 44:
        band = "Borderline"
    elif pct >= 30:
        band = "No Hire"
    else:
        band = "Strong No Hire"

    # Strong Hire additionally requires solid coverage.
    if band == "Strong Hire" and coverage < 0.8:
        band = "Hire"

    assert p is not None
    return Decision(
        band=band,
        p_success=p,
        percentile=pct,
        meets_bar=p >= c,
        bar=bar,
        cost_threshold=c,
        coverage=_js_round(coverage, 2),
        calibration="uncalibrated_prior",
        reason=(
            f"Ability percentile {pct} · P(clears bar θ≥{bar}) = {_js_round(p * 100)}%, "
            f"at {_js_round(coverage * 100)}% coverage."
        ),
    )
