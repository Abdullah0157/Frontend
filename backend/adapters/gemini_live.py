"""Gemini Live implementation of the VoiceSession port.

Wraps google-genai's realtime Live API (native audio-in / audio-out) so the rest
of the platform talks to the provider-independent VoiceSession, not Gemini. This
is the ONLY file that knows Gemini Live exists — swapping to LiveKit/Deepgram+
ElevenLabs later means adding a sibling adapter, not touching the relay or the
interview logic.

Note: `google.genai` is imported lazily (heavy, and network-live) so the module
loads and is unit-testable without it. The Live wire shape is read defensively
because it varies across SDK versions.
"""

from __future__ import annotations

import os
from typing import Any, AsyncIterator

import structlog

from ports.voice import VoiceEvent, VoiceEventType

log = structlog.get_logger(__name__)

# Native-audio Live model. Overridable via env as the Live line evolves.
DEFAULT_LIVE_MODEL = os.environ.get("GEMINI_LIVE_MODEL", "gemini-2.0-flash-live-001")
DEFAULT_VOICE = os.environ.get("GEMINI_LIVE_VOICE", "Aoede")
INPUT_RATE = 16000   # mic PCM in
OUTPUT_RATE = 24000  # model PCM out


class _GeminiLiveSession:
    """Adapts one open Gemini Live session to the VoiceSession port."""

    def __init__(self, sdk_session: Any) -> None:
        self._s = sdk_session

    async def send_audio(self, pcm16: bytes) -> None:
        from google.genai import types
        await self._s.send_realtime_input(
            audio=types.Blob(data=pcm16, mime_type=f"audio/pcm;rate={INPUT_RATE}")
        )

    async def receive(self) -> AsyncIterator[VoiceEvent]:
        async for resp in self._s.receive():
            # Model audio (native TTS) — the low-latency win.
            data = getattr(resp, "data", None)
            if data:
                yield VoiceEvent(type=VoiceEventType.audio, audio=data)

            sc = getattr(resp, "server_content", None)
            if sc is None:
                continue
            # Live transcripts of both sides (read defensively across versions).
            it = getattr(sc, "input_transcription", None)
            if it is not None and getattr(it, "text", None):
                yield VoiceEvent(type=VoiceEventType.input_transcript, text=it.text)
            ot = getattr(sc, "output_transcription", None)
            if ot is not None and getattr(ot, "text", None):
                yield VoiceEvent(type=VoiceEventType.output_transcript, text=ot.text)
            if getattr(sc, "interrupted", False):
                yield VoiceEvent(type=VoiceEventType.interrupted)
            if getattr(sc, "turn_complete", False):
                yield VoiceEvent(type=VoiceEventType.turn_complete)

    async def close(self) -> None:
        try:
            await self._s.close()
        except Exception:  # noqa: BLE001 — best-effort teardown
            pass


class _ConnectCM:
    """Async context manager: opens the SDK Live session, yields the adapter."""

    def __init__(self, model: str, config: Any) -> None:
        self._model = model
        self._config = config
        self._cm: Any = None

    async def __aenter__(self) -> _GeminiLiveSession:
        from google import genai
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        self._cm = client.aio.live.connect(model=self._model, config=self._config)
        sdk_session = await self._cm.__aenter__()
        log.info("voice.connected", provider="gemini_live", model=self._model)
        return _GeminiLiveSession(sdk_session)

    async def __aexit__(self, *exc: object) -> None:
        if self._cm is not None:
            await self._cm.__aexit__(*exc)


class GeminiLiveProvider:
    """Opens Gemini Live voice sessions (implements the VoiceProvider port)."""

    def __init__(self, model: str = DEFAULT_LIVE_MODEL) -> None:
        self._model = model

    def connect(self, system_instruction: str, voice: str = "") -> _ConnectCM:
        from google.genai import types
        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            system_instruction=system_instruction,
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice or DEFAULT_VOICE)
                )
            ),
            # Live transcripts of both sides → feed the EIE belief loop.
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
        )
        return _ConnectCM(self._model, config)
