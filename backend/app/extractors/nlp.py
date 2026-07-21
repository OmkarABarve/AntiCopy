"""Lazy spaCy loader with a zero-dependency fallback.

If ``en_core_web_sm`` is installed we use it for sentence segmentation and
lemma/token features. Otherwise we degrade gracefully to a blank English
tokenizer (spaCy) or, failing that, a naive regex tokenizer, so the demo never
crashes because of a missing model download.
"""

from __future__ import annotations

import re
from functools import lru_cache
from typing import Any


@lru_cache(maxsize=1)
def get_nlp() -> Any | None:
    try:
        import spacy
    except Exception:
        return None

    for loader in (
        lambda: spacy.load("en_core_web_sm"),
        lambda: _blank_with_sentencizer(spacy),
    ):
        try:
            return loader()
        except Exception:
            continue
    return None


def _blank_with_sentencizer(spacy_mod: Any) -> Any:
    nlp = spacy_mod.blank("en")
    if "sentencizer" not in nlp.pipe_names:
        nlp.add_pipe("sentencizer")
    return nlp


_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+")
_WORD = re.compile(r"[A-Za-z']+")


def tokenize(text: str) -> list[str]:
    """Lower-cased word tokens, spaCy if available else regex."""
    nlp = get_nlp()
    if nlp is not None:
        return [t.text.lower() for t in nlp(text) if t.is_alpha]
    return [w.lower() for w in _WORD.findall(text)]


def sentences(text: str) -> list[str]:
    nlp = get_nlp()
    if nlp is not None:
        doc = nlp(text)
        sents = [s.text.strip() for s in doc.sents if s.text.strip()]
        if sents:
            return sents
    return [s.strip() for s in _SENT_SPLIT.split(text) if s.strip()]
