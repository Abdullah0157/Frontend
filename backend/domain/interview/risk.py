"""Risk Analysis agent — scans an interview transcript for integrity signals.

A Layer-3 specialist (Part 5): looks across the WHOLE conversation for evasion,
memorized-sounding answers, coaching, self-contradiction, and fabrication —
signals the per-competency rater can miss because they live in the pattern, not
one answer. Absence of evidence under direct probing IS signal. Provider-
independent (depends on the LLMGateway port); never raises.
"""

from __future__ import annotations

import json
import re
from typing import Any

from ports.llm import CompletionRequest, LLMGateway, Message, Role

RISK_TYPES = ["evasion", "memorized", "coached", "contradiction", "fabrication", "off_scope"]


def _strip_json(text: str) -> str:
    return re.sub(r"```\s*$", "", re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.I)).strip()


def build_risk_prompt(role: str, transcript: str) -> str:
    return f"""You are a skeptical interview-integrity reviewer for "{role}". Scan the FULL transcript for genuine risk signals only — do NOT invent concerns. For each real signal, cite the turn and a short quote.

Signal types:
- evasion: dodged a direct question or answered a different one; no real detail under probing.
- memorized: textbook/rehearsed answer that collapses when asked "what went wrong / what would your manager say".
- coached: answers feel fed/scripted rather than lived.
- contradiction: says something that conflicts with an earlier statement.
- fabrication: a claim that is internally inconsistent or implausibly specific/vague.
- off_scope: repeatedly steers away from the assessed skills.

Default to NO flags. Only flag what the transcript clearly supports.

Output STRICT JSON only:
{{
  "flags": [ {{ "type": "<one of: {', '.join(RISK_TYPES)}>", "severity": "low"|"medium"|"high", "turn_ref": <int>, "evidence": "<short quote>", "note": "<why>" }} ],
  "overall_risk": "low"|"medium"|"high",
  "summary": "<one line; 'No integrity concerns.' if clean>"
}}

FULL TRANSCRIPT:
{transcript}"""


async def analyze_risk(gateway: LLMGateway, role: str, messages: list[dict] | None) -> dict[str, Any]:
    """Return {flags, overall_risk, summary}. Never raises."""
    messages = messages or []
    if not messages:
        return {"flags": [], "overall_risk": "low", "summary": "No transcript."}
    transcript = "\n\n".join(
        f"[Turn {i + 1}] {'INTERVIEWER' if m.get('role') == 'assistant' else 'CANDIDATE'}: {m.get('content')}"
        for i, m in enumerate(messages)
    )
    try:
        result = await gateway.complete(CompletionRequest(
            tier="scorer",
            messages=[Message(role=Role.user, content=build_risk_prompt(role, transcript))],
            json_schema={"type": "object"},
            temperature=0.1,
        ))
        parsed = json.loads(_strip_json(result.text))
        flags = [f for f in parsed.get("flags", []) if f.get("type") in RISK_TYPES]
        overall = parsed.get("overall_risk")
        if overall not in ("low", "medium", "high"):
            overall = "high" if any(f.get("severity") == "high" for f in flags) else ("medium" if flags else "low")
        return {"flags": flags, "overall_risk": overall,
                "summary": parsed.get("summary") or ("No integrity concerns." if not flags else "Review flagged signals.")}
    except Exception:  # noqa: BLE001 — risk analysis must never break the caller
        return {"flags": [], "overall_risk": "low", "summary": "Risk analysis unavailable.", "error": True}
