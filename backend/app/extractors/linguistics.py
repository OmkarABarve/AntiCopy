"""Linguistic features from candidate speech.

Fillers, self-corrections, hedging, confirmations, sentence length, lexical
diversity, conversational entropy and an over-explanation score.
"""

from __future__ import annotations

from ..schemas import Speaker
from ..session import SessionState
from . import lexicons as lex
from .base import register_extractor, safe_mean, safe_std, shannon_entropy
from .nlp import sentences, tokenize


def _count_phrases(text_lower: str, phrases: list[str]) -> int:
    return sum(text_lower.count(p) for p in phrases)


@register_extractor
class LinguisticsExtractor:
    name = "linguistics"

    def extract(self, session: SessionState) -> dict[str, float]:
        cand_turns = session.candidate_turns()
        full_text = " ".join(t.text for t in cand_turns).strip()
        if not full_text:
            return {k: 0.0 for k in self._keys()}

        lower = full_text.lower()
        tokens = tokenize(full_text)
        n_tokens = max(1, len(tokens))
        per_100 = 100.0 / n_tokens

        sents = sentences(full_text)
        sent_lengths = [len(tokenize(s)) for s in sents if s]

        # Lexical diversity (type-token ratio, length-normalised via root TTR).
        unique = len(set(tokens))
        ttr = unique / n_tokens
        root_ttr = unique / (n_tokens ** 0.5)

        # Conversational entropy: variability of candidate turn lengths (words).
        turn_word_counts = [float(t.word_count) for t in cand_turns if t.word_count]
        conv_entropy = shannon_entropy(turn_word_counts)

        fillers = _count_phrases(lower, lex.FILLERS)
        self_corr = _count_phrases(lower, lex.SELF_CORRECTIONS)
        hedging = _count_phrases(lower, lex.HEDGING)
        confirmation = _count_phrases(lower, lex.CONFIRMATION)
        clarification = _count_phrases(lower, lex.CLARIFICATION)
        opinion = _count_phrases(lower, lex.OPINION)
        thinking = _count_phrases(lower, lex.THINKING)

        # Over-explanation: long answers to questions that were tagged "easy".
        over_explanation = self._over_explanation(session)

        return {
            "filler_count": float(fillers),
            "filler_per_100w": round(fillers * per_100, 2),
            "self_correction_count": float(self_corr),
            "self_correction_per_100w": round(self_corr * per_100, 2),
            "hedging_count": float(hedging),
            "hedging_per_100w": round(hedging * per_100, 2),
            "confirmation_count": float(confirmation),
            "clarification_count": float(clarification),
            "opinion_count": float(opinion),
            "thinking_marker_count": float(thinking),
            "sentence_length_mean": round(safe_mean(sent_lengths), 1),
            "sentence_length_std": round(safe_std(sent_lengths), 1),
            "lexical_diversity_ttr": round(ttr, 3),
            "lexical_diversity_root_ttr": round(root_ttr, 2),
            "conversational_entropy": round(conv_entropy, 3),
            "over_explanation_score": round(over_explanation, 3),
            "total_words": float(n_tokens),
        }

    def _over_explanation(self, session: SessionState) -> float:
        """0..1 score: verbosity on questions tagged easy / rapid_easy."""
        easy_words: list[float] = []
        hard_words: list[float] = []
        for t in session.candidate_turns():
            if t.question_type in {"easy", "rapid_easy"}:
                easy_words.append(float(t.word_count))
            elif t.question_type in {"hard_technical", "constraint"}:
                hard_words.append(float(t.word_count))
        if not easy_words:
            return 0.0
        easy_avg = safe_mean(easy_words)
        # Absolute verbosity component: >60 words for an "easy" Q is a lot.
        verbosity = min(1.0, easy_avg / 90.0)
        # Relative component: easy answers nearly as long as hard ones.
        if hard_words:
            ratio = easy_avg / max(1.0, safe_mean(hard_words))
            relative = min(1.0, ratio)
        else:
            relative = verbosity
        return round(0.5 * verbosity + 0.5 * relative, 3)

    @staticmethod
    def _keys() -> list[str]:
        return [
            "filler_count",
            "filler_per_100w",
            "self_correction_count",
            "self_correction_per_100w",
            "hedging_count",
            "hedging_per_100w",
            "confirmation_count",
            "clarification_count",
            "opinion_count",
            "thinking_marker_count",
            "sentence_length_mean",
            "sentence_length_std",
            "lexical_diversity_ttr",
            "lexical_diversity_root_ttr",
            "conversational_entropy",
            "over_explanation_score",
            "total_words",
        ]
