from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional, Callable

@dataclass
class ProductionRule:
    rule_id: str
    name: str
    category: str  # IMPUTATION, ENCODING, SCALING_OUTLIERS, FILTERING_LEAKAGE, DATETIME, DATASET_LEVEL
    severity: str  # CRITICAL, WARNING, OPTIMIZATION, INFO
    confidence: float  # 0.0 to 1.0
    description: str
    condition: Callable[[Dict[str, Any], Dict[str, Any]], bool]
    action_type: str
    generate_recommendation: Callable[[Dict[str, Any], Dict[str, Any]], Dict[str, Any]]

# Production Rules Database
RULES: List[ProductionRule] = [
    # ----------------------------------------------------
    # IMPUTATION RULES (R-IMP)
    # ----------------------------------------------------
    ProductionRule(
        rule_id="R-IMP-01",
        name="Excessive Missingness Column Pruning",
        category="IMPUTATION",
        severity="CRITICAL",
        confidence=0.96,
        description="Drops columns where missing values exceed 70%, avoiding synthetic variance injection.",
        condition=lambda col_fact, ds_fact: col_fact["missing_pct"] >= 70.0,
        action_type="drop_column",
        generate_recommendation=lambda col_fact, ds_fact: {
            "action": "drop_column",
            "technique": "Drop Column",
            "parameters": {},
            "rationale": f"Column '{col_fact['name']}' has {col_fact['missing_pct']}% missing values. Imputing over 70% synthetic data introduces extreme estimation variance and false confidence. Dropping the column is mathematically prudent unless mandatory business knowledge dictates otherwise.",
            "impact": "Eliminates high-noise, sparsely populated dimension."
        }
    ),
    ProductionRule(
        rule_id="R-IMP-02",
        name="Skewed / Outlier-Prone Numerical Median Imputation",
        category="IMPUTATION",
        severity="WARNING",
        confidence=0.92,
        description="Recommends median imputation for skewed numerical data with missing values to resist tail pull.",
        condition=lambda col_fact, ds_fact: (
            0 < col_fact["missing_pct"] < 70.0 and
            col_fact.get("numeric_stats") is not None and
            (abs(col_fact["numeric_stats"]["skewness"]) >= 0.8 or col_fact["numeric_stats"]["outliers_iqr_pct"] >= 2.0)
        ),
        action_type="impute_median",
        generate_recommendation=lambda col_fact, ds_fact: {
            "action": "impute_median",
            "technique": "Median Imputer + Missing Indicator",
            "parameters": {"add_indicator": col_fact["missing_pct"] >= 3.0, "value": col_fact["numeric_stats"]["median"]},
            "rationale": f"Column '{col_fact['name']}' has {col_fact['missing_pct']}% missing values with significant skewness ({col_fact['numeric_stats']['skewness']}) and/or {col_fact['numeric_stats']['outliers_iqr_count']} outliers. Mean imputation would be heavily pulled by extreme tail values. Median imputation preserves the non-parametric central tendency.",
            "impact": "Robust central imputation without skew distortion."
        }
    ),
    ProductionRule(
        rule_id="R-IMP-03",
        name="Symmetric Gaussian Numerical Mean Imputation",
        category="IMPUTATION",
        severity="INFO",
        confidence=0.88,
        description="Recommends mean imputation for approximately symmetric, normally distributed numerical features.",
        condition=lambda col_fact, ds_fact: (
            0 < col_fact["missing_pct"] < 70.0 and
            col_fact.get("numeric_stats") is not None and
            abs(col_fact["numeric_stats"]["skewness"]) < 0.8 and
            col_fact["numeric_stats"]["outliers_iqr_pct"] < 2.0
        ),
        action_type="impute_mean",
        generate_recommendation=lambda col_fact, ds_fact: {
            "action": "impute_mean",
            "technique": "Mean Imputer",
            "parameters": {"add_indicator": col_fact["missing_pct"] >= 3.0, "value": col_fact["numeric_stats"]["mean"]},
            "rationale": f"Column '{col_fact['name']}' has {col_fact['missing_pct']}% missing values and displays near-symmetric Gaussian characteristics (skewness = {col_fact['numeric_stats']['skewness']}). Mean imputation provides the minimum-variance unbiased estimate under normality.",
            "impact": "Preserves sample mean with minimum estimation error."
        }
    ),
    ProductionRule(
        rule_id="R-IMP-04",
        name="Multivariate Covariance Imputation (MICE/KNN)",
        category="IMPUTATION",
        severity="OPTIMIZATION",
        confidence=0.85,
        description="Recommends MICE / KNN imputation when a missing numeric column correlates strongly with complete peers.",
        condition=lambda col_fact, ds_fact: (
            3.0 <= col_fact["missing_pct"] <= 40.0 and
            col_fact.get("numeric_stats") is not None and
            any(
                (p["feature_a"] == col_fact["name"] or p["feature_b"] == col_fact["name"]) and p["abs_correlation"] >= 0.65
                for p in ds_fact.get("high_correlation_pairs", [])
            )
        ),
        action_type="impute_knn_or_iterative",
        generate_recommendation=lambda col_fact, ds_fact: {
            "action": "impute_knn_or_iterative",
            "technique": "IterativeImputer (MICE) or KNNImputer (k=5)",
            "parameters": {"n_neighbors": 5},
            "rationale": f"Feature '{col_fact['name']}' exhibits strong linear correlation with other features in the dataset. Univariate imputation (mean/median) collapses variance; multivariate iterative imputation (MICE) reconstructs values conditional on correlated predictors.",
            "impact": "Preserves covariance structure and feature inter-relationships."
        }
    ),
    ProductionRule(
        rule_id="R-IMP-05",
        name="Low-Missingness Categorical Mode Imputation",
        category="IMPUTATION",
        severity="INFO",
        confidence=0.90,
        description="Recommends most frequent (mode) imputation when categorical missingness is below 5%.",
        condition=lambda col_fact, ds_fact: (
            0 < col_fact["missing_pct"] < 5.0 and
            col_fact["inferred_type"] in ["categorical_nominal", "categorical_ordinal", "boolean"]
        ),
        action_type="impute_mode",
        generate_recommendation=lambda col_fact, ds_fact: {
            "action": "impute_mode",
            "technique": "Mode (Most Frequent) Imputer",
            "parameters": {"value": col_fact.get("categorical_stats", {}).get("mode_category", "Unknown")},
            "rationale": f"Categorical feature '{col_fact['name']}' has only {col_fact['missing_pct']}% missing values. Imputing with the dominant mode ('{col_fact.get('categorical_stats', {}).get('mode_category')}') introduces negligible bias while maintaining complete rows.",
            "impact": "Quick, robust imputation with minimal distortion to class proportions."
        }
    ),
    ProductionRule(
        rule_id="R-IMP-06",
        name="Moderate/High Categorical Dedicated Constant Level",
        category="IMPUTATION",
        severity="WARNING",
        confidence=0.93,
        description="Recommends a separate 'Missing' level for categoricals with >= 5% missingness.",
        condition=lambda col_fact, ds_fact: (
            5.0 <= col_fact["missing_pct"] < 70.0 and
            col_fact["inferred_type"] in ["categorical_nominal", "categorical_ordinal", "free_text"]
        ),
        action_type="impute_constant",
        generate_recommendation=lambda col_fact, ds_fact: {
            "action": "impute_constant",
            "technique": "Constant Token Imputer ('Missing')",
            "parameters": {"fill_value": "Missing"},
            "rationale": f"Column '{col_fact['name']}' has {col_fact['missing_pct']}% missingness. Imputing with the mode would artificially inflate that class. Introducing an explicit 'Missing' category treats the unobserved status as an informative signal.",
            "impact": "Preserves missingness as an independent categorical state."
        }
    ),

    # ----------------------------------------------------
    # ENCODING RULES (R-ENC)
    # ----------------------------------------------------
    ProductionRule(
        rule_id="R-ENC-01",
        name="Binary Feature Integer Mapping",
        category="ENCODING",
        severity="INFO",
        confidence=0.98,
        description="Maps binary 2-state categorical features directly to 0/1 integers.",
        condition=lambda col_fact, ds_fact: (
            col_fact["is_binary"] and
            col_fact["inferred_type"] in ["boolean", "categorical_nominal"] and
            not col_fact["is_constant"]
        ),
        action_type="encode_binary",
        generate_recommendation=lambda col_fact, ds_fact: {
            "action": "encode_binary",
            "technique": "Binary Integer Mapping (0/1)",
            "parameters": {"mapping": {str(s): i for i, s in enumerate(col_fact.get("sample_values", [])[:2])}},
            "rationale": f"Feature '{col_fact['name']}' has exactly 2 distinct classes. Mapping to binary integers (0 and 1) adds zero dimensional overhead and is universally compatible with all ML algorithms.",
            "impact": "Zero dimensionality growth, compact representation."
        }
    ),
    ProductionRule(
        rule_id="R-ENC-02",
        name="Low-Cardinality One-Hot Encoding",
        category="ENCODING",
        severity="INFO",
        confidence=0.95,
        description="Recommends One-Hot Encoding for nominal categoricals with 3 to 10 unique classes.",
        condition=lambda col_fact, ds_fact: (
            3 <= col_fact["unique_count"] <= 10 and
            col_fact["inferred_type"] == "categorical_nominal" and
            not col_fact["is_identifier"]
        ),
        action_type="encode_onehot",
        generate_recommendation=lambda col_fact, ds_fact: {
            "action": "encode_onehot",
            "technique": "One-Hot Encoding (OHE)",
            "parameters": {"drop": "first", "handle_unknown": "ignore"},
            "rationale": f"Feature '{col_fact['name']}' has {col_fact['unique_count']} discrete nominal categories. One-Hot Encoding avoids false ordinal ordering while only generating {col_fact['unique_count'] - 1} dummy indicators.",
            "impact": "Provides linear independence without distance bias."
        }
    ),
    ProductionRule(
        rule_id="R-ENC-03",
        name="High-Cardinality Target or Frequency Encoding",
        category="ENCODING",
        severity="WARNING",
        confidence=0.91,
        description="Prevents dimensionality explosion by recommending Frequency/Target encoding for categoricals with > 10 levels.",
        condition=lambda col_fact, ds_fact: (
            col_fact["unique_count"] > 10 and
            col_fact["inferred_type"] == "categorical_nominal" and
            col_fact["uniqueness_ratio"] < 0.7 and
            not col_fact["is_identifier"]
        ),
        action_type="encode_frequency_or_target",
        generate_recommendation=lambda col_fact, ds_fact: {
            "action": "encode_frequency_or_target",
            "technique": "Frequency (Count) or Target Encoding",
            "parameters": {"encoding": "frequency", "min_samples_leaf": 5},
            "rationale": f"Feature '{col_fact['name']}' has {col_fact['unique_count']} distinct categories. One-Hot Encoding would cause dimensionality explosion (curse of dimensionality) and severe sparsity. Frequency or out-of-fold Target Encoding retains density in 1 feature.",
            "impact": "Compresses high-cardinality nominal space into a continuous density feature."
        }
    ),
    ProductionRule(
        rule_id="R-ENC-04",
        name="Ordinal Semantic Ranking Encoding",
        category="ENCODING",
        severity="INFO",
        confidence=0.94,
        description="Preserves monotonic progression by mapping discovered ordinal hierarchies to ordered integers.",
        condition=lambda col_fact, ds_fact: (
            col_fact["inferred_type"] == "categorical_ordinal" and
            col_fact.get("ordinal_order") is not None
        ),
        action_type="encode_ordinal",
        generate_recommendation=lambda col_fact, ds_fact: {
            "action": "encode_ordinal",
            "technique": "Ordinal (Ordered Integer) Encoding",
            "parameters": {"categories": col_fact.get("ordinal_order")},
            "rationale": f"Detected natural ordinal sequence: {col_fact.get('ordinal_order')}. Ordinal encoding preserves the monotonic relationship (e.g., low < medium < high) in a single dimension.",
            "impact": "Preserves hierarchy without expanding feature dimensionality."
        }
    ),

    # ----------------------------------------------------
    # SCALING & OUTLIERS RULES (R-DIST)
    # ----------------------------------------------------
    ProductionRule(
        rule_id="R-DIST-01",
        name="Heavy Right-Skew Power Transformation",
        category="SCALING_OUTLIERS",
        severity="WARNING",
        confidence=0.90,
        description="Compresses extreme right-skewed positive distributions via Log1p or Yeo-Johnson.",
        condition=lambda col_fact, ds_fact: (
            col_fact.get("numeric_stats") is not None and
            col_fact["numeric_stats"]["skewness"] >= 1.2 and
            col_fact["numeric_stats"]["min"] >= 0 and
            not col_fact["is_constant"]
        ),
        action_type="transform_log1p",
        generate_recommendation=lambda col_fact, ds_fact: {
            "action": "transform_log1p",
            "technique": "Log1p Transformation (log(x + 1))",
            "parameters": {"transform": "log1p"},
            "rationale": f"Feature '{col_fact['name']}' exhibits heavy positive skewness (skew = {col_fact['numeric_stats']['skewness']}). Applying a log1p or Yeo-Johnson transform compresses the long right tail, stabilizes heteroscedastic variance, and accelerates gradient convergence.",
            "impact": "Approximates normality and contracts high-magnitude variance."
        }
    ),
    ProductionRule(
        rule_id="R-DIST-02",
        name="Yeo-Johnson Power Transform for Skewed Negative Values",
        category="SCALING_OUTLIERS",
        severity="WARNING",
        confidence=0.89,
        description="Uses Yeo-Johnson power transform for skewed features containing negative values.",
        condition=lambda col_fact, ds_fact: (
            col_fact.get("numeric_stats") is not None and
            abs(col_fact["numeric_stats"]["skewness"]) >= 1.2 and
            col_fact["numeric_stats"]["min"] < 0 and
            not col_fact["is_constant"]
        ),
        action_type="transform_yeo_johnson",
        generate_recommendation=lambda col_fact, ds_fact: {
            "action": "transform_yeo_johnson",
            "technique": "PowerTransformer (Yeo-Johnson)",
            "parameters": {"method": "yeo-johnson"},
            "rationale": f"Feature '{col_fact['name']}' has high skewness ({col_fact['numeric_stats']['skewness']}) and contains negative values (min = {col_fact['numeric_stats']['min']}). Standard Box-Cox fails on non-positive values; Yeo-Johnson accommodates the full real domain.",
            "impact": "Normalizes variance across both negative and positive domains."
        }
    ),
    ProductionRule(
        rule_id="R-DIST-03",
        name="Outlier Mitigation via Winsorization / Robust Scaling",
        category="SCALING_OUTLIERS",
        severity="WARNING",
        confidence=0.88,
        description="Recommends Winsorization clipping (1st to 99th percentile) or RobustScaler when outliers exceed 2.5%.",
        condition=lambda col_fact, ds_fact: (
            col_fact.get("numeric_stats") is not None and
            col_fact["numeric_stats"]["outliers_iqr_pct"] >= 2.5 and
            not col_fact["is_constant"]
        ),
        action_type="mitigate_outliers",
        generate_recommendation=lambda col_fact, ds_fact: {
            "action": "mitigate_outliers",
            "technique": "Winsorization (Capping at 1st & 99th percentile) + RobustScaler",
            "parameters": {
                "lower_quantile": 0.01,
                "upper_quantile": 0.99,
                "detected_outliers_count": col_fact["numeric_stats"]["outliers_iqr_count"],
                "lower_bound": col_fact["numeric_stats"]["lower_bound_iqr"],
                "upper_bound": col_fact["numeric_stats"]["upper_bound_iqr"]
            },
            "rationale": f"Detected {col_fact['numeric_stats']['outliers_iqr_count']} outliers ({col_fact['numeric_stats']['outliers_iqr_pct']}%) outside 1.5x IQR. Winsorization prevents extreme anomalies from exerting disproportionate leverage on cost functions while retaining sample rows.",
            "impact": "Removes outlier leverage without reducing dataset sample size."
        }
    ),
    ProductionRule(
        rule_id="R-DIST-04",
        name="Gaussian Z-Score Standardization",
        category="SCALING_OUTLIERS",
        severity="INFO",
        confidence=0.87,
        description="Standardizes approximately normal continuous features to zero mean and unit variance.",
        condition=lambda col_fact, ds_fact: (
            col_fact.get("numeric_stats") is not None and
            col_fact["numeric_stats"]["is_normally_distributed"] and
            col_fact["numeric_stats"]["outliers_iqr_pct"] < 2.5 and
            not col_fact["is_constant"]
        ),
        action_type="scale_standard",
        generate_recommendation=lambda col_fact, ds_fact: {
            "action": "scale_standard",
            "technique": "StandardScaler (Z-Score)",
            "parameters": {"with_mean": True, "with_std": True},
            "rationale": f"Feature '{col_fact['name']}' follows a Gaussian-like distribution (skew = {col_fact['numeric_stats']['skewness']}, kurtosis = {col_fact['numeric_stats']['kurtosis']}). StandardScaler scales features to mean=0, std=1, ensuring balanced gradient steps.",
            "impact": "Aligns feature magnitudes across all continuous dimensions."
        }
    ),

    # ----------------------------------------------------
    # FILTERING & LEAKAGE RULES (R-FLT)
    # ----------------------------------------------------
    ProductionRule(
        rule_id="R-FLT-01",
        name="Zero-Variance Constant Feature Elimination",
        category="FILTERING_LEAKAGE",
        severity="CRITICAL",
        confidence=0.99,
        description="Drops constant features possessing zero variance and zero mutual information.",
        condition=lambda col_fact, ds_fact: col_fact["is_constant"],
        action_type="drop_column",
        generate_recommendation=lambda col_fact, ds_fact: {
            "action": "drop_column",
            "technique": "Drop Column (Zero Variance)",
            "parameters": {},
            "rationale": f"Column '{col_fact['name']}' is completely constant ({col_fact['unique_count']} unique value). It provides zero mathematical information, adds useless memory overhead, and can cause singular covariance matrices.",
            "impact": "Removes uninformative degenerate column."
        }
    ),
    ProductionRule(
        rule_id="R-FLT-02",
        name="Identifier / Primary Key Leakage Pruning",
        category="FILTERING_LEAKAGE",
        severity="CRITICAL",
        confidence=0.96,
        description="Identifies and drops row IDs, UUIDs, and tracking keys that cause memorization leakage.",
        condition=lambda col_fact, ds_fact: col_fact["is_identifier"],
        action_type="drop_column",
        generate_recommendation=lambda col_fact, ds_fact: {
            "action": "drop_column",
            "technique": "Drop Column (Identifier / Leakage Risk)",
            "parameters": {},
            "rationale": f"Column '{col_fact['name']}' exhibits distinct primary key / identifier characteristics (uniqueness ratio = {col_fact['uniqueness_ratio'] * 100:.1f}%). Including entity IDs in training causes models to memorize specific sample keys rather than generalizable signals.",
            "impact": "Eliminates target memorization hazard and overfitting."
        }
    ),
    ProductionRule(
        rule_id="R-FLT-03",
        name="High Multicollinearity Redundancy Warning",
        category="FILTERING_LEAKAGE",
        severity="WARNING",
        confidence=0.90,
        description="Identifies collinear feature pairs with correlation >= 0.85 and flags redundancy.",
        condition=lambda col_fact, ds_fact: any(
            (p["feature_a"] == col_fact["name"] or p["feature_b"] == col_fact["name"]) and p["abs_correlation"] >= 0.85
            for p in ds_fact.get("high_correlation_pairs", [])
        ),
        action_type="flag_collinear",
        generate_recommendation=lambda col_fact, ds_fact: {
            "action": "flag_collinear",
            "technique": "Collinearity Pruning / PCA Combination",
            "parameters": {
                "correlated_pairs": [
                    p for p in ds_fact.get("high_correlation_pairs", [])
                    if p["feature_a"] == col_fact["name"] or p["feature_b"] == col_fact["name"]
                ]
            },
            "rationale": f"Feature '{col_fact['name']}' has high multicollinearity (|r| >= 0.85) with peer features. Collinearity inflates parameter variance and creates unstable coefficient signs in regression models.",
            "impact": "Reduces feature redundancy and prevents variance inflation."
        }
    ),

    # ----------------------------------------------------
    # DATETIME FEATURE ENGINEERING (R-DAT)
    # ----------------------------------------------------
    ProductionRule(
        rule_id="R-DAT-01",
        name="Datetime Decomposition & Cyclic Feature Extraction",
        category="DATETIME",
        severity="OPTIMIZATION",
        confidence=0.95,
        description="Extracts year, month, day, dayofweek, weekend indicator, and cyclical sin/cos signals from timestamps.",
        condition=lambda col_fact, ds_fact: col_fact["inferred_type"] == "datetime",
        action_type="decompose_datetime",
        generate_recommendation=lambda col_fact, ds_fact: {
            "action": "decompose_datetime",
            "technique": "Datetime Component & Cyclic Sine/Cosine Expansion",
            "parameters": {"extract": ["year", "month", "day", "day_of_week", "is_weekend", "sin_month", "cos_month"]},
            "rationale": f"Column '{col_fact['name']}' contains temporal data. Tabular ML estimators cannot ingest raw timestamps. Deconstructing into calendar units and continuous cyclic trigonometrics (sin/cos of month & day) provides smooth temporal features.",
            "impact": "Transforms uninterpretable timestamp into rich seasonal indicators."
        }
    )
]
