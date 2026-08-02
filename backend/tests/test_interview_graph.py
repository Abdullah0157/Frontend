"""Interview Orchestrator (LangGraph) — end-to-end turn loop, offline.

A fake gateway plays both roles: rater (returns anchored ratings) and presenter
(returns a question). Proves the DEIE loop: score → plan → present | conclude,
with checkpointed state — no provider key, no network.
"""

from __future__ import annotations

import json
from typing import AsyncIterator

import pytest

from orchestration.interview_graph import build_interview_graph
from ports.llm import Completion, CompletionRequest, Token, Usage

# Strong ratings for every competency → high coverage, decision stable.
_STRONG = {"ratings": [
    {"competency_id": cid, "state": "measured", "bars_level": 5, "confidence": 0.9,
     "evidence": [{"quote": "x", "turn_ref": 2}, {"quote": "y", "turn_ref": 4}]}
    for cid in ["structured_problem_solving", "ownership", "communication", "learning_velocity",
                "integrity_judgment", "technical_depth", "system_design"]
]}


class FakeGateway:
    def __init__(self) -> None:
        self.questions = 0

    async def complete(self, req: CompletionRequest) -> Completion:
        if req.tier == "presenter":
            self.questions += 1
            return Completion(text="Tell me about the hardest system you've designed.",
                              model="fake", tier=req.tier, usage=Usage())
        # scorer tier: verifier asks for "verdicts", rater asks for "ratings".
        content = req.messages[-1].content
        payload = {"verdicts": []} if "verdicts" in content else _STRONG
        return Completion(text=json.dumps(payload), model="fake", tier=req.tier, usage=Usage())

    async def stream(self, req: CompletionRequest) -> AsyncIterator[Token]:
        yield Token(text="")


@pytest.mark.asyncio
async def test_first_turn_presents_a_question() -> None:
    graph = build_interview_graph(FakeGateway())
    state = {"role": "Senior Backend Engineer", "seniority": "senior", "messages": [], "min_answers": 4}
    out = await graph.ainvoke(state, config={"configurable": {"thread_id": "t1"}})
    assert out["done"] is False
    assert out["question"] and isinstance(out["question"], str)
    # It planned a target and started tracking turns.
    assert out["plan"]["next_target"] is not None
    assert out["last_target"] is not None


@pytest.mark.asyncio
async def test_strong_covered_interview_concludes() -> None:
    graph = build_interview_graph(FakeGateway())
    # 5 answered turns + strong scoring → decision stable → conclude.
    messages = []
    for i in range(5):
        messages.append({"role": "assistant", "content": f"Q{i}"})
        messages.append({"role": "user", "content": f"Detailed strong answer {i} with specifics and outcomes."})
    state = {"role": "Senior Backend Engineer", "seniority": "senior", "messages": messages, "min_answers": 4}
    out = await graph.ainvoke(state, config={"configurable": {"thread_id": "t2"}})
    assert out["done"] is True
    assert out["question"] is None
    assert out["plan"]["ready_to_conclude"] is True
    assert out["profile"]["decision"]["band"] in ("Strong Hire", "Hire")


@pytest.mark.asyncio
async def test_state_is_checkpointed_per_thread() -> None:
    graph = build_interview_graph(FakeGateway())
    cfg = {"configurable": {"thread_id": "t3"}}
    await graph.ainvoke({"role": "SWE", "seniority": "senior", "messages": [], "min_answers": 4}, config=cfg)
    snap = graph.get_state(cfg)
    assert snap.values.get("last_target") is not None  # persisted for the next turn's critique
