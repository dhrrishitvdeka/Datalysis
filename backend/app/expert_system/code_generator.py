import inspect
from typing import Dict, Any, List, Optional

from . import sanitizer
from .fact_extractor import DAY_MONTH_YEAR_REGEX, parse_dates, to_datetime_safe

# rule_id -> the sanitizer function that replays that repair on a raw column
REPLAY_FUNCTIONS = {
    "R-QLT-07": sanitizer.replay_strip_whitespace,
    "R-QLT-01": sanitizer.replay_disguised_missing,
    "R-QLT-03": sanitizer.replay_numeric_text,
    "R-QLT-04": sanitizer.replay_boolean_text,
    "R-QLT-05": sanitizer.replay_inconsistent_labels,
    "R-QLT-06": sanitizer.replay_infinite_values,
    "R-QLT-02": sanitizer.replay_numeric_sentinels,
}


def build_repair_section(repairs: List[Dict[str, Any]]) -> str:
    """
    Source text of the `repair_data_quality(df)` part of the script. The replay functions are copied
    from sanitizer.py with inspect (like the date parser), so the script repeats exactly what the
    profiler's data went through. Only the helpers the recorded repairs need are included.
    """
    used = {r["rule_id"] for r in repairs}
    if not used:
        return '''DATA_QUALITY_REPAIRS = []  # the profiled file needed no data-quality repairs


def repair_data_quality(df: pd.DataFrame) -> pd.DataFrame:
    """No R-QLT repairs were applied when this script was generated, so there is nothing to replay."""
    return df'''

    helpers = [sanitizer._is_text, sanitizer._string_cells, sanitizer._flags]
    constants = ""
    if "R-QLT-03" in used:
        constants = (
            f"CURRENCY_AND_SPACE = {sanitizer.CURRENCY_AND_SPACE!r}\n"
            f"THOUSANDS_PATTERN = {sanitizer.THOUSANDS_PATTERN!r}\n\n\n"
        )
        helpers.append(sanitizer.parse_numeric_strings)
    helper_source = constants + "\n\n\n".join(inspect.getsource(f).rstrip() for f in helpers)
    replay_source = "\n\n\n".join(
        inspect.getsource(f).rstrip() for rule_id, f in REPLAY_FUNCTIONS.items() if rule_id in used
    )

    # repr() of plain str/int/list/dict values is always a valid Python literal (quotes, backslashes, unicode)
    entries = ""
    for r in repairs:
        entry = {"rule_id": r["rule_id"], "column": r["column"], "replay": r.get("replay", {})}
        entries += f"    {entry!r},\n"
    dispatch = "".join(
        f"    {rule_id!r}: {f.__name__},\n" for rule_id, f in REPLAY_FUNCTIONS.items() if rule_id in used
    )

    return f'''{helper_source}


{replay_source}


# One entry per repair the profiler applied, in the order it applied them: rule, column, replay parameters.
DATA_QUALITY_REPAIRS = [
{entries}]

REPLAY_BY_RULE = {{
{dispatch}}}


def repair_data_quality(df: pd.DataFrame) -> pd.DataFrame:
    """
    Repeats the data-quality repairs Datalysis applied before profiling, so a RAW file can be fed in.
    Columns that are not in `df` are skipped. Learns nothing from the data, so it is safe before a split.
    """
    repaired = df.copy()
    for repair in DATA_QUALITY_REPAIRS:
        column = repair["column"]
        if column in repaired.columns:
            replay = REPLAY_BY_RULE[repair["rule_id"]]
            repaired[column] = replay(repaired[column], repair["replay"])
    return repaired'''


def generate_python_pipeline_code(
    dataset_facts: Dict[str, Any],
    inference_results: Dict[str, Any],
    target_col: Optional[str] = None,
    repairs: Optional[List[Dict[str, Any]]] = None,
) -> str:
    """
    Generates production-ready, clean Scikit-Learn + Pandas Python preprocessing script.
    With a `target_col`, the target is excluded from every feature transformer and the script
    splits train/test BEFORE fitting, so the preprocessing statistics never see the test rows.
    With `repairs` (the R-QLT repairs the sanitizer applied), the script replays them first, so it
    runs on the raw file and not only on the repaired frame the column types were inferred from.
    """
    repairs = repairs or []
    col_recs = inference_results.get("column_recommendations", {})
    cols = dataset_facts.get("columns", {})

    drop_cols = [c for c, r in col_recs.items() if r.get("should_drop") and c != target_col]

    num_median_robust = []
    num_mean_standard = []
    num_log1p = []
    cat_ohe = []
    cat_freq = []
    datetime_cols = []
    binary_cols = []

    for col, r in col_recs.items():
        if r.get("should_drop") or col == target_col:
            continue

        c_fact = cols.get(col, {})
        itype = c_fact.get("inferred_type", "")
        enc = r.get("encoding") or {}
        scaling_actions = {s.get("action") for s in r.get("scaling_and_outliers", [])}

        if itype == "datetime":
            datetime_cols.append(col)
        elif enc.get("action") == "encode_binary" or itype == "boolean" or c_fact.get("is_binary"):
            binary_cols.append(col)
        elif "numerical" in itype:
            ns = c_fact.get("numeric_stats") or {}
            if "transform_log1p" in scaling_actions:
                num_log1p.append(col)
            elif abs(ns.get("skewness", 0)) >= 0.8 or ns.get("outliers_iqr_pct", 0) >= 2.0:
                num_median_robust.append(col)
            else:
                num_mean_standard.append(col)
        elif enc.get("action") == "encode_frequency_or_target" or (
            "categorical" in itype and c_fact.get("unique_count", 0) > 10
        ):
            cat_freq.append(col)
        elif "categorical" in itype:
            cat_ohe.append(col)
        else:
            cat_ohe.append(col)

    # Compute passthrough columns (columns that exist, are not dropped, and not transformed)
    all_known_cols = [c for c in cols.keys() if c != target_col]
    transformed_cols = set(num_median_robust + num_mean_standard + num_log1p + cat_ohe + cat_freq + binary_cols + drop_cols + datetime_cols)
    passthrough_cols = [c for c in all_known_cols if c not in transformed_cols]

    datetime_expanded: List[str] = []
    datetime_time_cols: List[str] = []
    for col in datetime_cols:
        datetime_expanded.extend(
            [
                f"{col}_year",
                f"{col}_month",
                f"{col}_day",
                f"{col}_dayofweek",
                f"{col}_is_weekend",
                f"{col}_sin_month",
                f"{col}_cos_month",
            ]
        )
        c_fact = cols.get(col, {})
        has_time = c_fact.get("datetime_stats", {}).get("has_time", False)
        if has_time:
            datetime_time_cols.append(col)
            datetime_expanded.extend(
                [
                    f"{col}_hour",
                    f"{col}_sin_hour",
                    f"{col}_cos_hour",
                    f"{col}_is_night",
                    f"{col}_minute",
                ]
            )

    # The same date parser the profiler used, copied into the script so it stands alone
    datetime_helpers = (
        f"DAY_MONTH_YEAR_REGEX = {DAY_MONTH_YEAR_REGEX!r}\n\n\n"
        + inspect.getsource(to_datetime_safe) + "\n\n"
        + inspect.getsource(parse_dates)
    )

    repair_section = build_repair_section(repairs)

    code = f'''"""
=============================================================================
Datalysis Expert System - Production Preprocessing Pipeline
Generated automatically from mathematical heuristics & rule inference.

DATA-QUALITY REPAIRS: clean_and_transform(df) first calls repair_data_quality(df), which repeats the
repairs Datalysis made before profiling (see DATA_QUALITY_REPAIRS). Pass the RAW file; if you call
build_preprocessing_pipeline() yourself, run repair_data_quality(df) on your data first.

LEAKAGE WARNING: scalers, imputers and encoders learn statistics (means, medians,
categories). Fit them on TRAINING rows only, then transform the test rows.
  * With a target column: clean_and_transform(df) splits first, fits on X_train only,
    and returns X_train, X_test, y_train, y_test.
  * Without a target: clean_and_transform(df) fits on whatever frame you pass in.
    Pass training data only, or call build_preprocessing_pipeline() yourself:
        preprocessor = build_preprocessing_pipeline()
        X_train_p = preprocessor.fit_transform(X_train)
        X_test_p = preprocessor.transform(X_test)
=============================================================================
"""

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin, OneToOneFeatureMixin
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, RobustScaler, OneHotEncoder, FunctionTransformer


# ---------------------------------------------------------------------------
# 0. Date parsing helpers (day-first aware, unparseable values become NaT)
# ---------------------------------------------------------------------------
{datetime_helpers}


# ---------------------------------------------------------------------------
# 0b. Data-quality repairs (R-QLT), replayed so the script works on the raw file
# ---------------------------------------------------------------------------
{repair_section}


# ---------------------------------------------------------------------------
# 1. Custom Datetime Feature Extractor
# ---------------------------------------------------------------------------
class DatetimeFeatureExtractor(BaseEstimator, TransformerMixin):
    def __init__(self, datetime_cols, time_cols=None):
        self.datetime_cols = datetime_cols
        self.time_cols = time_cols if time_cols is not None else {repr(datetime_time_cols)}

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        X_out = pd.DataFrame(index=X.index)
        for col in self.datetime_cols:
            dt = parse_dates(X[col])
            month = dt.dt.month.fillna(1).astype(int)
            X_out[f"{{col}}_year"] = dt.dt.year.fillna(2000).astype(int)
            X_out[f"{{col}}_month"] = month
            X_out[f"{{col}}_day"] = dt.dt.day.fillna(1).astype(int)
            X_out[f"{{col}}_dayofweek"] = dt.dt.day_of_week.fillna(0).astype(int)
            X_out[f"{{col}}_is_weekend"] = dt.dt.day_of_week.isin([5, 6]).astype(int)
            X_out[f"{{col}}_sin_month"] = np.sin(2 * np.pi * month / 12.0)
            X_out[f"{{col}}_cos_month"] = np.cos(2 * np.pi * month / 12.0)
            if col in self.time_cols:
                hour = dt.dt.hour.fillna(0).astype(int)
                X_out[f"{{col}}_hour"] = hour
                X_out[f"{{col}}_sin_hour"] = np.sin(2 * np.pi * hour / 24.0)
                X_out[f"{{col}}_cos_hour"] = np.cos(2 * np.pi * hour / 24.0)
                X_out[f"{{col}}_is_night"] = ((hour < 6) | (hour > 20)).astype(int)
                X_out[f"{{col}}_minute"] = dt.dt.minute.fillna(0).astype(int)
        return X_out.fillna(0)


# ---------------------------------------------------------------------------
# 2. Winsorization Outlier Clipper
# ---------------------------------------------------------------------------
class OutlierCapper(OneToOneFeatureMixin, BaseEstimator, TransformerMixin):
    def __init__(self, lower_quantile=0.01, upper_quantile=0.99):
        self.lower_quantile = lower_quantile
        self.upper_quantile = upper_quantile
        self.bounds_ = {{}}

    def fit(self, X, y=None):
        X_df = pd.DataFrame(X)
        self.n_features_in_ = X_df.shape[1]
        if hasattr(X_df, 'columns'):
            self.feature_names_in_ = np.array(X_df.columns, dtype=object)
        for col in X_df.columns:
            q_low = X_df[col].quantile(self.lower_quantile)
            q_high = X_df[col].quantile(self.upper_quantile)
            self.bounds_[col] = (q_low, q_high)
        return self

    def transform(self, X):
        X_df = pd.DataFrame(X).copy()
        for col, (q_low, q_high) in self.bounds_.items():
            if col in X_df.columns:
                X_df[col] = np.clip(X_df[col], q_low, q_high)
        return X_df.to_numpy()


# ---------------------------------------------------------------------------
# 3. Frequency Encoder (high-cardinality categoricals)
# ---------------------------------------------------------------------------
class FrequencyEncoder(OneToOneFeatureMixin, BaseEstimator, TransformerMixin):
    def fit(self, X, y=None):
        X_df = pd.DataFrame(X)
        self.n_features_in_ = X_df.shape[1]
        if hasattr(X_df, 'columns'):
            self.feature_names_in_ = np.array(X_df.columns, dtype=object)
        self.maps_ = {{}}
        for col in X_df.columns:
            self.maps_[col] = X_df[col].value_counts(normalize=True).to_dict()
        return self

    def transform(self, X):
        X_df = pd.DataFrame(X).copy()
        for col, mapping in self.maps_.items():
            if col in X_df.columns:
                X_df[col] = X_df[col].map(mapping).fillna(0.0)
        return X_df.to_numpy()


# ---------------------------------------------------------------------------
# 4. Column Partitioning (Determined by Expert System Rules)
# ---------------------------------------------------------------------------
TARGET_COLUMN = {repr(target_col)}  # never transformed; None when no target was chosen
DROP_COLUMNS = {repr(drop_cols)}
NUMERIC_MEDIAN_ROBUST = {repr(num_median_robust)}
NUMERIC_MEAN_STANDARD = {repr(num_mean_standard)}
NUMERIC_LOG1P = {repr(num_log1p)}
CATEGORICAL_OHE = {repr(cat_ohe)}
CATEGORICAL_HIGH_CARD = {repr(cat_freq)}
DATETIME_COLUMNS = {repr(datetime_cols)}
DATETIME_EXPANDED = {repr(datetime_expanded)}
BINARY_COLUMNS = {repr(binary_cols)}
PASSTHROUGH_COLUMNS = {repr(passthrough_cols)}


# ---------------------------------------------------------------------------
# 5. Pipeline Construction
# ---------------------------------------------------------------------------
def build_preprocessing_pipeline() -> ColumnTransformer:
    transformers = []

    if NUMERIC_LOG1P:
        log1p_pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="median", add_indicator=True)),
            ("capper", OutlierCapper(lower_quantile=0.01, upper_quantile=0.99)),
            ("log1p", FunctionTransformer(np.log1p, validate=False, feature_names_out="one-to-one")),
            ("scaler", RobustScaler())
        ])
        transformers.append(("num_log1p", log1p_pipe, NUMERIC_LOG1P))

    if NUMERIC_MEDIAN_ROBUST:
        num_median_pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="median", add_indicator=True)),
            ("capper", OutlierCapper(lower_quantile=0.01, upper_quantile=0.99)),
            ("scaler", RobustScaler())
        ])
        transformers.append(("num_skewed", num_median_pipe, NUMERIC_MEDIAN_ROBUST))

    if NUMERIC_MEAN_STANDARD:
        num_mean_pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="mean", add_indicator=True)),
            ("scaler", StandardScaler())
        ])
        transformers.append(("num_gaussian", num_mean_pipe, NUMERIC_MEAN_STANDARD))

    if DATETIME_EXPANDED:
        dt_pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler())
        ])
        transformers.append(("datetime_parts", dt_pipe, DATETIME_EXPANDED))

    if CATEGORICAL_OHE:
        cat_pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="constant", fill_value="Missing")),
            ("onehot", OneHotEncoder(drop="first", handle_unknown="ignore", sparse_output=False))
        ])
        transformers.append(("cat_ohe", cat_pipe, CATEGORICAL_OHE))

    if CATEGORICAL_HIGH_CARD:
        freq_pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="constant", fill_value="Missing")),
            ("freq", FrequencyEncoder())
        ])
        transformers.append(("cat_freq", freq_pipe, CATEGORICAL_HIGH_CARD))

    if BINARY_COLUMNS:
        bin_pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(drop="if_binary", handle_unknown="ignore", sparse_output=False))
        ])
        transformers.append(("binary", bin_pipe, BINARY_COLUMNS))

    if PASSTHROUGH_COLUMNS:
        transformers.append(("passthrough", "passthrough", PASSTHROUGH_COLUMNS))

    preprocessor = ColumnTransformer(
        transformers=transformers,
        remainder="passthrough"
    )

    try:
        preprocessor.set_output(transform="pandas")
    except Exception:
        pass

    return preprocessor


def _prepare_frame(df: pd.DataFrame) -> pd.DataFrame:
    """Row-wise steps that learn nothing from the data, so they are safe to run before splitting."""
    df_clean = df.copy()
    float_cols = df_clean.select_dtypes(include="floating").columns
    df_clean[float_cols] = df_clean[float_cols].replace([np.inf, -np.inf], np.nan)

    drop_present = [c for c in DROP_COLUMNS if c in df_clean.columns]
    if drop_present:
        df_clean = df_clean.drop(columns=drop_present)

    # Deduplicate after the ID columns are gone, so IDs cannot hide duplicate rows
    initial_rows = len(df_clean)
    df_clean = df_clean.drop_duplicates()
    print(f"Dropped {{initial_rows - len(df_clean)}} duplicate rows.")

    present_dt = [c for c in DATETIME_COLUMNS if c in df_clean.columns]
    if present_dt:
        dt_features = DatetimeFeatureExtractor(present_dt).transform(df_clean)
        df_clean = pd.concat([df_clean.drop(columns=present_dt), dt_features], axis=1)
    return df_clean


def _to_frame(preprocessor, matrix, index) -> pd.DataFrame:
    """Makes sure the transformer output is a DataFrame with string column names."""
    if isinstance(matrix, pd.DataFrame):
        return matrix
    try:
        names = [str(n) for n in preprocessor.get_feature_names_out()]
    except (AttributeError, ValueError):
        names = [f"feature_{{i}}" for i in range(matrix.shape[1])]
    return pd.DataFrame(matrix, columns=names, index=index)


def clean_and_transform(df: pd.DataFrame, test_size: float = 0.2, random_state: int = 42):
    """
    With TARGET_COLUMN set (and present in df): split into train/test first, fit the preprocessor
    on X_train ONLY, transform X_test with that fitted preprocessor, and return
    (X_train, X_test, y_train, y_test). The target is left untouched (no scaling or encoding).

    Without a target: fits on the frame you pass in and returns one DataFrame. To avoid leakage,
    pass training rows only, or use build_preprocessing_pipeline() with your own split.
    """
    df_clean = _prepare_frame(repair_data_quality(df))

    if TARGET_COLUMN is not None and TARGET_COLUMN in df_clean.columns:
        df_clean = df_clean.dropna(subset=[TARGET_COLUMN])  # a row without a label cannot be used
        X = df_clean.drop(columns=[TARGET_COLUMN])
        y = df_clean[TARGET_COLUMN]

        # Same task rule as the Datalysis target analysis: numeric with > 20 distinct values is regression
        is_classification = (not pd.api.types.is_numeric_dtype(y)) or y.nunique() <= 20
        n_test = int(np.ceil(len(y) * test_size))
        n_classes = y.nunique()
        can_stratify = (
            is_classification
            and y.value_counts().min() >= 2          # every class must appear at least twice
            and n_test >= n_classes                  # and fit in both halves of the split
            and len(y) - n_test >= n_classes
        )
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state,
            stratify=y if can_stratify else None,
        )

        preprocessor = build_preprocessing_pipeline()
        X_train_p = _to_frame(preprocessor, preprocessor.fit_transform(X_train), X_train.index)  # fit on train only
        X_test_p = _to_frame(preprocessor, preprocessor.transform(X_test), X_test.index)         # reuse train statistics
        print(f"X_train: {{X_train_p.shape}}, X_test: {{X_test_p.shape}} (stratified: {{can_stratify}})")
        return X_train_p, X_test_p, y_train, y_test

    preprocessor = build_preprocessing_pipeline()
    out_df = _to_frame(preprocessor, preprocessor.fit_transform(df_clean), df_clean.index)
    print(f"Final Preprocessed DataFrame Shape: {{out_df.shape}}")
    return out_df


if __name__ == "__main__":
    print("Datalysis Expert Preprocessing Pipeline Initialized.")
    print(f"Columns to Prune: {{len(DROP_COLUMNS)}}")
    print(f"Skewed Features: {{len(NUMERIC_MEDIAN_ROBUST)}}")
    print(f"Log1p Features: {{len(NUMERIC_LOG1P)}}")
    print(f"Gaussian Features: {{len(NUMERIC_MEAN_STANDARD)}}")
    print(f"Categorical Features: {{len(CATEGORICAL_OHE)}}")
    print(f"High-cardinality Features: {{len(CATEGORICAL_HIGH_CARD)}}")
    print(f"Passthrough Unflagged Features: {{len(PASSTHROUGH_COLUMNS)}}")
    if TARGET_COLUMN is not None:
        print(f"Target: {{TARGET_COLUMN}}. Call `X_train, X_test, y_train, y_test = clean_and_transform(df)`.")
    else:
        print("Call `clean_and_transform(df)` with your TRAINING DataFrame (or use build_preprocessing_pipeline()).")
'''
    return code
