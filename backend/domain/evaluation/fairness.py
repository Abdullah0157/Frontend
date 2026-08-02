"""Fairness & Validity — EIE (ported from lib/fairness.js).

Makes the engine legally/ethically defensible:
  • blinding: redact identity cues before the rater ever sees the transcript
  • adverse impact: the EEOC 4/5ths rule on selection rates by group
  • DIF: does equal ability yield equal ratings across groups?
  • bias-audit export: the NYC Local Law 144 annual summary

Protected-class labels come via HRIS integration and are NEVER elicited in the
interview. All computations are pure and unit-tested.
"""

from __future__ import annotations

import math
import re
from typing import Any, Callable

from domain.evaluation.psychometrics import _js_round

# ── Blinding ─────────────────────────────────────────────────────────────────
_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_PHONE = re.compile(r"(?:\+?\d[\d\s().-]{7,}\d)")
_URL = re.compile(r"\bhttps?://\S+|\bwww\.\S+", re.I)
_HONORIFIC = re.compile(r"\b(mr|mrs|ms|miss|mx|dr|prof)\.?\s+[A-Z][a-z]+")


def blind_transcript(messages: list[dict], name: str | None = None) -> dict[str, Any]:
    """Redact identity cues from CANDIDATE turns before rating (interviewer turns
    left intact). Returns {"messages": blinded, "redactions": count}."""
    redactions = 0
    name_re: re.Pattern[str] | None = None
    if name:
        parts = [re.escape(p) for p in name.strip().split()]
        if parts:
            name_re = re.compile(r"\b" + r"\s+".join(parts) + r"\b", re.I)

    def redact(text: Any) -> str:
        nonlocal redactions
        t = str(text or "")

        def sub(regex: re.Pattern[str], tag: str) -> None:
            nonlocal t, redactions
            def repl(_m: re.Match[str]) -> str:
                nonlocal redactions
                redactions += 1
                return tag
            t = regex.sub(repl, t)

        sub(_EMAIL, "[email]")
        sub(_URL, "[url]")
        sub(_PHONE, "[phone]")
        sub(_HONORIFIC, "[name]")
        if name_re is not None:
            sub(name_re, "[name]")
        return t

    blinded = [
        m if m.get("role") == "assistant" else {**m, "content": redact(m.get("content"))}
        for m in (messages or [])
    ]
    return {"messages": blinded, "redactions": redactions}


# ── Adverse impact — the 4/5ths rule ─────────────────────────────────────────
def adverse_impact(rows: list[dict], min_cell: int = 30, threshold: float = 0.8) -> dict[str, Any]:
    g: dict[str, dict[str, int]] = {}
    for r in rows or []:
        k = r.get("group", "unknown")
        g.setdefault(k, {"n": 0, "selected": 0})
        g[k]["n"] += 1
        if r.get("selected"):
            g[k]["selected"] += 1
    groups = [
        {"group": group, "n": v["n"], "selected": v["selected"],
         "rate": _js_round(v["selected"] / v["n"], 3) if v["n"] else 0}
        for group, v in g.items()
    ]
    if len(groups) < 2:
        return {"status": "insufficient_groups", "groups": groups}
    max_rate = max(x["rate"] for x in groups)
    for x in groups:
        x["impact_ratio"] = _js_round(x["rate"] / max_rate, 3) if max_rate > 0 else None
        x["flag"] = x["impact_ratio"] is not None and x["impact_ratio"] < threshold
    small_cells = any(x["n"] < min_cell for x in groups)
    any_flag = any(x["flag"] for x in groups)
    return {
        "status": "insufficient_data" if small_cells else ("adverse_impact_detected" if any_flag else "pass"),
        "rule": "4/5ths",
        "max_rate": _js_round(max_rate, 3),
        "groups": sorted(groups, key=lambda a: a["rate"], reverse=True),
    }


def standardized_mean_difference(a: list[float], b: list[float]) -> float | None:
    """Cohen's d between two groups on a competency score."""
    ga = [x for x in (a or []) if isinstance(x, (int, float)) and math.isfinite(x)]
    gb = [x for x in (b or []) if isinstance(x, (int, float)) and math.isfinite(x)]
    if len(ga) < 2 or len(gb) < 2:
        return None
    mean = lambda x: sum(x) / len(x)  # noqa: E731
    varc = lambda x, m: sum((v - m) ** 2 for v in x) / (len(x) - 1)  # noqa: E731
    ma, mb = mean(ga), mean(gb)
    pooled = math.sqrt(((len(ga) - 1) * varc(ga, ma) + (len(gb) - 1) * varc(gb, mb)) / (len(ga) + len(gb) - 2))
    return _js_round((ma - mb) / pooled, 3) if pooled > 0 else 0


def differential_item_functioning(rows: list[dict], focal: str, reference: str, flag_at: float = 0.3) -> dict[str, Any]:
    """DIF (Mantel-Haenszel idea): compare focal vs reference score CONDITIONAL on
    ability band, so a gap is only attributed to bias after controlling ability."""
    bands: dict[str, dict[str, list]] = {}
    for r in rows or []:
        if r.get("group") not in (focal, reference):
            continue
        b = r.get("ability_band", "na")
        bands.setdefault(b, {"focal": [], "reference": []})
        (bands[b]["focal"] if r["group"] == focal else bands[b]["reference"]).append(r["score"])
    wsum = 0.0
    gap_sum = 0.0
    per_band = []
    for band, v in bands.items():
        if len(v["focal"]) < 2 or len(v["reference"]) < 2:
            continue
        mean = lambda x: sum(x) / len(x)  # noqa: E731
        gap = _js_round(mean(v["focal"]) - mean(v["reference"]), 2)
        w = len(v["focal"]) + len(v["reference"])
        per_band.append({"band": band, "gap": gap, "n": w})
        wsum += w
        gap_sum += gap * w
    if wsum == 0:
        return {"status": "insufficient_data", "per_band": per_band}
    conditional_gap = _js_round(gap_sum / wsum, 2)
    return {
        "status": "dif_detected" if abs(conditional_gap) >= flag_at * 100 else "pass",
        "conditional_gap": conditional_gap,
        "per_band": per_band,
    }


def bias_audit_summary(decisions: list[dict], group_field: str = "group",
                       select_predicate: Callable[[dict], bool] | None = None) -> dict[str, Any]:
    is_selected = select_predicate or (lambda d: d.get("band") in ("Strong Hire", "Hire", "Hire with Reservations"))
    rows = [{"group": d.get(group_field), "selected": is_selected(d)} for d in decisions]
    return {
        "generated_for": "NYC Local Law 144 style bias audit",
        "n": len(decisions),
        "adverse_impact": adverse_impact(rows),
        "note": ("Protected-class labels are supplied via HRIS integration and are never elicited "
                 "during the interview. Ratings are produced on identity-blinded transcripts."),
    }
