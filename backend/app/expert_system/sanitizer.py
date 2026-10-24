"""
Data Quality Repair rules (R-QLT family).

Real files are dirty in ways that make a column look like something it is not: "?" in a numeric
column makes it text, "$1,200" is a string, "male" and "Male " become two categories. These rules
run BEFORE fact extraction so the profile and the recommendations describe the repaired data.

Each rule is a small pure function `rule(series, column_name) -> None | (new_series, repair)`.
It returns None when it has no strong evidence, so a rule only fires when it is clearly right.
A repair is a dict: rule_id, rule_name, column, severity, affected_count, description, examples, replay.
`replay` holds the exact parameters needed to repeat the repair on a fresh copy of the raw column
(see the replay_* functions below); the generated pipeline script uses it to clean raw files.
"""

from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

Repair = Dict[str, Any]
RuleResult = Optional[Tuple[pd.Series, Repair]]

# Strings that mean "no value" (compared after strip + casefold)
MISSING_TOKENS = {
    "", "?", "-", "--", "na", "n/a", "nan", "null", "none", "nil",
    "missing", "unknown", "undefined", "#n/a", "#null!", "#value!",
}

# Typical "no data" codes written into numeric columns
SENTINEL_VALUES = (-999, -9999, -99999, 999, 9999, 99999, -1)

# (positive, negative) tokens, both lower case
BOOLEAN_PAIRS = [("yes", "no"), ("y", "n"), ("true", "false"), ("t", "f")]

CURRENCY_AND_SPACE = r"[$€£₹¥\s]"  # $ euro pound rupee yen, and whitespace
THOUSANDS_PATTERN = r"[+-]?\d{1,3}(,\d{3})+(\.\d+)?"  # 1,234 or 1,234,567.89


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def _is_text(s: pd.Series) -> bool:
    """True for object columns and pandas string columns."""
    return s.dtype == object or isinstance(s.dtype, pd.StringDtype)


def _string_cells(s: pd.Series) -> pd.Series:
    """The string cells of a text column; any other cell (number, NaN) becomes NaN."""
    if isinstance(s.dtype, pd.StringDtype):
        return s
    return s.where(s.map(lambda v: isinstance(v, str)))


def _flags(mask: pd.Series) -> np.ndarray:
    """Boolean Series (possibly with NA) -> plain numpy bool array."""
    return mask.fillna(False).to_numpy(dtype=bool)


def _all_cells_are_strings(s: pd.Series, cells: pd.Series) -> bool:
    return int(cells.notna().sum()) == int(s.notna().sum())


def _examples(before: pd.Series, after: pd.Series, mask: np.ndarray) -> List[Dict[str, str]]:
    """Up to 3 before/after pairs taken from the cells selected by `mask`."""
    pairs = zip(before[mask].head(3), after[mask].head(3))
    return [{"before": str(b), "after": str(a)} for b, a in pairs]


def _repair(rule_id: str, rule_name: str, column: str, severity: str,
            affected: int, description: str, examples: List[Dict[str, str]], replay: Dict[str, Any]) -> Repair:
    return {
        "rule_id": rule_id,
        "rule_name": rule_name,
        "column": column,
        "severity": severity,
        "affected_count": int(affected),
        "description": description,
        "examples": examples[:3],
        "replay": replay,
    }


def _format_number(value: float) -> str:
    if pd.isna(value):
        return "NaN"
    return str(int(value)) if float(value).is_integer() else str(value)


# ----------------------------------------------------------------------------
# R-QLT-07: surrounding whitespace
# ----------------------------------------------------------------------------
def strip_whitespace(s: pd.Series, col: str) -> RuleResult:
    if not _is_text(s):
        return None
    cells = _string_cells(s)
    stripped = cells.str.strip()
    changed = _flags(cells.notna() & (stripped != cells))
    if not changed.any():
        return None
    new = s.mask(changed, stripped)
    return new, _repair(
        "R-QLT-07", "Surrounding Whitespace Stripped", col, "INFO", changed.sum(),
        "Leading/trailing spaces were removed. ' yes' and 'yes' are the same value to a person "
        "but different categories to an encoder, which would split one class into several.",
        _examples(cells, stripped, changed), {},
    )


# ----------------------------------------------------------------------------
# R-QLT-01: disguised missing values
# ----------------------------------------------------------------------------
def disguised_missing(s: pd.Series, col: str) -> RuleResult:
    if not _is_text(s):
        return None
    cells = _string_cells(s)
    non_null = int(cells.notna().sum())
    if non_null == 0:
        return None
    normalized = cells.str.strip().str.casefold()
    is_token = normalized.isin(MISSING_TOKENS)
    # "unknown" is a real category when it dominates the column
    if (normalized == "unknown").sum() / non_null >= 0.5:
        is_token = is_token & (normalized != "unknown")
    mask = _flags(is_token)
    if not mask.any():
        return None
    new = s.mask(mask)
    tokens_found = sorted(str(t) for t in normalized[mask].unique())
    return new, _repair(
        "R-QLT-01", "Disguised Missing Values", col, "WARNING", mask.sum(),
        "Placeholder strings such as '?', '-', 'N/A' or 'unknown' were converted to real missing values. "
        "Left as text they count as a valid category (or stop a numeric column from being numeric), "
        "so statistics, imputation and encoders would treat 'no data' as data.",
        _examples(cells, pd.Series("NaN", index=cells.index), mask), {"tokens": tokens_found},
    )


# ----------------------------------------------------------------------------
# R-QLT-03: numbers stored as text
# ----------------------------------------------------------------------------
def parse_numeric_strings(original: pd.Series) -> tuple:
    """
    The fixed parse procedure of R-QLT-03 on stripped strings. Returns (numbers, is_negative, has_thousands):
    float values (NaN where the text is not a number), and the two masks used to describe what was removed.
    """
    is_negative = original.str.match(r"^\(.*\)$")  # accounting style (123) means -123
    text = original.str.replace(r"^\((.*)\)$", r"\1", regex=True)
    text = text.str.replace(CURRENCY_AND_SPACE, "", regex=True)
    text = text.str.replace(r"%$", "", regex=True)
    has_thousands = text.str.fullmatch(THOUSANDS_PATTERN)
    text = text.mask(has_thousands, text.str.replace(",", "", regex=False))
    numbers = pd.to_numeric(text, errors="coerce")
    numbers = numbers.where(np.isfinite(numbers))
    numbers = numbers.mask(is_negative, -numbers)
    return numbers, is_negative, has_thousands


def numeric_text(s: pd.Series, col: str) -> RuleResult:
    if not _is_text(s):
        return None
    cells = _string_cells(s)
    if not _all_cells_are_strings(s, cells):
        return None
    present = _flags(cells.notna())
    n = int(present.sum())
    if n == 0:
        return None

    original = cells[present].str.strip()
    # Codes like zip "00123" are identifiers; converting would destroy the leading zeros
    if original.str.match(r"^0\d").mean() >= 0.2:
        return None

    numbers, is_negative, has_thousands = parse_numeric_strings(original)

    parsed = numbers.notna()
    if parsed.mean() < 0.9:
        return None

    values = np.full(len(s), np.nan)
    values[present] = numbers.to_numpy()
    new = pd.Series(values, index=s.index, dtype="float64")

    unparseable = int((~parsed).sum())
    stripped_parts = []
    if original.str.contains(r"[$€£₹¥]").any():
        stripped_parts.append("currency symbols")
    if has_thousands.any():
        stripped_parts.append("thousands separators")
    if original.str.endswith("%").any():
        stripped_parts.append("percent sign (the number is kept as written, '10%' becomes 10.0)")
    if is_negative.any():
        stripped_parts.append("accounting parentheses (converted to negative numbers)")
    stripped_text = ", ".join(stripped_parts) if stripped_parts else "no formatting characters"
    description = (
        f"{100 * parsed.mean():.0f}% of the values are numbers written as text; the column was converted to float "
        f"(removed: {stripped_text}). Kept as text it would be profiled as categorical, one-hot encoded, "
        f"and never scaled."
    )
    if unparseable:
        description += f" {unparseable} value(s) that could not be read as a number became missing."

    shown = (original != numbers.map(_format_number)) | ~parsed  # prefer cells that were actually rewritten
    if not shown.any():
        shown = pd.Series(True, index=original.index)
    examples = _examples(original, numbers.map(_format_number), shown.to_numpy(dtype=bool))
    return new, _repair("R-QLT-03", "Numeric Stored as Text", col, "WARNING", n, description, examples, {})


# ----------------------------------------------------------------------------
# R-QLT-04: yes/no style text
# ----------------------------------------------------------------------------
def boolean_text(s: pd.Series, col: str) -> RuleResult:
    if not _is_text(s):
        return None
    cells = _string_cells(s)
    if not _all_cells_are_strings(s, cells) or cells.notna().sum() == 0:
        return None
    normalized = cells.str.strip().str.casefold()
    distinct = set(normalized.dropna().unique())
    for positive, negative in BOOLEAN_PAIRS:
        if distinct == {positive, negative}:
            codes = normalized.map({positive: 1.0, negative: 0.0})
            if cells.notna().all():
                codes = codes.astype("int64")
            return codes, _repair(
                "R-QLT-04", "Boolean-Like Text", col, "INFO", cells.notna().sum(),
                f"The column holds only '{positive}'/'{negative}' (any case); mapped to 1/0 with '{positive}' = 1. "
                "A true/false flag stored as words cannot be correlated or scaled until it is numeric.",
                _examples(cells, codes, _flags(cells.notna())), {"positive": positive, "negative": negative},
            )
    return None


# ----------------------------------------------------------------------------
# R-QLT-05: category labels that differ only by case or spacing
# ----------------------------------------------------------------------------
def inconsistent_labels(s: pd.Series, col: str) -> RuleResult:
    if not _is_text(s):
        return None
    cells = _string_cells(s)
    present = _flags(cells.notna())
    n = int(present.sum())
    if n < 2:
        return None
    values = cells[present]
    if values.nunique() / n > 0.5:  # mostly unique: free text, leave it alone
        return None

    tidy = values.str.strip().str.replace(r"\s+", " ", regex=True)
    counts = tidy.value_counts()
    first_seen = {spelling: i for i, spelling in enumerate(tidy.drop_duplicates())}
    spellings: Dict[str, List[str]] = {}
    for spelling in counts.index:
        spellings.setdefault(spelling.casefold(), []).append(spelling)
    # Most frequent spelling wins; ties go to the one that appears first in the file (deterministic)
    canonical = {key: sorted(group, key=lambda x: (-counts[x], first_seen[x]))[0] for key, group in spellings.items()}
    replacement = {sp: canonical[key] for key, group in spellings.items() for sp in group}
    merged = tidy.map(replacement)

    changed = merged.to_numpy() != values.to_numpy()
    if not changed.any():
        return None

    new = s.copy()
    new.iloc[np.flatnonzero(present)[changed]] = merged.to_numpy()[changed]

    groups = [(key, group) for key, group in spellings.items() if len(group) > 1]
    if groups:
        examples = [{"before": " | ".join(group), "after": canonical[key]} for key, group in groups]
    else:
        examples = _examples(values, merged, changed)
    mapping = {spelling: target for spelling, target in replacement.items() if spelling != target}
    return new, _repair(
        "R-QLT-05", "Category Label Inconsistency", col, "WARNING", changed.sum(),
        f"{len(groups)} group(s) of labels differed only by letter case or spacing and were merged into the "
        "most frequent spelling. One real category written several ways would otherwise become several "
        "sparse one-hot columns and weaken every category statistic.",
        examples, {"mapping": mapping},
    )


# ----------------------------------------------------------------------------
# R-QLT-06: infinite values
# ----------------------------------------------------------------------------
def infinite_values(s: pd.Series, col: str) -> RuleResult:
    if not pd.api.types.is_float_dtype(s):
        return None
    mask = np.isinf(s.to_numpy(dtype="float64", na_value=np.nan))
    if not mask.any():
        return None
    return s.mask(mask), _repair(
        "R-QLT-06", "Infinite Values", col, "WARNING", mask.sum(),
        "+/-inf cannot be averaged, scaled or fed to most estimators (one inf makes the mean and standard "
        "deviation infinite or NaN). They were treated as missing so they can be imputed.",
        _examples(s, pd.Series("NaN", index=s.index), mask), {},
    )


# ----------------------------------------------------------------------------
# R-QLT-02: numeric sentinel codes (-999, 9999, ...)
# ----------------------------------------------------------------------------
def numeric_sentinels(s: pd.Series, col: str) -> RuleResult:
    if not pd.api.types.is_numeric_dtype(s) or pd.api.types.is_bool_dtype(s):
        return None
    values = s.to_numpy(dtype="float64", na_value=np.nan)
    finite = values[np.isfinite(values)]
    is_sentinel = np.isin(finite, SENTINEL_VALUES)
    rest = finite[~is_sentinel]
    if not is_sentinel.any() or len(rest) < 4:
        return None

    q25, q75 = np.percentile(rest, [25, 75])
    iqr = q75 - q25
    lower, upper = q25 - 3 * iqr, q75 + 3 * iqr  # "extreme" fences (3 x IQR)

    to_null = []
    for code in SENTINEL_VALUES:
        count = int((values == code).sum())
        if count == 0 or count / len(values) < 0.01:
            continue  # absent, or too rare to be a systematic code
        if code == -1 and (rest < 0).any():
            continue  # -1 is a legitimate value when the column has other negatives
        if lower <= code <= upper:
            continue  # inside the normal range: it could be real data
        to_null.append(code)

    mask = np.isin(values, to_null)
    if not mask.any():
        return None
    return s.mask(mask), _repair(
        "R-QLT-02", "Numeric Sentinel Codes", col, "WARNING", mask.sum(),
        f"Value(s) {to_null} sit far outside the rest of the column (beyond 3 x IQR from the quartiles) and "
        "repeat in at least 1% of rows, which is how 'no data' codes look. They were set to missing; kept, "
        "they would drag the mean and inflate the variance.",
        _examples(s, pd.Series("NaN", index=s.index), mask), {"codes": [int(code) for code in to_null]},
    )


# ----------------------------------------------------------------------------
# Replay: repeat a recorded repair on a raw column, with no decisions left to make
# ----------------------------------------------------------------------------
# Each function takes the column and the repair's `replay` dict and returns the repaired column.
# The rules above DECIDE (is this column numbers-as-text? which labels are variants?); these only
# APPLY that decision, so they give the same result on the data the rules saw. They are copied into
# the generated pipeline script, which is why they use only pandas, numpy and the helpers above.
def replay_strip_whitespace(s: pd.Series, params: dict) -> pd.Series:
    if not _is_text(s):
        return s
    cells = _string_cells(s)
    return s.mask(_flags(cells.notna()), cells.str.strip())


def replay_disguised_missing(s: pd.Series, params: dict) -> pd.Series:
    if not _is_text(s):
        return s
    normalized = _string_cells(s).str.strip().str.casefold()
    return s.mask(_flags(normalized.isin(params["tokens"])))


def replay_numeric_text(s: pd.Series, params: dict) -> pd.Series:
    present = _flags(s.notna())
    numbers, _, _ = parse_numeric_strings(s[present].astype(str).str.strip())
    values = np.full(len(s), np.nan)
    values[present] = numbers.to_numpy()
    return pd.Series(values, index=s.index, dtype="float64")


def replay_boolean_text(s: pd.Series, params: dict) -> pd.Series:
    if not _is_text(s):
        return s
    normalized = _string_cells(s).str.strip().str.casefold()
    codes = normalized.map({params["positive"]: 1.0, params["negative"]: 0.0})
    return codes.astype("int64") if codes.notna().all() else codes


def replay_inconsistent_labels(s: pd.Series, params: dict) -> pd.Series:
    if not _is_text(s):
        return s
    cells = _string_cells(s)
    tidy = cells.str.strip().str.replace(r"\s+", " ", regex=True)
    merged = tidy.map(lambda label: params["mapping"].get(label, label), na_action="ignore")
    return s.mask(_flags(cells.notna()), merged)


def replay_infinite_values(s: pd.Series, params: dict) -> pd.Series:
    if not pd.api.types.is_float_dtype(s):
        return s
    return s.mask(np.isinf(s.to_numpy(dtype="float64", na_value=np.nan)))


def replay_numeric_sentinels(s: pd.Series, params: dict) -> pd.Series:
    if not pd.api.types.is_numeric_dtype(s) or pd.api.types.is_bool_dtype(s):
        return s
    return s.mask(np.isin(s.to_numpy(dtype="float64", na_value=np.nan), params["codes"]))


# Order matters: clean text first, then convert, then merge labels, then numeric checks
RULES_IN_ORDER = [
    strip_whitespace,
    disguised_missing,
    numeric_text,
    boolean_text,
    inconsistent_labels,
    infinite_values,
    numeric_sentinels,
]


def sanitize_dataframe(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[Repair]]:
    """Applies the R-QLT rules column by column. Returns (repaired copy, list of repairs)."""
    repaired = df.copy()
    repairs: List[Repair] = []
    for position, col in enumerate(df.columns):
        series = repaired.iloc[:, position]
        original = series
        for rule in RULES_IN_ORDER:
            result = rule(series, str(col))
            if result is not None:
                series, repair = result
                repairs.append(repair)
        if series is not original:
            repaired.isetitem(position, series)
    return repaired, repairs
