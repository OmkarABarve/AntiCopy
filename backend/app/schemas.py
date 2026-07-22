"""Typed WebSocket protocol.

Two directions:

* Inbound  (browser -> backend): discriminated union on ``type`` -> ``InboundEvent``
* Outbound (backend -> browser): ``MonitorState`` snapshots (+ ack/error)

Keeping every message typed makes the API self-documenting and lets both ends
evolve independently.
"""

from __future__ import annotations

from enum import Enum
from typing import Annotated, Literal, Optional, Union

from pydantic import BaseModel, Field


# --------------------------------------------------------------------------- #
# Enums
# --------------------------------------------------------------------------- #
class Speaker(str, Enum):
    interviewer = "interviewer"
    candidate = "candidate"


class QuestionType(str, Enum):
    easy = "easy"
    hard_technical = "hard_technical"
    rapid_easy = "rapid_easy"
    opinion = "opinion"
    resume_ownership = "resume_ownership"
    personal_experience = "personal_experience"
    constraint = "constraint"
    follow_up = "follow_up"


class RiskLevel(str, Enum):
    low = "LOW"
    medium = "MEDIUM"
    high = "HIGH"


class ConfidenceLevel(str, Enum):
    low = "LOW"
    medium = "MEDIUM"
    high = "HIGH"


class SignalDirection(str, Enum):
    # "positive" signals raise the estimated probability of AI assistance.
    positive = "positive"
    # "human" signals are human-like behaviours that *reduce* that probability.
    human = "human"


# --------------------------------------------------------------------------- #
# Inbound events (browser -> backend)
# --------------------------------------------------------------------------- #
class TranscriptEvent(BaseModel):
    type: Literal["transcript"] = "transcript"
    speaker: Speaker
    text: str
    ts_start: float  # seconds (client clock)
    ts_end: float
    is_final: bool = True


class GazeEvent(BaseModel):
    """A single (already aggregated) gaze/eye sample from MediaPipe, computed on
    the candidate's Google Meet video (tab capture)."""

    type: Literal["gaze"] = "gaze"
    ts: float
    face_visible: bool = True  # whether a candidate face was detected this frame
    on_screen: bool = True
    blink: bool = False
    ear: Optional[float] = None  # eye aspect ratio
    gaze_x: float = 0.0  # normalized horizontal gaze, -1 (left) .. 1 (right)
    gaze_y: float = 0.0  # normalized vertical gaze,   -1 (up)   .. 1 (down)
    yaw: Optional[float] = None
    pitch: Optional[float] = None


class ActivityKind(str, Enum):
    focus = "focus"
    blur = "blur"
    visibility_hidden = "visibility_hidden"
    visibility_visible = "visibility_visible"
    mouse = "mouse"
    key = "key"


class ActivityEvent(BaseModel):
    """Browser focus / mouse / keyboard *metadata only* (never key contents)."""

    type: Literal["activity"] = "activity"
    ts: float
    kind: ActivityKind
    detail: Optional[str] = None


class QuestionEvent(BaseModel):
    """Interviewer tags the current question type (drives interview dynamics)."""

    type: Literal["question"] = "question"
    ts: float
    question_type: QuestionType


class ControlEvent(BaseModel):
    type: Literal["control"] = "control"
    action: Literal["start", "stop", "reset"]


InboundEvent = Annotated[
    Union[
        TranscriptEvent,
        GazeEvent,
        ActivityEvent,
        QuestionEvent,
        ControlEvent,
    ],
    Field(discriminator="type"),
]


class InboundEnvelope(BaseModel):
    """Wrapper so a raw dict can be validated into the correct event type."""

    event: InboundEvent


# --------------------------------------------------------------------------- #
# Outbound: features, signals, risk, flow
# --------------------------------------------------------------------------- #
class Signal(BaseModel):
    """One explainable piece of evidence produced by a detector."""

    id: str
    label: str
    direction: SignalDirection
    weight: float = Field(ge=0.0, le=1.0)  # base importance of this signal
    confidence: float = Field(ge=0.0, le=1.0)  # how sure we are it is present
    explanation: str
    detector: str = "unknown"


class RiskResult(BaseModel):
    risk_level: RiskLevel
    risk_score: float  # 0..100 (higher = more likely AI-assisted)
    confidence_level: ConfidenceLevel
    confidence_score: float  # 0..100
    positive_pressure: float  # summed positive-signal contribution
    human_pressure: float  # summed human-signal contribution
    evidence: list[Signal]  # positive signals present
    counter_evidence: list[Signal]  # human-like signals present
    summary: str  # plain-language, never-accusatory summary


class FlowSuggestion(BaseModel):
    next_question_type: QuestionType
    next_question_prompt: str
    rationale: str
    adaptive_flow: list[QuestionType]


class TimelinePoint(BaseModel):
    ts: float
    value: float
    label: Optional[str] = None


class Timelines(BaseModel):
    wpm: list[TimelinePoint] = Field(default_factory=list)
    latency: list[TimelinePoint] = Field(default_factory=list)
    blink: list[TimelinePoint] = Field(default_factory=list)
    pause: list[TimelinePoint] = Field(default_factory=list)
    conversation: list[TimelinePoint] = Field(default_factory=list)  # +1 candidate / -1 interviewer


class HeatmapCell(BaseModel):
    x: int
    y: int
    value: float


class TranscriptSegment(BaseModel):
    speaker: Speaker
    text: str
    ts_start: float
    ts_end: float


class FeatureSnapshot(BaseModel):
    """Flat, namespaced feature values. Extractors write into ``values``."""

    values: dict[str, float] = Field(default_factory=dict)
    # By-question-type aggregates for interview-dynamics comparisons.
    by_question_type: dict[str, dict[str, float]] = Field(default_factory=dict)


class MonitorState(BaseModel):
    type: Literal["state"] = "state"
    session_id: str
    ts: float
    status: Literal["idle", "monitoring", "stopped"]
    duration_s: float
    features: FeatureSnapshot
    risk: RiskResult
    flow: FlowSuggestion
    timelines: Timelines
    heatmap: list[HeatmapCell]
    transcript: list[TranscriptSegment]
    ownership_score: float  # 0..100 convenience mirror for the dashboard
    data_sufficiency: float  # 0..1 how much signal we have collected


class AckMessage(BaseModel):
    type: Literal["ack"] = "ack"
    session_id: str
    message: str


class ErrorMessage(BaseModel):
    type: Literal["error"] = "error"
    message: str
