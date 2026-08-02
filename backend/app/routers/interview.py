"""Interview runtime endpoint — one DEIE turn per call, via the LangGraph.

POST /v1/interview/turn: send the transcript so far; get back either the next
question (aimed at the most important, least-certain competency) or a conclusion
when the decision is stable. State (turns spent, belief, last target) is
checkpointed per session_id, so the interview is resumable across calls.
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from adapters.persistence import repositories as repo
from app.deps import best_effort_db

router = APIRouter(prefix="/v1/interview", tags=["interview"])

_MSG_EVENTS = ("QuestionAsked", "CandidateAnswered")


class Turn(BaseModel):
    role: str  # "assistant" | "user"
    content: str


class TurnRequest(BaseModel):
    session_id: str = Field(examples=["sess_abc123"])
    role: str = Field(examples=["Senior Backend Engineer"])
    seniority: str | None = None
    name: str = ""
    candidate_id: str | None = None
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

    # ── Persist the event-sourced runtime (best-effort) ──────────────────────
    async with best_effort_db(request) as db:
        if db is not None:
            await repo.ensure_session(db, req.session_id, role=req.role,
                                      seniority=req.seniority, candidate_id=req.candidate_id)
            # Append only the transcript turns not yet logged (idempotent across
            # calls, since the client resends the full transcript each turn).
            existing = await repo.load_events(db, req.session_id)
            persisted = sum(1 for e in existing if e["type"] in _MSG_EVENTS)
            for m in req.messages[persisted:]:
                etype = "QuestionAsked" if m.role == "assistant" else "CandidateAnswered"
                await repo.append_event(db, req.session_id, etype, {"content": m.content},
                                        actor="interviewer" if m.role == "assistant" else "candidate")
            if out.get("done"):
                profile = out.get("profile") or {}
                await repo.append_event(db, req.session_id, "InterviewFinished",
                                        {"decision": profile.get("decision")}, actor="orchestrator")
                if profile:
                    await repo.save_evaluation(db, uuid.uuid4().hex, profile,
                                               candidate_id=req.candidate_id, session_id=req.session_id, role=req.role)

    return {
        "done": out.get("done", False),
        "question": out.get("question"),
        "next_target": plan.get("next_target"),
        "ready_to_conclude": plan.get("ready_to_conclude", False),
        "conclude_reason": plan.get("conclude_reason"),
        "coverage": plan.get("coverage", 0),
        "decision": (out.get("profile") or {}).get("decision") if out.get("done") else None,
    }


@router.get("/{session_id}/events")
async def events(session_id: str, request: Request) -> dict[str, Any]:
    """The append-only event log for a session — replayable/auditable."""
    async with best_effort_db(request) as db:
        rows = await repo.load_events(db, session_id) if db is not None else []
    return {"session_id": session_id, "count": len(rows), "events": rows}
