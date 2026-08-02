"""Adaptive Assessment Engine — verified by CAT properties."""

from __future__ import annotations

import random

from domain.assessment.adaptive import AdaptiveSession, StoppingConfig, select_next_item
from domain.assessment.irt import Item, prob_correct


def _pool(n: int = 40, c: float = 0.0) -> list[Item]:
    # A bank spanning difficulty, with a couple of skills. Default 2PL (no
    # guessing) so property tests reason about reachable precision cleanly.
    return [
        Item(id=f"i{i}", a=1.2 + (i % 5) * 0.15, b=-3 + i * (6 / (n - 1)), c=c,
             skill="python" if i % 2 == 0 else "systems")
        for i in range(n)
    ]


def test_selects_most_informative_item() -> None:
    pool = [Item(id="easy", a=1.2, b=-2.5, c=0.2),
            Item(id="on_target", a=1.5, b=0.0, c=0.2),
            Item(id="hard", a=1.2, b=2.5, c=0.2)]
    # At θ≈0, the b≈0 item is most informative.
    assert select_next_item(0.0, pool, set()).id == "on_target"


def test_respects_min_items() -> None:
    s = AdaptiveSession(_pool(), StoppingConfig(min_items=5, max_items=30, max_se=0.9))
    for _ in range(3):
        it = s.next_item()
        assert it is not None
        s.record(it, True)
    assert s.is_done() is False   # below min_items → never done even if SE is low


def test_respects_max_items_cap() -> None:
    # Impossible SE target → must stop at the cap, not run forever.
    s = AdaptiveSession(_pool(), StoppingConfig(min_items=2, max_items=8, max_se=0.01))
    rng = random.Random(1)
    n = 0
    while (it := s.next_item()) is not None and n < 100:
        s.record(it, rng.random() < 0.6)
        n += 1
    assert s.n_administered == 8   # stopped exactly at max_items


def test_adaptive_converges_to_true_theta() -> None:
    true_theta = 1.2
    s = AdaptiveSession(_pool(60), StoppingConfig(min_items=6, max_items=45, max_se=0.34))
    rng = random.Random(11)
    while (it := s.next_item()) is not None:
        s.record(it, rng.random() < prob_correct(true_theta, it))
    r = s.report()
    assert r["done"] is True
    assert r["se"] <= 0.34                       # reached the target precision
    assert abs(r["theta"] - true_theta) < 0.5    # converged near the true ability


def test_adaptive_beats_fixed_length_for_precision() -> None:
    # Adaptive should reach the SE target using fewer items than the full bank.
    true_theta = 0.0
    s = AdaptiveSession(_pool(60), StoppingConfig(min_items=6, max_items=60, max_se=0.35))
    rng = random.Random(5)
    while (it := s.next_item()) is not None:
        s.record(it, rng.random() < prob_correct(true_theta, it))
    assert s.n_administered < 60                # didn't need the whole bank
    assert s.ability.se <= 0.35


def test_pool_exhaustion_stops_gracefully() -> None:
    s = AdaptiveSession(_pool(5), StoppingConfig(min_items=2, max_items=50, max_se=0.001))
    rng = random.Random(2)
    while (it := s.next_item()) is not None:
        s.record(it, rng.random() < 0.5)
    assert s.n_administered == 5   # exhausted the 5-item pool without crashing
    assert s.is_done() is True
