import re
import math
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional

KNOWN_ORDINAL_SEQUENCES = [
    ["low", "medium", "high"],
    ["poor", "fair", "good", "very good", "excellent"],
    ["bad", "average", "good"],
    ["small", "medium", "large"],
    ["xs", "s", "m", "l", "xl", "xxl"],
    ["beginner", "intermediate", "advanced", "expert"],
    ["tier 1", "tier 2", "tier 3", "tier 4"],
    ["tier 3", "tier 2", "tier 1"],
    ["bronze", "silver", "gold", "platinum", "diamond"],
    ["strongly disagree", "disagree", "neutral", "agree", "strongly agree"],
    ["never", "rarely", "sometimes", "often", "always"]
]

def clean_val_str(v: Any) -> str:
    return str(v).strip().lower()

def detect_ordinal_sequence(unique_vals: List[Any]) -> Optional[List[str]]:
    cleaned = [clean_val_str(v) for v in unique_vals if pd.notna(v)]
    if len(cleaned) < 2 or len(cleaned) > 8:
        return None
    cleaned_set = set(cleaned)
    for seq in KNOWN_ORDINAL_SEQUENCES:
        seq_set = set(seq)
        if cleaned_set.issubset(seq_set) and len(cleaned_set) >= 2:
            # Return matching elements in order of the sequence
            return [x for x in seq if x in cleaned_set]
    return None

def is_likely_datetime_string(series: pd.Series) -> bool:
    if series.empty:
        return False
    sample = series.dropna().astype(str).head(50)
    if sample.empty:
        return False
    # Date patterns like YYYY-MM-DD, DD/MM/YYYY, ISO8601
    date_regex = re.compile(r'^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}')
    matches = sum(1 for s in sample if date_regex.match(s.strip()))
    if matches / len(sample) > 0.7:
        try:
            pd.to_datetime(sample.head(10))
            return True
        except Exception:
            return False
    return False

def is_likely_identifier(col_name: str, uniqueness_ratio: float, total_rows: int, dtype_str: str, series: Optional[pd.Series] = None) -> bool:
    # Convert camelCase and dashes to underscores (e.g. userId -> user_id, customerID -> customer_id)
    name_normalized = re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', col_name).lower().strip()
    tokens = set(re.split(r'[^a-zA-Z0-9]+', name_normalized))

    date_tokens = {'date', 'time', 'timestamp', 'datetime', 'year', 'month', 'day'}
    if tokens & date_tokens or any(tok in name_normalized for tok in ['timestamp', 'datetime']):
        return False

    # Exclude obvious free-text, natural language, or contact fields
    non_id_tokens = {
        'comment', 'text', 'desc', 'description', 'notes', 'feedback', 'email', 'body',
        'message', 'address', 'summary', 'review', 'bio', 'name', 'title', 'headline'
    }
    if tokens & non_id_tokens or any(tok in name_normalized for tok in ['email', 'description', 'feedback', 'review']):
        return False

    id_tokens = {'id', 'identifier', 'uuid', 'guid', 'key', 'code', 'serial', 'hash', 'ssn', 'ticket', 'index', 'account_num', 'account_no'}
    has_id_name = bool(tokens & id_tokens) or any(
        name_normalized.endswith(f"_{tok}") or name_normalized.startswith(f"{tok}_") or name_normalized == tok
        for tok in id_tokens
    )

    # Check series characteristics if provided
    if series is not None and len(series.dropna()) > 0:
        sample = series.dropna().astype(str).head(50)
        # Check for email pattern
        email_like = sum(1 for s in sample if '@' in s and '.' in s)
        if email_like / len(sample) > 0.2:
            return False

        # Natural text has spaces, multiple words, or longer average length
        mean_len = float(sample.str.len().mean())
        mean_words = float(sample.str.split().str.len().mean())
        has_spaces = float((sample.str.contains(r'\s', regex=True)).mean())

        if mean_words > 1.5 or mean_len > 35 or has_spaces > 0.3:
            return False

    if has_id_name and uniqueness_ratio > 0.85 and total_rows >= 10:
        return True

    # If no explicit ID name, require very high uniqueness and strictly compact single tokens without spaces
    if total_rows >= 25 and uniqueness_ratio > 0.98 and dtype_str in ['object', 'str', 'string']:
        if series is not None and len(series.dropna()) > 0:
            sample = series.dropna().astype(str).head(30)
            has_spaces = float((sample.str.contains(r'\s', regex=True)).mean())
            mean_len = float(sample.str.len().mean())
            if has_spaces > 0.05 or mean_len > 35:
                return False
        return True
    return False

def calculate_histogram(series: pd.Series, bins: int = 20) -> Dict[str, Any]:
    valid = series.dropna().to_numpy()
    if len(valid) == 0:
        return {"bin_edges": [], "counts": []}
    try:
        counts, edges = np.histogram(valid, bins=bins)
        return {
            "bin_edges": [round(float(e), 3) for e in edges],
            "counts": [int(c) for c in counts]
        }
    except Exception:
        return {"bin_edges": [], "counts": []}

def extract_column_facts(df: pd.DataFrame, col: str) -> Dict[str, Any]:
    series = df[col]
    total_rows = len(df)
    non_null_count = int(series.count())
    missing_count = int(series.isna().sum())
    missing_pct = round((missing_count / total_rows) * 100, 2) if total_rows > 0 else 0.0
    
    unique_vals = series.dropna().unique()
    unique_count = int(len(unique_vals))
    uniqueness_ratio = round(unique_count / non_null_count, 4) if non_null_count > 0 else 0.0

    raw_dtype = str(series.dtype)
    is_constant = (unique_count <= 1 and non_null_count > 0)
    
    # Infer semantic type
    inferred_type = "categorical_nominal"
    ordinal_order = None
    is_binary = (unique_count == 2)
    is_id = False

    # Check datetime
    if pd.api.types.is_datetime64_any_dtype(series):
        inferred_type = "datetime"
    elif (raw_dtype in ['object', 'str', 'string'] or pd.api.types.is_string_dtype(series)) and is_likely_datetime_string(series):
        inferred_type = "datetime"
    elif is_constant:
        inferred_type = "constant"
    elif is_likely_identifier(col, uniqueness_ratio, total_rows, raw_dtype, series=series):
        inferred_type = "identifier"
        is_id = True
    elif pd.api.types.is_bool_dtype(series):
        inferred_type = "boolean"
    elif pd.api.types.is_numeric_dtype(series):
        if is_binary:
            inferred_type = "boolean"
        elif unique_count <= 10 and (series.dropna() % 1 == 0).all():
            inferred_type = "numerical_discrete"
        else:
            inferred_type = "numerical_continuous"
    else:
        # String or categorical
        matched_seq = detect_ordinal_sequence(list(unique_vals[:20]))
        if matched_seq:
            inferred_type = "categorical_ordinal"
            ordinal_order = matched_seq
        elif is_binary:
            inferred_type = "boolean"
        elif uniqueness_ratio > 0.9 and total_rows > 50:
            inferred_type = "free_text"
        else:
            inferred_type = "categorical_nominal"

    sample_values = [str(x) for x in series.dropna().head(5).tolist()]

    fact: Dict[str, Any] = {
        "name": col,
        "raw_dtype": raw_dtype,
        "inferred_type": inferred_type,
        "non_null_count": non_null_count,
        "missing_count": missing_count,
        "missing_pct": missing_pct,
        "unique_count": unique_count,
        "uniqueness_ratio": uniqueness_ratio,
        "is_constant": is_constant,
        "is_binary": is_binary,
        "is_identifier": is_id,
        "ordinal_order": ordinal_order,
        "sample_values": sample_values,
        "numeric_stats": None,
        "categorical_stats": None,
        "datetime_stats": None
    }

    # Numeric detailed profiling
    if pd.api.types.is_numeric_dtype(series) and not is_constant:
        valid_s = series.dropna()
        if len(valid_s) > 0:
            val_min = float(valid_s.min())
            val_max = float(valid_s.max())
            val_mean = float(valid_s.mean())
            val_median = float(valid_s.median())
            val_std = float(valid_s.std()) if len(valid_s) > 1 else 0.0
            q25 = float(valid_s.quantile(0.25))
            q75 = float(valid_s.quantile(0.75))
            iqr = q75 - q25

            # Outlier detection
            lower_bound = q25 - (1.5 * iqr)
            upper_bound = q75 + (1.5 * iqr)
            outliers_iqr = int(((valid_s < lower_bound) | (valid_s > upper_bound)).sum())
            outliers_iqr_pct = round((outliers_iqr / len(valid_s)) * 100, 2)
            
            extreme_lower = q25 - (3.0 * iqr)
            extreme_upper = q75 + (3.0 * iqr)
            outliers_extreme = int(((valid_s < extreme_lower) | (valid_s > extreme_upper)).sum())

            # Skewness & Kurtosis
            skewness = float(valid_s.skew()) if len(valid_s) > 2 and val_std > 0 else 0.0
            kurt = float(valid_s.kurtosis()) if len(valid_s) > 3 and val_std > 0 else 0.0
            if math.isnan(skewness): skewness = 0.0
            if math.isnan(kurt): kurt = 0.0

            zero_count = int((valid_s == 0).sum())
            negative_count = int((valid_s < 0).sum())

            fact["numeric_stats"] = {
                "min": round(val_min, 4),
                "max": round(val_max, 4),
                "mean": round(val_mean, 4),
                "median": round(val_median, 4),
                "std": round(val_std, 4),
                "q25": round(q25, 4),
                "q75": round(q75, 4),
                "iqr": round(iqr, 4),
                "skewness": round(skewness, 3),
                "kurtosis": round(kurt, 3),
                "is_normally_distributed": abs(skewness) <= 0.8 and -1.0 <= kurt <= 2.0,
                "zero_count": zero_count,
                "zero_pct": round((zero_count / len(valid_s)) * 100, 2),
                "negative_count": negative_count,
                "outliers_iqr_count": outliers_iqr,
                "outliers_iqr_pct": outliers_iqr_pct,
                "outliers_extreme_count": outliers_extreme,
                "lower_bound_iqr": round(lower_bound, 4),
                "upper_bound_iqr": round(upper_bound, 4),
                "histogram": calculate_histogram(valid_s)
            }

    # Categorical detailed profiling
    if inferred_type in ['categorical_nominal', 'categorical_ordinal', 'boolean', 'identifier', 'free_text']:
        val_counts = series.dropna().value_counts()
        total_valid = len(series.dropna())
        top_freqs = []
        for val, count in val_counts.head(6).items():
            pct = round((count / total_valid) * 100, 2) if total_valid > 0 else 0.0
            top_freqs.append({"category": str(val), "count": int(count), "percentage": pct})
        
        rare_count = int((val_counts / total_valid < 0.01).sum()) if total_valid > 0 else 0

        # Shannon entropy
        probs = val_counts / total_valid if total_valid > 0 else []
        entropy = -sum(p * math.log2(p) for p in probs if p > 0)

        fact["categorical_stats"] = {
            "top_categories": top_freqs,
            "rare_categories_count": rare_count,
            "mode_category": str(val_counts.index[0]) if not val_counts.empty else None,
            "mode_frequency_pct": round((val_counts.iloc[0] / total_valid) * 100, 2) if not val_counts.empty else 0.0,
            "entropy": round(entropy, 3)
        }

    # Datetime detailed profiling
    if inferred_type == "datetime":
        try:
            dt_series = pd.to_datetime(series, errors='coerce')
            dt_valid = dt_series.dropna()
            if not dt_valid.empty:
                min_dt = dt_valid.min()
                max_dt = dt_valid.max()
                fact["datetime_stats"] = {
                    "min_date": str(min_dt),
                    "max_date": str(max_dt),
                    "time_span_days": round((max_dt - min_dt).total_seconds() / 86400, 1),
                    "has_time": any(dt.hour != 0 or dt.minute != 0 for dt in dt_valid.head(20))
                }
        except Exception:
            pass

    return fact

def extract_dataset_facts(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Extracts high-level and per-column statistical facts from the DataFrame.
    """
    row_count = int(len(df))
    col_count = int(len(df.columns))
    total_cells = row_count * col_count
    total_missing_cells = int(df.isna().sum().sum())
    overall_missing_pct = round((total_missing_cells / total_cells) * 100, 2) if total_cells > 0 else 0.0
    
    duplicate_rows = int(df.duplicated().sum())
    duplicate_pct = round((duplicate_rows / row_count) * 100, 2) if row_count > 0 else 0.0
    memory_bytes = int(df.memory_usage(deep=True).sum())
    memory_mb = round(memory_bytes / (1024 * 1024), 2)

    columns_facts: Dict[str, Any] = {}
    for col in df.columns:
        columns_facts[col] = extract_column_facts(df, col)

    # Inter-column Pearson Correlation for numeric columns
    numeric_cols = [c for c, f in columns_facts.items() if f.get("numeric_stats") is not None]
    high_correlation_pairs = []
    correlation_matrix = {}

    if len(numeric_cols) >= 2:
        try:
            corr = df[numeric_cols].corr(method='pearson')
            for c1 in numeric_cols:
                correlation_matrix[c1] = {}
                for c2 in numeric_cols:
                    val = corr.loc[c1, c2]
                    correlation_matrix[c1][c2] = round(float(val), 3) if not np.isnan(val) else 0.0

            for i in range(len(numeric_cols)):
                for j in range(i + 1, len(numeric_cols)):
                    c1, c2 = numeric_cols[i], numeric_cols[j]
                    val = corr.loc[c1, c2]
                    if not np.isnan(val) and abs(val) >= 0.75:
                        high_correlation_pairs.append({
                            "feature_a": c1,
                            "feature_b": c2,
                            "correlation": round(float(val), 3),
                            "abs_correlation": round(abs(float(val)), 3),
                            "severity": "CRITICAL" if abs(val) >= 0.90 else "WARNING"
                        })
            high_correlation_pairs.sort(key=lambda x: x["abs_correlation"], reverse=True)
        except Exception:
            pass

    # Categorical association via Cramer's V for nominal pairs
    cat_cols = [c for c, f in columns_facts.items() if "categorical" in f.get("inferred_type", "") or f.get("inferred_type") == "boolean"]
    if len(cat_cols) >= 2:
        for i in range(len(cat_cols)):
            for j in range(i + 1, min(len(cat_cols), i + 10)):
                c1, c2 = cat_cols[i], cat_cols[j]
                try:
                    sub = df[[c1, c2]].dropna()
                    if len(sub) > 20:
                        conf = pd.crosstab(sub[c1], sub[c2])
                        if conf.shape[0] > 1 and conf.shape[1] > 1:
                            chi2 = sp_stats.chi2_contingency(conf)[0]
                            n = conf.sum().sum()
                            phi2 = chi2 / n
                            r, k = conf.shape
                            phi2corr = max(0, phi2 - ((k - 1) * (r - 1)) / (n - 1))
                            rcorr = r - ((r - 1) ** 2) / (n - 1)
                            kcorr = k - ((k - 1) ** 2) / (n - 1)
                            denom = min((kcorr - 1), (rcorr - 1))
                            if denom > 0:
                                cv = float(np.sqrt(phi2corr / denom))
                                if cv >= 0.75:
                                    high_correlation_pairs.append({
                                        "feature_a": c1,
                                        "feature_b": c2,
                                        "correlation": round(cv, 3),
                                        "abs_correlation": round(cv, 3),
                                        "severity": "CRITICAL" if cv >= 0.90 else "WARNING"
                                    })
                except Exception:
                    pass
        high_correlation_pairs.sort(key=lambda x: x["abs_correlation"], reverse=True)

    # Missingness correlation heuristic (to detect MAR / co-missing structures)
    missing_cols = [c for c, f in columns_facts.items() if f["missing_pct"] > 0]
    missing_corr_pairs = []
    if len(missing_cols) >= 2:
        try:
            missing_df = df[missing_cols].isna().astype(int)
            m_corr = missing_df.corr()
            for i in range(len(missing_cols)):
                for j in range(i + 1, len(missing_cols)):
                    c1, c2 = missing_cols[i], missing_cols[j]
                    val = m_corr.loc[c1, c2]
                    if not np.isnan(val) and val >= 0.5:
                        missing_corr_pairs.append({
                            "feature_a": c1,
                            "feature_b": c2,
                            "correlation": round(float(val), 3)
                        })
        except Exception:
            pass

    type_counts = {
        "numerical_continuous": 0,
        "numerical_discrete": 0,
        "categorical_nominal": 0,
        "categorical_ordinal": 0,
        "datetime": 0,
        "boolean": 0,
        "identifier": 0,
        "constant": 0,
        "free_text": 0
    }
    for f in columns_facts.values():
        t = f["inferred_type"]
        if t in type_counts:
            type_counts[t] += 1

    return {
        "dataset_summary": {
            "row_count": row_count,
            "col_count": col_count,
            "total_cells": total_cells,
            "total_missing_cells": total_missing_cells,
            "overall_missing_pct": overall_missing_pct,
            "duplicate_rows": duplicate_rows,
            "duplicate_pct": duplicate_pct,
            "memory_mb": memory_mb,
            "type_counts": type_counts,
            "columns_with_missing": len(missing_cols),
            "columns_constant": type_counts["constant"],
            "columns_identifiers": type_counts["identifier"]
        },
        "columns": columns_facts,
        "high_correlation_pairs": high_correlation_pairs,
        "correlation_matrix": correlation_matrix,
        "missing_corr_pairs": missing_corr_pairs
    }
