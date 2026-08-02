"""Interview Orchestrator — the DEIE turn loop as a LangGraph.

One "advance turn" step: score the transcript-so-far → update the belief state →
either CONCLUDE (decision stable) or PRESENT the next question aimed at the most
important, least-certain competency. The evaluator (EIE) and the interviewer are
one system: the rubric posteriors ARE the belief state.

State is checkpointed (MemorySaver) per session, so an interview is resumable —
the event-sourced-runtime requirement, for free. The graph closes over the
provider-independent LLMGateway, so nothing here knows which model is behind it.
"""

from __future__ import annotations

from typing import Any, TypedDict

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from domain.evaluation.eie_rate import score_transcript
from domain.interview.planner import (
    build_strategy,
    extract_resume_hooks,
    plan_from_profile,
    target_directive,
)
from domain.interview.presenter import generate_question
from ports.llm import LLMGateway

_EMPTY_PROFILE: dict[str, Any] = {"competencies": [], "coverage": 0, "decision": {}, "composite_ci90": None}


class InterviewState(TypedDict, total=False):
    role: str
    seniority: str
    name: str
    resume_text: str
    messages: list[dict]          # [{role: assistant|user, content}]
    turns_spent: dict[str, int]
    prev_belief: list[dict] | None
    last_target: str | None
    min_answers: int
    strategy: dict[str, Any]
    profile: dict[str, Any] | None
    plan: dict[str, Any]
    question: str | None
    done: bool


def build_interview_graph(gateway: LLMGateway):
    """Compile the interview turn-loop graph bound to a gateway."""

    async def score_node(state: InterviewState) -> dict[str, Any]:
        messages = state.get("messages", [])
        answered = sum(1 for m in messages if m.get("role") == "user")
        if answered == 0:
            return {"profile": None}
        res = await score_transcript(
            gateway, role=state["role"], seniority=state.get("seniority", ""),
            messages=messages, name=state.get("name", ""),
        )
        return {"profile": res.get("profile")}

    def plan_node(state: InterviewState) -> dict[str, Any]:
        strategy = state.get("strategy")
        if not strategy:
            hooks = extract_resume_hooks(state.get("resume_text"), build_strategy(state["role"], state.get("seniority", ""))["model"])
            strategy = build_strategy(state["role"], state.get("seniority", ""), hooks)
        messages = state.get("messages", [])
        answered = sum(1 for m in messages if m.get("role") == "user")
        plan = plan_from_profile(
            strategy, state.get("profile") or _EMPTY_PROFILE,
            turns_spent=state.get("turns_spent", {}), answered=answered,
            min_answers=state.get("min_answers", 4),
            prev_belief=state.get("prev_belief"), last_target=state.get("last_target"),
        )
        return {"strategy": strategy, "plan": plan}

    def route(state: InterviewState) -> str:
        return "conclude" if state["plan"].get("ready_to_conclude") else "present"

    async def present_node(state: InterviewState) -> dict[str, Any]:
        plan = state["plan"]
        target = plan.get("next_target")
        directive = target_directive(target)
        question = await generate_question(gateway, state["role"], state.get("messages", []), directive)

        turns_spent = dict(state.get("turns_spent", {}))
        last_target = None
        if target:
            cid = target["competency_id"]
            turns_spent[cid] = turns_spent.get(cid, 0) + 1
            last_target = cid
        return {
            "question": question,
            "done": False,
            "turns_spent": turns_spent,
            "last_target": last_target,
            "prev_belief": plan.get("belief"),
        }

    def conclude_node(state: InterviewState) -> dict[str, Any]:
        return {"question": None, "done": True}

    g = StateGraph(InterviewState)
    g.add_node("score", score_node)
    g.add_node("plan", plan_node)
    g.add_node("present", present_node)
    g.add_node("conclude", conclude_node)
    g.add_edge(START, "score")
    g.add_edge("score", "plan")
    g.add_conditional_edges("plan", route, {"present": "present", "conclude": "conclude"})
    g.add_edge("present", END)
    g.add_edge("conclude", END)

    return g.compile(checkpointer=MemorySaver())
