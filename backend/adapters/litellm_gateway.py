"""LiteLLM-backed implementation of the LLMGateway port.

This is the ONLY file in the codebase that knows a real provider exists. It:
  - resolves a capability tier -> concrete model (config/models.yaml)
  - walks the fallback chain on 429 / 5xx / timeout with a bounded backoff
    (mirrors the 2.5s cap we shipped on the JS side — a slow provider must never
    freeze a live interview turn)
  - reports usage + cost so per-agent spend lands on a dashboard
  - streams tokens for the voice/question hot path

Swapping providers, reordering fallbacks, or pinning a per-tenant model is a
config edit here — never a change in agents or domain code.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, AsyncIterator

import structlog
import yaml

# NOTE: `litellm` is imported lazily inside complete()/stream() rather than at
# module top. It's a heavy dependency (and lags new Python releases), so keeping
# it out of import time makes startup faster and lets the whole provider layer be
# unit-tested against a fake gateway without installing it.

from ports.llm import (
    Completion,
    CompletionRequest,
    Token,
    Usage,
)

log = structlog.get_logger(__name__)

_RETRY_HINT = re.compile(r"try again in ([\d.]+)s", re.I)


class LiteLLMGateway:
    """Concrete gateway. Constructed once at startup and injected everywhere."""

    def __init__(self, config_path: str | Path) -> None:
        cfg = yaml.safe_load(Path(config_path).read_text())
        self._tiers: dict[str, dict[str, Any]] = cfg["tiers"]
        self._max_wait_ms: int = cfg.get("rate_limit", {}).get("max_wait_ms", 2500)

    def _chain(self, tier: str) -> list[str]:
        t = self._tiers[tier]
        return [t["primary"], *t.get("fallbacks", [])]

    def _params(self, req: CompletionRequest) -> dict[str, Any]:
        t = self._tiers[req.tier]
        params: dict[str, Any] = {
            "temperature": req.temperature if req.temperature is not None else t.get("temperature", 0.7),
            "max_tokens": req.max_tokens or t.get("max_tokens", 1024),
        }
        if req.json_schema is not None:
            params["response_format"] = {"type": "json_object"}
        return params

    @staticmethod
    def _messages(req: CompletionRequest) -> list[dict[str, str]]:
        return [{"role": m.role.value, "content": m.content} for m in req.messages]

    async def complete(self, req: CompletionRequest) -> Completion:
        import litellm  # lazy — see module note

        params = self._params(req)
        messages = self._messages(req)
        chain = self._chain(req.tier)
        last_err: Exception | None = None

        for i, model in enumerate(chain):
            try:
                resp = await litellm.acompletion(model=model, messages=messages, **params)
                usage = getattr(resp, "usage", None)
                cost = float(getattr(resp, "_hidden_params", {}).get("response_cost", 0.0) or 0.0)
                completion = Completion(
                    text=(resp.choices[0].message.content or "").strip(),
                    model=model,
                    tier=req.tier,
                    fell_back=i > 0,
                    usage=Usage(
                        prompt_tokens=getattr(usage, "prompt_tokens", 0) or 0,
                        completion_tokens=getattr(usage, "completion_tokens", 0) or 0,
                        cost_usd=cost,
                    ),
                )
                log.info(
                    "llm.complete",
                    tier=req.tier,
                    model=model,
                    fell_back=completion.fell_back,
                    cost_usd=round(cost, 6),
                    tokens=completion.usage.completion_tokens,
                )
                return completion
            except Exception as exc:  # noqa: BLE001 — we classify + fail over
                last_err = exc
                wait_ms = self._retry_after_ms(exc)
                # If the required wait exceeds our cap, a shorter sleep won't clear
                # the limit — skip straight to the next provider instead of hanging.
                if wait_ms and wait_ms <= self._max_wait_ms and i < len(chain) - 1:
                    log.warning("llm.rate_limited", model=model, wait_ms=wait_ms, action="failover")
                log.warning("llm.failover", tier=req.tier, model=model, error=str(exc)[:200])
                continue

        raise RuntimeError(f"All models failed for tier '{req.tier}': {last_err}")

    async def stream(self, req: CompletionRequest) -> AsyncIterator[Token]:
        """Stream the primary model's tokens for the hot path.

        Streaming intentionally does NOT walk the fallback chain mid-stream (you
        can't un-send tokens). On a hard failure before the first token, callers
        fall back to complete()."""
        import litellm  # lazy — see module note

        params = self._params(req)
        messages = self._messages(req)
        model = self._chain(req.tier)[0]
        resp = await litellm.acompletion(model=model, messages=messages, stream=True, **params)
        async for chunk in resp:
            delta = chunk.choices[0].delta.content or ""
            if delta:
                yield Token(text=delta)

    @staticmethod
    def _retry_after_ms(exc: Exception) -> int | None:
        m = _RETRY_HINT.search(str(exc))
        return int(float(m.group(1)) * 1000) if m else None
