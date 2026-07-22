"""Voice-overlap features from browser ActivityEvent(kind=voice_overlap).

Counted live; the corresponding human detector only fires after the interview
is stopped (see VoiceClashDetector + interview_finished).
"""

from __future__ import annotations

from ..schemas import ActivityKind
from ..session import SessionState
from .base import register_extractor


@register_extractor
class VoiceOverlapExtractor:
    name = "voice_overlap"

    def extract(self, session: SessionState) -> dict[str, float]:
        overlaps = [
            a for a in session.activity if a.kind == ActivityKind.voice_overlap
        ]
        count = float(len(overlaps))
        duration = session.duration_s()
        per_min = (
            round(count / (duration / 60.0), 2) if duration > 5.0 else 0.0
        )
        # 0..100 display score (caps quickly — overlap is a small nudge).
        score = min(100.0, count * 20.0)

        return {
            "voice_overlap_count": count,
            "voice_overlap_per_min": per_min,
            "voice_overlap_score": score,
            # Detectors use this gate so voice_clash only applies post-interview.
            "interview_finished": 1.0 if session.status == "stopped" else 0.0,
        }
