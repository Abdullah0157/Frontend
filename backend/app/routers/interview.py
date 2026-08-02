"""Interview runtime endpoint — one DEIE turn per call, via the LangGraph.

POST /v1/interview/turn: send the transcript so far; get back either the next
question (aimed at the most important, least-certain competency) or a conclusion
when the decision is stable. State (turns spent, belief, last target) is
checkpointed per session_id, so the interview is resumable across calls.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

router = APIRouter(prefix="/v1/interview", tags=["interview"])


class Turn(BaseModel):
    role: str  # "assistant" | "user"
    content: str


class TurnRequest(BaseModel):
    session_id: str = Field(examples=["sess_abc123"])
    role: str = Field(examples=["Senior Backend Engineer"])
    seniority: str | None = None
    name: str = ""
    resume_text: str = ""
    messages: list[Turn] = []
    min_answers: int = 4


@router.post("/turn")
async def turn(req: TurnRequest, request: Request) -> dict[str, Any]:
    graph = request.app.state.interview_graph
    state = {
        "role": req.role,
        "seniority": req.seniority or "",
        "name": req.name,
        "resume_text": req.resume_text,
        "messages": [m.model_dump() for m in req.messages],
        "min_answers": req.min_answers,
    }
    out = await graph.ainvoke(state, config={"configurable": {"thread_id": req.session_id}})
    plan = out.get("plan", {})
    return {
        "done": out.get("done", False),
        "question": out.get("question"),
        "next_target": plan.get("next_target"),
        "ready_to_conclude": plan.get("ready_to_conclude", False),
        "conclude_reason": plan.get("conclude_reason"),
        "coverage": plan.get("coverage", 0),
        "decision": (out.get("profile") or {}).get("decision") if out.get("done") else None,
    }
