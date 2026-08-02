"""EIE competency framework — Python port parity tests.

Reference values from the original JS (lib/competency-framework.js).
"""

from __future__ import annotations

from domain.evaluation.competency_framework import (
    FRAMEWORK_VERSION,
    anchor_guide_text,
    build_model,
    role_family_from_text,
    seniority_from_text,
)


def test_role_family_detection_matches_js() -> None:
    assert role_family_from_text("Senior Backend Engineer") == "software_engineer"
    assert role_family_from_text("Product Manager") == "product_manager"
    assert role_family_from_text("Account Executive") == "sales"
    assert role_family_from_text("Chef") == "_default"


def test_seniority_detection_matches_js() -> None:
    assert seniority_from_text("VP of Engineering") == "exec"
    assert seniority_from_text("Staff Engineer") == "staff"
    assert seniority_from_text("Senior Engineer") == "senior"
    assert seniority_from_text("Junior Developer") == "ic3"


def test_build_model_matches_js() -> None:
    m = build_model("Senior Backend Engineer", "Senior Backend Engineer")
    assert m["role_family"] == "software_engineer"
    assert m["seniority"] == "senior"
    assert m["framework_version"] == FRAMEWORK_VERSION == "eie-2025.1"
    assert [c["id"] for c in m["competencies"]] == [
        "structured_problem_solving", "ownership", "communication",
        "learning_velocity", "integrity_judgment", "technical_depth", "system_design",
    ]
    assert [c["weight"] for c in m["competencies"]] == [0.167, 0.149, 0.123, 0.114, 0.123, 0.167, 0.158]


def test_weights_normalize() -> None:
    m = build_model("Senior Backend Engineer")
    assert abs(sum(c["weight"] for c in m["competencies"]) - 1.0) < 0.005  # rounding slack


def test_anchor_guide_renders_all_competencies() -> None:
    m = build_model("Senior Backend Engineer")
    guide = anchor_guide_text(m)
    for c in m["competencies"]:
        assert c["id"] in guide
        assert c["anchors"][5] in guide  # top anchor present → frame-of-reference intact
