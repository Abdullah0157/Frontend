# Deploying the JobStream backend

The backend is a Docker web service (FastAPI + a WebSocket voice relay). It needs
a host that supports **WebSockets** (for the Gemini Live voice loop) — Vercel
can't. Below, ranked for a free pilot.

## ✅ Recommended (free, no card, WebSockets): Koyeb

Koyeb's free tier includes **WebSockets** and doesn't require a credit card. Perfect
for the Maya voice pilot.

1. Sign up at **[koyeb.com](https://www.koyeb.com)** (GitHub login; no card).
2. **Create Web Service** → **GitHub** → repo `Abdullah0157/Frontend`,
   branch **`backend/python-rewrite`**.
3. Build settings:
   - **Work directory / context:** `backend`
   - **Dockerfile:** `deploy/Dockerfile`
4. **Instance:** Free (512 MB). **Port:** `8000` (the container reads `$PORT`; Koyeb sets it).
   **Health check path:** `/health`.
5. **Environment variables:**
   - `GEMINI_API_KEY` = your key (Live API enabled on the Google project)
   - `JS_DATABASE_URL` = leave unset → uses in-container SQLite (fine for the pilot;
     data resets on restart). For persistence, use a free **Neon** Postgres
     (neon.tech, no card) and paste its `postgresql://…` URL here.
6. Deploy → you get `https://<app>-<org>.koyeb.app`.
7. Point the frontend at it (Vercel env):
   `NEXT_PUBLIC_VOICE_WS_URL = wss://<app>-<org>.koyeb.app/v1/voice/ws`

Then open `/dashboard/live-interview` and talk to Maya.

## Alternatives

- **Render** (`render.yaml` here) — free plan, but requires a card ($1 hold, not a
  charge). Includes a free Postgres. Same WebSocket support.
- **Google Cloud Run** — WebSockets up to 60 min; needs GCP billing; long-lived WS
  connections can incur cost.
- **Hugging Face Spaces** — free, no card, but WebSocket support for custom Docker
  apps is unreliable, so the **voice relay likely won't work** (everything else will).

## Free Postgres (optional, for any host)
[Neon](https://neon.tech) — genuinely free Postgres, no card. Paste its connection
string into `JS_DATABASE_URL`; the app normalizes the URL for asyncpg automatically.
