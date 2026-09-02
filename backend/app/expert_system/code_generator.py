from typing import Dict, Any, List

def generate_python_pipeline_code(dataset_facts: Dict[str, Any], inference_results: Dict[str, Any]) -> str:
    """
    Generates production-ready, clean Scikit-Learn + Pandas Python preprocessing script.
    """
    col_recs = inference_results.get("column_recommendations", {})
    cols = dataset_facts.get("columns", {})

    drop_cols = [c for c, r in col_recs.items() if r["should_drop"]]
    
    num_median_robust = []
    num_mean_standard = []
    cat_ohe = []
    cat_freq = []
    datetime_cols = []
    binary_cols = []

    for col, r in col_recs.items():
        if r["should_drop"]:
            continue
        
        c_fact = cols.get(col, {})
        itype = c_fact.get("inferred_type", "")

        if itype == "datetime":
            datetime_cols.append(col)
        elif itype == "boolean" or c_fact.get("is_binary"):
            binary_cols.append(col)
        elif "numerical" in itype:
            ns = c_fact.get("numeric_stats", {})
            if abs(ns.get("skewness", 0)) >= 0.8 or ns.get("outliers_iqr_pct", 0) >= 2.0:
                num_median_robust.append(col)
            else:
                num_mean_standard.append(col)
        elif "categorical" in itype:
            if c_fact.get("unique_count", 0) <= 10:
                cat_ohe.append(col)
            else:
                cat_freq.append(col)
        else:
            cat_ohe.append(col)

    code = f'''"""
=============================================================================
Datalysis AI Expert System - Production Preprocessing Pipeline
Generated automatically from mathematical heuristics & rule inference.
=============================================================================
"""

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, RobustScaler, OneHotEncoder


# ---------------------------------------------------------------------------
# 1. Custom Datetime Feature Extractor
# ---------------------------------------------------------------------------
class DatetimeFeatureExtractor(BaseEstimator, TransformerMixin):
    def __init__(self, datetime_cols):
        self.datetime_cols = datetime_cols

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        X_out = pd.DataFrame(index=X.index)
        for col in self.datetime_cols:
            dt = pd.to_datetime(X[col], errors='coerce')
            X_out[f"{{col}}_year"] = dt.dt.year
            X_out[f"{{col}}_month"] = dt.dt.month
            X_out[f"{{col}}_day"] = dt.dt.day
            X_out[f"{{col}}_dayofweek"] = dt.dt.dayofweek
            X_out[f"{{col}}_is_weekend"] = dt.dt.dayofweek.isin([5, 6]).astype(int)
            # Cyclical encodings
            X_out[f"{{col}}_sin_month"] = np.sin(2 * np.pi * dt.dt.month / 12.0)
            X_out[f"{{col}}_cos_month"] = np.cos(2 * np.pi * dt.dt.month / 12.0)
        return X_out.fillna(0)


# ---------------------------------------------------------------------------
# 2. Winsorization Outlier Clipper
# ---------------------------------------------------------------------------
class OutlierCapper(BaseEstimator, TransformerMixin):
    def __init__(self, lower_quantile=0.01, upper_quantile=0.99):
        self.lower_quantile = lower_quantile
        self.upper_quantile = upper_quantile
        self.bounds_ = {{}}

    def fit(self, X, y=None):
        X_df = pd.DataFrame(X)
        for col in X_df.columns:
            q_low = X_df[col].quantile(self.lower_quantile)
            q_high = X_df[col].quantile(self.upper_quantile)
            self.bounds_[col] = (q_low, q_high)
        return self

    def transform(self, X):
        X_df = pd.DataFrame(X).copy()
        for col, (q_low, q_high) in self.bounds_.items():
            X_df[col] = np.clip(X_df[col], q_low, q_high)
        return X_df.to_numpy()


# ---------------------------------------------------------------------------
# 3. Column Partitioning (Determined by Expert System Rules)
# ---------------------------------------------------------------------------
DROP_COLUMNS = {repr(drop_cols)}
NUMERIC_MEDIAN_ROBUST = {repr(num_median_robust)}
NUMERIC_MEAN_STANDARD = {repr(num_mean_standard)}
CATEGORICAL_OHE = {repr(cat_ohe)}
CATEGORICAL_HIGH_CARD = {repr(cat_freq)}
DATETIME_COLUMNS = {repr(datetime_cols)}
BINARY_COLUMNS = {repr(binary_cols)}


# ---------------------------------------------------------------------------
# 4. Pipeline Construction
# ---------------------------------------------------------------------------
def build_preprocessing_pipeline() -> ColumnTransformer:
    transformers = []

    # Pipeline A: Skewed / Outlier-heavy numericals (Median Impute + Robust Scaling)
    if NUMERIC_MEDIAN_ROBUST:
        num_median_pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="median", add_indicator=True)),
            ("capper", OutlierCapper(lower_quantile=0.01, upper_quantile=0.99)),
            ("scaler", RobustScaler())
        ])
        transformers.append(("num_skewed", num_median_pipe, NUMERIC_MEDIAN_ROBUST))

    # Pipeline B: Symmetric / Gaussian numericals (Mean Impute + Standard Scaling)
    if NUMERIC_MEAN_STANDARD:
        num_mean_pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="mean", add_indicator=True)),
            ("scaler", StandardScaler())
        ])
        transformers.append(("num_gaussian", num_mean_pipe, NUMERIC_MEAN_STANDARD))

    # Pipeline C: Low-cardinality categoricals (Constant token Impute + One-Hot)
    if CATEGORICAL_OHE:
        cat_pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="constant", fill_value="Missing")),
            ("onehot", OneHotEncoder(drop="first", handle_unknown="ignore", sparse_output=False))
        ])
        transformers.append(("cat_ohe", cat_pipe, CATEGORICAL_OHE))

    # Pipeline D: Binary indicators
    if BINARY_COLUMNS:
        bin_pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(drop="if_binary", handle_unknown="ignore", sparse_output=False))
        ])
        transformers.append(("binary", bin_pipe, BINARY_COLUMNS))

    # Construct overall ColumnTransformer
    preprocessor = ColumnTransformer(
        transformers=transformers,
        remainder="drop"  # Safely drops pruned/identifier/constant columns
    )

    return preprocessor


def clean_and_transform(df: pd.DataFrame) -> pd.DataFrame:
    """Convenience helper to apply end-to-end cleaning to raw pandas DataFrame."""
    # Step 1: Drop duplicate rows
    initial_rows = len(df)
    df_clean = df.drop_duplicates().copy()
    print(f"Dropped {{initial_rows - len(df_clean)}} duplicate rows.")

    # Step 2: Handle Datetime features if present
    if DATETIME_COLUMNS:
        dt_extractor = DatetimeFeatureExtractor(DATETIME_COLUMNS)
        dt_features = dt_extractor.transform(df_clean)
        df_clean = pd.concat([df_clean.drop(columns=DATETIME_COLUMNS), dt_features], axis=1)

    # Step 3: Fit & Transform through ColumnTransformer
    preprocessor = build_preprocessing_pipeline()
    feature_matrix = preprocessor.fit_transform(df_clean)
    
    print(f"Final Preprocessed Matrix Shape: {{feature_matrix.shape}}")
    return feature_matrix


if __name__ == "__main__":
    import sys
    print("Datalysis Expert Preprocessing Pipeline Initialized.")
    print(f"Columns to Prune: {{len(DROP_COLUMNS)}}")
    print(f"Skewed Features: {{len(NUMERIC_MEDIAN_ROBUST)}}")
    print(f"Gaussian Features: {{len(NUMERIC_MEAN_STANDARD)}}")
    print(f"Categorical Features: {{len(CATEGORICAL_OHE)}}")
    print("Call `clean_and_transform(df)` with your pandas DataFrame to run.")
'''
    return code
