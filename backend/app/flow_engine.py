"""Module 4 - Interview flow suggestion engine.

Turns the current behavioural picture into concrete, adaptive interviewer
guidance: the single next-best question plus a suggested flow. This helps an
interviewer actively probe rather than passively watch a score.
"""

from __future__ import annotations

from .schemas import (
    FeatureSnapshot,
    FlowSuggestion,
    QuestionType,
    Signal,
)

# A small bank of prompts per question type (interviewer-facing suggestions).
PROMPT_BANK: dict[QuestionType, str] = {
    QuestionType.easy: "Ask a simple warm-up question to establish a baseline.",
    QuestionType.hard_technical: "Pose a hard technical problem that requires reasoning aloud.",
    QuestionType.rapid_easy: "Fire a rapid factual question and note the time-to-answer.",
    QuestionType.opinion: "Ask an opinion-based question ('Which would you choose and why?').",
    QuestionType.resume_ownership: "Ask them to walk through a specific project on their resume.",
    QuestionType.personal_experience: "Ask about a debugging story or a decision they personally made.",
    QuestionType.constraint: "Introduce a sudden constraint switch ('Now assume memory is limited').",
    QuestionType.follow_up: "Ask a pointed follow-up drilling into their previous answer.",
}

# Baseline exploration order when no signal strongly dominates.
DEFAULT_FLOW = [
    QuestionType.easy,
    QuestionType.hard_technical,
    QuestionType.rapid_easy,
    QuestionType.opinion,
    QuestionType.resume_ownership,
    QuestionType.constraint,
    QuestionType.follow_up,
]


# (signal_id -> (recommended question type, rationale)) in priority order.
SIGNAL_RULES: list[tuple[str, QuestionType, str]] = [
    (
        "consistent_latency",
        QuestionType.rapid_easy,
        "Latency is nearly identical across difficulty. Ask a rapid factual question - "
        "a real assistant round-trip should show up as a suspiciously flat delay.",
    ),
    (
        "reading_like_gaze",
        QuestionType.constraint,
        "Gaze looks reading-like. Switch constraints mid-answer so a pre-generated "
        "response no longer fits.",
    ),
    (
        "off_screen_attention",
        QuestionType.opinion,
        "Attention is often off-camera. Ask an opinion question that has no lookup-able "
        "answer and rewards personal reasoning.",
    ),
    (
        "downward_gaze",
        QuestionType.opinion,
        "Candidate frequently looks down (possibly reading notes). Ask an opinion "
        "question with no lookup-able answer, and watch whether the downward glancing "
        "stops.",
    ),
    (
        "generic_ownership",
        QuestionType.resume_ownership,
        "Answers are generic. Ask a resume-ownership question demanding specific "
        "implementation details.",
    ),
    (
        "over_explanation",
        QuestionType.follow_up,
        "Trivial questions get over-explained. Ask a sharp follow-up to test whether the "
        "depth is genuine.",
    ),
    (
        "stable_wpm",
        QuestionType.personal_experience,
        "Speaking rate is unusually flat. Ask for a personal debugging story to force "
        "spontaneous, uneven delivery.",
    ),
    (
        "low_conversational_entropy",
        QuestionType.constraint,
        "Answers are structurally uniform. A constraint switch forces genuine adaptation.",
    ),
]


def suggest_flow(features: FeatureSnapshot, signals: list[Signal]) -> FlowSuggestion:
    present = {s.id for s in signals if s.confidence >= 0.2}
    asked = set(features.by_question_type.keys())

    chosen: QuestionType | None = None
    rationale = ""

    for signal_id, qtype, why in SIGNAL_RULES:
        if signal_id in present:
            chosen = qtype
            rationale = why
            break

    if chosen is None:
        # No dominant signal: continue baseline exploration of untested types.
        for qtype in DEFAULT_FLOW:
            if qtype.value not in asked:
                chosen = qtype
                rationale = (
                    "No dominant behavioural signal yet. Continue broad exploration to "
                    "build a reliable baseline before drawing conclusions."
                )
                break
        if chosen is None:
            chosen = QuestionType.follow_up
            rationale = (
                "Good coverage across question types. Use targeted follow-ups to deepen "
                "the strongest areas of interest."
            )

    adaptive_flow = _adaptive_flow(chosen, asked)

    return FlowSuggestion(
        next_question_type=chosen,
        next_question_prompt=PROMPT_BANK[chosen],
        rationale=rationale,
        adaptive_flow=adaptive_flow,
    )


def _adaptive_flow(first: QuestionType, asked: set[str]) -> list[QuestionType]:
    flow = [first]
    for qtype in DEFAULT_FLOW:
        if qtype == first:
            continue
        # Prioritise types not yet asked, then everything else.
        flow.append(qtype)
    # De-dupe while preserving order, cap length for a clean UI.
    seen: set[QuestionType] = set()
    ordered: list[QuestionType] = []
    for qtype in flow:
        if qtype not in seen:
            seen.add(qtype)
            ordered.append(qtype)
    return ordered[:6]
