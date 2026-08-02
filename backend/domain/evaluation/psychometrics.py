"""Psychometrics core — EIE Measurement Engine (ported from lib/psychometrics.js).

Turns an ordered BARS rating into a Bayesian posterior over a latent ability θ
using Samejima's Graded Response Model (GRM) with EAP estimation over a fixed
θ-grid. Outputs a point estimate, a credible interval (honest uncertainty), a
norm-percentile, and marginal reliability.

Why this and not "level×20": a point score hides how well we actually measured
the person. A confident, well-evidenced L4 and a hand-wavy L4 must NOT look
identical — the second gets a wide credible interval. This is a faithful port of
the JS engine; the math is byte-for-byte equivalent (including JS Math.round
half-up rounding), verified against the same regression assertions.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


# ── JS-parity helpers ────────────────────────────────────────────────────────
def _js_round(n: float, d: int = 0) -> float:
    """Match JavaScript Math.round(n*10^d)/10^d — half rounds toward +Infinity."""
    f = 10 ** d
    r = math.floor(n * f + 0.5) / f
    return int(r) if d == 0 else r


def normal_pdf(z: float) -> float:
    return math.exp(-0.5 * z * z) / math.sqrt(2 * math.pi)


def normal_cdf(z: float) -> float:
    """Standard-normal CDF (Abramowitz & Stegun 7.1.26)."""
    t = 1 / (1 + 0.2316419 * abs(z))
    d = 0.3989423 * math.exp(-z * z / 2)
    p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
    return 1 - p if z > 0 else p


def _logistic(x: float) -> float:
    return 1 / (1 + math.exp(-x))


def _clamp(n: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, n))


# θ grid: -4..4 step 0.1 (81 points). Fixed → deterministic, fast, no sampler.
GRID: list[float] = [-4 + i * 0.1 for i in range(81)]

# Default GRM parameters (theory-set; refit from data in the calibration phase).
DEFAULT_A = 2.0
DEFAULT_THRESHOLDS = [-1.5, -0.5, 0.5, 1.5]


def _category_prob(level: int, theta: float, a: float, thr: list[float]) -> float:
    """P(response == level | θ) under the GRM."""
    def pge(k: int) -> float:
        if k <= 1:
            return 1.0
        if k >= 6:
            return 0.0
        return _logistic(a * (theta - thr[k - 2]))
    return _clamp(pge(level) - pge(level + 1), 1e-9, 1)


def _quantile(post: list[float], q: float) -> float:
    cum = 0.0
    for i in range(len(GRID)):
        cum += post[i]
        if cum >= q:
            return GRID[i]
    return GRID[-1]


@dataclass
class Posterior:
    theta: float
    se: float
    ci90: tuple[float, float]
    percentile: int
    reliability: float | None = None


def grm_posterior(
    level: int,
    weight: float = 1.0,
    a: float = DEFAULT_A,
    thresholds: list[float] | None = None,
    prior_mean: float = 0.0,
    prior_sd: float = 1.0,
) -> Posterior:
    """Bayesian posterior over θ for a single observed BARS `level`.

    `weight` = effective number of confidence-scaled observations; >1 sharpens
    the posterior (tighter CI), low confidence flattens it toward the prior.
    """
    thr = thresholds if thresholds is not None else DEFAULT_THRESHOLDS
    w = _clamp(weight, 0.05, 3.5)
    unnorm = [
        normal_pdf((t - prior_mean) / prior_sd) * (_category_prob(level, t, a, thr) ** w)
        for t in GRID
    ]
    z = sum(unnorm) or 1.0
    post = [x / z for x in unnorm]

    theta = sum(t * post[i] for i, t in enumerate(GRID))
    variance = sum((t - theta) ** 2 * post[i] for i, t in enumerate(GRID))
    se = math.sqrt(variance)
    ci90 = (_quantile(post, 0.05), _quantile(post, 0.95))
    reliability = _clamp(1 - variance / (prior_sd * prior_sd), 0, 1)

    return Posterior(
        theta=_js_round(theta, 2),
        se=_js_round(se, 2),
        ci90=(_js_round(ci90[0], 2), _js_round(ci90[1], 2)),
        reliability=_js_round(reliability, 2),
        percentile=_js_round(normal_cdf(theta) * 100),
    )


def grm_posterior_multi(
    observations: list[dict],
    a: float = DEFAULT_A,
    thresholds: list[float] | None = None,
    prior_mean: float = 0.0,
    prior_sd: float = 1.0,
) -> Posterior | None:
    """Multi-rater posterior. Agreeing raters sharpen the posterior; disagreeing
    raters flatten it — rater disagreement becomes honest uncertainty for free.

    observations: list of {"level": int, "weight": float}.
    """
    thr = thresholds if thresholds is not None else DEFAULT_THRESHOLDS
    obs = [o for o in (observations or []) if isinstance(o.get("level"), (int, float)) and math.isfinite(o["level"])]
    if not obs:
        return None
    unnorm: list[float] = []
    for t in GRID:
        logp = math.log(normal_pdf((t - prior_mean) / prior_sd) + 1e-300)
        for o in obs:
            w = _clamp(o.get("weight", 1) if o.get("weight") is not None else 1, 0.02, 3.5)
            logp += w * math.log(_category_prob(int(o["level"]), t, a, thr))
        unnorm.append(math.exp(logp))
    z = sum(unnorm) or 1.0
    post = [x / z for x in unnorm]

    theta = sum(t * post[i] for i, t in enumerate(GRID))
    variance = sum((t - theta) ** 2 * post[i] for i, t in enumerate(GRID))
    se = math.sqrt(variance)
    ci90 = (_quantile(post, 0.05), _quantile(post, 0.95))
    reliability = _clamp(1 - variance / (prior_sd * prior_sd), 0, 1)
    return Posterior(
        theta=_js_round(theta, 2),
        se=_js_round(se, 2),
        ci90=(_js_round(ci90[0], 2), _js_round(ci90[1], 2)),
        reliability=_js_round(reliability, 2),
        percentile=_js_round(normal_cdf(theta) * 100),
    )


def rater_agreement(levels: list[float]) -> float | None:
    """Exact-agreement-style rater agreement for BARS levels (0..1)."""
    xs = [x for x in (levels or []) if isinstance(x, (int, float)) and math.isfinite(x)]
    if len(xs) < 2:
        return None
    mean = sum(xs) / len(xs)
    mad = sum(abs(x - mean) for x in xs) / len(xs)
    return _js_round(_clamp(1 - mad / 2, 0, 1), 2)


@dataclass
class Dependability:
    v_comp: float
    v_rater: float
    v_resid: float
    dependability: float | None


def profile_dependability(matrix: list[list[float]]) -> Dependability | None:
    """Two-way (competency × rater) variance decomposition → G-theory
    dependability of the candidate's PROFILE against rater swaps.
    Returns None dependability when the profile is flat (nothing to differentiate).
    """
    rows = [r for r in (matrix or []) if isinstance(r, list) and len(r)]
    n_c = len(rows)
    n_r = len(rows[0]) if rows else 0
    if n_c < 2 or n_r < 2:
        return None
    flat = [x for r in rows for x in r]
    grand = sum(flat) / (n_c * n_r)
    comp_means = [sum(r) / n_r for r in rows]
    rater_means = [sum(rows[i][j] for i in range(n_c)) / n_c for j in range(n_r)]

    ss_c = ss_r = ss_e = 0.0
    for i in range(n_c):
        ss_c += n_r * (comp_means[i] - grand) ** 2
        for j in range(n_r):
            resid = rows[i][j] - comp_means[i] - rater_means[j] + grand
            ss_e += resid * resid
    for j in range(n_r):
        ss_r += n_c * (rater_means[j] - grand) ** 2
    v_comp = max(0.0, ss_c / (n_c - 1) - ss_e / ((n_c - 1) * (n_r - 1)))
    v_rater = max(0.0, ss_r / (n_r - 1))
    v_resid = max(1e-6, ss_e / ((n_c - 1) * (n_r - 1)))
    dependability = (
        None if v_comp < 1e-3
        else _js_round(_clamp(v_comp / (v_comp + (v_rater + v_resid) / n_r), 0, 1), 2)
    )
    return Dependability(
        v_comp=_js_round(v_comp, 3),
        v_rater=_js_round(v_rater, 3),
        v_resid=_js_round(v_resid, 3),
        dependability=dependability,
    )


def composite_posterior(items: list[dict]) -> Posterior | None:
    """Combine per-competency posteriors into a weighted composite θ with correct
    error propagation. items: [{"theta", "se", "weight"}]. Weights normalized.
    """
    measured = [
        x for x in items
        if isinstance(x.get("theta"), (int, float)) and math.isfinite(x["theta"]) and x.get("weight", 0) > 0
    ]
    if not measured:
        return None
    total_w = sum(x["weight"] for x in measured)
    theta = sum((x["weight"] / total_w) * x["theta"] for x in measured)
    variance = sum(((x["weight"] / total_w) ** 2) * (x["se"] * x["se"]) for x in measured)
    se = math.sqrt(variance)
    return Posterior(
        theta=_js_round(theta, 2),
        se=_js_round(se, 2),
        ci90=(_js_round(theta - 1.645 * se, 2), _js_round(theta + 1.645 * se, 2)),
        percentile=_js_round(normal_cdf(theta) * 100),
    )


def prior_mean_for_seniority(seniority: str) -> float:
    """Seniority base-rate prior mean (weak, non-zero information)."""
    return {"ic3": -0.3, "senior": 0.0, "staff": 0.2, "exec": 0.3}.get(seniority, 0.0)
