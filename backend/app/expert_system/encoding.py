"""
Deterministic category-to-integer mappings shared by the rules and the preprocessor.
The mapping never depends on the order rows happen to appear in the file.
"""

from typing import Any, Dict, Iterable, List, Optional

import numpy as np
import pandas as pd

POSITIVE_TOKENS = {"yes", "y", "true", "t", "1", "positive", "pass"}
NEGATIVE_TOKENS = {"no", "n", "false", "f", "0", "negative", "fail"}


def normalize_token(value: Any) -> str:
    """Lower-cased, stripped text form of a value; 1.0 and True become '1' and 'true'."""
    if isinstance(value, (bool, np.bool_)):
        return str(bool(value)).lower()
    if isinstance(value, (int, float, np.integer, np.floating)) and float(value).is_integer():
        return str(int(value))
    return str(value).strip().lower()


def sorted_values(values: Iterable[Any]) -> List[Any]:
    """Sorts values naturally (numbers numerically, text alphabetically); mixed types fall back to text order."""
    values = list(values)
    try:
        return sorted(values)
    except TypeError:
        return sorted(values, key=str)


def binary_mapping(values: Iterable[Any]) -> Dict[Any, int]:
    """
    Maps the (at most 2) distinct values to 0/1.
    A recognisable positive/negative pair (yes/no, true/false, 1/0, pass/fail, ...) maps positive -> 1;
    anything else is sorted and mapped sorted[0] -> 0, sorted[1] -> 1.
    """
    distinct = list(pd.unique(pd.Series(list(values)).dropna()))
    if len(distinct) > 2:
        raise ValueError(f"binary mapping needs at most 2 distinct values, got {len(distinct)}")
    positives = [v for v in distinct if normalize_token(v) in POSITIVE_TOKENS]
    negatives = [v for v in distinct if normalize_token(v) in NEGATIVE_TOKENS]
    if len(distinct) == 2 and len(positives) == 1 and len(negatives) == 1:
        return {positives[0]: 1, negatives[0]: 0}
    return {v: i for i, v in enumerate(sorted_values(distinct))}


def ordinal_mapping(values: Iterable[Any], ordinal_order: Optional[List[str]] = None) -> Dict[Any, int]:
    """
    Maps categories to 0..k-1. Uses the detected semantic order (e.g. low < medium < high, matched
    case-insensitively on stripped text) when it covers every value; otherwise sorted unique values.
    """
    distinct = list(pd.unique(pd.Series(list(values)).dropna()))
    if ordinal_order:
        position = {name: i for i, name in enumerate(ordinal_order)}
        keyed = {v: position.get(str(v).strip().lower()) for v in distinct}
        if all(rank is not None for rank in keyed.values()):
            return keyed
    return {v: i for i, v in enumerate(sorted_values(distinct))}
