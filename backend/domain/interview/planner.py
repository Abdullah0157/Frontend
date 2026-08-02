"""Interview Planner — DEIE Strategy Planner + belief loop
(ported from lib/interview-planner.js).

Makes the interviewer and the evaluator ONE system: the rubric's competency
posteriors ARE the interview's belief state, and the planner asks about the
competency that is most important AND least certain (max information gain).

Pure/deterministic on purpose — the one AI call (scoring the transcript) lives
in the API/agent layer; everything here is unit-tested logic over the EIE profile.
"""

from __future__ import annotations

import math
from typing import Any

from domain.evaluation.competency_framework import build_model
from domain.evaluation.psychometrics import _js_round

_SENIORITY_BASE = {"ic3": 0.5, "senior": 0.55, "staff": 0.62, "exec": 0.65}


def required_confidence(seniority: str, weight: float) -> float:
    base = _SENIORITY_BASE.get(seniority, 0.55)
    return min(0.85, base + 0.3 * (weight or 0))


def build_strategy(role: str, seniority: str, resume_hooks: dict[str, list] | None = None) -> dict[str, Any]:
    resume_hooks = resume_hooks or {}
    model = build_model(role, seniority or role)
    objectives = [
        {
            "competency_id": c["id"],
            "name": c["name"],
            "importance": c["weight"],
            "required_confidence": required_confidence(model["seniority"], c["weight"]),
            "interview_signals": c.get("positive_indicators", []),
            "evidence_requirements": c.get("evidence_requirements", {"min_episodes": 1}),
            "resume_hooks": resume_hooks.get(c["id"], []),
            "status": "unknown",
        }
        for c in model["competencies"]
    ]
    return {
        "framework_version": model["framework_version"],
        "role_family": model["role_family"],
        "seniority": model["seniority"],
        "model": model,
        "objectives": objectives,
    }


def status_for(comp: dict[str, Any], required_conf: float) -> str:
    if not comp or comp.get("state") != "measured":
        return "unknown"
    ev = len(comp["evidence"]) if isinstance(comp.get("evidence"), list) else 0
    if comp.get("refuted"):
        return "partial"
    if (comp.get("confidence") or 0) >= required_conf and ev >= 2:
        return "verified"
    if (comp.get("confidence") or 0) >= required_conf:
        return "strong"
    return "partial"


def _status_boost(status: str) -> float:
    return {"unknown": 1.3, "partial": 1.0, "strong": 0.3, "verified": 0}.get(status, 1)


def move_for(comp: dict[str, Any] | None, status: str, turns_spent: int = 0) -> str:
    if comp and (comp.get("refuted") or (comp.get("risk") and len(comp["risk"]))):
        return "resolve"
    if status == "unknown":
        return "switch" if turns_spent >= 2 else "open"
    if status == "partial":
        return "switch" if turns_spent >= 2 else "deepen"
    if status == "strong":
        return "verify"
    return "switch"


def _round2(n: float) -> float:
    return _js_round(n, 2)


def critique(prev_belief: list[dict] | None, next_belief: list[dict] | None,
             target_id: str | None, useful_delta: float = 0.05) -> dict[str, Any] | None:
    if not target_id:
        return None
    prev = next((b for b in (prev_belief or []) if b.get("competency_id") == target_id), {})
    nxt = next((b for b in (next_belief or []) if b.get("competency_id") == target_id), {})
    d_conf = _round2((nxt.get("confidence") or 0) - (prev.get("confidence") or 0))
    gained_evidence = (nxt.get("evidence_count") or 0) > (prev.get("evidence_count") or 0)
    settled = nxt.get("status") in ("strong", "verified")
    useful = gained_evidence or d_conf >= useful_delta or settled
    evasive = (not useful) and (prev.get("turns_spent") or 0) >= 1
    return {
        "target": target_id,
        "delta_confidence": d_conf,
        "gained_evidence": gained_evidence,
        "settled": settled,
        "useful": useful,
        "evasive": evasive,
        "verdict": "settled" if settled else "productive" if useful else "evasive" if evasive else "weak",
        "recommendation": "switch" if (settled or evasive) else "deepen" if useful else "reframe",
    }


def extract_resume_hooks(resume_text: str | None, model: dict[str, Any]) -> dict[str, list[str]]:
    hooks: dict[str, list[str]] = {}
    if not resume_text or not model.get("competencies"):
        return hooks
    import re
    lines = [s.strip() for s in re.split(r"[\n.;]+", str(resume_text)) if len(s.strip()) > 12]

    def has(cid: str) -> bool:
        return any(c["id"] == cid for c in model["competencies"])

    def push(cid: str, claim: str) -> None:
        hooks.setdefault(cid, []).append(claim[:120])

    for line in lines:
        quantified = bool(re.search(r"\d+\s*%|\bx\b|\$\d|\bp99\b|\d{2,}|\bmillion\b|\bthousand\b", line, re.I))
        leadership = bool(re.search(r"\b(led|managed|owned|drove|founded|built a team|mentored|hired)\b", line, re.I))
        technical = bool(re.search(r"\b(architected|designed|scaled|optimized|migrated|deployed|debugged|latency|throughput|infrastructure|api|model)\b", line, re.I))
        if (quantified or leadership) and has("ownership"):
            push("ownership", line)
        if technical and has("technical_depth"):
            push("technical_depth", line)
        if technical and has("system_design") and re.search(r"\b(architect|scale|design|distributed)\b", line, re.I):
            push("system_design", line)
    for k in list(hooks.keys()):
        hooks[k] = hooks[k][:3]
    return hooks


def expected_info_gain(cb: dict[str, Any]) -> float:
    if cb.get("status") == "verified" or cb.get("settled"):
        return float("-inf")
    se = cb["se"] if isinstance(cb.get("se"), (int, float)) and math.isfinite(cb["se"]) else 1.0
    base = (cb["importance"] ** 2) * (se * se) * _status_boost(cb["status"])
    verify_bonus = 0.02 if cb.get("resume_hooks") else 0
    contradiction_bonus = 0.05 if (cb.get("status") == "partial" and cb.get("refuted")) else 0
    fatigue = (0.6 ** cb["turns_spent"]) if cb.get("turns_spent") else 1
    return (base + verify_bonus + contradiction_bonus) * fatigue


def plan_from_profile(strategy: dict[str, Any], profile: dict[str, Any], *,
                      turns_spent: dict[str, int] | None = None, answered: int = 0,
                      min_answers: int = 4, prev_belief: list[dict] | None = None,
                      last_target: str | None = None) -> dict[str, Any]:
    turns_spent = turns_spent or {}
    by_id = {c["id"]: c for c in (profile.get("competencies") or [])}

    belief: list[dict[str, Any]] = []
    for o in strategy["objectives"]:
        comp = by_id.get(o["competency_id"], {})
        status = status_for(comp, o["required_confidence"])
        b = {
            "competency_id": o["competency_id"], "name": o["name"], "importance": o["importance"],
            "required_confidence": o["required_confidence"], "resume_hooks": o["resume_hooks"],
            "status": status, "settled": status in ("verified", "strong"),
            "theta": comp.get("theta"), "se": comp.get("se"),
            "confidence": comp.get("confidence") or 0,
            "evidence_count": len(comp["evidence"]) if isinstance(comp.get("evidence"), list) else 0,
            "refuted": bool(comp.get("refuted")), "risk": comp.get("risk") or [],
            "turns_spent": turns_spent.get(o["competency_id"], 0),
            "interview_signals": o["interview_signals"],
        }
        b["info_gain"] = expected_info_gain(b)
        b["move"] = move_for(comp, status, b["turns_spent"])
        belief.append(b)

    crit = critique(prev_belief, belief, last_target)
    if crit and crit["evasive"]:
        evaded = next((b for b in belief if b["competency_id"] == last_target), None)
        if evaded:
            evaded["info_gain"] *= 0.15
            evaded["move"] = "switch"
            evaded["evasive"] = True

    open_objs = [b for b in belief if b["info_gain"] > float("-inf")]
    nxt = max(open_objs, key=lambda b: b["info_gain"]) if open_objs else None
    coverage = profile.get("coverage") or 0

    stability = decision_stability(profile)
    ready = answered >= min_answers and (stability["stable"] or ready_to_conclude(belief, coverage))

    return {
        "belief": belief,
        "coverage": coverage,
        "decision": profile.get("decision"),
        "decision_stability": stability,
        "open_objectives": [b["name"] for b in open_objs],
        "next_target": None if ready else (
            {"competency_id": nxt["competency_id"], "name": nxt["name"], "move": nxt["move"],
             "interview_signals": nxt["interview_signals"], "resume_hooks": nxt["resume_hooks"]}
            if nxt else None
        ),
        "ready_to_conclude": ready,
        "conclude_reason": (
            (stability["reason"] if stability["stable"] else "critical competencies settled") if ready else None
        ),
        "critique": crit,
    }


def ready_to_conclude(belief: list[dict], coverage: float,
                      critical_weight: float = 0.12, min_coverage: float = 0.85) -> bool:
    critical = [b for b in belief if b["importance"] >= critical_weight]
    pool = critical if critical else belief
    all_settled = all(b["status"] in ("strong", "verified") for b in pool)
    no_open_contradiction = not any(b["refuted"] and b["status"] != "verified" for b in belief)
    return coverage >= min_coverage and all_settled and no_open_contradiction


def decision_stability(profile: dict[str, Any], min_coverage: float = 0.6) -> dict[str, Any]:
    d = profile.get("decision") or {}
    ci = profile.get("composite_ci90")
    bar = d.get("bar")
    coverage = profile.get("coverage") or 0
    if not isinstance(ci, list) or not isinstance(bar, (int, float)) or not math.isfinite(bar):
        return {"stable": False, "reason": "no composite credible interval yet"}
    lo, hi = ci
    straddles = lo < bar and hi > bar
    margin = _js_round(min(abs(lo - bar), abs(hi - bar)), 2)
    stable = (not straddles) and coverage >= min_coverage
    return {
        "stable": stable,
        "straddles": straddles,
        "side": "below_bar" if hi <= bar else "above_bar" if lo >= bar else "straddles",
        "bar": bar, "ci": ci, "margin": margin, "coverage": coverage,
        "reason": (
            "credible interval straddles the hire bar — more evidence could still flip the decision" if straddles
            else f"coverage {_js_round(coverage * 100)}% too low to conclude" if coverage < min_coverage
            else "decision robust to remaining uncertainty"
        ),
    }


def target_directive(nxt: dict[str, Any] | None) -> str:
    if not nxt:
        return ""
    move_text = {
        "open": "You have NO solid evidence for this competency yet — ask an open behavioral question to elicit a concrete real example.",
        "deepen": "You have partial evidence — go one level deeper on the SAME thread: ask what was hardest, what broke, or what the trade-off was.",
        "verify": "This looks strong — respectfully CHALLENGE it: ask what a skeptic would say, or for the specific detail only a real expert would know.",
        "resolve": "There is a contradiction or a failed claim here — ask them to reconcile it directly.",
        "switch": "Move to this new area.",
    }.get(nxt["move"], "")
    hooks = f" Anchor it to their resume: {'; '.join(nxt['resume_hooks'][:2])}." if nxt.get("resume_hooks") else ""
    signals = f" Good evidence looks like: {'; '.join(nxt['interview_signals'][:3])}." if nxt.get("interview_signals") else ""
    return f"\n\nINVESTIGATION TARGET → {nxt['name']}. {move_text}{signals}{hooks} Ask exactly ONE natural question aimed at this."
