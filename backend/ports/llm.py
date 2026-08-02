"""The one door to every model.

Domain code and agents depend on THIS interface — never on openai / anthropic /
google SDKs directly. That single rule is what makes the platform provider- and
model-independent: swapping vendors is a new adapter + a config line, with zero
changes to business logic.
"""

from __future__ import annotations

from enum import Enum
from typing import AsyncIterator, Literal, Protocol, runtime_checkable

from pydantic import BaseModel, Field

# Capability tiers, not vendor model names. Business code asks for a tier; the
# gateway resolves it to a concrete model via config/models.yaml.
Tier = Literal["planner", "presenter", "scorer", "cheap"]


class Role(str, Enum):
    system = "system"
    user = "user"
    assistant = "assistant"


class Message(BaseModel):
    role: Role
    content: str


class CachePolicy(str, Enum):
    NONE = "none"
    EXACT = "exact"        # hash(prompt + model) → cached response
    SEMANTIC = "semantic"  # embedding nearest-neighbour over recent prompts


class CompletionRequest(BaseModel):
    """What business code asks for — a capability and a policy, not a vendor."""

    tier: Tier
    messages: list[Message]
    json_schema: dict | None = None          # structured output (validated)
    cache: CachePolicy = CachePolicy.NONE
    max_cost_usd: float | None = None         # hard budget guard for this call
    temperature: float | None = None          # override the tier default
    max_tokens: int | None = None


class Usage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    cost_usd: float = 0.0


class Completion(BaseModel):
    text: str
    model: str = Field(description="The concrete model that actually served the call")
    tier: Tier
    usage: Usage = Usage()
    cached: bool = False
    fell_back: bool = False  # true if the primary failed and a fallback served it


class Token(BaseModel):
    text: str


@runtime_checkable
class LLMGateway(Protocol):
    """Everything the platform needs from an LLM, and nothing about who provides it."""

    async def complete(self, req: CompletionRequest) -> Completion: ...

    def stream(self, req: CompletionRequest) -> AsyncIterator[Token]: ...
