from typing import Dict, Any, List


def generate_python_pipeline_code(dataset_facts: Dict[str, Any], inference_results: Dict[str, Any]) -> str:
    """
    Generates production-ready, clean Scikit-Learn + Pandas Python preprocessing script.
    """
    col_recs = inference_results.get("column_recommendations", {})
    cols = dataset_facts.get("columns", {})

    drop_cols = [c for c, r in col_recs.items() if r.get("should_drop")]

    num_median_robust = []
    num_mean_standard = []
    num_log1p = []
    cat_ohe = []
    cat_freq = []
    datetime_cols = []
    binary_cols = []

    for col, r in col_recs.items():
        if r.get("should_drop"):
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
    all_known_cols = list(cols.keys())
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

    code = f'''"""
=============================================================================
Datalysis Expert System - Production Preprocessing Pipeline
Generated automatically from mathematical heuristics & rule inference.
=============================================================================
"""

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin, OneToOneFeatureMixin
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, RobustScaler, OneHotEncoder, FunctionTransformer


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
            dt = pd.to_datetime(X[col], errors='coerce')
            month = dt.dt.month.fillna(1).astype(int)
            X_out[f"{{col}}_year"] = dt.dt.year.fillna(2000).astype(int)
            X_out[f"{{col}}_month"] = month
            X_out[f"{{col}}_day"] = dt.dt.day.fillna(1).astype(int)
            X_out[f"{{col}}_dayofweek"] = dt.dt.dayofweek.fillna(0).astype(int)
            X_out[f"{{col}}_is_weekend"] = dt.dt.dayofweek.isin([5, 6]).astype(int)
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


def clean_and_transform(df: pd.DataFrame):
    """Convenience helper to apply end-to-end cleaning to raw pandas DataFrame."""
    initial_rows = len(df)
    df_clean = df.drop_duplicates().copy()
    print(f"Dropped {{initial_rows - len(df_clean)}} duplicate rows.")

    drop_present = [c for c in DROP_COLUMNS if c in df_clean.columns]
    if drop_present:
        df_clean = df_clean.drop(columns=drop_present)

    if DATETIME_COLUMNS:
        present_dt = [c for c in DATETIME_COLUMNS if c in df_clean.columns]
        if present_dt:
            dt_extractor = DatetimeFeatureExtractor(present_dt)
            dt_features = dt_extractor.transform(df_clean)
            df_clean = pd.concat([df_clean.drop(columns=present_dt), dt_features], axis=1)

    preprocessor = build_preprocessing_pipeline()
    try:
        feature_matrix = preprocessor.fit_transform(df_clean)
    except Exception:
        feature_matrix = preprocessor.fit_transform(df_clean)

    if isinstance(feature_matrix, pd.DataFrame):
        print(f"Final Preprocessed DataFrame Shape: {{feature_matrix.shape}}")
        return feature_matrix
    else:
        try:
            col_names = preprocessor.get_feature_names_out()
            out_df = pd.DataFrame(feature_matrix, columns=col_names, index=df_clean.index)
        except Exception:
            out_df = pd.DataFrame(feature_matrix, index=df_clean.index)
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
    print("Call `clean_and_transform(df)` with your pandas DataFrame to run.")
'''
    return code
