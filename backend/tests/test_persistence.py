"""Persistence layer — round-trip tests against in-memory SQLite.

Same models run on Postgres in prod; SQLite here keeps the suite offline + fast.
"""

from __future__ import annotations

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import StaticPool

from adapters.persistence import repositories as repo
from infra.db import init_models, make_sessionmaker


@pytest_asyncio.fixture
async def db() -> AsyncSession:
    # StaticPool → one shared in-memory DB across the engine's connections.
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:", poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    await init_models(engine)
    sm = make_sessionmaker(engine)
    async with sm() as session:
        yield session
    await engine.dispose()


@pytest.mark.asyncio
async def test_event_log_is_append_only_with_monotonic_seq(db: AsyncSession) -> None:
    await repo.ensure_session(db, "s1", role="SWE", seniority="senior")
    seq1 = await repo.append_event(db, "s1", "QuestionAsked", {"text": "Q1"})
    seq2 = await repo.append_event(db, "s1", "CandidateAnswered", {"text": "A1"})
    seq3 = await repo.append_event(db, "s1", "QuestionAsked", {"text": "Q2"})
    assert [seq1, seq2, seq3] == [1, 2, 3]
    events = await repo.load_events(db, "s1")
    assert [e["type"] for e in events] == ["QuestionAsked", "CandidateAnswered", "QuestionAsked"]
    assert events[0]["payload"]["text"] == "Q1"      # replayable event-sourced log


@pytest.mark.asyncio
async def test_item_bank_and_responses(db: AsyncSession) -> None:
    n = await repo.upsert_items(db, [
        {"id": "q1", "a": 1.4, "b": 0.0, "skill": "python"},
        {"id": "q2", "a": 1.2, "b": 1.0, "skill": "python"},
    ])
    assert n == 2
    pool = await repo.get_pool(db, skill="python")
    assert {i["id"] for i in pool} == {"q1", "q2"}
    await repo.record_response(db, "q1", correct=True, candidate_id="c1", session_id="s1")
    # n_administered incremented on the item.
    pool2 = await repo.get_pool(db)
    assert len(pool2) == 2


@pytest.mark.asyncio
async def test_skill_graph_upsert_is_cumulative(db: AsyncSession) -> None:
    await repo.upsert_skill_state(db, "c1", "python", theta=0.5, theta_se=0.6, n_responses=3)
    await repo.upsert_skill_state(db, "c1", "python", theta=0.9, theta_se=0.35, n_responses=8)  # updated
    state = await repo.get_skill_state(db, "c1", "python")
    assert state is not None
    assert state["theta"] == 0.9 and state["n_responses"] == 8   # last write wins, one row
    assert await repo.get_skill_state(db, "c1", "systems") is None


@pytest.mark.asyncio
async def test_evaluation_is_queryable_by_band_and_score(db: AsyncSession) -> None:
    await repo.save_evaluation(db, "e1", {
        "framework_version": "eie-2025.1", "composite_score": 81, "coverage": 0.84,
        "decision": {"band": "Strong Hire"},
    }, candidate_id="c1", role="SWE")
    await repo.save_evaluation(db, "e2", {
        "framework_version": "eie-2025.1", "composite_score": 40, "coverage": 0.8,
        "decision": {"band": "No Hire"},
    }, candidate_id="c2", role="SWE")
    # The Part-3 win: query WHERE band/score, no full-scan of a JSON blob.
    strong = await repo.query_evaluations(db, band="Strong Hire")
    assert [r["id"] for r in strong] == ["e1"]
    high = await repo.query_evaluations(db, min_score=70)
    assert [r["id"] for r in high] == ["e1"]
