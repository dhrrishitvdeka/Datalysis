import time
from typing import Dict, Any, List
from .rules import RULES, ProductionRule

def calculate_health_score(ds_summary: Dict[str, Any], columns_facts: Dict[str, Any], high_corr_pairs: List[Any]) -> Dict[str, Any]:
    total_cols = max(1, ds_summary["col_count"])
    num_cols = max(1, ds_summary["type_counts"]["numerical_continuous"] + ds_summary["type_counts"]["numerical_discrete"])
    cat_cols = max(1, ds_summary["type_counts"]["categorical_nominal"] + ds_summary["type_counts"]["categorical_ordinal"])

    # 1. Completeness Score (Weight: 30%)
    missing_pct = ds_summary["overall_missing_pct"]
    cols_with_missing = ds_summary["columns_with_missing"]
    comp_penalty = (missing_pct * 2.0) + ((cols_with_missing / total_cols) * 20.0)
    completeness_score = max(0.0, min(100.0, 100.0 - comp_penalty))

    # 2. Distribution & Outliers Score (Weight: 25%)
    skewed_count = 0
    outlier_count = 0
    for f in columns_facts.values():
        if f.get("numeric_stats"):
            if abs(f["numeric_stats"]["skewness"]) >= 1.2:
                skewed_count += 1
            if f["numeric_stats"]["outliers_iqr_pct"] >= 2.5:
                outlier_count += 1
    dist_penalty = ((skewed_count / num_cols) * 35.0) + ((outlier_count / num_cols) * 35.0)
    distribution_score = max(0.0, min(100.0, 100.0 - dist_penalty))

    # 3. Parsimony & Integrity Score (Weight: 25%)
    dup_pct = ds_summary["duplicate_pct"]
    constant_count = ds_summary["columns_constant"]
    id_count = ds_summary["columns_identifiers"]
    corr_count = len(high_corr_pairs)
    parsimony_penalty = (dup_pct * 2.5) + (constant_count * 20.0) + (id_count * 15.0) + min(25.0, corr_count * 6.0)
    parsimony_score = max(0.0, min(100.0, 100.0 - parsimony_penalty))

    # 4. Encoding Readiness (Weight: 20%)
    high_card_count = sum(1 for f in columns_facts.values() if f["unique_count"] > 10 and f["inferred_type"] == "categorical_nominal")
    raw_dt_count = ds_summary["type_counts"]["datetime"]
    enc_penalty = (high_card_count * 12.0) + (raw_dt_count * 10.0)
    encoding_readiness_score = max(0.0, min(100.0, 100.0 - enc_penalty))

    # Weighted Overall Score
    overall = (
        (completeness_score * 0.30) +
        (distribution_score * 0.25) +
        (parsimony_score * 0.25) +
        (encoding_readiness_score * 0.20)
    )
    overall = round(max(5.0, min(100.0, overall)), 1)

    # Grade
    if overall >= 92: grade = "A+"
    elif overall >= 83: grade = "A"
    elif overall >= 72: grade = "B"
    elif overall >= 60: grade = "C"
    elif overall >= 45: grade = "D"
    else: grade = "F"

    # Executive Diagnosis
    critical_issues = []
    if missing_pct > 15.0:
        critical_issues.append(f"Severe missing data density ({missing_pct}% total empty cells)")
    if id_count > 0:
        critical_issues.append(f"{id_count} high-risk identifier columns creating target leakage hazard")
    if constant_count > 0:
        critical_issues.append(f"{constant_count} zero-variance constant features")
    if corr_count > 0:
        critical_issues.append(f"{corr_count} highly collinear feature pairs (VIF risk)")
    if outlier_count > 0:
        critical_issues.append(f"{outlier_count} continuous features with heavy outlier leverage")

    if not critical_issues:
        diagnosis = "Dataset is remarkably clean and well-structured, requiring minor scaling and standard encoding."
    else:
        diagnosis = "Dataset requires systematic preprocessing: " + "; ".join(critical_issues) + "."

    return {
        "overall_score": overall,
        "grade": grade,
        "sub_scores": {
            "completeness": round(completeness_score, 1),
            "distribution": round(distribution_score, 1),
            "parsimony": round(parsimony_score, 1),
            "encoding_readiness": round(encoding_readiness_score, 1)
        },
        "executive_diagnosis": diagnosis,
        "critical_issues": critical_issues
    }

def run_expert_inference(dataset_facts: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluates dataset facts against the Production Rule Base.
    Generates:
      - Activated rules per column
      - Synthesized column preprocessing recipes
      - Cognitive Reasoning Trace (audit log)
      - Health Score & Executive Diagnosis
    """
    ds_summary = dataset_facts["dataset_summary"]
    columns_facts = dataset_facts["columns"]
    high_corr_pairs = dataset_facts.get("high_correlation_pairs", [])

    reasoning_trace: List[Dict[str, Any]] = []
    def log_step(phase: str, message: str, details: Any = None):
        reasoning_trace.append({
            "timestamp": round(time.time(), 3),
            "phase": phase,
            "message": message,
            "details": details
        })

    log_step("INGESTION_AUDIT", f"Analyzing tabular structure: {ds_summary['row_count']} rows x {ds_summary['col_count']} columns ({ds_summary['memory_mb']} MB).")
    
    # Check duplicates
    if ds_summary["duplicate_rows"] > 0:
        log_step("INTEGRITY_CHECK", f"Identified {ds_summary['duplicate_rows']} exact duplicate records ({ds_summary['duplicate_pct']}%). Triggered dataset-level pruning recommendation.")
    else:
        log_step("INTEGRITY_CHECK", "Zero duplicate records detected. Record uniqueness verified.")

    column_recommendations: Dict[str, Dict[str, Any]] = {}
    triggered_rules_log: List[Dict[str, Any]] = []

    for col_name, col_fact in columns_facts.items():
        col_recs: List[Dict[str, Any]] = []
        should_drop = False
        drop_reason = None

        # Evaluate rules in priority order
        for rule in RULES:
            try:
                if rule.condition(col_fact, dataset_facts):
                    rec = rule.generate_recommendation(col_fact, dataset_facts)
                    rec["rule_id"] = rule.rule_id
                    rec["rule_name"] = rule.name
                    rec["category"] = rule.category
                    rec["severity"] = rule.severity
                    rec["confidence"] = rule.confidence
                    
                    triggered_rules_log.append({
                        "column": col_name,
                        "rule_id": rule.rule_id,
                        "rule_name": rule.name,
                        "category": rule.category,
                        "severity": rule.severity,
                        "confidence": rule.confidence,
                        "action_type": rule.action_type
                    })

                    # If marked to drop (e.g. ID or 70%+ missing or constant), mark drop
                    if rule.action_type == "drop_column":
                        should_drop = True
                        drop_reason = rec["rationale"]

                    col_recs.append(rec)
            except Exception as e:
                pass

        # Synthesize consolidated action plan for the column
        imputation_step = next((r for r in col_recs if r["category"] == "IMPUTATION"), None)
        encoding_step = next((r for r in col_recs if r["category"] == "ENCODING"), None)
        scaling_steps = [r for r in col_recs if r["category"] == "SCALING_OUTLIERS"]
        filtering_step = next((r for r in col_recs if r["category"] == "FILTERING_LEAKAGE" and r["action"] == "drop_column"), None)
        datetime_step = next((r for r in col_recs if r["category"] == "DATETIME"), None)

        status = "HEALTHY"
        if should_drop:
            status = "DROP_RECOMMENDED"
        elif any(r["severity"] == "CRITICAL" for r in col_recs):
            status = "CRITICAL_ATTENTION"
        elif any(r["severity"] == "WARNING" for r in col_recs):
            status = "REQUIRES_TRANSFORMATION"
        elif col_recs:
            status = "READY_WITH_PREPROCESSING"

        column_recommendations[col_name] = {
            "column": col_name,
            "inferred_type": col_fact["inferred_type"],
            "raw_dtype": col_fact["raw_dtype"],
            "status": status,
            "should_drop": should_drop,
            "drop_reason": drop_reason,
            "missing_pct": col_fact["missing_pct"],
            "unique_count": col_fact["unique_count"],
            "all_rules_triggered": col_recs,
            "imputation": imputation_step,
            "encoding": encoding_step,
            "scaling_and_outliers": scaling_steps,
            "filtering": filtering_step,
            "datetime_engineering": datetime_step,
            "sample_values": col_fact.get("sample_values", [])
        }

    # Trace logs for findings
    dropped_cols = [c for c, r in column_recommendations.items() if r["should_drop"]]
    if dropped_cols:
        log_step("RULE_EVALUATION", f"Pruning recommendations issued for {len(dropped_cols)} column(s): {', '.join(dropped_cols)} (zero variance, leakage IDs, or >70% missing).")

    impute_cols = [c for c, r in column_recommendations.items() if r["imputation"] and not r["should_drop"]]
    log_step("IMPUTATION_ANALYSIS", f"Synthesized targeted imputation strategy for {len(impute_cols)} column(s) with missing values.")

    log_step("MULTICOLLINEARITY_AUDIT", f"Evaluated Pearson correlation matrix across numeric dimensions. Found {len(high_corr_pairs)} high-correlation pairs (|r| >= 0.75).")

    health = calculate_health_score(ds_summary, columns_facts, high_corr_pairs)
    log_step("HEALTH_ASSESSMENT", f"Synthesized composite ML Readiness Index: {health['overall_score']}/100 (Grade {health['grade']}).")

    return {
        "health_score": health,
        "reasoning_trace": reasoning_trace,
        "triggered_rules_count": len(triggered_rules_log),
        "triggered_rules_log": triggered_rules_log,
        "column_recommendations": column_recommendations
    }
