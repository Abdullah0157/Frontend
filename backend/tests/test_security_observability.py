"""ABAC authorization, API-key auth, and request-tracing observability."""

from __future__ import annotations

import os

import pytest
from fastapi import HTTPException
from starlette.testclient import TestClient

from app.main import app
from app.security import Principal, authorize, enforce


# ── ABAC policy ──────────────────────────────────────────────────────────────
def test_admin_can_do_anything() -> None:
    p = Principal(id="u1", role="admin")
    assert authorize(p, "write:evaluation", {"org_id": "x"}) is True


def test_recruiter_reads_only_own_org() -> None:
    p = Principal(id="r1", role="recruiter", org_id="orgA")
    assert authorize(p, "read:candidates", {"org_id": "orgA"}) is True
    assert authorize(p, "read:candidates", {"org_id": "orgB"}) is False
    assert authorize(p, "write:candidate", {"org_id": "orgA"}) is False  # recruiters don't write here


def test_viewer_reads_only_their_own_record() -> None:
    p = Principal(id="cand_1", role="viewer")
    assert authorize(p, "read:profile", {"candidate_id": "cand_1"}) is True
    assert authorize(p, "read:profile", {"candidate_id": "cand_2"}) is False


def test_enforce_raises_on_deny() -> None:
    with pytest.raises(HTTPException) as ei:
        enforce(Principal(id="v", role="viewer"), "read:x", {"candidate_id": "other"})
    assert ei.value.status_code == 403


# ── API-key auth (opt-in) ────────────────────────────────────────────────────
def test_api_key_enforced_when_configured() -> None:
    if os.path.exists("jobstream.db"):
        os.remove("jobstream.db")
    os.environ["JS_API_KEY"] = "secret123"
    try:
        with TestClient(app) as c:
            assert c.get("/v1/analytics/summary").status_code == 401             # no key
            assert c.get("/v1/analytics/summary", headers={"x-api-key": "wrong"}).status_code == 401
            ok = c.get("/v1/analytics/summary", headers={"x-api-key": "secret123"})
            assert ok.status_code == 200
    finally:
        del os.environ["JS_API_KEY"]


def test_no_api_key_means_open_in_dev() -> None:
    os.environ.pop("JS_API_KEY", None)
    with TestClient(app) as c:
        assert c.get("/v1/analytics/summary").status_code == 200  # auth disabled in dev


# ── Observability ────────────────────────────────────────────────────────────
def test_every_response_carries_a_request_id() -> None:
    with TestClient(app) as c:
        r = c.get("/health")
        assert r.status_code == 200
        assert r.headers.get("x-request-id")  # request-tracing id attached
