"""Realtime voice port — provider-independent, like the LLM gateway.

A VoiceSession is a full-duplex audio stream: push microphone PCM in, receive a
stream of events out (model audio, live transcripts, turn boundaries). The
browser relay and any EIE hooks depend on THIS interface — never on Gemini Live
directly — so the voice provider can be swapped (Gemini Live ↔ LiveKit/Deepgram+
ElevenLabs) by config, with zero change to the interview logic.
"""

from __future__ import annotations

from enum import Enum
from typing import AsyncIterator, Protocol, runtime_checkable

from pydantic import BaseModel


class VoiceEventType(str, Enum):
    audio = "audio"                      # model speech (PCM bytes) to play
    input_transcript = "input_transcript"    # what the candidate said (streaming)
    output_transcript = "output_transcript"  # what the model said
    turn_complete = "turn_complete"      # model finished its turn
    interrupted = "interrupted"          # barge-in: candidate spoke over the model
    error = "error"


class VoiceEvent(BaseModel):
    type: VoiceEventType
    audio: bytes | None = None
    text: str | None = None

    model_config = {"arbitrary_types_allowed": True}


@runtime_checkable
class VoiceSession(Protocol):
    """One live audio conversation."""

    async def send_audio(self, pcm16: bytes) -> None:
        """Push a chunk of 16-bit little-endian PCM mic audio (16 kHz mono)."""
        ...

    def receive(self) -> AsyncIterator[VoiceEvent]:
        """Stream model audio + transcripts + turn events until the session ends."""
        ...

    async def close(self) -> None: ...


@runtime_checkable
class VoiceProvider(Protocol):
    """Opens voice sessions. Config names a capability, not a vendor."""

    def connect(self, system_instruction: str, voice: str = "") -> "VoiceSessionCM": ...


class VoiceSessionCM(Protocol):
    """Async context manager yielding a VoiceSession (mirrors the SDK shape)."""

    async def __aenter__(self) -> VoiceSession: ...
    async def __aexit__(self, *exc: object) -> None: ...
