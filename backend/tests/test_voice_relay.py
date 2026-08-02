"""Voice relay — browser ↔ (fake) realtime session, offline.

Verifies the WebSocket relay wiring — config handshake, audio out, transcript +
turn events — without Gemini Live or real audio. The real provider drops in via
app.state.voice with a Gemini key.
"""

from __future__ import annotations

from typing import AsyncIterator

from starlette.testclient import TestClient

from app.main import app
from ports.voice import VoiceEvent, VoiceEventType, VoiceSession


class FakeSession:
    def __init__(self) -> None:
        self.sent: list[bytes] = []

    async def send_audio(self, pcm16: bytes) -> None:
        self.sent.append(pcm16)

    async def receive(self) -> AsyncIterator[VoiceEvent]:
        yield VoiceEvent(type=VoiceEventType.output_transcript, text="Tell me about yourself.")
        yield VoiceEvent(type=VoiceEventType.audio, audio=b"\x00\x01\x02\x03")
        yield VoiceEvent(type=VoiceEventType.turn_complete)

    async def close(self) -> None:
        pass


class FakeCM:
    async def __aenter__(self) -> FakeSession:
        return FakeSession()

    async def __aexit__(self, *exc: object) -> None:
        pass


class FakeProvider:
    def connect(self, system_instruction: str, voice: str = "") -> FakeCM:
        assert "Maya" in system_instruction   # persona wired through
        return FakeCM()


def test_fake_session_satisfies_port() -> None:
    assert isinstance(FakeSession(), VoiceSession)


def test_voice_relay_streams_transcript_audio_and_turn() -> None:
    with TestClient(app) as c:
        app.state.voice = FakeProvider()
        with c.websocket_connect("/v1/voice/ws") as ws:
            ws.send_json({"role": "Senior Backend Engineer"})
            ws.send_bytes(b"\x10\x00" * 160)                 # a mic frame
            assert ws.receive_json()["type"] == "output_transcript"
            assert ws.receive_bytes() == b"\x00\x01\x02\x03"  # model audio relayed
            assert ws.receive_json()["type"] == "turn_complete"


def test_voice_relay_errors_without_provider() -> None:
    with TestClient(app) as c:
        app.state.voice = None
        with c.websocket_connect("/v1/voice/ws") as ws:
            assert ws.receive_json()["type"] == "error"
