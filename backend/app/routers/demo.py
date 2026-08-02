"""Demo endpoints that prove the provider abstraction end-to-end.

These call the LLM strictly through the gateway PORT — the router has no idea
which provider serves the request. In later phases the interview/assessment
routers follow this exact shape (SSE streaming for the voice/question hot path).
"""

from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from ports.llm import CompletionRequest, LLMGateway, Message, Role, Tier

router = APIRouter(prefix="/v1/llm", tags=["demo"])


class AskIn(BaseModel):
    tier: Tier = "cheap"
    prompt: str


def _gateway(request: Request) -> LLMGateway:
    return request.app.state.llm


@router.post("/ask")
async def ask(body: AskIn, request: Request) -> dict[str, object]:
    """Non-streaming completion — returns text plus which model actually served it."""
    gw = _gateway(request)
    result = await gw.complete(
        CompletionRequest(tier=body.tier, messages=[Message(role=Role.user, content=body.prompt)])
    )
    return {
        "text": result.text,
        "served_by": result.model,      # proves tier → concrete model resolution
        "fell_back": result.fell_back,  # proves the fallback chain
        "cost_usd": result.usage.cost_usd,
    }


@router.post("/stream")
async def stream(body: AskIn, request: Request) -> EventSourceResponse:
    """Token stream over SSE — the shape the voice/question hot path uses."""
    gw = _gateway(request)

    async def gen():
        async for tok in gw.stream(
            CompletionRequest(tier=body.tier, messages=[Message(role=Role.user, content=body.prompt)])
        ):
            yield {"data": tok.text}

    return EventSourceResponse(gen())
