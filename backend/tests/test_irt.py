"""IRT core — verified by mathematical properties (greenfield, no JS parity)."""

from __future__ import annotations

import random

from domain.assessment.irt import Item, eap_estimate, item_information, prob_correct


def test_prob_is_bounded_and_monotonic() -> None:
    it = Item(id="x", a=1.2, b=0.0, c=0.2)
    ps = [prob_correct(t, it) for t in (-4, -2, 0, 2, 4)]
    assert all(0.2 - 1e-9 <= p <= 1.0 for p in ps)     # bounded by [c, 1]
    assert ps == sorted(ps)                             # monotonic increasing in θ


def test_prob_at_difficulty_is_half_when_no_guessing() -> None:
    it = Item(id="x", a=1.0, b=0.7, c=0.0)
    assert abs(prob_correct(0.7, it) - 0.5) < 1e-9      # P(b)=0.5 for 2PL


def test_information_peaks_near_difficulty() -> None:
    it = Item(id="x", a=1.5, b=0.5, c=0.0)
    at_b = item_information(0.5, it)
    assert at_b > item_information(0.5 - 2, it)          # info concentrates near b
    assert at_b > item_information(0.5 + 2, it)


def test_higher_discrimination_gives_more_information() -> None:
    sharp = Item(id="s", a=2.0, b=0.0, c=0.0)
    flat = Item(id="f", a=0.7, b=0.0, c=0.0)
    assert item_information(0.0, sharp) > item_information(0.0, flat)


def test_eap_with_no_responses_returns_prior() -> None:
    a = eap_estimate([])
    assert abs(a.theta) < 1e-6      # prior mean 0
    assert abs(a.se - 1.0) < 0.02   # prior sd ≈ 1


def _simulate(true_theta: float, items: list[Item], seed: int) -> list[tuple[Item, int]]:
    rng = random.Random(seed)
    return [(it, 1 if rng.random() < prob_correct(true_theta, it) else 0) for it in items]


def test_eap_recovers_known_ability() -> None:
    # 2PL (no guessing) → clean recovery of a known ability.
    pool = [Item(id=f"i{i}", a=1.5, b=-2 + i * 0.2, c=0.0) for i in range(21)]  # b spans -2..2
    resp = _simulate(1.0, pool, seed=7)
    a = eap_estimate(resp)
    assert abs(a.theta - 1.0) < 0.45      # recovers the true θ within tolerance
    assert a.se < 0.4                      # many items → tight measurement


def test_more_items_reduce_se() -> None:
    pool = [Item(id=f"i{i}", a=1.2, b=-2 + i * 0.4, c=0.2) for i in range(11)]
    resp = _simulate(0.5, pool, seed=3)
    se_few = eap_estimate(resp[:3]).se
    se_many = eap_estimate(resp).se
    assert se_many < se_few                # more evidence → less uncertainty
