import re
from typing import Dict, Any, List

class ConversationalExpert:
    """
    Deterministic rule-based AI Expert System agent.
    Provides intelligent explanations, justifications, and answers to user queries
    grounded strictly in the active dataset's extracted facts and production rule activations,
    without requiring any external LLM or API keys.
    """

    def __init__(self, dataset_facts: Dict[str, Any], inference_results: Dict[str, Any]):
        self.facts = dataset_facts
        self.inference = inference_results
        self.ds_summary = dataset_facts.get("dataset_summary", {})
        self.cols = dataset_facts.get("columns", {})
        self.col_recs = inference_results.get("column_recommendations", {})
        self.health = inference_results.get("health_score", {})
        self.high_corr = dataset_facts.get("high_correlation_pairs", [])

    def answer_query(self, query: str) -> Dict[str, Any]:
        q = query.lower().strip()
        matched_column = self._find_referenced_column(q)

        # 1. Ask about a specific column's imputation
        if matched_column and any(k in q for k in ["impute", "imputation", "missing", "mean", "median", "mode", "fill", "why"]):
            return self._explain_column_imputation(matched_column)

        # 2. Ask about a specific column's encoding
        if matched_column and any(k in q for k in ["encode", "encoding", "onehot", "ohe", "ordinal", "categorical"]):
            return self._explain_column_encoding(matched_column)

        # 3. Ask about a specific column's outliers / scaling
        if matched_column and any(k in q for k in ["outlier", "outliers", "scale", "scaling", "skew", "skewness", "distribut"]):
            return self._explain_column_outliers_scaling(matched_column)

        # 4. Ask why a column should be dropped
        if matched_column and any(k in q for k in ["drop", "remove", "delete", "leak", "id"]):
            return self._explain_column_drop(matched_column)

        # 5. General column overview if column named
        if matched_column:
            return self._summarize_column(matched_column)

        # 6. Overall Health Score explanation
        if any(k in q for k in ["health", "score", "grade", "readiness", "evaluation"]):
            return self._explain_health_score()

        # 7. Leakage, ID columns, or Dropped columns
        if any(k in q for k in ["leak", "leakage", "drop", "id", "identifier", "constant", "remove"]):
            return self._explain_leakage_and_drops()

        # 8. Missing values across dataset
        if any(k in q for k in ["missing", "null", "empty", "imput"]):
            return self._explain_overall_missing()

        # 9. Outliers across dataset
        if any(k in q for k in ["outlier", "anomal", "extreme"]):
            return self._explain_overall_outliers()

        # 10. Collinearity and Correlations
        if any(k in q for k in ["correlat", "collinear", "redundant", "vif", "multicollin"]):
            return self._explain_collinearity()

        # 11. Top issues / Summary / Overview
        if any(k in q for k in ["issue", "problem", "summary", "diagnos", "worst", "priority", "critical", "what should i do"]):
            return self._explain_critical_issues()

        # 12. Code generation query
        if any(k in q for k in ["code", "script", "python", "sklearn", "pipeline"]):
            return {
                "answer": (
                    "### Recommended Scikit-Learn Preprocessing Architecture\n\n"
                    "The expert system automatically builds an end-to-end `ColumnTransformer` inside an sklearn `Pipeline`.\n\n"
                    "- **Numerical Pipeline**: Handles median/mean imputation with `SimpleImputer(add_indicator=True)`, followed by `RobustScaler` or `StandardScaler`.\n"
                    "- **Categorical Pipeline**: Applies `SimpleImputer(strategy='constant', fill_value='Missing')` followed by `OneHotEncoder(handle_unknown='ignore')`.\n"
                    "- **Pruned Columns**: Filters out zero-variance constants and high-uniqueness identifier keys.\n\n"
                    "Navigate to the **'Pipeline Code'** tab in the top navigation to inspect and copy the complete, runnable Python code!"
                ),
                "suggested_followups": [
                    "What are the critical issues?",
                    "Which columns have missing data?",
                    "Are there leaky identifiers?"
                ]
            }

        # Default fallback response
        return self._default_response()

    def _find_referenced_column(self, q: str) -> str:
        # Match exact column name or case-insensitive
        for col in self.cols.keys():
            col_l = col.lower()
            pattern = r'\b' + re.escape(col_l) + r'\b'
            if re.search(pattern, q) or col_l in q:
                return col
        return None

    def _explain_column_imputation(self, col: str) -> Dict[str, Any]:
        f = self.cols[col]
        r = self.col_recs.get(col, {})
        imp = r.get("imputation")
        
        if f["missing_count"] == 0:
            return {
                "answer": f"**Column `{col}` has zero missing values** (100% complete across all {self.ds_summary['row_count']} rows). No imputation operation is required.",
                "suggested_followups": [f"How is {col} distributed?", f"What encoding is used for {col}?"]
            }

        if r.get("should_drop"):
            return {
                "answer": (
                    f"**Imputation is not recommended for `{col}` because it is flagged to be dropped.**\n\n"
                    f"- **Drop Reason**: {r.get('drop_reason')}\n"
                    f"- **Missingness**: {f['missing_pct']}% ({f['missing_count']} rows missing).\n\n"
                    "Attempting to impute a column that is >70% unobserved or an identifier introduces mathematical distortion without predictive gain."
                ),
                "suggested_followups": ["Which other columns have missing data?", "Explain data health score"]
            }

        if imp:
            tech = imp.get("technique", "Standard Imputation")
            rationale = imp.get("rationale", "")
            rule_id = imp.get("rule_id", "R-IMP")
            conf = imp.get("confidence", 0.9)
            
            num_stats = f.get("numeric_stats")
            stats_block = ""
            if num_stats:
                stats_block = (
                    f"\n\n**Statistical Evidence:**\n"
                    f"- **Skewness**: `{num_stats['skewness']}` (Severe if > 0.8)\n"
                    f"- **Mean vs Median**: Mean = `{num_stats['mean']}`, Median = `{num_stats['median']}`\n"
                    f"- **Outlier Count**: `{num_stats['outliers_iqr_count']}` ({num_stats['outliers_iqr_pct']}%)\n"
                    f"- **Missingness**: `{f['missing_pct']}%` ({f['missing_count']} records)"
                )
            elif f.get("categorical_stats"):
                cat_stats = f["categorical_stats"]
                stats_block = (
                    f"\n\n**Categorical Evidence:**\n"
                    f"- **Missingness**: `{f['missing_pct']}%` ({f['missing_count']} records)\n"
                    f"- **Dominant Mode**: `{cat_stats.get('mode_category')}` ({cat_stats.get('mode_frequency_pct')}%)\n"
                    f"- **Distinct Categories**: `{f['unique_count']}`"
                )

            return {
                "answer": (
                    f"### Expert System Imputation Diagnosis for `{col}`\n\n"
                    f"**Recommended Strategy**: `{tech}`  \n"
                    f"**Rule Triggered**: `{rule_id}` (Confidence: `{int(conf*100)}%`)\n\n"
                    f"**Mathematical Justification**:\n{rationale}"
                    f"{stats_block}"
                ),
                "suggested_followups": [
                    f"How should {col} be scaled?",
                    f"Are there outliers in {col}?",
                    "Which columns have missing data?"
                ]
            }

        return {
            "answer": f"Column `{col}` has {f['missing_pct']}% missing values. A standard default imputation applies.",
            "suggested_followups": ["What are the critical issues?"]
        }

    def _explain_column_encoding(self, col: str) -> Dict[str, Any]:
        f = self.cols[col]
        r = self.col_recs.get(col, {})
        enc = r.get("encoding")

        if r.get("should_drop"):
            return {
                "answer": f"Column `{col}` is flagged for removal ({r.get('drop_reason')}). Encoding is unnecessary.",
                "suggested_followups": ["Why should it be dropped?", "What columns are kept?"]
            }

        if f.get("numeric_stats"):
            return {
                "answer": f"Column `{col}` is a numerical feature (`{f['inferred_type']}`). Numerical features do not require categorical encoding. Instead, they require scaling or transformation.",
                "suggested_followups": [f"What scaling is recommended for {col}?", f"Are there outliers in {col}?"]
            }

        if enc:
            return {
                "answer": (
                    f"### Expert System Categorical Encoding for `{col}`\n\n"
                    f"**Technique**: `{enc.get('technique')}`  \n"
                    f"**Rule**: `{enc.get('rule_id')}` (Confidence: `{int(enc.get('confidence', 0.9)*100)}%`)\n\n"
                    f"**Rationale**: {enc.get('rationale')}\n\n"
                    f"- **Unique Cardinality**: `{f['unique_count']}` unique values\n"
                    f"- **Top Values**: {', '.join([c['category'] for c in f.get('categorical_stats', {}).get('top_categories', [])[:4]])}"
                ),
                "suggested_followups": [f"How is missingness handled in {col}?", "Summarize dataset problems"]
            }

        return {
            "answer": f"Column `{col}` has inferred type `{f['inferred_type']}` with `{f['unique_count']}` distinct values.",
            "suggested_followups": ["What are the critical issues?"]
        }

    def _explain_column_outliers_scaling(self, col: str) -> Dict[str, Any]:
        f = self.cols[col]
        num_stats = f.get("numeric_stats")
        if not num_stats:
            return {
                "answer": f"Column `{col}` is non-numeric (`{f['inferred_type']}`). Outlier detection and continuous scaling apply strictly to numeric dimensions.",
                "suggested_followups": [f"What encoding should I use for {col}?"]
            }

        r = self.col_recs.get(col, {})
        scaling_steps = r.get("scaling_and_outliers", [])
        techniques = [s.get("technique") for s in scaling_steps]

        return {
            "answer": (
                f"### Distribution & Outlier Diagnosis for `{col}`\n\n"
                f"- **Outlier Detection (1.5x IQR)**: `{num_stats['outliers_iqr_count']}` records ({num_stats['outliers_iqr_pct']}% of data)\n"
                f"- **IQR Bounds**: Lower: `{num_stats['lower_bound_iqr']}`, Upper: `{num_stats['upper_bound_iqr']}`\n"
                f"- **Distribution Skewness**: `{num_stats['skewness']}` ({'Heavy Right Skew' if num_stats['skewness'] > 1.0 else 'Heavy Left Skew' if num_stats['skewness'] < -1.0 else 'Approximately Normal'})\n"
                f"- **Kurtosis**: `{num_stats['kurtosis']}`\n"
                f"- **Minimum / Maximum**: `{num_stats['min']}` to `{num_stats['max']}`\n\n"
                f"**Expert Recommendation**: {', '.join(techniques) if techniques else 'StandardScaler'}\n\n"
                f"{scaling_steps[0]['rationale'] if scaling_steps else 'Data shows standard dispersion; standard Z-score scaling is optimal.'}"
            ),
            "suggested_followups": [f"Why impute {col}?", "Are there outliers in other columns?"]
        }

    def _explain_column_drop(self, col: str) -> Dict[str, Any]:
        r = self.col_recs.get(col, {})
        f = self.cols[col]
        if r.get("should_drop"):
            return {
                "answer": (
                    f"### Pruning Recommendation for `{col}`\n\n"
                    f"**Action**: `DROP COLUMN`  \n"
                    f"**Status**: `{r.get('status')}`  \n\n"
                    f"**Reasoning**: {r.get('drop_reason')}\n\n"
                    f"- **Missingness**: `{f['missing_pct']}%`\n"
                    f"- **Cardinality**: `{f['unique_count']}` unique values (Uniqueness Ratio: `{f['uniqueness_ratio']*100:.1f}%`)\n"
                    f"- **Inferred Semantic Role**: `{f['inferred_type']}`"
                ),
                "suggested_followups": ["What other columns should be dropped?", "Explain health score"]
            }
        return {
            "answer": f"Column `{col}` is **NOT** recommended for dropping. It contains valid discriminative variance and should be retained after proper preprocessing.",
            "suggested_followups": [f"What preprocessing is needed for {col}?"]
        }

    def _summarize_column(self, col: str) -> Dict[str, Any]:
        f = self.cols[col]
        r = self.col_recs.get(col, {})
        return {
            "answer": (
                f"### Column Profile: `{col}`\n\n"
                f"- **Inferred Role**: `{f['inferred_type']}` (Raw: `{f['raw_dtype']}`)\n"
                f"- **Status**: `{r.get('status', 'HEALTHY')}`\n"
                f"- **Missing Values**: `{f['missing_count']}` ({f['missing_pct']}%)\n"
                f"- **Distinct Count**: `{f['unique_count']}`\n"
                f"- **Sample Values**: {', '.join(f.get('sample_values', [])[:4])}\n\n"
                f"**Active Recommendations**:\n"
                f"- Imputation: `{r.get('imputation', {}).get('technique', 'None needed')}`\n"
                f"- Encoding: `{r.get('encoding', {}).get('technique', 'N/A')}`\n"
                f"- Scaling/Outliers: `{', '.join([s['technique'] for s in r.get('scaling_and_outliers', [])]) or 'None'}`"
            ),
            "suggested_followups": [f"Why impute {col}?", f"Are there outliers in {col}?"]
        }

    def _explain_health_score(self) -> Dict[str, Any]:
        sub = self.health.get("sub_scores", {})
        return {
            "answer": (
                f"### Dataset ML Health & Readiness Score: **{self.health['overall_score']}/100** (Grade: **{self.health['grade']}**)\n\n"
                f"**Component Breakdown:**\n"
                f"- **Completeness** (Weight 30%): `{sub.get('completeness')}/100` — Reflects {self.ds_summary['overall_missing_pct']}% missing data density across {self.ds_summary['columns_with_missing']} affected columns.\n"
                f"- **Distribution & Outliers** (Weight 25%): `{sub.get('distribution')}/100` — Deductions from high skewness and extreme outliers in numerical columns.\n"
                f"- **Parsimony & Integrity** (Weight 25%): `{sub.get('parsimony')}/100` — Penalties for {self.ds_summary['duplicate_rows']} duplicates, {self.ds_summary['columns_identifiers']} leaky IDs, and {len(self.high_corr)} collinear pairs.\n"
                f"- **Encoding Readiness** (Weight 20%): `{sub.get('encoding_readiness')}/100` — Categorical readiness and high-cardinality nominals.\n\n"
                f"**Executive Diagnosis**:\n{self.health['executive_diagnosis']}"
            ),
            "suggested_followups": [
                "What are the critical issues?",
                "Which columns should be dropped?",
                "Show missing data"
            ]
        }

    def _explain_leakage_and_drops(self) -> Dict[str, Any]:
        dropped = [(c, r) for c, r in self.col_recs.items() if r["should_drop"]]
        if not dropped:
            return {
                "answer": "No columns are flagged for pruning. All features contribute non-zero variance and show no obvious entity ID leakage.",
                "suggested_followups": ["What are the critical issues?", "Show missing data"]
            }
        
        lines = []
        for col, r in dropped:
            lines.append(f"- **`{col}`**: {r.get('drop_reason')}")

        return {
            "answer": (
                f"### Features Flagged for Pruning ({len(dropped)} columns)\n\n"
                + "\n".join(lines) +
                "\n\n*Pruning these features prevents data leakage, memorization overfitting, and numerical matrix singularity.*"
            ),
            "suggested_followups": [
                "What are the critical issues?",
                "Explain health score"
            ]
        }

    def _explain_overall_missing(self) -> Dict[str, Any]:
        missing_cols = [(c, f) for c, f in self.cols.items() if f["missing_pct"] > 0]
        missing_cols.sort(key=lambda x: x[1]["missing_pct"], reverse=True)

        if not missing_cols:
            return {
                "answer": "**The dataset is 100% complete.** There are zero null, NaN, or unobserved cells across all rows and columns.",
                "suggested_followups": ["Are there outliers?", "What are the critical issues?"]
            }

        lines = []
        for col, f in missing_cols:
            rec = self.col_recs.get(col, {})
            strategy = rec.get("imputation", {}).get("technique", "Drop" if rec.get("should_drop") else "Default")
            lines.append(f"- **`{col}`**: `{f['missing_pct']}%` missing ({f['missing_count']} rows) -> Recommended: `{strategy}`")

        return {
            "answer": (
                f"### Missing Data Analysis\n\n"
                f"Overall Dataset Sparsity: **{self.ds_summary['overall_missing_pct']}%** ({self.ds_summary['total_missing_cells']} missing cells across {len(missing_cols)} columns).\n\n"
                + "\n".join(lines)
            ),
            "suggested_followups": [
                f"Why impute {missing_cols[0][0]}?",
                "Are there leaky identifiers?"
            ]
        }

    def _explain_overall_outliers(self) -> Dict[str, Any]:
        outlier_cols = []
        for col, f in self.cols.items():
            ns = f.get("numeric_stats")
            if ns and ns["outliers_iqr_count"] > 0:
                outlier_cols.append((col, ns))
        outlier_cols.sort(key=lambda x: x[1]["outliers_iqr_pct"], reverse=True)

        if not outlier_cols:
            return {
                "answer": "No extreme outliers were detected using the standard 1.5x Interquartile Range (IQR) boundary criterion.",
                "suggested_followups": ["What are the critical issues?", "Show missing data"]
            }

        lines = []
        for col, ns in outlier_cols:
            lines.append(f"- **`{col}`**: `{ns['outliers_iqr_count']}` outliers (`{ns['outliers_iqr_pct']}%`) | Bounds: [{ns['lower_bound_iqr']}, {ns['upper_bound_iqr']}]")

        return {
            "answer": (
                f"### Outlier Scan Report ({len(outlier_cols)} columns)\n\n"
                "Outliers detected via Tukey's IQR rule (values beyond $[Q1 - 1.5 \\times IQR, Q3 + 1.5 \\times IQR]$):\n\n"
                + "\n".join(lines) +
                "\n\n*Recommendation: Apply 1st/99th percentile Winsorization or RobustScaler to shield linear estimators and gradient-based models.*"
            ),
            "suggested_followups": [
                f"How do I handle outliers in {outlier_cols[0][0]}?",
                "What are the critical issues?"
            ]
        }

    def _explain_collinearity(self) -> Dict[str, Any]:
        if not self.high_corr:
            return {
                "answer": "No high multicollinearity detected. All numeric feature pairs exhibit pairwise Pearson correlations $|r| < 0.75$.",
                "suggested_followups": ["What are the critical issues?", "Show missing data"]
            }

        lines = []
        for p in self.high_corr:
            lines.append(f"- **`{p['feature_a']}`** & **`{p['feature_b']}`**: Pearson $r = {p['correlation']}$ ({p['severity']})")

        return {
            "answer": (
                f"### High Multicollinearity Redundancy ({len(self.high_corr)} pairs)\n\n"
                + "\n".join(lines) +
                "\n\n*Collinearity inflates coefficient variance in linear models and distorts feature importance. Consider dropping one feature or applying PCA.*"
            ),
            "suggested_followups": [
                "Which columns should be dropped?",
                "What are the critical issues?"
            ]
        }

    def _explain_critical_issues(self) -> Dict[str, Any]:
        crit = self.health.get("critical_issues", [])
        if not crit:
            return {
                "answer": "### Expert Diagnostic Summary\n\nNo critical structural flaws were detected! The dataset is in solid condition with good row-to-column ratio and low sparsity.",
                "suggested_followups": ["Explain health score", "Show pipeline code"]
            }
        
        lines = [f"{i+1}. {issue}" for i, issue in enumerate(crit)]
        return {
            "answer": (
                f"### Top Priority Dataset Remediation Issues\n\n"
                + "\n".join(lines) +
                f"\n\n**Composite Health Score**: `{self.health['overall_score']}/100` (Grade `{self.health['grade']}`).\n"
                "Check the **'Preprocessing Recommendations'** table to see exact mathematical recipes for each feature."
            ),
            "suggested_followups": [
                "Which columns should be dropped?",
                "Show missing data",
                "Are there outliers?"
            ]
        }

    def _default_response(self) -> Dict[str, Any]:
        first_col = list(self.cols.keys())[0] if self.cols else "Feature"
        return {
            "answer": (
                "I am the **Datalysis Expert Inference System**, an autonomous analytical agent operating entirely locally without external LLMs. "
                "I evaluate your data using statistical hypothesis tests, distribution metrics, and an active production rule base.\n\n"
                "**Here are questions you can ask me about your dataset:**\n"
                f"- *\"Why is median recommended for `{first_col}`?\"*\n"
                "- *\"What are the most critical issues in this dataset?\"*\n"
                "- *\"Which features should be dropped to prevent leakage?\"*\n"
                "- *\"Show all columns with missing values.\"*\n"
                "- *\"Are there extreme outliers in the continuous features?\"*\n"
                "- *\"Explain the Data Health Score breakdown.\"*"
            ),
            "suggested_followups": [
                "What are the critical issues?",
                f"How should {first_col} be processed?",
                "Are there leaky identifiers?",
                "Explain health score"
            ]
        }
