"""Calibration & Outcome Loop — EIE (ported from lib/calibration.js).

Once real hire outcomes accrue, this measures whether predictions were actually
valid and RECALIBRATES the engine against ground truth:
  • predictive validity: Brier, AUC, calibration curve / ECE
  • recalibrate the decision bar (θ cut) to maximize outcome agreement (Youden J)
  • recalibrate competency weights from their empirical link to outcomes

Until enough outcomes exist, everything is 'insufficient_data' and the engine
keeps its theory-based priors. We never claim validity we haven't earned — this
is the compounding moat that needs YOUR accumulating outcome data.
"""

from __future__ import annotations

import math
from typing import Any

from domain.evaluation.psychometrics import _js_round


def _r(n: float, d: int = 3) -> float:
    return _js_round(n, d)


def _finite(x: Any) -> bool:
    return isinstance(x, (int, float)) and math.isfinite(x)


def brier_score(pairs: list[dict]) -> float | None:
    xs = [p for p in (pairs or []) if _finite(p.get("p")) and p.get("outcome") in (0, 1)]
    if not xs:
        return None
    return _r(sum((p["p"] - p["outcome"]) ** 2 for p in xs) / len(xs))


def auc(pairs: list[dict]) -> float | None:
    pos = [p["p"] for p in pairs if p.get("outcome") == 1]
    neg = [p["p"] for p in pairs if p.get("outcome") == 0]
    if not pos or not neg:
        return None
    wins = 0.0
    for a in pos:
        for b in neg:
            wins += 1 if a > b else 0.5 if a == b else 0
    return _r(wins / (len(pos) * len(neg)))


def calibration_curve(pairs: list[dict], bins: int = 10) -> list[dict]:
    buckets = [{"sumP": 0.0, "sumO": 0.0, "n": 0} for _ in range(bins)]
    for p in pairs:
        if not _finite(p.get("p")):
            continue
        b = int(max(0, min(bins - 1, math.floor(p["p"] * bins))))
        buckets[b]["sumP"] += p["p"]
        buckets[b]["sumO"] += p["outcome"]
        buckets[b]["n"] += 1
    out = []
    for i, b in enumerate(buckets):
        if b["n"] <= 0:
            continue
        out.append({
            "bin": f"{_r(i / bins, 2)}-{_r((i + 1) / bins, 2)}",
            "n": b["n"],
            "predicted": _r(b["sumP"] / b["n"]),
            "observed": _r(b["sumO"] / b["n"]),
        })
    return out


def expected_calibration_error(pairs: list[dict], bins: int = 10) -> float | None:
    curve = calibration_curve(pairs, bins)
    n = sum(1 for p in pairs if _finite(p.get("p")))
    if not n:
        return None
    return _r(sum((b["n"] / n) * abs(b["predicted"] - b["observed"]) for b in curve))


def recalibrate_bar(rows: list[dict]) -> dict[str, Any]:
    xs = [r for r in (rows or []) if _finite(r.get("theta")) and r.get("outcome") in (0, 1)]
    if len(xs) < 10:
        return {"status": "insufficient_data", "n": len(xs)}
    p_count = sum(1 for r in xs if r["outcome"] == 1)
    n_count = len(xs) - p_count
    if not p_count or not n_count:
        return {"status": "insufficient_data", "n": len(xs)}
    candidates = sorted(set(r["theta"] for r in xs))
    best = {"bar": candidates[0], "j": -1.0, "accuracy": 0.0}
    for bar in candidates:
        tp = sum(1 for r in xs if r["theta"] >= bar and r["outcome"] == 1)
        fp = sum(1 for r in xs if r["theta"] >= bar and r["outcome"] == 0)
        j = tp / p_count - fp / n_count
        acc = (tp + (n_count - fp)) / len(xs)
        if j > best["j"]:
            best = {"bar": _r(bar, 2), "j": _r(j), "accuracy": _r(acc)}
    return {"status": "ok", **best, "n": len(xs)}


def point_biserial(x: list[float], y: list[int]) -> float | None:
    pairs = [(a, b) for a, b in zip(x, y) if _finite(a) and b in (0, 1)]
    if len(pairs) < 3:
        return None
    xs = [p[0] for p in pairs]
    ys = [p[1] for p in pairs]
    n = len(xs)
    mx = sum(xs) / n
    sd = math.sqrt(sum((v - mx) ** 2 for v in xs) / n)
    if sd == 0:
        return 0
    ones = [p[0] for p in pairs if p[1] == 1]
    zeros = [p[0] for p in pairs if p[1] == 0]
    prop = len(ones) / n
    if prop in (0, 1):
        return 0
    m1 = sum(ones) / len(ones)
    m0 = sum(zeros) / len(zeros)
    return _r(((m1 - m0) / sd) * math.sqrt(prop * (1 - prop)))


def recalibrate_weights(rows: list[dict], competency_ids: list[str]) -> dict[str, Any]:
    xs = [r for r in (rows or []) if r and r.get("thetas") and r.get("outcome") in (0, 1)]
    if len(xs) < 20:
        return {"status": "insufficient_data", "n": len(xs)}
    y = [r["outcome"] for r in xs]
    raw: dict[str, float] = {}
    for cid in competency_ids:
        col = [r["thetas"].get(cid) for r in xs]
        if any(not _finite(v) for v in col):
            raw[cid] = 0
            continue
        raw[cid] = max(0, point_biserial(col, y) or 0)
    total = sum(raw.values())
    if total == 0:
        return {"status": "no_signal", "n": len(xs)}
    weights = {cid: _r(raw[cid] / total) for cid in competency_ids}
    return {"status": "ok", "n": len(xs), "weights": weights, "correlations": raw}


def validity_summary(pairs: list[dict], min_n: int = 50) -> dict[str, Any]:
    xs = [p for p in (pairs or []) if _finite(p.get("p")) and p.get("outcome") in (0, 1)]
    if len(xs) < min_n:
        return {"status": "insufficient_data", "n": len(xs), "needed": min_n, "calibration": "uncalibrated_prior"}
    return {
        "status": "calibrated",
        "n": len(xs),
        "calibration": "calibrated",
        "brier": brier_score(xs),
        "auc": auc(xs),
        "ece": expected_calibration_error(xs),
        "curve": calibration_curve(xs),
    }
