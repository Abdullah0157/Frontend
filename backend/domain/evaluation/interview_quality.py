"""Interview Quality — DEIE Critic step (ported from lib/interview-quality.js).

Grades the INTERVIEW, not the candidate: did the interviewer extract enough
well-evidenced signal to support a decision, efficiently?
  quality = coverage × reliability × efficiency, penalized for unknowns/evasion.
"""

from __future__ import annotations

from typing import Any

from domain.evaluation.psychometrics import _js_round


def _clamp(n: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, n))


def _grade(score: float) -> str:
    if score >= 90:
        return "A+"
    if score >= 82:
        return "A"
    if score >= 74:
        return "B"
    if score >= 64:
        return "C"
    if score >= 50:
        return "D"
    return "F"


def interview_quality(profile: dict[str, Any], questions_asked: int = 0, evasions: int = 0) -> dict[str, Any]:
    cov = _clamp(profile.get("coverage") or 0, 0, 1)
    rel = _clamp(profile.get("overall_reliability") or 0, 0, 1)
    comps = profile.get("competencies") or []
    total = len(comps) or 1
    unknowns = sum(1 for c in comps if c.get("state") == "unknown")
    unknown_ratio = unknowns / total

    efficiency = _clamp(cov / (questions_asked / 8), 0, 1) if questions_asked > 0 else 0
    evasion_penalty = _clamp(evasions * 0.05, 0, 0.2)
    too_short = 0 < questions_asked < 4

    score = 100 * (0.40 * cov + 0.35 * rel + 0.15 * efficiency + 0.10 * (1 - unknown_ratio))
    score = score * (1 - evasion_penalty)
    if too_short:
        score *= 0.75
    score = _js_round(_clamp(score, 0, 100))

    flags: list[str] = []
    if cov < 0.7:
        flags.append("low_coverage")
    if rel < 0.5:
        flags.append("low_reliability")
    if unknown_ratio > 0.3:
        flags.append("many_unknowns")
    if too_short:
        flags.append("too_short")
    if evasions > 0:
        flags.append("unresolved_evasion")

    return {
        "score": score,
        "grade": _grade(score),
        "coverage": _js_round(cov, 2),
        "reliability": _js_round(rel, 2),
        "efficiency": _js_round(efficiency, 2),
        "unknown_ratio": _js_round(unknown_ratio, 2),
        "questions_asked": questions_asked,
        "evasions": evasions,
        "flags": flags,
        "verdict": (
            "Strong interview — well-evidenced across the board."
            if not flags else f"Review: {', '.join(flags).replace('_', ' ')}."
        ),
    }
