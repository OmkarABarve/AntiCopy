"""Module 5 - Positive (risk-raising) signals.

Each detector only fires when the pattern is actually present, and its
confidence scales with how much data we have. Eye tracking is deliberately
low-weight because it must never be the sole evidence.
"""

from __future__ import annotations

from ..schemas import FeatureSnapshot, Signal, SignalDirection
from .base import ramp, register_detector

P = SignalDirection.positive


def _mk(
    sid: str,
    label: str,
    weight: float,
    confidence: float,
    explanation: str,
    detector: str,
) -> Signal:
    return Signal(
        id=sid,
        label=label,
        direction=P,
        weight=round(weight, 3),
        confidence=round(max(0.0, min(1.0, confidence)), 3),
        explanation=explanation,
        detector=detector,
    )


@register_detector
class LatencyConsistencyDetector:
    name = "latency_consistency"

    def evaluate(self, features: FeatureSnapshot) -> list[Signal]:
        v = features.values
        consistency = v.get("response_latency_consistency", 0.0)
        samples = v.get("response_latency_samples", 0.0)
        strength = ramp(consistency, 0.7, 0.95)
        data = ramp(samples, 3, 8)
        if strength * data < 0.15:
            return []
        return [
            _mk(
                "consistent_latency",
                "Consistent response latency",
                weight=0.7,
                confidence=strength * data,
                explanation=(
                    f"Response latency is unusually uniform "
                    f"({consistency:.0%} consistency across {int(samples)} answers). "
                    "Humans usually vary more between easy and hard questions."
                ),
                detector=self.name,
            )
        ]


@register_detector
class GazeReadingDetector:
    name = "gaze_reading"

    def evaluate(self, features: FeatureSnapshot) -> list[Signal]:
        v = features.values
        out: list[Signal] = []
        samples = v.get("gaze_samples", 0.0)
        data = ramp(samples, 60, 300)  # need sustained tracking

        reading = v.get("reading_scan_score", 0.0)
        strength = ramp(reading, 0.35, 0.7)
        if strength * data >= 0.15:
            out.append(
                _mk(
                    "reading_like_gaze",
                    "Reading-like gaze pattern",
                    weight=0.4,  # low - eye tracking is never sole evidence
                    confidence=strength * data,
                    explanation=(
                        "Eye movement shows rhythmic left-to-right sweeps with line "
                        "resets, consistent with reading text off-screen. Treat as "
                        "supporting evidence only."
                    ),
                    detector=self.name,
                )
            )

        off_screen = v.get("gaze_off_screen_pct", 0.0)
        fixed = v.get("gaze_fixed_region_score", 0.0)
        off_strength = ramp(off_screen, 25, 60)
        combined = max(off_strength, ramp(fixed, 0.4, 0.8))
        if combined * data >= 0.15:
            out.append(
                _mk(
                    "off_screen_attention",
                    "High off-screen / fixed-region attention",
                    weight=0.45,
                    confidence=combined * data,
                    explanation=(
                        f"Attention is off the camera {off_screen:.0f}% of the time, "
                        "often toward a fixed region. Could indicate a second screen - "
                        "or simply notes; corroborate with conversation signals."
                    ),
                    detector=self.name,
                )
            )
        return out


@register_detector
class WpmStabilityDetector:
    name = "wpm_stability"

    def evaluate(self, features: FeatureSnapshot) -> list[Signal]:
        v = features.values
        cv = v.get("wpm_cv", 1.0)
        samples = v.get("wpm_samples", 0.0)
        # Very low coefficient of variation => robotically stable pacing.
        strength = ramp(0.25 - cv, 0.0, 0.18) if cv < 0.25 else 0.0
        data = ramp(samples, 3, 8)
        if strength * data < 0.15:
            return []
        return [
            _mk(
                "stable_wpm",
                "Extremely stable speaking rate",
                weight=0.6,
                confidence=strength * data,
                explanation=(
                    f"Speaking rate barely varies (CV={cv:.2f}) across answers. "
                    "Genuine speech typically speeds up and slows down with thinking."
                ),
                detector=self.name,
            )
        ]


@register_detector
class ConversationalEntropyDetector:
    name = "conversational_entropy"

    def evaluate(self, features: FeatureSnapshot) -> list[Signal]:
        v = features.values
        entropy = v.get("conversational_entropy", 1.0)
        words = v.get("total_words", 0.0)
        strength = ramp(0.4 - entropy, 0.0, 0.3) if entropy < 0.4 else 0.0
        data = ramp(words, 120, 400)
        if strength * data < 0.15:
            return []
        return [
            _mk(
                "low_conversational_entropy",
                "Low conversational entropy",
                weight=0.5,
                confidence=strength * data,
                explanation=(
                    "Answers are structurally uniform (similar length and rhythm), "
                    "which can indicate templated or generated responses."
                ),
                detector=self.name,
            )
        ]


@register_detector
class GenericOwnershipDetector:
    name = "generic_ownership"

    def evaluate(self, features: FeatureSnapshot) -> list[Signal]:
        v = features.values
        ownership = v.get("ownership_score", 0.0)
        words = v.get("total_words", 0.0)
        # Lots of talking but little first-hand ownership detail.
        strength = ramp(30 - ownership, 0, 25) if ownership < 30 else 0.0
        data = ramp(words, 150, 500)
        if strength * data < 0.15:
            return []
        return [
            _mk(
                "generic_ownership",
                "Generic, non-specific answers",
                weight=0.55,
                confidence=strength * data,
                explanation=(
                    f"Ownership score is low ({ownership:.0f}/100): few references to "
                    "implementation, debugging, tradeoffs or personal experience. "
                    "Consider a resume-ownership question to probe further."
                ),
                detector=self.name,
            )
        ]


@register_detector
class SelfCorrectionScarcityDetector:
    name = "self_correction_scarcity"

    def evaluate(self, features: FeatureSnapshot) -> list[Signal]:
        v = features.values
        per100 = v.get("self_correction_per_100w", 0.0)
        fillers = v.get("filler_per_100w", 0.0)
        words = v.get("total_words", 0.0)
        # Almost no self-corrections AND almost no fillers = unnaturally clean.
        clean = ramp(0.3 - per100, 0, 0.3) * ramp(1.0 - fillers, 0, 1.0)
        data = ramp(words, 150, 450)
        if clean * data < 0.15:
            return []
        return [
            _mk(
                "few_self_corrections",
                "Unusually few self-corrections / fillers",
                weight=0.45,
                confidence=clean * data,
                explanation=(
                    "Speech is very clean, with almost no fillers or self-corrections. "
                    "Spontaneous human speech is usually messier."
                ),
                detector=self.name,
            )
        ]


@register_detector
class OverExplanationDetector:
    name = "over_explanation"

    def evaluate(self, features: FeatureSnapshot) -> list[Signal]:
        v = features.values
        score = v.get("over_explanation_score", 0.0)
        strength = ramp(score, 0.4, 0.8)
        if strength < 0.15:
            return []
        return [
            _mk(
                "over_explanation",
                "Over-explanation of trivial questions",
                weight=0.4,
                confidence=strength,
                explanation=(
                    "Simple questions receive long, exhaustive answers - a pattern "
                    "sometimes seen when reading from a generated response."
                ),
                detector=self.name,
            )
        ]
