"""Feature extractors.

Each extractor is an independent plugin that reads the raw ``SessionState`` and
writes a namespaced set of numeric features. Extraction is fully decoupled from
scoring: detectors only ever see the merged :class:`FeatureSnapshot`, never the
raw buffers.

Register a new extractor by decorating it with ``@register_extractor``.
"""

from __future__ import annotations

from .base import FeatureExtractor, register_extractor, run_extractors, EXTRACTORS

# Importing the modules triggers their @register_extractor side effects.
from . import timing  # noqa: F401,E402
from . import speech_rate  # noqa: F401,E402
from . import linguistics  # noqa: F401,E402
from . import ownership  # noqa: F401,E402
from . import gaze  # noqa: F401,E402

__all__ = [
    "FeatureExtractor",
    "register_extractor",
    "run_extractors",
    "EXTRACTORS",
]
