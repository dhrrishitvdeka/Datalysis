import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple

def execute_preprocessing_pipeline(df_raw: pd.DataFrame, dataset_facts: Dict[str, Any], inference_results: Dict[str, Any]) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Executes the recommended transformations directly on the DataFrame.
    Returns:
      - Transformed DataFrame
      - Transformation report (metrics before/after and step log)
    """
    df = df_raw.copy()
    col_recs = inference_results.get("column_recommendations", {})
    cols = dataset_facts.get("columns", {})
    steps_log = []

    initial_rows = len(df)
    initial_cols = len(df.columns)
    initial_missing = int(df.isna().sum().sum())

    # 1. Drop Duplicates
    dup_count = int(df.duplicated().sum())
    if dup_count > 0:
        df = df.drop_duplicates()
        steps_log.append(f"Dropped {dup_count} exact duplicate rows.")

    # 2. Prune Columns flagged for removal (Zero-variance, ID leakage, >70% missing)
    drop_cols = [c for c, r in col_recs.items() if r.get("should_drop") and c in df.columns]
    if drop_cols:
        df = df.drop(columns=drop_cols)
        steps_log.append(f"Pruned {len(drop_cols)} uninformative/leaky columns: {', '.join(drop_cols)}")

    # 3. Handle Datetime Features
    datetime_cols = [c for c, r in col_recs.items() if r.get("datetime_engineering") and c in df.columns]
    for dt_col in datetime_cols:
        try:
            dt_s = pd.to_datetime(df[dt_col], errors='coerce')
            df[f"{dt_col}_year"] = dt_s.dt.year.fillna(2000).astype(int)
            df[f"{dt_col}_month"] = dt_s.dt.month.fillna(1).astype(int)
            df[f"{dt_col}_day"] = dt_s.dt.day.fillna(1).astype(int)
            df[f"{dt_col}_dayofweek"] = dt_s.dt.dayofweek.fillna(0).astype(int)
            df[f"{dt_col}_is_weekend"] = dt_s.dt.dayofweek.isin([5, 6]).astype(int)
            df[f"{dt_col}_sin_month"] = np.sin(2 * np.pi * df[f"{dt_col}_month"] / 12.0)
            df[f"{dt_col}_cos_month"] = np.cos(2 * np.pi * df[f"{dt_col}_month"] / 12.0)
            df = df.drop(columns=[dt_col])
            steps_log.append(f"Decomposed datetime '{dt_col}' into calendar and cyclical components.")
        except Exception:
            pass

    # 4. Imputation
    for col in list(df.columns):
        if col in col_recs:
            r = col_recs[col]
            imp = r.get("imputation")
            if imp and df[col].isna().sum() > 0:
                action = imp.get("action")
                params = imp.get("parameters", {})
                
                # Add missing indicator if missingness was notable
                if params.get("add_indicator"):
                    df[f"{col}_was_missing"] = df[col].isna().astype(int)

                if action == "impute_median":
                    fill_val = df[col].median()
                    df[col] = df[col].fillna(fill_val)
                    steps_log.append(f"Imputed '{col}' missing values with median ({round(fill_val, 2)}).")
                elif action == "impute_mean":
                    fill_val = df[col].mean()
                    df[col] = df[col].fillna(fill_val)
                    steps_log.append(f"Imputed '{col}' missing values with mean ({round(fill_val, 2)}).")
                elif action == "impute_mode":
                    mode_val = df[col].mode()
                    fill_val = mode_val.iloc[0] if not mode_val.empty else "Unknown"
                    df[col] = df[col].fillna(fill_val)
                    steps_log.append(f"Imputed '{col}' missing values with mode ('{fill_val}').")
                elif action == "impute_constant":
                    df[col] = df[col].fillna("Missing")
                    steps_log.append(f"Imputed '{col}' missing values with 'Missing' category token.")
                else:
                    # Fallback
                    if pd.api.types.is_numeric_dtype(df[col]):
                        df[col] = df[col].fillna(df[col].median())
                    else:
                        df[col] = df[col].fillna("Missing")

    # 5. Outlier Capping (Winsorization) & Skew Transformation
    for col in list(df.columns):
        if col in col_recs:
            r = col_recs[col]
            for step in r.get("scaling_and_outliers", []):
                action = step.get("action")
                if action == "mitigate_outliers" and pd.api.types.is_numeric_dtype(df[col]):
                    q01 = df[col].quantile(0.01)
                    q99 = df[col].quantile(0.99)
                    df[col] = df[col].clip(lower=q01, upper=q99)
                    steps_log.append(f"Winsorized outliers in '{col}' to range [{round(q01, 2)}, {round(q99, 2)}].")
                elif action == "transform_log1p" and pd.api.types.is_numeric_dtype(df[col]) and (df[col] >= 0).all():
                    df[col] = np.log1p(df[col])
                    steps_log.append(f"Applied Log1p transformation to positive skewed feature '{col}'.")

    # 6. Categorical One-Hot Encoding
    cat_to_encode = []
    for col in list(df.columns):
        if col in col_recs:
            r = col_recs[col]
            enc = r.get("encoding")
            if enc and enc.get("action") == "encode_onehot" and col in df.columns:
                cat_to_encode.append(col)

    if cat_to_encode:
        df = pd.get_dummies(df, columns=cat_to_encode, drop_first=True, dtype=int)
        steps_log.append(f"One-Hot Encoded {len(cat_to_encode)} categorical features: {', '.join(cat_to_encode)}")

    final_rows = len(df)
    final_cols = len(df.columns)
    final_missing = int(df.isna().sum().sum())

    report = {
        "initial_shape": [initial_rows, initial_cols],
        "final_shape": [final_rows, final_cols],
        "initial_missing_cells": initial_missing,
        "final_missing_cells": final_missing,
        "steps_executed": steps_log,
        "preview": df.head(30).to_dict(orient="records")
    }

    return df, report
