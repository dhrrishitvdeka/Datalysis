import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple, Optional


def execute_preprocessing_pipeline(
    df_raw: pd.DataFrame,
    dataset_facts: Dict[str, Any],
    inference_results: Dict[str, Any],
    recipe_overrides: Optional[Dict[str, Any]] = None,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Executes the recommended or customized transformations directly on the DataFrame.
    Returns the transformed DataFrame and a comprehensive before/after report.
    """
    df = df_raw.copy()
    col_recs = inference_results.get("column_recommendations", {})
    steps_log = []

    # Parse recipe overrides if provided
    overrides: Dict[str, Any] = {}
    should_drop_dups = True
    if recipe_overrides:
        if isinstance(recipe_overrides, dict):
            overrides = recipe_overrides.get("column_overrides", {}) or {}
            should_drop_dups = recipe_overrides.get("drop_duplicates", True)
            if should_drop_dups is None:
                should_drop_dups = True

    initial_rows = len(df)
    initial_cols = len(df.columns)
    initial_missing = int(df.isna().sum().sum())

    # 1. Drop Duplicates
    if should_drop_dups:
        dup_count = int(df.duplicated().sum())
        if dup_count > 0:
            df = df.drop_duplicates()
            steps_log.append(f"Dropped {dup_count} exact duplicate rows.")

    # 2. Prune Columns flagged for removal (with user override support)
    drop_cols = []
    for c in list(df.columns):
        c_override = overrides.get(c, {})
        if isinstance(c_override, dict) and "drop" in c_override and c_override["drop"] is not None:
            if c_override["drop"]:
                drop_cols.append(c)
        else:
            rec = col_recs.get(c, {})
            if rec.get("should_drop"):
                drop_cols.append(c)

    if drop_cols:
        df = df.drop(columns=[c for c in drop_cols if c in df.columns])
        steps_log.append(f"Pruned {len(drop_cols)} column(s): {', '.join(drop_cols)}")

    # 3. Handle Datetime Features (enhanced for IoT, telemetry, and time-of-day)
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

            # Telemetry/IoT time-of-day enhancement
            c_fact = dataset_facts.get("columns", {}).get(dt_col, {})
            has_time = c_fact.get("datetime_stats", {}).get("has_time", False)
            if has_time:
                hour = dt_s.dt.hour.fillna(0).astype(int)
                df[f"{dt_col}_hour"] = hour
                df[f"{dt_col}_sin_hour"] = np.sin(2 * np.pi * hour / 24.0)
                df[f"{dt_col}_cos_hour"] = np.cos(2 * np.pi * hour / 24.0)
                df[f"{dt_col}_is_night"] = ((hour < 6) | (hour > 20)).astype(int)
                df[f"{dt_col}_minute"] = dt_s.dt.minute.fillna(0).astype(int)

            df = df.drop(columns=[dt_col])
            steps_log.append(f"Decomposed datetime '{dt_col}' into calendar and cyclical components.")
        except Exception:
            pass

    # 4. Imputation Handling
    # Check for row-drop override first
    for col in list(df.columns):
        c_override = overrides.get(col, {})
        if isinstance(c_override, dict) and c_override.get("imputation") == "drop_rows":
            null_count = int(df[col].isna().sum())
            if null_count > 0:
                df = df.dropna(subset=[col])
                steps_log.append(f"Dropped {null_count} row(s) with missing values in '{col}'.")

    # KNN Imputation
    knn_cols = []
    for col in list(df.columns):
        if df[col].isna().sum() == 0:
            continue
        c_override = overrides.get(col, {})
        rec = col_recs.get(col, {})
        imp = rec.get("imputation") or {}
        override_imp = c_override.get("imputation") if isinstance(c_override, dict) else None
        
        effective_imp = imp.get("action") if (override_imp is None or override_imp == "auto") else override_imp
        if effective_imp in ["knn", "impute_knn_or_iterative"]:
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
                steps_log.append(f"KNN-imputed {len(knn_cols)} correlated numeric column(s): {', '.join(knn_cols)}")
            except Exception:
                for col in knn_cols:
                    df[col] = df[col].fillna(df[col].median() if df[col].notna().any() else 0)
                steps_log.append(f"Fell back to median for KNN targets: {', '.join(knn_cols)}")
        else:
            for col in knn_cols:
                df[col] = df[col].fillna(df[col].median() if df[col].notna().any() else 0)

    # Standard Imputation per column
    for col in list(df.columns):
        if col in knn_cols or df[col].isna().sum() == 0:
            continue

        c_override = overrides.get(col, {})
        rec = col_recs.get(col, {})
        imp = rec.get("imputation") or {}
        override_imp = c_override.get("imputation") if isinstance(c_override, dict) else None

        if override_imp == "none":
            continue

        effective_imp = imp.get("action") if (override_imp is None or override_imp == "auto") else override_imp
        params = imp.get("parameters", {})

        if params.get("add_indicator"):
            df[f"{col}_was_missing"] = df[col].isna().astype(int)

        if effective_imp in ["impute_median", "median"]:
            fill_val = df[col].median() if df[col].notna().any() else 0
            df[col] = df[col].fillna(fill_val)
            steps_log.append(f"Imputed '{col}' missing values with median ({round(float(fill_val), 2)}).")
        elif effective_imp in ["impute_mean", "mean"]:
            fill_val = df[col].mean() if df[col].notna().any() else 0
            df[col] = df[col].fillna(fill_val)
            steps_log.append(f"Imputed '{col}' missing values with mean ({round(float(fill_val), 2)}).")
        elif effective_imp in ["impute_mode", "mode"]:
            mode_val = df[col].mode()
            fill_val = mode_val.iloc[0] if not mode_val.empty else ("Unknown" if not pd.api.types.is_numeric_dtype(df[col]) else 0)
            df[col] = df[col].fillna(fill_val)
            steps_log.append(f"Imputed '{col}' missing values with mode ('{fill_val}').")
        elif effective_imp in ["impute_constant", "constant"]:
            const_val = c_override.get("impute_value") if isinstance(c_override, dict) else None
            if const_val is None:
                const_val = 0 if pd.api.types.is_numeric_dtype(df[col]) else "Missing"
            df[col] = df[col].fillna(const_val)
            steps_log.append(f"Imputed '{col}' missing values with constant '{const_val}'.")
        else:
            if pd.api.types.is_numeric_dtype(df[col]):
                df[col] = df[col].fillna(df[col].median() if df[col].notna().any() else 0)
            else:
                df[col] = df[col].fillna("Missing")

    # 5. Outlier Capping and Scaling (Decoupled execution)
    for col in list(df.columns):
        if not pd.api.types.is_numeric_dtype(df[col]):
            continue

        c_override = overrides.get(col, {})
        rec = col_recs.get(col, {})
        override_outliers = c_override.get("outliers") if isinstance(c_override, dict) else None
        override_scaling = c_override.get("scaling") if isinstance(c_override, dict) else None

        scaling_and_outlier_steps = rec.get("scaling_and_outliers", [])
        rule_outlier_step = next((s for s in scaling_and_outlier_steps if s.get("action") == "mitigate_outliers"), None)
        rule_scaling_steps = [s for s in scaling_and_outlier_steps if s.get("action") != "mitigate_outliers"]

        # 5a. Outlier mitigation
        effective_outliers = override_outliers
        if effective_outliers is None or effective_outliers == "auto":
            effective_outliers = "winsorize" if rule_outlier_step else "none"

        if effective_outliers == "winsorize":
            q01 = df[col].quantile(0.01)
            q99 = df[col].quantile(0.99)
            df[col] = df[col].clip(lower=q01, upper=q99)
            steps_log.append(f"Winsorized outliers in '{col}' to range [{round(float(q01), 2)}, {round(float(q99), 2)}].")
        elif effective_outliers == "clip_iqr":
            q25 = df[col].quantile(0.25)
            q75 = df[col].quantile(0.75)
            iqr = q75 - q25
            low_bound, up_bound = q25 - 1.5 * iqr, q75 + 1.5 * iqr
            df[col] = df[col].clip(lower=low_bound, upper=up_bound)
            steps_log.append(f"Clipped IQR outliers in '{col}' to [{round(float(low_bound), 2)}, {round(float(up_bound), 2)}].")
        elif effective_outliers == "zscore":
            mean, std = df[col].mean(), df[col].std()
            if std > 0:
                low_bound, up_bound = mean - 3 * std, mean + 3 * std
                df[col] = df[col].clip(lower=low_bound, upper=up_bound)
                steps_log.append(f"Z-score clipped '{col}' within 3 standard deviations.")

        # 5b. Scaling and power transforms
        if override_scaling is not None and override_scaling != "auto":
            if override_scaling == "standard":
                try:
                    from sklearn.preprocessing import StandardScaler
                    scaler = StandardScaler()
                    df[col] = scaler.fit_transform(df[[col]]).ravel()
                except Exception:
                    mean, std = float(df[col].mean()), float(df[col].std())
                    df[col] = (df[col] - mean) / (std if std > 0 else 1.0)
                steps_log.append(f"Standardized '{col}' with StandardScaler.")
            elif override_scaling == "robust":
                try:
                    from sklearn.preprocessing import RobustScaler
                    scaler = RobustScaler()
                    df[col] = scaler.fit_transform(df[[col]]).ravel()
                except Exception:
                    q25, q75 = float(df[col].quantile(0.25)), float(df[col].quantile(0.75))
                    iqr = q75 - q25
                    med = float(df[col].median())
                    df[col] = (df[col] - med) / (iqr if iqr > 0 else 1.0)
                steps_log.append(f"Scaled '{col}' with RobustScaler.")
            elif override_scaling == "log1p" and (df[col] >= 0).all():
                df[col] = np.log1p(df[col])
                steps_log.append(f"Applied Log1p transform to '{col}'.")
            elif override_scaling == "none":
                pass
        else:
            # Auto / None: apply recommended rule scaling steps
            for step in rule_scaling_steps:
                action = step.get("action")
                if action == "transform_log1p" and (df[col] >= 0).all():
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
                elif action == "scale_standard":
                    try:
                        from sklearn.preprocessing import StandardScaler
                        scaler = StandardScaler()
                        df[col] = scaler.fit_transform(df[[col]]).ravel()
                    except Exception:
                        mean, std = float(df[col].mean()), float(df[col].std())
                        df[col] = (df[col] - mean) / (std if std > 0 else 1.0)
                    steps_log.append(f"Standardized '{col}' with StandardScaler (mean=0, std=1).")

    # 6. Binary and Categorical Encodings
    cat_to_encode = []
    for col in list(df.columns):
        c_override = overrides.get(col, {})
        override_enc = c_override.get("encoding") if isinstance(c_override, dict) else None
        rec = col_recs.get(col, {})
        enc = rec.get("encoding") if rec else None

        if override_enc == "none":
            continue

        selected_enc = (enc.get("action") if enc else None) if (override_enc is None or override_enc == "auto") else override_enc

        if selected_enc in ["encode_binary", "binary"] and col in df.columns:
            uniq = [v for v in df[col].dropna().unique()]
            mapping = {uniq[i]: i for i in range(min(2, len(uniq)))}
            df[col] = df[col].map(lambda v, m=mapping: m.get(v, 0)).astype(int)
            steps_log.append(f"Mapped binary feature '{col}' to 0/1 integers.")
        elif selected_enc in ["encode_frequency_or_target", "frequency"] and col in df.columns:
            freq = df[col].value_counts(normalize=True)
            df[col] = df[col].map(freq).astype(float)
            df[col] = df[col].fillna(0.0)
            steps_log.append(f"Frequency-encoded high-cardinality feature '{col}'.")
        elif selected_enc in ["encode_ordinal", "ordinal"] and col in df.columns:
            categories = list(df[col].dropna().unique())
            ord_map = {cat: idx for idx, cat in enumerate(categories)}
            df[col] = df[col].map(lambda v, m=ord_map: m.get(v, 0)).astype(int)
            steps_log.append(f"Ordinal-encoded feature '{col}'.")
        elif selected_enc in ["encode_onehot", "onehot"] and col in df.columns:
            cat_to_encode.append(col)

    if cat_to_encode:
        df = pd.get_dummies(df, columns=cat_to_encode, drop_first=True, dtype=int)
        steps_log.append(f"One-Hot Encoded {len(cat_to_encode)} categorical features: {', '.join(cat_to_encode)}")

    # 7. Residual Missing Cells Safety Net
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

    preview = json_safe_preview(df.head(50))

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
    return json.loads(df.to_json(orient="records", date_format="iso"))
