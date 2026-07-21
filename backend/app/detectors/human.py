"""Module 6 - Negative (human-like) signals.

These actively LOWER the estimated probability of AI assistance. This is the
core of the never-accuse philosophy: every suspicious pattern has a human-like
counterpart capable of reducing risk, which minimises false positives.
"""

from __future__ import annotations

from ..schemas import FeatureSnapshot, Signal, SignalDirection
from .base import ramp, register_detector

H = SignalDirection.human


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
        direction=H,
        weight=round(weight, 3),
        confidence=round(max(0.0, min(1.0, confidence)), 3),
        explanation=explanation,
        detector=detector,
    )


@register_detector
class VariableLatencyDetector:
    name = "variable_latency"

    def evaluate(self, features: FeatureSnapshot) -> list[Signal]:
        v = features.values
        consistency = v.get("response_latency_consistency", 1.0)
        samples = v.get("response_latency_samples", 0.0)
        strength = ramp(0.7 - consistency, 0.0, 0.4)  # more variable = more human
        data = ramp(samples, 3, 8)
        if strength * data < 0.15:
            return []
        return [
            _mk(
                "variable_latency",
                "Variable response latency",
                weight=0.6,
                confidence=strength * data,
                explanation=(
                    "Time-to-answer varies naturally with question difficulty - a "
                    "strong human-like signal."
                ),
                detector=self.name,
            )
        ]


@register_detector
class DynamicWpmDetector:
    name = "dynamic_wpm"

    def evaluate(self, features: FeatureSnapshot) -> list[Signal]:
        v = features.values
        cv = v.get("wpm_cv", 0.0)
        samples = v.get("wpm_samples", 0.0)
        strength = ramp(cv, 0.2, 0.5)
        data = ramp(samples, 3, 8)
        if strength * data < 0.15:
            return []
        return [
            _mk(
                "dynamic_wpm",
                "Dynamic speaking rate",
                weight=0.5,
                confidence=strength * data,
                explanation=(
                    "Speaking rate speeds up and slows down, consistent with real-time "
                    "thinking rather than reading."
                ),
                detector=self.name,
            )
        ]


@register_detector
class InteractivityDetector:
    name = "interactivity"

    def evaluate(self, features: FeatureSnapshot) -> list[Signal]:
        v = features.values
        out: list[Signal] = []
        clarification = v.get("clarification_count", 0.0)
        confirmation = v.get("confirmation_count", 0.0)
        interactive = clarification + confirmation
        strength = ramp(interactive, 1, 4)
        if strength >= 0.15:
            out.append(
                _mk(
                    "clarifying_questions",
                    "Asked clarifying / confirmation questions",
                    weight=0.6,
                    confidence=strength,
                    explanation=(
                        f"Candidate engaged interactively ({int(interactive)} clarifying "
                        "or confirming questions), which real-time assistants rarely do."
                    ),
                    detector=self.name,
                )
            )
        return out


@register_detector
class OpinionDetector:
    name = "opinion"

    def evaluate(self, features: FeatureSnapshot) -> list[Signal]:
        v = features.values
        opinion = v.get("opinion_count", 0.0)
        strength = ramp(opinion, 1, 4)
        if strength < 0.15:
            return []
        return [
            _mk(
                "opinionated_answers",
                "Opinionated, personal answers",
                weight=0.5,
                confidence=strength,
                explanation=(
                    "Candidate volunteered personal opinions and preferences, a "
                    "human-like conversational trait."
                ),
                detector=self.name,
            )
        ]


@register_detector
class OwnershipStoryDetector:
    name = "ownership_story"

    def evaluate(self, features: FeatureSnapshot) -> list[Signal]:
        v = features.values
        ownership = v.get("ownership_score", 0.0)
        impl = v.get("ownership_implementation", 0.0)
        debug = v.get("ownership_debugging", 0.0)
        personal = v.get("ownership_personal", 0.0)
        strength = ramp(ownership, 30, 70)
        if strength < 0.15:
            return []
        detail_bits = []
        if impl:
            detail_bits.append("implementation")
        if debug:
            detail_bits.append("debugging")
        if personal:
            detail_bits.append("personal project")
        detail = ", ".join(detail_bits) or "first-hand"
        return [
            _mk(
                "ownership_stories",
                "Shared first-hand ownership stories",
                weight=0.75,
                confidence=strength,
                explanation=(
                    f"Answers include {detail} details (ownership score "
                    f"{ownership:.0f}/100) - strong evidence of genuine experience."
                ),
                detector=self.name,
            )
        ]


@register_detector
class SelfCorrectionDetector:
    name = "self_correction"

    def evaluate(self, features: FeatureSnapshot) -> list[Signal]:
        v = features.values
        corr = v.get("self_correction_per_100w", 0.0)
        fillers = v.get("filler_per_100w", 0.0)
        words = v.get("total_words", 0.0)
        strength = max(ramp(corr, 0.3, 1.5), 0.6 * ramp(fillers, 1.0, 4.0))
        data = ramp(words, 80, 300)
        if strength * data < 0.15:
            return []
        return [
            _mk(
                "self_corrections",
                "Natural self-corrections and fillers",
                weight=0.5,
                confidence=strength * data,
                explanation=(
                    "Speech contains natural fillers and mid-sentence corrections, "
                    "typical of spontaneous human answering."
                ),
                detector=self.name,
            )
        ]


@register_detector
class GenuineUncertaintyDetector:
    name = "genuine_uncertainty"

    def evaluate(self, features: FeatureSnapshot) -> list[Signal]:
        v = features.values
        hedging = v.get("hedging_per_100w", 0.0)
        words = v.get("total_words", 0.0)
        strength = ramp(hedging, 0.5, 2.5)
        data = ramp(words, 80, 300)
        if strength * data < 0.15:
            return []
        return [
            _mk(
                "genuine_uncertainty",
                "Expressed genuine uncertainty",
                weight=0.4,
                confidence=strength * data,
                explanation=(
                    "Candidate hedged and admitted uncertainty in places, which "
                    "assistant-fed answers rarely do."
                ),
                detector=self.name,
            )
        ]


@register_detector
class ThinkingPauseDetector:
    name = "thinking_pause"

    def evaluate(self, features: FeatureSnapshot) -> list[Signal]:
        v = features.values
        pause_entropy = v.get("pause_entropy", 0.0)
        thinking = v.get("thinking_marker_count", 0.0)
        pause_count = v.get("pause_count", 0.0)
        strength = max(ramp(pause_entropy, 0.35, 0.7), ramp(thinking, 1, 3))
        data = ramp(pause_count, 3, 10)
        if strength * data < 0.15:
            return []
        return [
            _mk(
                "thinking_pauses",
                "Natural thinking pauses",
                weight=0.4,
                confidence=strength * data,
                explanation=(
                    "Pauses are irregular and include explicit thinking markers, "
                    "consistent with in-the-moment reasoning."
                ),
                detector=self.name,
            )
        ]
