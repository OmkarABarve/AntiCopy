"""Assemble a full :class:`MonitorState` snapshot from a session.

This is the orchestration seam: it runs extractors, then detectors, then the
risk + flow engines, and packages timelines/heatmap/transcript for the
dashboard. Each stage is independent and individually testable.
"""

from __future__ import annotations

import time

from .detectors import run_detectors
from .extractors import run_extractors
from .extractors.gaze import compute_heatmap
from .flow_engine import suggest_flow
from .risk_engine import compute_risk, data_sufficiency
from .schemas import MonitorState, Speaker, TimelinePoint, Timelines
from .session import SessionState


def _rel(ts: float, origin: float) -> float:
    return round(max(0.0, ts - origin), 2)


def _build_timelines(session: SessionState) -> Timelines:
    origin = session.time_origin()
    tl = Timelines()

    for turn in session.candidate_turns():
        if turn.duration > 0.4:
            wpm = turn.word_count / (turn.duration / 60.0)
            tl.wpm.append(TimelinePoint(ts=_rel(turn.end, origin), value=round(wpm, 1)))

    for ts, latency in session.response_latencies():
        tl.latency.append(TimelinePoint(ts=_rel(ts, origin), value=round(latency, 2)))

    # Blink rate binned into 10s windows.
    frames = list(session.gaze)
    if frames:
        bin_s = 10.0
        buckets: dict[int, int] = {}
        for f in frames:
            if f.blink:
                b = int((f.ts - origin) // bin_s)
                buckets[b] = buckets.get(b, 0) + 1
        for b in sorted(buckets):
            tl.blink.append(
                TimelinePoint(ts=round(b * bin_s, 1), value=float(buckets[b]))
            )

    # Pauses between turns.
    turns = session.turns()
    for prev, cur in zip(turns, turns[1:]):
        gap = cur.start - prev.end
        if gap > 0.4:
            tl.pause.append(TimelinePoint(ts=_rel(cur.start, origin), value=round(gap, 2)))

    # Conversation: +duration for candidate, -duration for interviewer.
    for turn in turns:
        value = turn.duration if turn.speaker == Speaker.candidate else -turn.duration
        tl.conversation.append(
            TimelinePoint(
                ts=_rel(turn.start, origin),
                value=round(value, 2),
                label=turn.speaker.value,
            )
        )

    return tl


def build_state(session: SessionState) -> MonitorState:
    features = run_extractors(session)
    signals = run_detectors(features)
    risk = compute_risk(features, signals)
    flow = suggest_flow(features, signals)
    timelines = _build_timelines(session)
    heatmap = compute_heatmap(session)

    return MonitorState(
        session_id=session.session_id,
        ts=time.time(),
        status=session.status,  # type: ignore[arg-type]
        duration_s=round(session.duration_s(), 1),
        features=features,
        risk=risk,
        flow=flow,
        timelines=timelines,
        heatmap=heatmap,
        transcript=session.transcript_segments(),
        ownership_score=features.values.get("ownership_score", 0.0),
        data_sufficiency=data_sufficiency(features),
    )
