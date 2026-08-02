"""Repositories — map the ORM to plain domain dicts.

Domain/agents never see SQLAlchemy; they call these async functions with an
AsyncSession. Covers the core flows the endpoints need durable:
  • event-sourced interview runtime (append/load events)
  • item bank + responses
  • cumulative candidate skill graph (EAP-updated)
  • evaluation-result snapshots (queryable band/score columns)
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from adapters.persistence.models import (
    CandidateSkillState,
    EvaluationResult,
    InterviewEvent,
    InterviewSession,
    Item,
    ItemResponse,
)


# ── Event-sourced interview runtime ──────────────────────────────────────────
async def ensure_session(db: AsyncSession, session_id: str, role: str, seniority: str | None = None,
                         candidate_id: str | None = None) -> InterviewSession:
    s = await db.get(InterviewSession, session_id)
    if s is None:
        s = InterviewSession(id=session_id, role=role, seniority=seniority, candidate_id=candidate_id)
        db.add(s)
        await db.flush()
    return s


async def append_event(db: AsyncSession, session_id: str, type_: str, payload: dict[str, Any],
                       actor: str = "system") -> int:
    """Append an event with the next monotonic seq for this session. Returns seq."""
    next_seq = (await db.scalar(
        select(func.coalesce(func.max(InterviewEvent.seq), 0) + 1).where(InterviewEvent.session_id == session_id)
    )) or 1
    db.add(InterviewEvent(session_id=session_id, seq=next_seq, type=type_, payload=payload, actor=actor))
    await db.flush()
    return next_seq


async def load_events(db: AsyncSession, session_id: str) -> list[dict[str, Any]]:
    rows = (await db.scalars(
        select(InterviewEvent).where(InterviewEvent.session_id == session_id).order_by(InterviewEvent.seq)
    )).all()
    return [{"seq": e.seq, "type": e.type, "payload": e.payload, "actor": e.actor, "ts": e.ts.isoformat()} for e in rows]


# ── Item bank + responses ────────────────────────────────────────────────────
async def upsert_items(db: AsyncSession, items: list[dict[str, Any]]) -> int:
    for it in items:
        existing = await db.get(Item, it["id"])
        if existing:
            for k in ("a", "b", "c", "skill", "status", "version"):
                if k in it:
                    setattr(existing, k, it[k])
        else:
            db.add(Item(id=it["id"], a=it.get("a", 1.0), b=it.get("b", 0.0), c=it.get("c", 0.0),
                        skill=it.get("skill", ""), status=it.get("status", "live")))
    await db.flush()
    return len(items)


async def get_pool(db: AsyncSession, skill: str | None = None) -> list[dict[str, Any]]:
    stmt = select(Item).where(Item.status == "live")
    if skill:
        stmt = stmt.where(Item.skill == skill)
    rows = (await db.scalars(stmt)).all()
    return [{"id": i.id, "a": i.a, "b": i.b, "c": i.c, "skill": i.skill} for i in rows]


async def record_response(db: AsyncSession, item_id: str, correct: bool, candidate_id: str | None = None,
                          session_id: str | None = None, time_spent_ms: int | None = None) -> None:
    db.add(ItemResponse(item_id=item_id, correct=correct, candidate_id=candidate_id,
                        session_id=session_id, time_spent_ms=time_spent_ms))
    item = await db.get(Item, item_id)
    if item:
        item.n_administered += 1
    await db.flush()


# ── Cumulative skill graph ───────────────────────────────────────────────────
async def upsert_skill_state(db: AsyncSession, candidate_id: str, skill_id: str,
                             theta: float, theta_se: float, n_responses: int) -> None:
    row = await db.scalar(
        select(CandidateSkillState).where(
            CandidateSkillState.candidate_id == candidate_id,
            CandidateSkillState.skill_id == skill_id,
        )
    )
    if row:
        row.theta, row.theta_se, row.n_responses = theta, theta_se, n_responses
    else:
        db.add(CandidateSkillState(candidate_id=candidate_id, skill_id=skill_id,
                                   theta=theta, theta_se=theta_se, n_responses=n_responses))
    await db.flush()


async def get_skill_state(db: AsyncSession, candidate_id: str, skill_id: str) -> dict[str, Any] | None:
    row = await db.scalar(
        select(CandidateSkillState).where(
            CandidateSkillState.candidate_id == candidate_id,
            CandidateSkillState.skill_id == skill_id,
        )
    )
    if not row:
        return None
    return {"candidate_id": row.candidate_id, "skill_id": row.skill_id,
            "theta": row.theta, "theta_se": row.theta_se, "n_responses": row.n_responses}


# ── Evaluation snapshots ─────────────────────────────────────────────────────
async def save_evaluation(db: AsyncSession, result_id: str, profile: dict[str, Any],
                          candidate_id: str | None = None, session_id: str | None = None,
                          role: str = "") -> None:
    decision = profile.get("decision") or {}
    db.add(EvaluationResult(
        id=result_id, candidate_id=candidate_id, session_id=session_id, role=role,
        framework_version=profile.get("framework_version", ""),
        composite_score=profile.get("composite_score"),
        band=decision.get("band"), coverage=profile.get("coverage"),
        profile=profile,
    ))
    await db.flush()


async def query_evaluations(db: AsyncSession, band: str | None = None, min_score: int | None = None) -> list[dict[str, Any]]:
    """Queryable BY band/score — the win over 'report is a JSON blob' (Part 3)."""
    stmt = select(EvaluationResult)
    if band:
        stmt = stmt.where(EvaluationResult.band == band)
    if min_score is not None:
        stmt = stmt.where(EvaluationResult.composite_score >= min_score)
    rows = (await db.scalars(stmt.order_by(EvaluationResult.composite_score.desc()))).all()
    return [{"id": r.id, "role": r.role, "band": r.band, "composite_score": r.composite_score,
             "coverage": r.coverage, "candidate_id": r.candidate_id} for r in rows]


# ── Analytics + CRM projections (read-only rollups over stored data) ──────────
async def analytics_summary(db: AsyncSession) -> dict[str, Any]:
    """Hiring analytics over stored evaluations — the queryable moat data."""
    total = await db.scalar(select(func.count()).select_from(EvaluationResult)) or 0
    avg_score = await db.scalar(select(func.avg(EvaluationResult.composite_score)))
    avg_cov = await db.scalar(select(func.avg(EvaluationResult.coverage)))
    band_rows = (await db.execute(
        select(EvaluationResult.band, func.count()).group_by(EvaluationResult.band)
    )).all()
    sessions = await db.scalar(select(func.count()).select_from(InterviewSession)) or 0
    candidates = await db.scalar(
        select(func.count(func.distinct(EvaluationResult.candidate_id)))
        .where(EvaluationResult.candidate_id.is_not(None))
    ) or 0
    return {
        "total_evaluations": total,
        "interview_sessions": sessions,
        "candidates_evaluated": candidates,
        "avg_composite": round(avg_score, 1) if avg_score is not None else None,
        "avg_coverage": round(avg_cov, 2) if avg_cov is not None else None,
        "by_band": {(b or "unknown"): n for b, n in band_rows},
    }


async def candidate_pipeline(db: AsyncSession, band: str | None = None) -> list[dict[str, Any]]:
    """CRM projection: each candidate with their LATEST evaluation (recruiter view)."""
    stmt = select(EvaluationResult).order_by(EvaluationResult.created_at.desc())
    if band:
        stmt = stmt.where(EvaluationResult.band == band)
    rows = (await db.scalars(stmt)).all()
    seen: dict[str, dict[str, Any]] = {}
    for r in rows:
        key = r.candidate_id or r.id
        if key not in seen:
            seen[key] = {
                "candidate_id": r.candidate_id, "role": r.role, "band": r.band,
                "composite_score": r.composite_score, "coverage": r.coverage,
                "latest_result_id": r.id, "evaluated_at": r.created_at.isoformat(),
            }
    return list(seen.values())


async def candidate_skill_graph(db: AsyncSession, candidate_id: str) -> list[dict[str, Any]]:
    """All persisted skill abilities for a candidate — their cumulative skill graph."""
    rows = (await db.scalars(
        select(CandidateSkillState).where(CandidateSkillState.candidate_id == candidate_id)
    )).all()
    return [{"skill_id": s.skill_id, "theta": s.theta, "theta_se": s.theta_se,
             "n_responses": s.n_responses} for s in rows]
