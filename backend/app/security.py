"""Security — API-key auth, ABAC authorization, and an audit trail.

- API key: opt-in (JS_API_KEY). When unset (dev), auth is disabled so local runs
  stay frictionless; set it in prod to require `X-API-Key` on protected routes.
- ABAC: attribute-based `authorize(principal, action, resource)` — every read/
  write can be checked against attributes, not just a static role (Part 6).
- Audit: every authorization decision is logged (subject, action, resource,
  allowed) — the "log every access" requirement, shippable to any log store.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

import structlog
from fastapi import HTTPException, Request

audit = structlog.get_logger("audit")


def require_api_key(request: Request) -> None:
    """FastAPI dependency: enforce X-API-Key when JS_API_KEY is configured."""
    expected = os.environ.get("JS_API_KEY")
    if not expected:
        return  # auth disabled in dev
    if request.headers.get("x-api-key") != expected:
        raise HTTPException(status_code=401, detail="invalid or missing API key")


@dataclass
class Principal:
    id: str
    role: str = "viewer"          # viewer | recruiter | admin
    org_id: str | None = None
    attrs: dict = field(default_factory=dict)


# Minimal ABAC policy. Real deployments swap this for Oso/OpenFGA; the interface
# (authorize/enforce) stays identical so call sites never change.
def authorize(principal: Principal, action: str, resource: dict) -> bool:
    # Admins can do anything.
    if principal.role == "admin":
        return True
    # Recruiters read candidates/analytics within their own org.
    if principal.role == "recruiter" and action.startswith("read:"):
        res_org = resource.get("org_id")
        return res_org is None or res_org == principal.org_id
    # Viewers may read their own candidate record only.
    if principal.role == "viewer" and action.startswith("read:"):
        return resource.get("candidate_id") == principal.id
    return False


def enforce(principal: Principal, action: str, resource: dict) -> None:
    """Authorize + audit. Raises 403 on deny."""
    allowed = authorize(principal, action, resource)
    audit.info("access", subject=principal.id, role=principal.role,
               action=action, resource=resource, allowed=allowed)
    if not allowed:
        raise HTTPException(status_code=403, detail="not authorized")
