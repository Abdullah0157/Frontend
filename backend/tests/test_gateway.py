"""P0 tests — verify the provider abstraction without touching a real provider.

The whole point of the port is that business logic can be tested against a fake
gateway (fast, deterministic, offline). These tests prove:
  1. tier -> concrete-model resolution + fallback chain reads from config
  2. the rate-limit hint parser (bounded backoff) works
  3. a fake gateway satisfies the LLMGateway protocol -> domain code is decoupled
"""

from __future__ import annotations

from pathlib import Path
from typing import AsyncIterator

import pytest

from adapters.litellm_gateway import LiteLLMGateway
from ports.llm import (
    Completion,
    CompletionRequest,
    LLMGateway,
    Message,
    Role,
    Token,
    Usage,
)

CONFIG = Path(__file__).resolve().parent.parent / "config" / "models.yaml"


def test_tier_resolves_to_primary_then_fallbacks() -> None:
    gw = LiteLLMGateway(CONFIG)
    chain = gw._chain("presenter")
    assert chain[0] == "gemini/gemini-2.5-flash"          # primary
    assert "groq/llama-3.3-70b-versatile" in chain        # fallback
    assert len(chain) >= 2


def test_every_tier_is_configured() -> None:
    gw = LiteLLMGateway(CONFIG)
    for tier in ("planner", "presenter", "scorer", "cheap"):
        assert gw._chain(tier), f"tier {tier} must resolve to at least one model"


def test_rate_limit_hint_is_parsed() -> None:
    gw = LiteLLMGateway(CONFIG)
    err = Exception("Rate limit reached. Please try again in 25.5s.")
    assert gw._retry_after_ms(err) == 25500
    assert gw._retry_after_ms(Exception("no hint here")) is None


# ---- A fake gateway proves domain code depends only on the PORT --------------

class FakeGateway:
    """Implements LLMGateway with zero network — what unit tests inject."""

    def __init__(self, reply: str = "hello") -> None:
        self.reply = reply
        self.calls: list[CompletionRequest] = []

    async def complete(self, req: CompletionRequest) -> Completion:
        self.calls.append(req)
        return Completion(text=self.reply, model="fake/model", tier=req.tier, usage=Usage())

    async def stream(self, req: CompletionRequest) -> AsyncIterator[Token]:
        for word in self.reply.split():
            yield Token(text=word + " ")


def test_fake_satisfies_the_protocol() -> None:
    fake = FakeGateway()
    assert isinstance(fake, LLMGateway)  # runtime_checkable Protocol


@pytest.mark.asyncio
async def test_domain_code_runs_against_the_port() -> None:
    gw: LLMGateway = FakeGateway(reply="scored: strong hire")
    result = await gw.complete(
        CompletionRequest(tier="scorer", messages=[Message(role=Role.user, content="evaluate")])
    )
    assert result.text == "scored: strong hire"
    assert result.tier == "scorer"
