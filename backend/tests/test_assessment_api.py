"""API test: adaptive assessment endpoint selects items and estimates ability."""

from __future__ import annotations

from starlette.testclient import TestClient

from app.main import app

POOL = [{"id": f"i{i}", "a": 1.4, "b": -3 + i * 0.4, "c": 0.0, "skill": "python"} for i in range(16)]


def test_first_call_returns_a_starting_item() -> None:
    with TestClient(app) as c:
        r = c.post("/v1/assessment/next", json={"pool": POOL, "responses": [], "min_items": 4})
        assert r.status_code == 200
        b = r.json()
        assert b["done"] is False
        assert b["next_item"] is not None
        assert abs(b["ability"]["theta"]) < 0.01     # prior at start
        assert abs(b["ability"]["se"] - 1.0) < 0.05


def test_responses_move_the_estimate_and_pick_new_item() -> None:
    with TestClient(app) as c:
        # A high-ability pattern: all correct → θ rises, next item gets harder.
        responses = [{"item_id": f"i{i}", "correct": True} for i in range(6)]
        r = c.post("/v1/assessment/next", json={"pool": POOL, "responses": responses, "min_items": 4, "max_se": 0.35})
        b = r.json()
        assert b["ability"]["theta"] > 0.3           # correct answers raised ability
        assert b["report"]["items_administered"] == 6
        # If not done, the next item must be one not already administered.
        if b["next_item"]:
            assert b["next_item"]["id"] not in {f"i{i}" for i in range(6)}


def test_unknown_item_reference_is_422() -> None:
    with TestClient(app) as c:
        r = c.post("/v1/assessment/next", json={"pool": POOL, "responses": [{"item_id": "nope", "correct": True}]})
        assert r.status_code == 422
