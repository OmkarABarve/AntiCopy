"""Independent detectors.

Each detector inspects the merged feature snapshot and emits zero or more
:class:`Signal` objects, each tagged as ``positive`` (raises AI-assistance
probability) or ``human`` (lowers it). Detectors never see raw buffers and are
fully independent of one another and of the risk engine.
"""

from __future__ import annotations

from .base import Detector, register_detector, run_detectors, DETECTORS

from . import positive  # noqa: F401,E402
from . import human  # noqa: F401,E402

__all__ = ["Detector", "register_detector", "run_detectors", "DETECTORS"]
