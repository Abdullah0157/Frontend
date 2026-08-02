"""Realtime voice relay — browser mic ↔ Gemini Live ↔ browser speaker.

WebSocket at /v1/voice/ws. The browser streams 16 kHz PCM mic frames (binary);
we relay them to a Gemini Live session (Maya persona) and stream the model's
native audio back (binary), plus live transcripts + turn events (JSON). Full
duplex: barge-in works because the mic stream never stops. Transcripts are
accumulated so the EIE belief loop can score in the background.

Provider-independent: the relay depends on the VoiceProvider/VoiceSession ports,
so swapping Gemini Live for another realtime stack is a config change.
"""

from __future__ import annotations

import asyncio

import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ports.voice import VoiceEventType

log = structlog.get_logger(__name__)
router = APIRouter(prefix="/v1/voice", tags=["voice"])

_VOICE_PERSONA = (
    "You are Maya, a warm, senior domain-expert interviewer conducting a live voice "
    "interview. One focused question per turn, then you listen. Be concise (a sentence "
    "or two), build on what they just said, and never read long paragraphs aloud. No "
    "filler. English only."
)


def _system_instruction(role: str) -> str:
    return f"{_VOICE_PERSONA}\n\nYou are interviewing for: {role or 'this role'}."


@router.websocket("/ws")
async def voice_ws(ws: WebSocket) -> None:
    await ws.accept()
    provider = getattr(ws.app.state, "voice", None)
    if provider is None:
        await ws.send_json({"type": "error", "text": "voice provider unavailable"})
        await ws.close()
        return

    # First message configures the session (role/seniority/name).
    try:
        cfg = await ws.receive_json()
    except Exception:
        cfg = {}
    role = cfg.get("role", "")
    transcript: list[dict] = []  # accumulates for the EIE belief loop

    try:
        async with provider.connect(_system_instruction(role), voice=cfg.get("voice", "")) as session:
            async def pump_browser_to_model() -> None:
                while True:
                    msg = await ws.receive()
                    if msg.get("type") == "websocket.disconnect":
                        raise WebSocketDisconnect()
                    data = msg.get("bytes")
                    if data:
                        await session.send_audio(data)
                    # A text frame can signal end-of-input, etc. (ignored for the pilot).

            async def pump_model_to_browser() -> None:
                async for ev in session.receive():
                    if ev.type == VoiceEventType.audio and ev.audio is not None:
                        await ws.send_bytes(ev.audio)
                    elif ev.type == VoiceEventType.input_transcript:
                        transcript.append({"role": "user", "content": ev.text or ""})
                        await ws.send_json({"type": "input_transcript", "text": ev.text})
                    elif ev.type == VoiceEventType.output_transcript:
                        transcript.append({"role": "assistant", "content": ev.text or ""})
                        await ws.send_json({"type": "output_transcript", "text": ev.text})
                    elif ev.type == VoiceEventType.interrupted:
                        await ws.send_json({"type": "interrupted"})
                    elif ev.type == VoiceEventType.turn_complete:
                        await ws.send_json({"type": "turn_complete"})

            # Full duplex: run both directions until either side ends.
            b2m = asyncio.create_task(pump_browser_to_model())
            m2b = asyncio.create_task(pump_model_to_browser())
            done, pending = await asyncio.wait({b2m, m2b}, return_when=asyncio.FIRST_COMPLETED)
            for t in pending:
                t.cancel()
    except WebSocketDisconnect:
        log.info("voice.disconnect", turns=len(transcript))
    except Exception as e:  # noqa: BLE001
        log.warning("voice.error", error=str(e)[:200])
        try:
            await ws.send_json({"type": "error", "text": "voice session ended"})
        except Exception:
            pass
    finally:
        # Hook point: score `transcript` via the EIE belief loop here (background).
        try:
            await ws.close()
        except Exception:
            pass
