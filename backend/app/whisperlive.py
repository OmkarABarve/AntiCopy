"""Optional WhisperLive streaming-ASR bridge (upgrade path).

Disabled by default (``ENABLE_WHISPERLIVE=false``). In the default demo the
browser's Web Speech API produces transcript events, so no audio is sent to the
server. When enabled, this module is where raw audio chunks streamed from the
browser would be forwarded to a WhisperLive server and turned into
``TranscriptEvent``s.

This is intentionally a thin, well-documented stub so the architecture is clear
and the real integration is a drop-in without touching the rest of the pipeline.
"""

from __future__ import annotations

from .config import settings
from .schemas import Speaker, TranscriptEvent


class WhisperLiveBridge:
    """Placeholder bridge. Real implementation would open a socket to a
    WhisperLive server (default localhost:9090) and stream PCM audio frames."""

    def __init__(self) -> None:
        self.enabled = settings.enable_whisperlive
        self._connected = False

    async def connect(self) -> bool:
        if not self.enabled:
            return False
        # Real integration:
        #   from whisper_live.client import TranscriptionClient
        #   self.client = TranscriptionClient(host, port, ...)
        self._connected = True
        return True

    async def push_audio(self, session_id: str, pcm: bytes, speaker: Speaker) -> None:
        """Forward an audio chunk. No-op when disabled."""
        if not (self.enabled and self._connected):
            return
        # Real integration would feed `pcm` to the WhisperLive client and, on
        # partial/final results, synthesize TranscriptEvent objects below.
        _ = (session_id, pcm, speaker)

    @staticmethod
    def make_transcript(
        speaker: Speaker, text: str, ts_start: float, ts_end: float, is_final: bool
    ) -> TranscriptEvent:
        return TranscriptEvent(
            speaker=speaker,
            text=text,
            ts_start=ts_start,
            ts_end=ts_end,
            is_final=is_final,
        )


bridge = WhisperLiveBridge()
