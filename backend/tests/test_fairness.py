"""EIE fairness — Python port parity tests (reference: lib/fairness.js)."""

from __future__ import annotations

from domain.evaluation.fairness import (
    adverse_impact,
    blind_transcript,
    standardized_mean_difference,
)


def test_blinding_redacts_identity_and_counts_matches_js() -> None:
    msgs = [
        {"role": "assistant", "content": "Tell me about yourself, Mr. Smith."},
        {"role": "user", "content": "I am John Smith, reach me at john@example.com or +1 415 555 1234, portfolio https://john.dev"},
    ]
    out = blind_transcript(msgs, name="John Smith")
    assert out["redactions"] == 4
    assert out["messages"][1]["content"] == "I am [name], reach me at [email] or [phone], portfolio [url]"
    # Interviewer turn is left intact (only candidate turns are blinded).
    assert out["messages"][0]["content"] == "Tell me about yourself, Mr. Smith."


def test_adverse_impact_4_5ths_matches_js() -> None:
    rows = (
        [{"group": "A", "selected": True}] * 40 + [{"group": "A", "selected": False}] * 10 +
        [{"group": "B", "selected": True}] * 20 + [{"group": "B", "selected": False}] * 30
    )
    ai = adverse_impact(rows)
    assert ai["status"] == "adverse_impact_detected"  # B's rate (0.4) < 0.8 × A's rate (0.8)
    assert ai["max_rate"] == 0.8


def test_standardized_mean_difference_matches_js() -> None:
    assert standardized_mean_difference([80, 70, 75, 90], [60, 55, 65, 50]) == 2.807
