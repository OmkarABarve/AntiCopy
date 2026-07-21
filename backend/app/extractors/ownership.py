"""Ownership score: does the candidate reason about first-hand experience?

We look for references to implementation, debugging, design decisions,
tradeoffs, lessons learned, and personal/project-specific experience. Higher
ownership is a strong *human-like* signal.
"""

from __future__ import annotations

from ..session import SessionState
from . import lexicons as lex
from .base import register_extractor


def _count(text_lower: str, phrases: list[str]) -> int:
    return sum(text_lower.count(p) for p in phrases)


@register_extractor
class OwnershipExtractor:
    name = "ownership"

    CATEGORIES = {
        "implementation": lex.OWNERSHIP_IMPLEMENTATION,
        "debugging": lex.OWNERSHIP_DEBUGGING,
        "design": lex.OWNERSHIP_DESIGN,
        "tradeoffs": lex.OWNERSHIP_TRADEOFFS,
        "lessons": lex.OWNERSHIP_LESSONS,
        "personal": lex.OWNERSHIP_PERSONAL,
    }

    def extract(self, session: SessionState) -> dict[str, float]:
        text = " ".join(t.text for t in session.candidate_turns()).strip().lower()
        if not text:
            return {"ownership_score": 0.0, **{f"ownership_{c}": 0.0 for c in self.CATEGORIES}}

        result: dict[str, float] = {}
        categories_present = 0
        total_hits = 0
        for cat, phrases in self.CATEGORIES.items():
            hits = _count(text, phrases)
            result[f"ownership_{cat}"] = float(hits)
            total_hits += hits
            if hits > 0:
                categories_present += 1

        # Score rewards *breadth* (distinct categories) over raw repetition.
        breadth = categories_present / len(self.CATEGORIES)
        depth = min(1.0, total_hits / 8.0)
        score = 100.0 * (0.7 * breadth + 0.3 * depth)

        result["ownership_categories_present"] = float(categories_present)
        result["ownership_total_hits"] = float(total_hits)
        result["ownership_score"] = round(score, 1)
        return result
