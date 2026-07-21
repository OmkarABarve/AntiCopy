"""Extractor plugin contract + registry."""

from __future__ import annotations

from typing import Callable, Protocol, runtime_checkable

from ..schemas import FeatureSnapshot
from ..session import SessionState


@runtime_checkable
class FeatureExtractor(Protocol):
    name: str

    def extract(self, session: SessionState) -> dict[str, float]:
        """Return a dict of ``feature_name -> value`` for this extractor."""
        ...


# Ordered registry of extractor instances.
EXTRACTORS: list[FeatureExtractor] = []


def register_extractor(cls: type) -> type:
    """Class decorator that instantiates and registers an extractor."""
    instance = cls()
    if not isinstance(instance, FeatureExtractor):
        raise TypeError(f"{cls.__name__} does not satisfy the FeatureExtractor protocol")
    EXTRACTORS.append(instance)
    return cls


def run_extractors(session: SessionState) -> FeatureSnapshot:
    """Run every registered extractor and merge results into one snapshot."""
    snapshot = FeatureSnapshot()
    for extractor in EXTRACTORS:
        try:
            values = extractor.extract(session)
        except Exception as exc:  # pragma: no cover - defensive; never break the demo
            values = {f"{extractor.name}_error": 1.0}
            _ = exc
        for key, value in values.items():
            if value is None:
                continue
            snapshot.values[key] = float(value)

    _attach_question_type_aggregates(session, snapshot)
    return snapshot


def _attach_question_type_aggregates(session: SessionState, snapshot: FeatureSnapshot) -> None:
    """Per-question-type latency / WPM aggregates for interview dynamics."""
    from statistics import mean

    latencies = dict(session.response_latencies())  # ts -> latency
    buckets: dict[str, dict[str, list[float]]] = {}

    for turn in session.candidate_turns():
        qt = turn.question_type or "untagged"
        b = buckets.setdefault(qt, {"latency": [], "wpm": [], "words": []})
        if turn.duration > 0:
            b["wpm"].append(turn.word_count / (turn.duration / 60.0))
        b["words"].append(float(turn.word_count))
        lat = latencies.get(turn.start)
        if lat is not None:
            b["latency"].append(lat)

    for qt, b in buckets.items():
        snapshot.by_question_type[qt] = {
            "avg_latency": round(mean(b["latency"]), 3) if b["latency"] else 0.0,
            "avg_wpm": round(mean(b["wpm"]), 1) if b["wpm"] else 0.0,
            "avg_words": round(mean(b["words"]), 1) if b["words"] else 0.0,
            "samples": float(len(b["words"])),
        }


# Shared numeric helpers used across extractors ----------------------------- #
def safe_std(values: list[float]) -> float:
    from statistics import pstdev

    return pstdev(values) if len(values) > 1 else 0.0


def safe_mean(values: list[float]) -> float:
    from statistics import mean

    return mean(values) if values else 0.0


def shannon_entropy(values: list[float], bins: int = 8) -> float:
    """Normalized Shannon entropy (0..1) of a list of non-negative values."""
    if len(values) < 2:
        return 0.0
    lo, hi = min(values), max(values)
    if hi - lo < 1e-9:
        return 0.0
    import math

    counts = [0] * bins
    width = (hi - lo) / bins
    for v in values:
        idx = min(bins - 1, int((v - lo) / width))
        counts[idx] += 1
    total = sum(counts)
    entropy = 0.0
    for c in counts:
        if c:
            p = c / total
            entropy -= p * math.log(p, 2)
    return entropy / math.log(bins, 2)
