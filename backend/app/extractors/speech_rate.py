"""Speech-rate features: WPM, rolling WPM and its variance."""

from __future__ import annotations

from ..config import settings
from ..session import SessionState
from .base import register_extractor, safe_mean, safe_std


@register_extractor
class SpeechRateExtractor:
    name = "speech_rate"

    def extract(self, session: SessionState) -> dict[str, float]:
        cand_turns = [t for t in session.candidate_turns() if t.duration > 0.5]
        if not cand_turns:
            return {
                "wpm_overall": 0.0,
                "wpm_rolling": 0.0,
                "wpm_variance": 0.0,
                "wpm_cv": 0.0,
                "wpm_samples": 0.0,
            }

        per_turn_wpm = [t.word_count / (t.duration / 60.0) for t in cand_turns]

        total_words = sum(t.word_count for t in cand_turns)
        total_time = sum(t.duration for t in cand_turns)
        wpm_overall = total_words / (total_time / 60.0) if total_time > 0 else 0.0

        # Rolling window over the most recent turns.
        now = session.last_event_ts_seconds()
        window = settings.rolling_window_s
        recent = [
            t.word_count / (t.duration / 60.0)
            for t in cand_turns
            if now - t.end <= window
        ]
        wpm_rolling = safe_mean(recent) if recent else per_turn_wpm[-1]

        wpm_std = safe_std(per_turn_wpm)
        wpm_mean = safe_mean(per_turn_wpm)
        wpm_cv = (wpm_std / wpm_mean) if wpm_mean > 0 else 0.0

        return {
            "wpm_overall": round(wpm_overall, 1),
            "wpm_rolling": round(wpm_rolling, 1),
            "wpm_variance": round(wpm_std ** 2, 1),
            "wpm_std": round(wpm_std, 1),
            "wpm_cv": round(wpm_cv, 3),
            "wpm_samples": float(len(per_turn_wpm)),
        }
