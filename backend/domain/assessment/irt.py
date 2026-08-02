"""Item Response Theory core — the psychometric engine for adaptive assessment.

Implements the 3-parameter logistic (3PL) model. Every item carries calibrated
parameters — discrimination a, difficulty b, guessing c — so a candidate's
ability θ is measured on ONE scale comparable across every assessment they take.
This is the assessment-side of the moat (Part 11): the calibrated item bank +
cumulative skill graph. θ is estimated by Bayesian EAP over a fixed grid — same
technique as the interview EIE, so the two intelligence layers share a scale.

Greenfield (no JS to port) — verified by mathematical properties, not parity.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from domain.evaluation.psychometrics import _js_round, normal_pdf

# θ grid: -4..4 step 0.05 (161 points) — finer than the EIE grid for sharper SE.
GRID: list[float] = [round(-4 + i * 0.05, 4) for i in range(161)]


def _logistic(x: float) -> float:
    return 1 / (1 + math.exp(-x))


@dataclass(frozen=True)
class Item:
    """A calibrated assessment item."""
    id: str
    a: float = 1.0          # discrimination (slope)
    b: float = 0.0          # difficulty (location on θ)
    c: float = 0.0          # guessing (lower asymptote), e.g. 0.25 for 4-option MCQ
    skill: str = ""         # skill/competency this item loads on


def prob_correct(theta: float, item: Item) -> float:
    """3PL probability of a correct response at ability θ."""
    return item.c + (1 - item.c) * _logistic(item.a * (theta - item.b))


def item_information(theta: float, item: Item) -> float:
    """Fisher information the item provides about θ (3PL).

    I(θ) = a² · (Q/P) · [(P−c)/(1−c)]²  — peaks near θ ≈ b and higher for
    sharper (large a) items. This is what adaptive selection maximizes.
    """
    p = prob_correct(theta, item)
    q = 1 - p
    if p <= 0 or p >= 1 or item.c >= 1:
        return 0.0
    return (item.a ** 2) * (q / p) * ((p - item.c) / (1 - item.c)) ** 2


@dataclass
class Ability:
    theta: float
    se: float
    reliability: float
    percentile: int


def eap_estimate(responses: list[tuple[Item, int]], prior_mean: float = 0.0, prior_sd: float = 1.0) -> Ability:
    """Bayesian EAP ability estimate from (item, correct∈{0,1}) responses.

    Posterior ∝ prior(θ) · Π P_i(θ)^{u_i}(1−P_i(θ))^{1−u_i}. Returns the posterior
    mean (θ̂), its SE (honest uncertainty), marginal reliability, and percentile.
    With no responses, returns the prior.
    """
    log_post = []
    for t in GRID:
        lp = math.log(normal_pdf((t - prior_mean) / prior_sd) + 1e-300)
        for item, u in responses:
            p = min(max(prob_correct(t, item), 1e-9), 1 - 1e-9)
            lp += (math.log(p) if u else math.log(1 - p))
        log_post.append(lp)
    m = max(log_post)
    unnorm = [math.exp(lp - m) for lp in log_post]
    z = sum(unnorm) or 1.0
    post = [x / z for x in unnorm]

    theta = sum(t * post[i] for i, t in enumerate(GRID))
    variance = sum((t - theta) ** 2 * post[i] for i, t in enumerate(GRID))
    se = math.sqrt(variance)
    reliability = max(0.0, min(1.0, 1 - variance / (prior_sd * prior_sd)))
    # Standard-normal percentile of θ.
    from domain.evaluation.psychometrics import normal_cdf
    return Ability(
        theta=_js_round(theta, 3),
        se=_js_round(se, 3),
        reliability=_js_round(reliability, 3),
        percentile=_js_round(normal_cdf(theta) * 100),
    )


def test_information(theta: float, items: list[Item]) -> float:
    """Total test information (sum of item informations) at θ — inverse of SE²."""
    return sum(item_information(theta, it) for it in items)
