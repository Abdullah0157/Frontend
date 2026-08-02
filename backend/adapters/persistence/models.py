"""SQLAlchemy 2 (async) ORM models — the durable substrate.

Portable across SQLite (tests) and PostgreSQL (prod): JSON columns, string UUIDs,
Python-side timestamps. Kept OUT of the domain layer — domain code stays pure and
speaks dicts; repositories map ORM ↔ domain. Mirrors the target schema (Part 7 /
Part 11): candidate identity, event-sourced interview runtime, calibrated item
bank, cumulative skill graph, and evaluation results.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Candidate(Base):
    __tablename__ = "candidates"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    email: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class InterviewSession(Base):
    __tablename__ = "interview_sessions"
    id: Mapped[str] = mapped_column(String, primary_key=True)  # == session_id / thread_id
    candidate_id: Mapped[str | None] = mapped_column(ForeignKey("candidates.id"), nullable=True)
    role: Mapped[str] = mapped_column(String)
    seniority: Mapped[str | None] = mapped_column(String, nullable=True)
    state: Mapped[str] = mapped_column(String, default="active")  # active|completed|abandoned
    framework_version: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    events: Mapped[list["InterviewEvent"]] = relationship(back_populates="session", cascade="all, delete-orphan")


class InterviewEvent(Base):
    """Append-only event log — the event-sourced runtime (replayable, auditable)."""
    __tablename__ = "interview_events"
    __table_args__ = (UniqueConstraint("session_id", "seq", name="uq_event_seq"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("interview_sessions.id"), index=True)
    seq: Mapped[int] = mapped_column(Integer)
    type: Mapped[str] = mapped_column(String)          # e.g. QuestionAsked, CandidateAnswered
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    actor: Mapped[str] = mapped_column(String, default="system")
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    session: Mapped[InterviewSession] = relationship(back_populates="events")


class Item(Base):
    """Calibrated assessment item (the item bank — the moat's substrate)."""
    __tablename__ = "items"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    skill: Mapped[str] = mapped_column(String, index=True, default="")
    a: Mapped[float] = mapped_column(Float, default=1.0)   # discrimination
    b: Mapped[float] = mapped_column(Float, default=0.0)   # difficulty
    c: Mapped[float] = mapped_column(Float, default=0.0)   # guessing
    n_administered: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String, default="live")  # draft|live|retired


class ItemResponse(Base):
    __tablename__ = "item_responses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_id: Mapped[str] = mapped_column(ForeignKey("items.id"), index=True)
    candidate_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    session_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    correct: Mapped[bool] = mapped_column(Boolean)
    time_spent_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class CandidateSkillState(Base):
    """Persistent per-candidate ability on a skill — the cumulative skill graph.
    θ is comparable across every assessment because items share one scale."""
    __tablename__ = "candidate_skill_state"
    __table_args__ = (UniqueConstraint("candidate_id", "skill_id", name="uq_skill_state"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    candidate_id: Mapped[str] = mapped_column(String, index=True)
    skill_id: Mapped[str] = mapped_column(String, index=True)
    theta: Mapped[float] = mapped_column(Float, default=0.0)
    theta_se: Mapped[float] = mapped_column(Float, default=1.0)
    n_responses: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class EvaluationResult(Base):
    """Immutable snapshot of a scored EIE profile + decision (queryable columns
    promoted out of the JSON blob, per Part 3 fix)."""
    __tablename__ = "evaluation_results"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    candidate_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    session_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    role: Mapped[str] = mapped_column(String)
    framework_version: Mapped[str] = mapped_column(String)
    composite_score: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    band: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    coverage: Mapped[float | None] = mapped_column(Float, nullable=True)
    profile: Mapped[dict] = mapped_column(JSON, default=dict)  # full structured profile
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
