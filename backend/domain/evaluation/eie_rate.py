"""EIE rating pipeline — transcript → anchored ratings → scored profile
(ported from lib/eie-rate.js).

This is where P0 (the provider-independent LLM gateway) meets P1 (the EIE): the
LLM acts ONLY as a calibrated rater/extractor against fixed BARS anchors; the
engine (finalize_profile) does the mechanical aggregation. Provider-independent
by construction — it depends on the LLMGateway port, not any vendor SDK.
"""

from __future__ import annotations

import asyncio
import json
import re
from typing import Any

from domain.evaluation.competency_framework import anchor_guide_text, build_model
from domain.evaluation.eie_scoring import finalize_profile, finalize_profile_ensemble
from domain.evaluation.fairness import blind_transcript
from domain.evaluation.interview_quality import interview_quality
from ports.llm import CompletionRequest, LLMGateway, Message, Role


def _strip_json_fences(text: str) -> str:
    return re.sub(r"```\s*$", "", re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.I)).strip()


def _clamp(n: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, n))


def _rotate(arr: list, k: int) -> list:
    n = len(arr)
    if n == 0:
        return arr
    s = ((k % n) + n) % n
    return [*arr[s:], *arr[:s]]


def build_rater_prompt(model: dict[str, Any], role: str, transcript: str) -> str:
    comp_ids = [c["id"] for c in model["competencies"]]
    return f"""You are a calibrated evaluation instrument, not a chatty assistant. Rate this candidate for "{role}" ({model['seniority']} level) on each competency below, STRICTLY against its BARS anchors. Pick the anchor level (1-5) whose description the transcript actually supports — not a flattering guess.

FRAME OF REFERENCE — the competencies and their anchors:
{anchor_guide_text(model)}

RULES (these make you trustworthy):
- Base every rating on a SPECIFIC behavioral moment (situation → action → outcome). Cite it with a direct quote and its turn number.
- If the transcript does NOT contain enough behavioral evidence for a competency, set "state":"unknown" and give a "followup" question. Unknown is CORRECT and expected — do NOT guess a number to fill it.
- Attach EVERY supporting quote you can find for a competency in its "evidence" array (more evidence = higher confidence).
- confidence (0.0-1.0) = how well the transcript actually evidenced your level.
- Calibration: level 5 = genuinely exceptional (top ~5%), 3 = solid/standard, 1 = poor. Most real people are 2-4. Do NOT inflate.
- If a candidate is caught contradicting themselves or fabricating, set "failure_triggered" for that competency.

Output STRICT JSON only — no markdown, no code fences:
{{
  "ratings": [
    {{
      "competency_id": "<one of: {', '.join(comp_ids)}>",
      "state": "measured" | "unknown",
      "bars_level": <1-5 or null if unknown>,
      "confidence": <0.0-1.0>,
      "evidence": [ {{ "quote": "<direct quote>", "turn_ref": <turn number>, "note": "<why this maps to the level>" }} ],
      "followup": "<if unknown: a question that would elicit the missing evidence, else null>",
      "failure_triggered": "<optional: describe a contradiction/fabrication, else omit>"
    }}
  ]
}}

FULL TRANSCRIPT:
{transcript}"""


def _format_transcript(messages: list[dict], name: str | None) -> tuple[str, int]:
    blinded = blind_transcript(messages, name)
    lines = [
        f"[Turn {i + 1}] {'INTERVIEWER' if m.get('role') == 'assistant' else 'CANDIDATE'}: {m.get('content')}"
        for i, m in enumerate(blinded["messages"])
    ]
    return "\n\n".join(lines), blinded["redactions"]


async def score_transcript(
    gateway: LLMGateway,
    role: str = "the role",
    seniority: str = "",
    messages: list[dict] | None = None,
    name: str = "",
) -> dict[str, Any]:
    """Single-rater: transcript → finalized EIE profile. Never raises."""
    messages = messages or []
    try:
        if not messages:
            return {"error": "no messages"}
        model = build_model(role, seniority or role)
        transcript, redactions = _format_transcript(messages, name)

        result = await gateway.complete(CompletionRequest(
            tier="scorer",
            messages=[Message(role=Role.user, content=build_rater_prompt(model, role, transcript))],
            json_schema={"type": "object"},
        ))
        try:
            parsed = json.loads(_strip_json_fences(result.text))
            ratings = parsed.get("ratings") if isinstance(parsed.get("ratings"), list) else []
        except (json.JSONDecodeError, AttributeError):
            return {"error": "parse failed", "raw": result.text}

        profile = finalize_profile(model, ratings)
        profile["audit"] = {"blinded": True, "redactions": redactions, "note": "rated on identity-blinded transcript"}
        return {"profile": profile}
    except Exception as e:  # noqa: BLE001 — scoring must never break the caller
        return {"error": str(e) or "scoring failed"}


async def _rate_once(gateway: LLMGateway, model: dict, role: str, transcript: str, temperature: float, rotate_by: int) -> list[dict]:
    rater_model = {**model, "competencies": _rotate(model["competencies"], rotate_by)}
    result = await gateway.complete(CompletionRequest(
        tier="scorer",
        messages=[Message(role=Role.user, content=build_rater_prompt(rater_model, role, transcript))],
        json_schema={"type": "object"},
        temperature=temperature,
    ))
    parsed = json.loads(_strip_json_fences(result.text))
    if not isinstance(parsed.get("ratings"), list):
        raise ValueError("bad rater output")
    return parsed["ratings"]


async def _adversarial_verify(gateway: LLMGateway, role: str, transcript: str, claims: list[dict]) -> dict[str, Any]:
    claim_lines = "\n".join(f"- {c['competency_id']} ({c['name']}): claimed level {c['level']}" for c in claims)
    prompt = f"""You are a skeptical review board member. For each competency below, the interviewer proposed a level (1-5) for "{role}". REFUTE any level the transcript does NOT genuinely support. Default to refuted=false; set refuted=true only when the evidence is clearly too weak, contradicted, or fabricated for the claimed level.

CLAIMS:
{claim_lines}

Output STRICT JSON only:
{{ "verdicts": [ {{ "competency_id": "<id>", "refuted": true|false, "reason": "<one line if refuted>" }} ] }}

FULL TRANSCRIPT:
{transcript}"""
    try:
        result = await gateway.complete(CompletionRequest(
            tier="scorer", messages=[Message(role=Role.user, content=prompt)],
            json_schema={"type": "object"}, temperature=0.1,
        ))
        parsed = json.loads(_strip_json_fences(result.text))
        out: dict[str, Any] = {}
        for v in parsed.get("verdicts", []) or []:
            if v.get("competency_id"):
                out[v["competency_id"]] = {"refuted": bool(v.get("refuted")), "reason": v.get("reason", "")}
        return out
    except Exception:  # noqa: BLE001 — verification is best-effort, non-fatal
        return {}


async def score_transcript_ensemble(
    gateway: LLMGateway,
    role: str = "the role",
    seniority: str = "",
    messages: list[dict] | None = None,
    n_raters: int = 2,
    name: str = "",
    evasions: int = 0,
) -> dict[str, Any]:
    """N independent raters → adversarial verify → G-theory aggregation.
    Rate-limit-safe: raters run concurrently; needs ≥1 to succeed."""
    messages = messages or []
    try:
        if not messages:
            return {"error": "no messages"}
        model = build_model(role, seniority or role)
        transcript, redactions = _format_transcript(messages, name)

        n = int(_clamp(n_raters, 1, 3))
        temps = [0.2, 0.45, 0.32]
        settled = await asyncio.gather(
            *[_rate_once(gateway, model, role, transcript, temps[i % len(temps)], i * 2) for i in range(n)],
            return_exceptions=True,
        )
        raters = [s for s in settled if not isinstance(s, Exception)]
        if not raters:
            err = next((str(s) for s in settled if isinstance(s, Exception)), "all raters failed")
            return {"error": err}

        by_comp: dict[str, list] = {c["id"]: [] for c in model["competencies"]}
        for ratings in raters:
            for r in ratings:
                if r.get("competency_id") in by_comp:
                    by_comp[r["competency_id"]].append(r)

        claims = []
        for c in model["competencies"]:
            lv = [float(r["bars_level"]) for r in by_comp.get(c["id"], [])
                  if isinstance(r.get("bars_level"), (int, float))]
            if lv:
                import math
                claims.append({"competency_id": c["id"], "name": c["name"],
                               "level": int(math.floor(sum(lv) / len(lv) + 0.5))})
        refutations = await _adversarial_verify(gateway, role, transcript, claims) if claims else {}

        profile = finalize_profile_ensemble(model, by_comp, refutations, {"rater_count": len(raters)})
        profile["audit"] = {
            "blinded": True, "redactions": redactions, "verified": True,
            "note": "rated on identity-blinded transcript; ensemble + adversarial verification",
        }
        questions_asked = sum(1 for m in messages if m.get("role") == "assistant")
        profile["interview_quality"] = interview_quality(profile, questions_asked=questions_asked, evasions=evasions)
        return {"profile": profile}
    except Exception as e:  # noqa: BLE001
        return {"error": str(e) or "ensemble scoring failed"}
