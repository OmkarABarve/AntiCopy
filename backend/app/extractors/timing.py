"""Timing features: response latency, speaking/listening balance, pauses."""

from __future__ import annotations

from ..schemas import Speaker
from ..session import SessionState
from .base import register_extractor, safe_mean, safe_std, shannon_entropy


@register_extractor
class TimingExtractor:
    name = "timing"

    def extract(self, session: SessionState) -> dict[str, float]:
        turns = session.turns()
        latencies = [lat for _, lat in session.response_latencies()]

        speaking = sum(t.duration for t in turns if t.speaker == Speaker.candidate)
        listening = sum(t.duration for t in turns if t.speaker == Speaker.interviewer)
        total = speaking + listening

        # Pauses = gaps between consecutive turns (silence in the conversation).
        pauses: list[float] = []
        for prev, cur in zip(turns, turns[1:]):
            gap = cur.start - prev.end
            if gap > 0.2:
                pauses.append(gap)

        latency_mean = safe_mean(latencies)
        latency_std = safe_std(latencies)
        # Consistency: 1.0 == robotically identical latency, 0 == highly variable.
        latency_cv = (latency_std / latency_mean) if latency_mean > 0.05 else 0.0
        latency_consistency = max(0.0, 1.0 - min(latency_cv, 1.0))

        return {
            "response_latency_mean": round(latency_mean, 3),
            "response_latency_std": round(latency_std, 3),
            "response_latency_consistency": round(latency_consistency, 3),
            "response_latency_samples": float(len(latencies)),
            "speaking_duration_s": round(speaking, 2),
            "listening_duration_s": round(listening, 2),
            "speaking_ratio": round(speaking / total, 3) if total > 0 else 0.0,
            "pause_count": float(len(pauses)),
            "pause_duration_mean": round(safe_mean(pauses), 3),
            "pause_frequency_per_min": round(
                len(pauses) / (total / 60.0), 2
            ) if total > 5 else 0.0,
            "pause_entropy": round(shannon_entropy(pauses), 3),
        }
