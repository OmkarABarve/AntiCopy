"""Keyword lexicons for conversational-metadata detection.

These are deliberately simple and fully transparent - every match is later
surfaced as explainable evidence, so an interviewer can audit exactly why a
signal fired.
"""

from __future__ import annotations

FILLERS = ["um", "uh", "erm", "hmm", "like", "you know", "sort of", "kind of", "basically"]

SELF_CORRECTIONS = [
    "actually",
    "wait",
    "sorry",
    "no i mean",
    "let me rephrase",
    "scratch that",
    "i mean",
    "or rather",
]

HEDGING = [
    "i think",
    "maybe",
    "probably",
    "if i remember correctly",
    "i guess",
    "perhaps",
    "i believe",
    "not sure",
    "roughly",
]

CONFIRMATION = [
    "right?",
    "am i correct",
    "does that make sense",
    "should i continue",
    "you know what i mean",
    "if that makes sense",
    "correct?",
]

# Ownership: signals of first-hand, project-specific reasoning.
OWNERSHIP_IMPLEMENTATION = [
    "i implemented",
    "i built",
    "i wrote",
    "i coded",
    "we implemented",
    "i designed the",
    "i set up",
    "i created",
]
OWNERSHIP_DEBUGGING = [
    "i debugged",
    "the bug was",
    "root cause",
    "i traced",
    "stack trace",
    "i fixed",
    "turned out the issue",
    "reproduce the",
]
OWNERSHIP_DESIGN = [
    "we decided",
    "design decision",
    "we chose",
    "the tradeoff",
    "trade-off",
    "we considered",
    "the alternative was",
    "architecture",
]
OWNERSHIP_TRADEOFFS = [
    "tradeoff",
    "trade-off",
    "in hindsight",
    "the downside",
    "the benefit was",
    "we sacrificed",
    "pros and cons",
]
OWNERSHIP_LESSONS = [
    "i learned",
    "lesson learned",
    "next time i would",
    "what i would do differently",
    "i realized",
    "in retrospect",
]
OWNERSHIP_PERSONAL = [
    "in my project",
    "at my last",
    "on my team",
    "my experience",
    "when i worked on",
    "in our system",
    "our production",
]

# Human-like conversational moves.
CLARIFICATION = [
    "can you clarify",
    "what do you mean",
    "could you repeat",
    "do you mean",
    "just to confirm",
    "are you asking",
    "which one",
]
OPINION = [
    "i prefer",
    "in my opinion",
    "i'd argue",
    "i would say",
    "personally",
    "i feel that",
    "my take",
]
THINKING = ["let me think", "give me a second", "hmm let me", "good question"]
