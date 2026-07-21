"""Per-session state: rolling buffers of everything the browser streams.

The session is intentionally "dumb" storage. All interpretation happens in the
extractors/detectors so that feature extraction stays decoupled from scoring.
"""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Optional

from .schemas import (
    ActivityEvent,
    GazeEvent,
    QuestionEvent,
    Speaker,
    TranscriptEvent,
    TranscriptSegment,
)

# Cap buffers so a very long interview cannot grow memory without bound.
MAX_GAZE_FRAMES = 6000
MAX_ACTIVITY = 4000
MAX_TRANSCRIPT = 2000


@dataclass
class Turn:
    """A contiguous span where one speaker holds the floor."""

    speaker: Speaker
    start: float
    end: float
    text: str = ""
    question_type: Optional[str] = None

    @property
    def duration(self) -> float:
        return max(0.0, self.end - self.start)

    @property
    def word_count(self) -> int:
        return len([w for w in self.text.split() if w])


@dataclass
class SessionState:
    session_id: str
    status: str = "idle"  # idle | monitoring | stopped
    started_at: Optional[float] = None
    first_event_ts: Optional[float] = None  # earliest event ts (client clock)
    last_event_ts: float = 0.0

    transcript: list[TranscriptEvent] = field(default_factory=list)
    gaze: Deque[GazeEvent] = field(default_factory=lambda: deque(maxlen=MAX_GAZE_FRAMES))
    activity: Deque[ActivityEvent] = field(default_factory=lambda: deque(maxlen=MAX_ACTIVITY))
    questions: list[QuestionEvent] = field(default_factory=list)

    # Cache of derived turns, invalidated whenever a final transcript arrives.
    _turns_cache: Optional[list[Turn]] = None
    _turns_dirty: bool = True

    # ------------------------------------------------------------------ #
    # Lifecycle
    # ------------------------------------------------------------------ #
    def start(self) -> None:
        self.status = "monitoring"
        if self.started_at is None:
            self.started_at = time.time()

    def stop(self) -> None:
        self.status = "stopped"

    def reset(self) -> None:
        self.status = "idle"
        self.started_at = None
        self.first_event_ts = None
        self.last_event_ts = 0.0
        self.transcript.clear()
        self.gaze.clear()
        self.activity.clear()
        self.questions.clear()
        self._turns_cache = None
        self._turns_dirty = True

    def duration_s(self) -> float:
        if self.first_event_ts is None:
            return 0.0
        return max(0.0, self.last_event_ts - self.first_event_ts)

    def time_origin(self) -> float:
        """Reference t=0 for timelines: the earliest event timestamp."""
        return self.first_event_ts if self.first_event_ts is not None else 0.0

    def last_event_ts_seconds(self) -> float:
        return self.last_event_ts

    def _note_ts(self, ts: float) -> None:
        if self.first_event_ts is None or ts < self.first_event_ts:
            self.first_event_ts = ts
        if ts > self.last_event_ts:
            self.last_event_ts = ts

    # ------------------------------------------------------------------ #
    # Ingestion
    # ------------------------------------------------------------------ #
    def add_transcript(self, ev: TranscriptEvent) -> None:
        self._note_ts(ev.ts_start)
        self._note_ts(ev.ts_end)
        if ev.is_final:
            if len(self.transcript) >= MAX_TRANSCRIPT:
                self.transcript.pop(0)
            self.transcript.append(ev)
            self._turns_dirty = True

    def add_gaze(self, ev: GazeEvent) -> None:
        self._note_ts(ev.ts)
        self.gaze.append(ev)

    def add_activity(self, ev: ActivityEvent) -> None:
        self._note_ts(ev.ts)
        self.activity.append(ev)

    def add_question(self, ev: QuestionEvent) -> None:
        self._note_ts(ev.ts)
        self.questions.append(ev)
        self._turns_dirty = True

    # ------------------------------------------------------------------ #
    # Derived views
    # ------------------------------------------------------------------ #
    def question_type_at(self, ts: float) -> Optional[str]:
        """The most recent question type tagged at or before ``ts``."""
        current: Optional[str] = None
        for q in self.questions:
            if q.ts <= ts:
                current = q.question_type.value
            else:
                break
        return current

    def turns(self) -> list[Turn]:
        """Merge consecutive same-speaker transcript segments into turns."""
        if not self._turns_dirty and self._turns_cache is not None:
            return self._turns_cache

        turns: list[Turn] = []
        for seg in sorted(self.transcript, key=lambda s: s.ts_start):
            if turns and turns[-1].speaker == seg.speaker and (
                seg.ts_start - turns[-1].end <= 1.5
            ):
                # Same speaker continuing without a real gap -> extend the turn.
                turns[-1].end = seg.ts_end
                turns[-1].text = (turns[-1].text + " " + seg.text).strip()
            else:
                turns.append(
                    Turn(
                        speaker=seg.speaker,
                        start=seg.ts_start,
                        end=seg.ts_end,
                        text=seg.text.strip(),
                        question_type=self.question_type_at(seg.ts_start),
                    )
                )

        self._turns_cache = turns
        self._turns_dirty = False
        return turns

    def candidate_turns(self) -> list[Turn]:
        return [t for t in self.turns() if t.speaker == Speaker.candidate]

    def response_latencies(self) -> list[tuple[float, float]]:
        """(ts, latency_seconds) for each interviewer->candidate handover."""
        turns = self.turns()
        out: list[tuple[float, float]] = []
        for prev, cur in zip(turns, turns[1:]):
            if prev.speaker == Speaker.interviewer and cur.speaker == Speaker.candidate:
                latency = max(0.0, cur.start - prev.end)
                out.append((cur.start, latency))
        return out

    def transcript_segments(self) -> list[TranscriptSegment]:
        return [
            TranscriptSegment(
                speaker=s.speaker, text=s.text, ts_start=s.ts_start, ts_end=s.ts_end
            )
            for s in sorted(self.transcript, key=lambda s: s.ts_start)
        ]


class SessionRegistry:
    """In-memory registry of active sessions (single-process demo scope)."""

    def __init__(self) -> None:
        self._sessions: dict[str, SessionState] = {}

    def get_or_create(self, session_id: str) -> SessionState:
        if session_id not in self._sessions:
            self._sessions[session_id] = SessionState(session_id=session_id)
        return self._sessions[session_id]

    def drop(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)


registry = SessionRegistry()
