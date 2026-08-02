"""Observability — structured request tracing.

Assigns a request id, times every HTTP request, and emits a structured log line
(method, path, status, duration). structlog contextvars bind the request id to
every log inside the request, so an interview's whole trace is correlatable.
An OpenTelemetry exporter can be added on top of this without changing call sites.
"""

from __future__ import annotations

import time
import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.types import ASGIApp

log = structlog.get_logger("http")


class ObservabilityMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        rid = request.headers.get("x-request-id") or uuid.uuid4().hex[:16]
        structlog.contextvars.bind_contextvars(request_id=rid)
        start = time.perf_counter()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            response.headers["x-request-id"] = rid
            return response
        finally:
            log.info(
                "http.request",
                method=request.method,
                path=request.url.path,
                status=status,
                duration_ms=round((time.perf_counter() - start) * 1000, 1),
            )
            structlog.contextvars.clear_contextvars()
