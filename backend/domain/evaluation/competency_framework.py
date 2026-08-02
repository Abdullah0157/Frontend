"""Competency Framework — EIE (ported from lib/competency-framework.js).

The FIXED, VERSIONED source of truth for what "good" means — same competencies,
anchors and evidentiary bar for every candidate, so ratings are comparable,
calibratable and defensible (Uniform Guidelines job-relatedness + consistency).
Each competency ships with 5-level BARS anchors (Smith & Kendall 1963).

Data is a faithful port; selector logic matches the JS byte-for-byte.
"""

from __future__ import annotations

import re
from typing import Any

from domain.evaluation.psychometrics import _js_round

FRAMEWORK_VERSION = "eie-2025.1"

# Level → scaled score (0–100). Linear/Dawes-robust until outcome data justifies
# fitting real GRM thresholds.
LEVEL_TO_SCORE = {1: 12, 2: 34, 3: 56, 4: 78, 5: 95}

# ── Universal competencies (measured for every role, weighted differently) ──
UNIVERSAL: list[dict[str, Any]] = [
    {
        "id": "structured_problem_solving",
        "name": "Structured Problem Solving",
        "cluster": "cognitive",
        "definition": "Decomposes ambiguous problems, forms and tests hypotheses, and converges on a defensible solution.",
        "positive_indicators": ["names the crux", "seeks disconfirming evidence", "quantifies tradeoffs", "revises when a test fails"],
        "negative_indicators": ["jumps to a solution", "cannot explain why an approach failed", "confuses activity with progress"],
        "anchors": {
            5: "Reframed an ambiguous problem, generated competing hypotheses, ran the cheapest discriminating test first, and explained why discarded paths were wrong.",
            4: "Structured decomposition and clear tradeoffs; handled an edge case with a sound method.",
            3: "Solved the standard case competently; less convincing on novelty or when a test failed.",
            2: "Formulaic; little evidence of hypothesis testing or adaptation.",
            1: "Jumped to an answer; no reasoning under difficulty; wrong on fundamentals.",
        },
        "evidence_requirements": {"min_episodes": 2, "requires_failure_probe": True},
        "weight_by_role": {"_default": 0.8, "software_engineer": 0.95, "data_scientist": 0.95, "product_manager": 0.85, "sales": 0.5, "designer": 0.7},
        "risk_indicators": ["confident but wrong", "cannot articulate own reasoning"],
        "failure_conditions": ["fabricates a method"],
    },
    {
        "id": "ownership",
        "name": "Ownership & Bias for Action",
        "cluster": "execution",
        "definition": "Takes end-to-end responsibility for outcomes, drives to results, and does not wait for permission on the right thing.",
        "positive_indicators": ["owned a problem end to end", "acted under ambiguity", "measured the consequence of their work"],
        "negative_indicators": ['"the team handled that"', "diffuse responsibility", "no measurable outcome"],
        "anchors": {
            5: "Owned a hard problem end to end in production, drove it through rollout, and can state the concrete impact and tradeoffs they lived through.",
            4: "Clear ownership of real shipped work with a measurable outcome.",
            3: "Contributed hands-on but thin on end-to-end ownership or impact.",
            2: "Mostly peripheral; few specifics; deflects responsibility.",
            1: "No credible evidence of owning outcomes.",
        },
        "evidence_requirements": {"min_episodes": 1, "requires_failure_probe": False},
        "weight_by_role": {"_default": 0.85},
        "risk_indicators": ["blames others for failures"],
        "failure_conditions": [],
    },
    {
        "id": "communication",
        "name": "Communication",
        "cluster": "interpersonal",
        "definition": "Makes complex ideas clear, precise, and well-structured for the audience.",
        "positive_indicators": ["organizes thoughts", "precise", "adjusts to the listener"],
        "negative_indicators": ["rambling", "buries the point", "jargon dump"],
        "anchors": {
            5: "Made a complex idea click fast — precise, structured, anticipated confusion, no waffle.",
            4: "Clear and easy to follow; organizes thoughts well.",
            3: "Understandable but rambling or imprecise at times.",
            2: "Hard to follow; vague; buries the point.",
            1: "Cannot articulate their own work clearly.",
        },
        "evidence_requirements": {"min_episodes": 1, "requires_failure_probe": False},
        "weight_by_role": {"_default": 0.7, "sales": 0.95, "product_manager": 0.9, "designer": 0.8},
        "risk_indicators": [],
        "failure_conditions": [],
    },
    {
        "id": "learning_velocity",
        "name": "Learning Velocity",
        "cluster": "cognitive",
        "definition": "Acquires new skills and updates mental models quickly from experience and feedback.",
        "positive_indicators": ["unlearned something", "changed approach after feedback", "self-directed depth"],
        "negative_indicators": ["static views", "defends disproven positions"],
        "anchors": {
            5: "Describes a specific belief they had to unlearn and exactly what evidence changed their mind, with faster subsequent mastery.",
            4: "Clear examples of picking up new skills and updating from feedback.",
            3: "Learns adequately but slowly or only when required.",
            2: "Little evidence of updating; surface learning.",
            1: "Rigid; does not update from evidence.",
        },
        "evidence_requirements": {"min_episodes": 1, "requires_failure_probe": False},
        "weight_by_role": {"_default": 0.65},
        "risk_indicators": [],
        "failure_conditions": [],
    },
    {
        "id": "integrity_judgment",
        "name": "Integrity & Judgment",
        "cluster": "integrity",
        "definition": "Honest about limits and failures; exercises sound judgment on ambiguous, high-stakes calls.",
        "positive_indicators": ["names real gaps", "owns a mistake and the lesson", "honest tradeoffs"],
        "negative_indicators": ["claims no weaknesses", "inconsistent story", "inflates contribution"],
        "anchors": {
            5: "Volunteers a genuine mistake, what it cost, and the durable change it produced — self-aware and non-defensive.",
            4: "Honest about gaps and tradeoffs; consistent account.",
            3: "Some candor but guarded; limited self-awareness.",
            2: "Deflects weaknesses; minor inconsistencies.",
            1: "Evasive or contradictory; inflates claims.",
        },
        "evidence_requirements": {"min_episodes": 1, "requires_failure_probe": True},
        "weight_by_role": {"_default": 0.7},
        "risk_indicators": ["contradicts earlier statements", "inflates contribution"],
        "failure_conditions": ["caught in a clear contradiction"],
    },
]

# ── Role-family competencies (added on top of universal) ──
ROLE_COMPETENCIES: dict[str, list[dict[str, Any]]] = {
    "software_engineer": [
        {
            "id": "technical_depth",
            "name": "Technical Depth",
            "cluster": "technical",
            "definition": "Understands systems at the level of internals, edge cases, and why things work — not just applied recipes.",
            "positive_indicators": ["explains internals", "knows failure modes", "source-level debugging"],
            "negative_indicators": ["recites surface knowledge", "vague under a concrete probe"],
            "anchors": {
                5: "Explains internals/first principles and edge cases; the tells of someone who has debugged this at the source level.",
                4: "Solid working depth; correct mental models; goes one level deeper when pushed.",
                3: "Competent applied knowledge; struggles past the standard case.",
                2: "Surface familiarity; vague under a concrete probe.",
                1: "Wrong on fundamentals.",
            },
            "evidence_requirements": {"min_episodes": 2, "requires_failure_probe": True},
            "weight_by_role": {"_default": 0.95},
            "risk_indicators": ["confident but wrong on fundamentals"],
            "failure_conditions": [],
        },
        {
            "id": "system_design",
            "name": "System Design",
            "cluster": "technical",
            "definition": "Designs systems that balance correctness, scale, and operational reality with explicit tradeoffs.",
            "positive_indicators": ["states constraints first", "reasons about failure/scale", "names tradeoffs"],
            "negative_indicators": ["buzzword architecture", "ignores failure modes"],
            "anchors": {
                5: "Starts from constraints, reasons about scale/failure/consistency tradeoffs, and defends choices against alternatives.",
                4: "Sound design with explicit tradeoffs and awareness of failure modes.",
                3: "Reasonable design for the standard case; light on tradeoffs.",
                2: "Buzzword-driven; little real reasoning.",
                1: "No coherent design reasoning.",
            },
            "evidence_requirements": {"min_episodes": 1, "requires_failure_probe": False},
            "weight_by_role": {"_default": 0.9},
            "risk_indicators": [],
            "failure_conditions": [],
        },
    ],
    "product_manager": [
        {
            "id": "product_sense",
            "name": "Product Sense",
            "cluster": "domain",
            "definition": "Identifies real user problems and translates them into high-leverage product bets.",
            "positive_indicators": ["starts from user problem", "prioritizes by leverage", "defines success metric"],
            "negative_indicators": ["feature-first", "no metric", "ignores tradeoffs"],
            "anchors": {
                5: "Frames a sharp user problem, picks the highest-leverage bet, defines the north-star metric, and names what they deliberately did not build.",
                4: "Clear user-problem framing with a success metric and prioritization.",
                3: "Reasonable product thinking; light on metrics or tradeoffs.",
                2: "Feature-first; weak on user problem or measurement.",
                1: "No coherent product reasoning.",
            },
            "evidence_requirements": {"min_episodes": 1, "requires_failure_probe": False},
            "weight_by_role": {"_default": 0.95},
            "risk_indicators": [],
            "failure_conditions": [],
        },
    ],
    "sales": [
        {
            "id": "discovery_negotiation",
            "name": "Discovery & Negotiation",
            "cluster": "domain",
            "definition": "Uncovers real buyer needs and drives to a mutually valuable close.",
            "positive_indicators": ["multi-threads", "quantifies buyer pain", "handles objections with evidence"],
            "negative_indicators": ["pitches before discovery", "discounts to close", "single-threaded"],
            "anchors": {
                5: "Runs disciplined discovery, quantifies buyer pain, multi-threads, and closes on value with a concrete win they drove.",
                4: "Solid discovery and objection handling with a real outcome.",
                3: "Competent but transactional; light on discovery depth.",
                2: "Pitch-first; weak qualification.",
                1: "No credible sales method.",
            },
            "evidence_requirements": {"min_episodes": 1, "requires_failure_probe": False},
            "weight_by_role": {"_default": 0.95},
            "risk_indicators": [],
            "failure_conditions": [],
        },
    ],
}

_ROLE_ALIASES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"(software|backend|frontend|full.?stack|platform|devops|cloud|security)\s*(engineer|developer|dev)?|engineer|developer|programmer", re.I), "software_engineer"),
    (re.compile(r"(data scientist|machine learning|\bml\b|\bai\b engineer|data engineer)", re.I), "data_scientist"),
    (re.compile(r"(product manager|\bpm\b|product owner|growth product)", re.I), "product_manager"),
    (re.compile(r"(sales|account executive|\bae\b|account manager|business development)", re.I), "sales"),
    (re.compile(r"(designer|\bux\b|\bui\b|product design)", re.I), "designer"),
]

_SENIORITY_WEIGHT = {"ic3": 0.85, "senior": 1.0, "staff": 1.05, "exec": 1.0}


def role_family_from_text(text: str | None) -> str:
    t = str(text or "")
    for regex, fam in _ROLE_ALIASES:
        if regex.search(t):
            return fam
    return "_default"


def seniority_from_text(text: str | None) -> str:
    t = str(text or "").lower()
    if re.search(r"(chief|vp|vice president|head of|director|exec)", t):
        return "exec"
    if re.search(r"(staff|principal|lead)", t):
        return "staff"
    if re.search(r"(senior|sr\.?|sr\b)", t):
        return "senior"
    if re.search(r"(junior|jr\.?|entry|intern|graduate)", t):
        return "ic3"
    return "senior"


def select_competencies(role_family: str) -> list[dict[str, Any]]:
    fam = role_family if role_family in ROLE_COMPETENCIES else "_default"
    return [*UNIVERSAL, *ROLE_COMPETENCIES.get(fam, [])]


def weight_for(comp: dict[str, Any], role_family: str, seniority: str) -> float:
    wbr = comp.get("weight_by_role", {})
    base = wbr.get(role_family, wbr.get("_default", 0.7))
    return base * _SENIORITY_WEIGHT.get(seniority, 1.0)


def build_model(role_text: str | None, seniority_text: str | None = None) -> dict[str, Any]:
    role_family = role_family_from_text(role_text)
    seniority = seniority_from_text(seniority_text if seniority_text is not None else role_text)
    comps = select_competencies(role_family)
    raw = [{"comp": c, "w": weight_for(c, role_family, seniority)} for c in comps]
    total = sum(x["w"] for x in raw) or 1
    return {
        "framework_version": FRAMEWORK_VERSION,
        "role_family": role_family,
        "seniority": seniority,
        "competencies": [{**x["comp"], "weight": _js_round(x["w"] / total, 3)} for x in raw],
    }


def anchor_guide_text(model: dict[str, Any]) -> str:
    parts = []
    for c in model["competencies"]:
        bands = "\n".join(f"      {k}: {c['anchors'][k]}" for k in (5, 4, 3, 2, 1))
        parts.append(
            f"  {c['id']} — {c['name']} (weight {_js_round(c['weight'] * 100)}%)\n"
            f"    definition: {c['definition']}\n    BARS anchors:\n{bands}"
        )
    return "\n\n".join(parts)
