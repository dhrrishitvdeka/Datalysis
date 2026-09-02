import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple


def execute_preprocessing_pipeline(
    df_raw: pd.DataFrame,
    dataset_facts: Dict[str, Any],
    inference_results: Dict[str, Any],
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Executes the recommended transformations directly on the DataFrame.
    Returns the transformed DataFrame and a before/after report.
    """
    df = df_raw.copy()
    col_recs = inference_results.get("column_recommendations", {})
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
            dt_s = pd.to_datetime(df[dt_col], errors="coerce")
            month = dt_s.dt.month.fillna(1).astype(int)
            df[f"{dt_col}_year"] = dt_s.dt.year.fillna(2000).astype(int)
            df[f"{dt_col}_month"] = month
            df[f"{dt_col}_day"] = dt_s.dt.day.fillna(1).astype(int)
            df[f"{dt_col}_dayofweek"] = dt_s.dt.dayofweek.fillna(0).astype(int)
            df[f"{dt_col}_is_weekend"] = dt_s.dt.dayofweek.isin([5, 6]).astype(int)
            df[f"{dt_col}_sin_month"] = np.sin(2 * np.pi * month / 12.0)
            df[f"{dt_col}_cos_month"] = np.cos(2 * np.pi * month / 12.0)
            df = df.drop(columns=[dt_col])
            steps_log.append(f"Decomposed datetime '{dt_col}' into calendar and cyclical components.")
        except Exception:
            pass

    # 4. Imputation
    knn_cols = []
    for col in list(df.columns):
        rec = col_recs.get(col)
        if not rec:
            continue
        imp = rec.get("imputation")
        if not imp or df[col].isna().sum() == 0:
            continue
        if imp.get("action") == "impute_knn_or_iterative":
            knn_cols.append(col)

    if knn_cols:
        numeric_neighbors = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
        if len(numeric_neighbors) >= 2:
            try:
                from sklearn.impute import KNNImputer

                imputer = KNNImputer(n_neighbors=5)
                imputed = imputer.fit_transform(df[numeric_neighbors])
                imputed_df = pd.DataFrame(imputed, columns=numeric_neighbors, index=df.index)
                for col in knn_cols:
                    if col in imputed_df.columns:
                        df[col] = imputed_df[col]
                steps_log.append(
                    f"KNN-imputed {len(knn_cols)} correlated numeric column(s): {', '.join(knn_cols)}"
                )
            except Exception:
                for col in knn_cols:
                    df[col] = df[col].fillna(df[col].median())
                steps_log.append(f"Fell back to median for KNN targets: {', '.join(knn_cols)}")
        else:
            for col in knn_cols:
                df[col] = df[col].fillna(df[col].median())

    for col in list(df.columns):
        rec = col_recs.get(col)
        if not rec:
            continue
        imp = rec.get("imputation")
        if not imp or df[col].isna().sum() == 0:
            continue
        action = imp.get("action")
        if action == "impute_knn_or_iterative":
            continue
        params = imp.get("parameters", {})

        if params.get("add_indicator"):
            df[f"{col}_was_missing"] = df[col].isna().astype(int)

        if action == "impute_median":
            fill_val = df[col].median()
            df[col] = df[col].fillna(fill_val)
            steps_log.append(f"Imputed '{col}' missing values with median ({round(float(fill_val), 2)}).")
        elif action == "impute_mean":
            fill_val = df[col].mean()
            df[col] = df[col].fillna(fill_val)
            steps_log.append(f"Imputed '{col}' missing values with mean ({round(float(fill_val), 2)}).")
        elif action == "impute_mode":
            mode_val = df[col].mode()
            fill_val = mode_val.iloc[0] if not mode_val.empty else "Unknown"
            df[col] = df[col].fillna(fill_val)
            steps_log.append(f"Imputed '{col}' missing values with mode ('{fill_val}').")
        elif action == "impute_constant":
            df[col] = df[col].fillna("Missing")
            steps_log.append(f"Imputed '{col}' missing values with 'Missing' category token.")
        else:
            if pd.api.types.is_numeric_dtype(df[col]):
                df[col] = df[col].fillna(df[col].median())
            else:
                df[col] = df[col].fillna("Missing")

    # 5. Outlier capping first, then power transforms
    _scale_order = {"mitigate_outliers": 0, "transform_log1p": 1, "transform_yeo_johnson": 1, "scale_standard": 2}
    for col in list(df.columns):
        rec = col_recs.get(col)
        if not rec or not pd.api.types.is_numeric_dtype(df[col]):
            continue
        scaled_steps = sorted(
            rec.get("scaling_and_outliers", []),
            key=lambda s: _scale_order.get(s.get("action"), 9),
        )
        for step in scaled_steps:
            action = step.get("action")
            if action == "mitigate_outliers":
                q01 = df[col].quantile(0.01)
                q99 = df[col].quantile(0.99)
                df[col] = df[col].clip(lower=q01, upper=q99)
                steps_log.append(f"Winsorized outliers in '{col}' to range [{round(float(q01), 2)}, {round(float(q99), 2)}].")
            elif action == "transform_log1p" and (df[col] >= 0).all():
                df[col] = np.log1p(df[col])
                steps_log.append(f"Applied Log1p transformation to positive skewed feature '{col}'.")
            elif action == "transform_yeo_johnson":
                try:
                    from sklearn.preprocessing import PowerTransformer

                    pt = PowerTransformer(method="yeo-johnson")
                    df[col] = pt.fit_transform(df[[col]]).ravel()
                    steps_log.append(f"Applied Yeo-Johnson power transform to '{col}'.")
                except Exception:
                    pass

    # 6. Binary integer mapping
    for col in list(df.columns):
        rec = col_recs.get(col)
        enc = rec.get("encoding") if rec else None
        if enc and enc.get("action") == "encode_binary" and col in df.columns:
            uniq = [v for v in df[col].dropna().unique()]
            mapping = {uniq[i]: i for i in range(min(2, len(uniq)))}
            df[col] = df[col].map(lambda v, m=mapping: m.get(v, 0)).astype(int)
            steps_log.append(f"Mapped binary feature '{col}' to 0/1 integers.")

    # 7. High-cardinality frequency encoding
    for col in list(df.columns):
        rec = col_recs.get(col)
        enc = rec.get("encoding") if rec else None
        if enc and enc.get("action") == "encode_frequency_or_target" and col in df.columns:
            freq = df[col].value_counts(normalize=True)
            df[col] = df[col].map(freq).astype(float)
            df[col] = df[col].fillna(0.0)
            steps_log.append(f"Frequency-encoded high-cardinality feature '{col}'.")

    # 8. Categorical One-Hot Encoding
    cat_to_encode = []
    for col in list(df.columns):
        rec = col_recs.get(col)
        enc = rec.get("encoding") if rec else None
        if enc and enc.get("action") == "encode_onehot" and col in df.columns:
            cat_to_encode.append(col)

    if cat_to_encode:
        df = pd.get_dummies(df, columns=cat_to_encode, drop_first=True, dtype=int)
        steps_log.append(f"One-Hot Encoded {len(cat_to_encode)} categorical features: {', '.join(cat_to_encode)}")

    # 9. Safety net: remaining missing cells
    leftover = int(df.isna().sum().sum())
    if leftover > 0:
        for col in df.columns:
            if df[col].isna().sum() == 0:
                continue
            if pd.api.types.is_numeric_dtype(df[col]):
                df[col] = df[col].fillna(df[col].median() if df[col].notna().any() else 0)
            else:
                mode_val = df[col].mode()
                df[col] = df[col].fillna(mode_val.iloc[0] if not mode_val.empty else "Missing")
        steps_log.append(f"Filled {leftover} residual missing cell(s) with column-wise median/mode.")

    final_rows = len(df)
    final_cols = len(df.columns)
    final_missing = int(df.isna().sum().sum())

    preview = json_safe_preview(df.head(30))

    report = {
        "initial_shape": [initial_rows, initial_cols],
        "final_shape": [final_rows, final_cols],
        "initial_missing_cells": initial_missing,
        "final_missing_cells": final_missing,
        "steps_executed": steps_log,
        "preview": preview,
    }

    return df, report


def json_safe_preview(df: pd.DataFrame):
    import json

    return json.loads(df.to_json(orient="records"))
