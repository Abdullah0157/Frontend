"""EIE Scoring — deterministic aggregation over anchored ratings
(ported from lib/eie-scoring.js).

Merges the competency model (defs + weights) with model-produced BARS ratings
into a finalized, defensible profile + decision. Delivers the honest upgrades:
Unknown/abstain (never a fake low score), coverage, evidence-linked scores, a
mechanical uncertainty-propagated composite, and utility-derived banding.
Single-rater and N-rater ensemble paths share one assembler.
"""

from __future__ import annotations

from dataclasses import asdict
from typing import Any

from domain.evaluation.decision_engine import Decision, decide_hire
from domain.evaluation.psychometrics import (
    Posterior,
    composite_posterior,
    grm_posterior,
    grm_posterior_multi,
    normal_cdf,
    prior_mean_for_seniority,
    profile_dependability,
    rater_agreement,
)

DECISION_BANDS = [
    "Strong Hire", "Hire", "Hire with Reservations", "Borderline",
    "Needs More Evidence", "No Hire", "Strong No Hire",
]


def _clamp(n: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, n))


def _js_round2(n: float) -> float:
    import math
    return math.floor(n * 100 + 0.5) / 100


def _default_followup(c: dict[str, Any]) -> str:
    return f"Ask for a specific real example that would demonstrate {c['name'].lower()}."


def _episodes(evidence: Any) -> int:
    if isinstance(evidence, list):
        return len(evidence)
    return 1 if evidence else 0


def _as_list(x: Any) -> list:
    if isinstance(x, list):
        return x
    return [x] if x else []


def _ci_pct(post: Posterior) -> list[int]:
    from domain.evaluation.psychometrics import _js_round
    return [_js_round(normal_cdf(post.ci90[0]) * 100), _js_round(normal_cdf(post.ci90[1]) * 100)]


def _decision_to_dict(d: Decision) -> dict[str, Any]:
    # Match the JS decision object shape: omit fields that are None (the
    # unknown/critical paths don't carry percentile/meets_bar/coverage).
    return {k: v for k, v in asdict(d).items() if v is not None}


def finalize_profile(model: dict[str, Any], ratings: list[dict[str, Any]] | None) -> dict[str, Any]:
    by_id: dict[str, dict[str, Any]] = {}
    for r in ratings or []:
        if r and r.get("competency_id"):
            by_id[r["competency_id"]] = r

    prior_mean = prior_mean_for_seniority(model["seniority"])
    competencies: list[dict[str, Any]] = []

    for c in model["competencies"]:
        r = by_id.get(c["id"], {})
        level = r.get("bars_level")
        level = float(level) if isinstance(level, (int, float)) else float("nan")
        confidence = _clamp(float(r.get("confidence") or 0), 0, 1)
        min_ep = (c.get("evidence_requirements") or {}).get("min_episodes", 1)
        episodes = _episodes(r.get("evidence"))

        import math
        insufficient = (not math.isfinite(level)) or r.get("state") == "unknown" or confidence < 0.35
        if not insufficient and episodes < min_ep:
            confidence = min(confidence, 0.55)
        state = "unknown" if insufficient else "measured"
        thin = state == "measured" and episodes < min_ep
        failure = _as_list(r.get("failure_triggered"))

        post: Posterior | None = None
        if state == "measured":
            eff_obs = confidence * _clamp(episodes, 1, 3)
            post = grm_posterior(level=int(_clamp(level, 1, 5)), weight=eff_obs, prior_mean=prior_mean)

        competencies.append({
            "id": c["id"], "name": c["name"], "cluster": c["cluster"], "weight": c["weight"],
            "state": state,
            "bars_level": int(_clamp(level, 1, 5)) if state == "measured" else None,
            "score": post.percentile if post else None,
            "theta": post.theta if post else None,
            "se": post.se if post else None,
            "ci90": list(post.ci90) if post else None,
            "ci_pct": _ci_pct(post) if post else None,
            "reliability": post.reliability if post else None,
            "confidence": confidence,
            "evidence": r.get("evidence", [])[:3] if isinstance(r.get("evidence"), list) else [],
            "followup": (r.get("followup") or _default_followup(c)) if state == "unknown" else None,
            "thin": thin,
            "risk": failure,
        })

    return _assemble(model, competencies, {"rater_count": 1})


def finalize_profile_ensemble(
    model: dict[str, Any],
    by_comp: dict[str, list[dict[str, Any]]],
    refutations: dict[str, Any] | None = None,
    meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    refutations = refutations or {}
    meta = meta or {}
    prior_mean = prior_mean_for_seniority(model["seniority"])
    n_raters = meta.get("rater_count", 1)
    import math

    competencies: list[dict[str, Any]] = []
    for c in model["competencies"]:
        raters = by_comp.get(c["id"], [])
        if not isinstance(raters, list):
            raters = []
        measured_raters = [
            r for r in raters
            if r and r.get("state") != "unknown"
            and isinstance(r.get("bars_level"), (int, float)) and math.isfinite(float(r["bars_level"]))
            and (float(r.get("confidence") or 0)) >= 0.35
        ]
        min_ep = (c.get("evidence_requirements") or {}).get("min_episodes", 1)
        refuted = bool(refutations.get(c["id"], {}).get("refuted"))

        if len(measured_raters) == 0 or len(measured_raters) < math.ceil(len(raters) / 2):
            fu = next((r["followup"] for r in raters if r and r.get("followup")), None) or _default_followup(c)
            competencies.append({
                "id": c["id"], "name": c["name"], "cluster": c["cluster"], "weight": c["weight"],
                "state": "unknown", "followup": fu, "rater_count": len(raters),
            })
            continue

        levels = [int(_clamp(float(r["bars_level"]), 1, 5)) for r in measured_raters]
        agreement = rater_agreement(levels)
        episodes_each = [_episodes(r.get("evidence")) for r in measured_raters]
        total_episodes = max(*episodes_each, 1) if episodes_each else 1
        thin = total_episodes < min_ep
        refute_factor = 0.4 if refuted else 1.0

        observations = []
        for i, r in enumerate(measured_raters):
            conf = _clamp(float(r.get("confidence") or 0), 0, 1)
            if thin:
                conf = min(conf, 0.55)
            observations.append({
                "level": int(_clamp(float(r["bars_level"]), 1, 5)),
                "weight": conf * _clamp(episodes_each[i], 1, 3) * refute_factor,
            })

        post = grm_posterior_multi(observations, prior_mean=prior_mean)
        assert post is not None
        mean_level = _js_round0(sum(levels) / len(levels))
        mean_conf = _clamp(sum(float(r.get("confidence") or 0) for r in measured_raters) / len(measured_raters), 0, 1) * refute_factor
        richest = sorted(measured_raters, key=lambda r: len(r.get("evidence") or []), reverse=True)[0]
        failures = [f for r in measured_raters for f in _as_list(r.get("failure_triggered"))]

        competencies.append({
            "id": c["id"], "name": c["name"], "cluster": c["cluster"], "weight": c["weight"],
            "state": "measured", "bars_level": mean_level,
            "score": post.percentile, "theta": post.theta, "se": post.se, "ci90": list(post.ci90),
            "ci_pct": _ci_pct(post), "reliability": post.reliability,
            "confidence": _js_round2(mean_conf),
            "rater_count": len(measured_raters),
            "rater_agreement": agreement,
            "refuted": refuted, "refute_reason": refutations.get(c["id"], {}).get("reason") if refuted else None,
            "evidence": (richest.get("evidence") or [])[:3] if isinstance(richest.get("evidence"), list) else [],
            "thin": thin, "risk": failures, "_levels": levels,
        })

    return _assemble(model, competencies, {**meta, "rater_count": n_raters})


def _assemble(model: dict[str, Any], competencies: list[dict[str, Any]], meta: dict[str, Any]) -> dict[str, Any]:
    measured = [c for c in competencies if c["state"] == "measured"]
    comp = composite_posterior([{"theta": c["theta"], "se": c["se"], "weight": c["weight"]} for c in measured])
    covered = sum(c["weight"] for c in measured)
    total_w = sum(c["weight"] for c in competencies)
    w_measured = covered or 0

    composite = comp.percentile if comp else None
    coverage = _js_round2(covered / total_w) if total_w > 0 else 0
    overall_confidence = _js_round2(sum(c["confidence"] * c["weight"] for c in measured) / w_measured) if w_measured > 0 else 0
    overall_reliability = _js_round2(sum((c.get("reliability") or 0) * c["weight"] for c in measured) / w_measured) if w_measured > 0 else 0

    dependability = None
    if meta.get("rater_count", 1) >= 2:
        with_levels = [c for c in measured if isinstance(c.get("_levels"), list) and len(c["_levels"]) >= 2]
        len_counts: dict[int, int] = {}
        for c in with_levels:
            n = len(c["_levels"])
            len_counts[n] = len_counts.get(n, 0) + 1
        if len_counts:
            target_len = sorted(len_counts.keys(), key=lambda k: len_counts[k], reverse=True)[0]
            matrix = [c["_levels"] for c in with_levels if len(c["_levels"]) == target_len]
            dependability = profile_dependability(matrix)
    for c in competencies:
        c.pop("_levels", None)

    critical_failures = [c["name"] for c in competencies if c.get("risk")]
    decision = decide_hire(
        theta=comp.theta if comp else None,
        se=comp.se if comp else None,
        coverage=coverage, critical_failures=critical_failures, seniority=model["seniority"],
    )
    if decision.band in ("Hire with Reservations", "Borderline"):
        decision.reservations = [
            c["name"] for c in competencies
            if c["state"] == "measured" and c["weight"] >= 0.08 and (c["score"] or 0) < 50
        ]

    return {
        "framework_version": model["framework_version"],
        "role_family": model["role_family"],
        "seniority": model["seniority"],
        "measurement_model": "grm-eap-v1",
        "rater_count": meta.get("rater_count", 1),
        "rater_dependability": dependability.dependability if dependability else None,
        "variance_components": (
            {"comp": dependability.v_comp, "rater": dependability.v_rater, "resid": dependability.v_resid}
            if dependability else None
        ),
        "competencies": competencies,
        "composite_score": composite,
        "composite_theta": comp.theta if comp else None,
        "composite_ci90": list(comp.ci90) if comp else None,
        "coverage": coverage,
        "overall_confidence": overall_confidence,
        "overall_reliability": overall_reliability,
        "decision": _decision_to_dict(decision),
        "unknown_competencies": [c["name"] for c in competencies if c["state"] == "unknown"],
        "followups": [{"competency": c["name"], "question": c["followup"]} for c in competencies if c.get("followup")],
    }


def _js_round0(n: float) -> int:
    import math
    return int(math.floor(n + 0.5))
