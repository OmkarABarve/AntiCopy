"""Gaze / eye features derived from browser-sent MediaPipe samples.

Off-screen attention, fixation duration, blink frequency and a reading-scan
score (rhythmic left->right sweeps with left resets, like reading text).

Eye tracking must NEVER be the sole evidence, so these features are weighted
modestly in the risk engine and always paired with counter-evidence.
"""

from __future__ import annotations

from ..schemas import GazeEvent, HeatmapCell
from ..session import SessionState
from .base import register_extractor, safe_mean, safe_std

HEATMAP_COLS = 12
HEATMAP_ROWS = 8


@register_extractor
class GazeExtractor:
    name = "gaze"

    def extract(self, session: SessionState) -> dict[str, float]:
        frames = list(session.gaze)
        if not frames:
            return {k: 0.0 for k in self._keys()}

        n = len(frames)
        on_screen = sum(1 for f in frames if f.on_screen)
        off_screen_pct = 100.0 * (1 - on_screen / n)

        blinks = sum(1 for f in frames if f.blink)
        span = max(1e-3, frames[-1].ts - frames[0].ts)
        blink_per_min = blinks / (span / 60.0)

        gx = [f.gaze_x for f in frames]
        gy = [f.gaze_y for f in frames]

        fixation = self._fixation_duration(frames)
        reading = self._reading_scan_score(frames)

        # Concentration of gaze toward a fixed off-center region (e.g. a second
        # screen / assistant window) - high horizontal offset held steadily.
        mean_gx = safe_mean(gx)
        fixed_region = min(1.0, abs(mean_gx)) * (1.0 - min(1.0, safe_std(gx)))

        return {
            "gaze_off_screen_pct": round(off_screen_pct, 1),
            "gaze_on_screen_pct": round(100.0 - off_screen_pct, 1),
            "blink_per_min": round(blink_per_min, 1),
            "blink_count": float(blinks),
            "gaze_fixation_mean_s": round(fixation, 2),
            "reading_scan_score": round(reading, 3),
            "gaze_fixed_region_score": round(fixed_region, 3),
            "gaze_horizontal_std": round(safe_std(gx), 3),
            "gaze_vertical_std": round(safe_std(gy), 3),
            "gaze_samples": float(n),
        }

    def _fixation_duration(self, frames: list[GazeEvent]) -> float:
        """Mean duration (s) that gaze stays within a small movement threshold."""
        if len(frames) < 2:
            return 0.0
        durations: list[float] = []
        start = frames[0].ts
        for prev, cur in zip(frames, frames[1:]):
            moved = abs(cur.gaze_x - prev.gaze_x) + abs(cur.gaze_y - prev.gaze_y)
            if moved > 0.15:  # saccade -> end of a fixation
                durations.append(prev.ts - start)
                start = cur.ts
        durations.append(frames[-1].ts - start)
        durations = [d for d in durations if d >= 0]
        return safe_mean(durations)

    def _reading_scan_score(self, frames: list[GazeEvent]) -> float:
        """Heuristic 0..1: rhythmic left->right sweeps followed by left resets."""
        if len(frames) < 8:
            return 0.0
        rightward = 0
        left_resets = 0
        for prev, cur in zip(frames, frames[1:]):
            dx = cur.gaze_x - prev.gaze_x
            dy = abs(cur.gaze_y - prev.gaze_y)
            if dx > 0.03 and dy < 0.05:
                rightward += 1
            elif dx < -0.2:  # fast jump back to line start
                left_resets += 1
        pairs = max(1, len(frames) - 1)
        rightward_ratio = rightward / pairs
        reset_ratio = min(1.0, left_resets / max(1, rightward / 6))
        return max(0.0, min(1.0, 0.6 * rightward_ratio + 0.4 * reset_ratio))

    @staticmethod
    def _keys() -> list[str]:
        return [
            "gaze_off_screen_pct",
            "gaze_on_screen_pct",
            "blink_per_min",
            "blink_count",
            "gaze_fixation_mean_s",
            "reading_scan_score",
            "gaze_fixed_region_score",
            "gaze_horizontal_std",
            "gaze_vertical_std",
            "gaze_samples",
        ]


def compute_heatmap(session: SessionState) -> list[HeatmapCell]:
    """Bin normalized gaze into a grid for the dashboard eye-heatmap."""
    frames = list(session.gaze)
    grid = [[0.0] * HEATMAP_COLS for _ in range(HEATMAP_ROWS)]
    if not frames:
        return []

    for f in frames:
        # Map gaze_x/gaze_y from [-1, 1] to grid indices.
        col = int((f.gaze_x + 1) / 2 * (HEATMAP_COLS - 1))
        row = int((f.gaze_y + 1) / 2 * (HEATMAP_ROWS - 1))
        col = max(0, min(HEATMAP_COLS - 1, col))
        row = max(0, min(HEATMAP_ROWS - 1, row))
        grid[row][col] += 1.0

    peak = max(max(r) for r in grid) or 1.0
    cells: list[HeatmapCell] = []
    for y, r in enumerate(grid):
        for x, v in enumerate(r):
            if v > 0:
                cells.append(HeatmapCell(x=x, y=y, value=round(v / peak, 3)))
    return cells
