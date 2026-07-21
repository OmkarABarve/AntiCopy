"""Runtime configuration and feature flags.

All heavy/optional subsystems (WhisperLive streaming ASR, trained ML models)
are disabled by default so the demo runs anywhere with zero GPU setup.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _env_bool(key: str, default: bool = False) -> bool:
    val = os.getenv(key)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "on"}


def _env_list(key: str, default: list[str]) -> list[str]:
    val = os.getenv(key)
    if not val:
        return default
    return [item.strip() for item in val.split(",") if item.strip()]


@dataclass
class Settings:
    """Central settings object.

    Fields are read from environment variables once at import time.
    """

    # CORS origins allowed to connect to the API / WebSocket.
    cors_origins: list[str] = field(
        default_factory=lambda: _env_list(
            "CORS_ORIGINS",
            ["http://localhost:3000", "http://127.0.0.1:3000"],
        )
    )

    # Minimum seconds between broadcasting a recomputed MonitorState to a client.
    broadcast_interval_s: float = float(os.getenv("BROADCAST_INTERVAL_S", "0.75"))

    # Rolling window (seconds) used by "rolling" features such as rolling WPM.
    rolling_window_s: float = float(os.getenv("ROLLING_WINDOW_S", "30"))

    # Optional streaming ASR upgrade. When False the backend expects the browser
    # (Web Speech API) to send transcript events; no audio is transcribed server
    # side. See app/whisperlive.py.
    enable_whisperlive: bool = _env_bool("ENABLE_WHISPERLIVE", False)
    whisperlive_host: str = os.getenv("WHISPERLIVE_HOST", "localhost")
    whisperlive_port: int = int(os.getenv("WHISPERLIVE_PORT", "9090"))

    # Optional trained ML model (XGBoost/sklearn) upgrade for the risk engine.
    # When False the transparent rule-based additive engine is used.
    enable_ml_model: bool = _env_bool("ENABLE_ML_MODEL", False)


settings = Settings()
