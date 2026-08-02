# Multi-stage, slim, non-root. Same image runs local (compose) and prod (k8s).
FROM python:3.13-slim AS base
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1

WORKDIR /app
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install ".[dev]"

COPY . .

# Non-root for security.
RUN useradd -m appuser && chown -R appuser /app
USER appuser

# Bind to the platform's $PORT (Render/Railway set it); default 8000 locally.
# uvicorn[standard] includes the websockets impl the voice relay needs.
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
