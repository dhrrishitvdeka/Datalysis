"""
Supervised Target Mode Analyzer for Datalysis
Detects problem type, evaluates class imbalance, checks for target leakage,
and computes feature importance / mutual information ranking against target.
"""

from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd


def analyze_target_variable(df: pd.DataFrame, target_col: str) -> Dict[str, Any]:
    if target_col not in df.columns:
        raise ValueError(f"Column '{target_col}' not found in dataset.")

    y = df[target_col]
    clean_mask = y.notna()
    y_clean = y[clean_mask]
    n_unique = int(y_clean.nunique())

    if n_unique <= 1:
        raise ValueError(f"Target column '{target_col}' is constant ({n_unique} unique value). Cannot perform supervised analysis.")

    # 1. Detect task type
    is_numeric = pd.api.types.is_numeric_dtype(y_clean)
    if n_unique == 2:
        task_type = "binary_classification"
    elif is_numeric and n_unique > 20:
        task_type = "regression"
    else:
        task_type = "multiclass_classification"

    # 2. Class imbalance & distributions
    class_imbalance: Optional[Dict[str, Any]] = None
    if "classification" in task_type:
        val_counts = y_clean.value_counts()
        total = len(y_clean)
        distribution = {}
        for k, v in val_counts.items():
            distribution[str(k)] = {
                "count": int(v),
                "percentage": round(float((v / total) * 100), 2)
            }

        probs = (val_counts / total).to_numpy()
        gini = float(1.0 - np.sum(probs ** 2))
        entropy = float(-np.sum(probs * np.log2(probs + 1e-12)))
        min_pct = float(val_counts.min() / total * 100)

        imbalance_severity = "NONE"
        imbalance_notes = "Classes are relatively balanced."
        if min_pct < 5.0:
            imbalance_severity = "SEVERE"
            imbalance_notes = f"Extreme class imbalance (minority class is {min_pct:.1f}%). Strongly recommend SMOTE, class_weight='balanced', or PR-AUC metric."
        elif min_pct < 15.0:
            imbalance_severity = "MODERATE"
            imbalance_notes = f"Moderate class imbalance (minority class is {min_pct:.1f}%). Consider stratified sampling, focal loss, or class weighting."

        class_imbalance = {
            "distribution": distribution,
            "minority_percentage": round(min_pct, 2),
            "gini_impurity": round(gini, 4),
            "entropy": round(entropy, 4),
            "imbalance_severity": imbalance_severity,
            "recommendation": imbalance_notes
        }

    # 3. Feature Importance & Target Leakage
    feature_cols = [c for c in df.columns if c != target_col]
    feature_importances: List[Dict[str, Any]] = []
    leakage_warnings: List[str] = []

    valid_df = df[clean_mask].copy()

    # Target encoding for MI & evaluation
    if "classification" in task_type:
        categories = list(y_clean.unique())
        y_encoded = y_clean.map({c: i for i, c in enumerate(categories)}).astype(int)
        # Compute Shannon entropy of target in nats (base e) for mutual information normalization
        probs = y_clean.value_counts(normalize=True).to_numpy()
        h_y_nats = float(-np.sum(probs * np.log(probs + 1e-12)))
    else:
        y_encoded = pd.to_numeric(y_clean, errors='coerce').fillna(0.0)
        h_y_nats = 0.0

    # Prepare X matrix encoding both numerical and categorical features
    X_encoded = pd.DataFrame(index=valid_df.index)
    discrete_mask = []
    for c in feature_cols:
        if pd.api.types.is_numeric_dtype(valid_df[c]):
            med = valid_df[c].median()
            fill_val = med if (med is not None and not np.isnan(med)) else 0.0
            X_encoded[c] = valid_df[c].fillna(fill_val)
            discrete_mask.append(False)
        else:
            X_encoded[c] = pd.Categorical(valid_df[c].fillna("__MISSING__")).codes
            discrete_mask.append(True)

    # Compute correlations where applicable
    correlations: Dict[str, float] = {}
    for c in feature_cols:
        try:
            if pd.api.types.is_numeric_dtype(valid_df[c]) and is_numeric:
                corr = float(valid_df[c].corr(valid_df[target_col]))
                if not np.isnan(corr):
                    correlations[c] = round(corr, 3)
            elif valid_df[c].nunique() == 2 and n_unique == 2:
                # Binary association
                c_binary = pd.Categorical(valid_df[c]).codes
                corr = float(pd.Series(c_binary, index=valid_df.index).corr(y_encoded))
                if not np.isnan(corr):
                    correlations[c] = round(corr, 3)
        except Exception:
            pass

    # Compute Mutual Information across all feature columns
    mi_scores: Dict[str, float] = {}
    if not X_encoded.empty and len(X_encoded) >= 5:
        try:
            if "classification" in task_type:
                from sklearn.feature_selection import mutual_info_classif
                scores = mutual_info_classif(X_encoded, y_encoded, discrete_features=discrete_mask, random_state=42)
            else:
                from sklearn.feature_selection import mutual_info_regression
                scores = mutual_info_regression(X_encoded, y_encoded, discrete_features=discrete_mask, random_state=42)

            for c, s in zip(feature_cols, scores):
                mi_scores[c] = round(float(s), 4)
        except Exception:
            pass

    # Process all features
    for c in feature_cols:
        score = mi_scores.get(c, 0.0)
        corr = correlations.get(c, None)

        # Fallback score from absolute correlation if MI not computed
        if score == 0.0 and corr is not None:
            score = round(abs(corr), 4)

        leakage_risk = False
        if corr is not None and abs(corr) >= 0.95:
            leakage_risk = True
            leakage_warnings.append(f"Feature '{c}' has near-perfect correlation ({corr:+.3f}) with target '{target_col}'. High risk of data leakage.")
        elif "classification" in task_type and h_y_nats > 0 and (score / h_y_nats) >= 0.95:
            leakage_risk = True
            leakage_warnings.append(f"Feature '{c}' explains {min(100.0, round((score / h_y_nats) * 100, 1))}% of target '{target_col}' entropy (MI: {score:.3f}). High risk of data leakage.")
        elif score >= 0.90:
            leakage_risk = True
            leakage_warnings.append(f"Feature '{c}' has extremely high mutual information ({score:.3f}) with target '{target_col}'. High risk of data leakage.")

        feature_importances.append({
            "feature": c,
            "score": score,
            "correlation": corr,
            "leakage_risk": leakage_risk
        })

    # Sort descending by predictive score
    feature_importances.sort(key=lambda x: x["score"], reverse=True)

    # Overall recommendation
    if "classification" in task_type:
        rec = f"Target '{target_col}' detected as {task_type.replace('_', ' ').title()} with {n_unique} classes. "
        if class_imbalance and class_imbalance["imbalance_severity"] != "NONE":
            rec += class_imbalance["recommendation"]
        else:
            rec += "Classes are balanced. Standard accuracy, F1, and log-loss metrics are suitable."
    else:
        rec = f"Target '{target_col}' detected as Continuous Regression ({n_unique} distinct numerical values). RMSE, MAE, and R-squared evaluation metrics recommended."

    return {
        "target": target_col,
        "task_type": task_type,
        "unique_count": n_unique,
        "class_imbalance": class_imbalance,
        "feature_importances": feature_importances,
        "leakage_warnings": leakage_warnings,
        "recommendation": rec
    }
