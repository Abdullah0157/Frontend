"""Presenter (Conversation Agent) — voices ONE natural question per turn.

The Presenter is the "character" layer (Maya / Iris): warmth, pacing, turn-taking.
It does NOT decide WHAT to probe — the Planner does that and hands it a directive,
which the Presenter turns into a single natural question. The directive rides in
the SYSTEM message (never injected into a candidate turn — avoids the prompt-
injection surface). Provider-independent: depends only on the LLMGateway port.
"""

from __future__ import annotations

from typing import Any

from ports.llm import CompletionRequest, LLMGateway, Message, Role

_PERSONA = """You are Maya, a senior domain expert conducting a live voice interview. Eight years assessing experts — you can tell genuine depth from surface familiarity.

HOW YOU SPEAK:
- One question per turn. Warm, calm, concise — one or two sentences, then you wait.
- Build on what they just said; reference a specific word they used.
- No filler ("Great", "Interesting", "Absolutely"). No labels, no preamble.
- English only. Output ONLY the question (optionally a brief natural acknowledgment first)."""


def build_presenter_messages(role: str, transcript: list[dict], directive: str) -> list[Message]:
    system = f"{_PERSONA}\n\nYou are interviewing for: {role}.{directive}"
    msgs: list[Message] = [Message(role=Role.system, content=system)]
    for m in transcript:
        role_ = Role.assistant if m.get("role") == "assistant" else Role.user
        msgs.append(Message(role=role_, content=str(m.get("content", ""))))
    if not transcript:
        # First turn: nudge the opener.
        msgs.append(Message(role=Role.user, content="[Begin the interview with your first question.]"))
    return msgs


async def generate_question(gateway: LLMGateway, role: str, transcript: list[dict], directive: str = "") -> str:
    """Generate the next natural question. Uses the fast 'presenter' tier."""
    result = await gateway.complete(CompletionRequest(
        tier="presenter",
        messages=build_presenter_messages(role, transcript, directive),
    ))
    return result.text.strip()
