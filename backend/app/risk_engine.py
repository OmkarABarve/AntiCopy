"""Module 7 - Explainable risk engine.

Final Risk = Positive-behaviour pressure - Human-behaviour pressure.

We deliberately do NOT simply sum suspicious features. Every positive signal can
be offset by a human-like signal, which is what keeps false positives low. The
output is always explainable (evidence + counter-evidence) and never an
accusation.
"""

from __future__ import annotations

from .schemas import (
    ConfidenceLevel,
    FeatureSnapshot,
    RiskLevel,
    RiskResult,
    Signal,
    SignalDirection,
)

# How much net pressure maps to a 100% risk score. Tuned conservatively so the
# system leans toward LOW/MEDIUM unless positive evidence clearly outweighs
# human-like evidence (minimising false positives).
NET_PRESSURE_DENOM = 2.5

# Risk thresholds (conservative: HIGH requires strong, un-offset evidence).
RISK_MEDIUM_MIN = 35.0
RISK_HIGH_MIN = 65.0

# Confidence thresholds.
CONF_MEDIUM_MIN = 40.0
CONF_HIGH_MIN = 70.0


def data_sufficiency(features: FeatureSnapshot) -> float:
    """0..1 estimate of how much behavioural signal we have collected."""
    v = features.values
    words = v.get("total_words", 0.0)
    latency_samples = v.get("response_latency_samples", 0.0)
    wpm_samples = v.get("wpm_samples", 0.0)
    gaze_samples = v.get("gaze_samples", 0.0)

    parts = [
        min(1.0, words / 400.0),
        min(1.0, latency_samples / 6.0),
        min(1.0, wpm_samples / 6.0),
        min(1.0, gaze_samples / 300.0),
    ]
    return round(sum(parts) / len(parts), 3)


def _pressure(signals: list[Signal], direction: SignalDirection) -> float:
    return sum(s.weight * s.confidence for s in signals if s.direction == direction)


def _risk_level(score: float) -> RiskLevel:
    if score >= RISK_HIGH_MIN:
        return RiskLevel.high
    if score >= RISK_MEDIUM_MIN:
        return RiskLevel.medium
    return RiskLevel.low


def _confidence_level(score: float) -> ConfidenceLevel:
    if score >= CONF_HIGH_MIN:
        return ConfidenceLevel.high
    if score >= CONF_MEDIUM_MIN:
        return ConfidenceLevel.medium
    return ConfidenceLevel.low


def _summary(risk: RiskLevel, conf: ConfidenceLevel, n_pos: int, n_hum: int) -> str:
    base = {
        RiskLevel.low: (
            "Behavioural signals currently suggest a LOW likelihood of real-time AI "
            "assistance."
        ),
        RiskLevel.medium: (
            "Behavioural signals show a MEDIUM, mixed picture regarding real-time AI "
            "assistance."
        ),
        RiskLevel.high: (
            "Behavioural signals lean toward a HIGHER likelihood of real-time AI "
            "assistance, but this is not proof."
        ),
    }[risk]
    balance = ""
    if n_hum:
        balance = f" {n_hum} human-like behaviour(s) are actively lowering the estimate."
    return (
        f"{base} Confidence in this estimate is {conf.value}."
        f"{balance} This is advisory only - the interviewer makes the final decision. "
        "The system never accuses; it explains."
    )


def compute_risk(features: FeatureSnapshot, signals: list[Signal]) -> RiskResult:
    positive_pressure = _pressure(signals, SignalDirection.positive)
    human_pressure = _pressure(signals, SignalDirection.human)

    net = positive_pressure - human_pressure
    risk_score = max(0.0, min(100.0, (net / NET_PRESSURE_DENOM) * 100.0))
    risk_level = _risk_level(risk_score)

    evidence = sorted(
        [s for s in signals if s.direction == SignalDirection.positive],
        key=lambda s: s.weight * s.confidence,
        reverse=True,
    )
    counter_evidence = sorted(
        [s for s in signals if s.direction == SignalDirection.human],
        key=lambda s: s.weight * s.confidence,
        reverse=True,
    )

    # Confidence = how much data we have + how much signal is present.
    sufficiency = data_sufficiency(features)
    strong_signals = sum(1 for s in signals if s.confidence >= 0.25)
    volume = min(1.0, strong_signals / 6.0)
    confidence_score = max(0.0, min(100.0, 100.0 * (0.6 * sufficiency + 0.4 * volume)))
    confidence_level = _confidence_level(confidence_score)

    return RiskResult(
        risk_level=risk_level,
        risk_score=round(risk_score, 1),
        confidence_level=confidence_level,
        confidence_score=round(confidence_score, 1),
        positive_pressure=round(positive_pressure, 3),
        human_pressure=round(human_pressure, 3),
        evidence=evidence,
        counter_evidence=counter_evidence,
        summary=_summary(risk_level, confidence_level, len(evidence), len(counter_evidence)),
    )
