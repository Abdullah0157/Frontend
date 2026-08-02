# JobStream Backend — AI-Native Python Spine

The Python-first backend for the JobStream AI Hiring OS. This is **P0 of the
strangler-fig migration**: the provider-independent spine that stands up *beside*
the existing Next.js app without touching it.

> Full target architecture: see the architecture doc (§1–§12). This repo folder
> implements §4 (Provider Independence) + §8 (structure) + §9 (async API) first,
> because it's the highest-value, zero-risk starting point.

## What's here (P0)

| Piece | File | Why it's first |
|---|---|---|
| **LLM Gateway port** | `ports/llm.py` | The one interface all agents/domain depend on. No vendor SDK leaks past it. |
| **LiteLLM adapter** | `adapters/litellm_gateway.py` | Tier→model resolution, fallback chain, bounded backoff (2.5s cap), cost tracking. |
| **Tier config** | `config/models.yaml` | Swap OpenAI↔Anthropic↔Gemini↔Groq here — nowhere else. |
| **FastAPI app** | `app/main.py` | Thin. Wires the adapter into the port at startup (DI). |
| **Demo routes** | `app/routers/demo.py` | Prove the abstraction: `/v1/llm/ask` returns which model *actually* served it. |
| **Tests** | `tests/test_gateway.py` | Domain code runs against a fake gateway — no network. |

## The core idea

Business code asks for a **capability tier**, never a vendor model:

```python
await gateway.complete(CompletionRequest(
    tier="planner",                      # not "claude-sonnet-5"
    messages=[Message(role="user", content="...")],
))
```

`config/models.yaml` maps `planner → anthropic/claude-sonnet-5` (with fallbacks).
Changing providers is a config edit. Zero business-logic changes. That is the
whole "future model independence" requirement, enforced by the type system.

## Run it

```bash
cd backend
python3.13 -m venv .venv && source .venv/bin/activate
pip install ".[dev]"

# tests (no provider keys needed — uses a fake gateway)
pytest -q

# run the API (set at least one provider key in .env first)
cp .env.example .env      # add a key
uvicorn app.main:app --reload
# → POST http://localhost:8000/v1/llm/ask  {"tier":"cheap","prompt":"hi"}
#   response includes "served_by" so you can see the real model + failover.

# full local stack (Postgres + Redis + MinIO)
docker compose -f deploy/docker-compose.yml up
```

## What comes next (per the migration plan)

- **P1** — port the Evaluation Engine (EIE) + Reporting behind a flag; event bus.
- **P2** — Interview Orchestrator + Planner + Conversation on LangGraph; voice worker (sub-2s).
- **P3** — Assessment (IRT), CRM, analytics, workflows; extract services only when signals fire.

The Next.js frontend stays as-is throughout and calls this service capability by
capability, always with the old path one flag away.
