"""Detector plugin contract + registry + shared helpers."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from ..schemas import FeatureSnapshot, Signal


@runtime_checkable
class Detector(Protocol):
    name: str

    def evaluate(self, features: FeatureSnapshot) -> list[Signal]:
        ...


DETECTORS: list[Detector] = []


def register_detector(cls: type) -> type:
    instance = cls()
    if not isinstance(instance, Detector):
        raise TypeError(f"{cls.__name__} does not satisfy the Detector protocol")
    DETECTORS.append(instance)
    return cls


def run_detectors(features: FeatureSnapshot) -> list[Signal]:
    signals: list[Signal] = []
    for detector in DETECTORS:
        try:
            signals.extend(detector.evaluate(features))
        except Exception:  # pragma: no cover - never break the demo
            continue
    return signals


def clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def ramp(value: float, lo: float, hi: float) -> float:
    """Linear 0..1 ramp: 0 at/below ``lo``, 1 at/above ``hi``."""
    if hi == lo:
        return 1.0 if value >= hi else 0.0
    return clamp01((value - lo) / (hi - lo))
