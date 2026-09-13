"""
Multi-format Data and Pipeline Exporter for Datalysis
Supports CSV, Excel (.xlsx), Parquet (.parquet), SQLite (.db),
Jupyter Notebook (.ipynb), and Pandera schema generation.
"""

import io
import json
import sqlite3
import tempfile
from typing import Dict, Any, Tuple, Optional
import pandas as pd
import numpy as np


def export_dataframe(df: pd.DataFrame, format: str, base_filename: str = "dataset") -> Tuple[bytes, str, str]:
    """
    Exports a DataFrame into the specified format.
    Returns: (content_bytes, mime_type, output_filename)
    """
    clean_base = base_filename.rsplit(".", 1)[0]
    fmt = format.lower().strip()

    if fmt == "csv":
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        return csv_buffer.getvalue().encode("utf-8"), "text/csv", f"{clean_base}_datalysis_cleaned.csv"

    elif fmt in ["excel", "xlsx"]:
        excel_buffer = io.BytesIO()
        with pd.ExcelWriter(excel_buffer, engine="openpyxl") as writer:
            # 1. Cleaned Data sheet
            df.to_excel(writer, sheet_name="Cleaned_Data", index=False)

            # 2. Metadata / Summary sheet
            summary_data = {
                "Metric": ["Total Rows", "Total Columns", "Total Cells", "Memory Usage (MB)"],
                "Value": [
                    len(df),
                    len(df.columns),
                    len(df) * len(df.columns),
                    round(df.memory_usage(deep=True).sum() / (1024 * 1024), 2)
                ]
            }
            pd.DataFrame(summary_data).to_excel(writer, sheet_name="Summary_Overview", index=False)

            # 3. Column Profiling sheet
            col_profile = []
            for col in df.columns:
                col_profile.append({
                    "Column": col,
                    "Dtype": str(df[col].dtype),
                    "Non-Null Count": int(df[col].count()),
                    "Unique Values": int(df[col].nunique()),
                })
            pd.DataFrame(col_profile).to_excel(writer, sheet_name="Column_Schema", index=False)

        excel_bytes = excel_buffer.getvalue()
        return (
            excel_bytes,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            f"{clean_base}_datalysis_cleaned.xlsx"
        )

    elif fmt == "parquet":
        parquet_buffer = io.BytesIO()
        parquet_df = df.copy()
        # Convert object columns to string to avoid ArrowTypeError on mixed types
        for col in parquet_df.columns:
            if parquet_df[col].dtype == "object":
                parquet_df[col] = parquet_df[col].astype(str)
        parquet_df.to_parquet(parquet_buffer, index=False, engine="pyarrow")
        return (
            parquet_buffer.getvalue(),
            "application/octet-stream",
            f"{clean_base}_datalysis_cleaned.parquet"
        )

    elif fmt in ["sqlite", "db"]:
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp_file:
            db_path = tmp_file.name

        try:
            conn = sqlite3.connect(db_path)
            # Ensure column names are strictly SQLite-compatible identifiers
            safe_df = df.copy()
            import re
            new_cols = []
            seen_cols = set()
            for i, c in enumerate(safe_df.columns):
                cleaned = re.sub(r"[^a-zA-Z0-9_]+", "_", str(c)).strip("_") or f"col_{i}"
                cand = cleaned
                idx = 1
                while cand in seen_cols:
                    cand = f"{cleaned}_{idx}"
                    idx += 1
                seen_cols.add(cand)
                new_cols.append(cand)
            safe_df.columns = new_cols
            safe_df.to_sql("cleaned_data", conn, index=False, if_exists="replace")
            conn.commit()
            conn.close()

            with open(db_path, "rb") as f:
                db_bytes = f.read()
        finally:
            import os
            if os.path.exists(db_path):
                try:
                    os.remove(db_path)
                except Exception:
                    pass

        return db_bytes, "application/x-sqlite3", f"{clean_base}_datalysis_cleaned.db"

    else:
        raise ValueError(f"Unsupported export format '{format}'. Choose from 'csv', 'excel', 'parquet', or 'sqlite'.")


def generate_jupyter_notebook(
    metadata: Dict[str, Any],
    facts: Dict[str, Any],
    inference: Dict[str, Any],
    pipeline_code: str,
    target_col: Optional[str] = None
) -> str:
    """
    Generates a valid, runnable Jupyter Notebook (.ipynb) conforming to nbformat v4.
    """
    filename = metadata.get("filename", "dataset.csv")
    rows = facts.get("dataset_summary", {}).get("row_count", 0)
    cols = facts.get("dataset_summary", {}).get("col_count", 0)
    health = inference.get("health_score", {})
    score = health.get("overall_score", 100)
    grade = health.get("grade", "A")

    cells = []

    # Title & Overview Cell
    title_md = f"""# Datalysis — Autonomous Preprocessing & Modeling Pipeline
**Dataset**: `{filename}` | **Rows**: {rows:,} | **Columns**: {cols}  
**Overall Health Score**: {score}/100 (Grade: `{grade}`)

---
*Generated automatically by Datalysis Local Expert Preprocessing System.*  
*100% Deterministic • Local Execution • Zero External API Dependencies*
"""
    cells.append({
        "cell_type": "markdown",
        "metadata": {},
        "source": [title_md]
    })

    # Code Cell 1: Environment & Loading
    ext = metadata.get("extension", "").lower()
    delimiter = metadata.get("detected_delimiter", ",")
    if ext in [".xlsx", ".xls"]:
        load_stmt = f'df = pd.read_excel(DATASET_PATH)'
    elif ext == ".json":
        load_stmt = f'df = pd.read_json(DATASET_PATH)'
    elif ext == ".parquet":
        load_stmt = f'df = pd.read_parquet(DATASET_PATH)'
    elif delimiter and delimiter != ",":
        load_stmt = f'df = pd.read_csv(DATASET_PATH, sep="{delimiter}")'
    else:
        load_stmt = f'df = pd.read_csv(DATASET_PATH)'

    load_code = f"""import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# 1. Load Raw Dataset
DATASET_PATH = "{filename}"
try:
    {load_stmt}
except Exception:
    # If using uploaded data or sample
    print("Please ensure your dataset is in the working directory.")
    df = pd.DataFrame()

print(f"Loaded dataset shape: {{df.shape}}")
df.head()
"""
    cells.append({
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [load_code]
    })

    # Markdown Cell 2: Health & Profiling
    cells.append({
        "cell_type": "markdown",
        "metadata": {},
        "source": ["## 2. Dataset Health & Missingness Profiling\nInspect null rates and data distributions before running transformations."]
    })

    # Code Cell 2: Profiling
    profile_code = """# Summary of missing cells
missing = df.isna().sum()
missing_pct = (missing / len(df)) * 100
summary_df = pd.DataFrame({
    'Missing_Count': missing,
    'Missing_Pct': missing_pct.round(2),
    'Dtype': df.dtypes
})
display(summary_df[summary_df['Missing_Count'] > 0])
"""
    cells.append({
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [profile_code]
    })

    # Markdown Cell 3: Production Pipeline
    cells.append({
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "## 3. Production Scikit-Learn Pipeline Definition\n"
            "The following self-contained script implements the full expert preprocessing recipe."
        ]
    })

    # Code Cell 3: Pipeline Definition
    cells.append({
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [pipeline_code]
    })

    # Markdown Cell 4: Execute Transformation
    cells.append({
        "cell_type": "markdown",
        "metadata": {},
        "source": ["## 4. Execute Pipeline Transformation & Inspect Cleaned Matrix"]
    })

    # Code Cell 4: Transformation Run
    run_code = """# Clean and transform dataset
cleaned_features = clean_and_transform(df)
print(f"Transformed output type: {type(cleaned_features)}")
if isinstance(cleaned_features, pd.DataFrame):
    display(cleaned_features.head())
"""
    cells.append({
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [run_code]
    })

    # Optional Modeling Cell
    target_text = f"target column '{target_col}'" if target_col else "your target feature"
    cells.append({
        "cell_type": "markdown",
        "metadata": {},
        "source": [f"## 5. Machine Learning Starter (Predicting {target_text})\nTrain a baseline model using scikit-learn."]
    })

    target_var_code = f"TARGET = '{target_col}'" if target_col else "TARGET = None  # e.g., 'Survived'"
    modeling_code = f"""{target_var_code}

if TARGET and TARGET in df.columns:
    from sklearn.model_selection import train_test_split
    from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
    
    X = df.drop(columns=[TARGET])
    y = df[TARGET]
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    preprocessor = build_preprocessing_pipeline()
    X_train_proc = preprocessor.fit_transform(X_train)
    X_test_proc = preprocessor.transform(X_test)
    
    print(f"X_train preprocessed shape: {{X_train_proc.shape}}")
    print(f"X_test preprocessed shape: {{X_test_proc.shape}}")
else:
    print("Specify TARGET variable above to run baseline machine learning model.")
"""
    cells.append({
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [modeling_code]
    })

    notebook = {
        "cells": cells,
        "metadata": {
            "kernelspec": {
                "display_name": "Python 3",
                "language": "python",
                "name": "python3"
            },
            "language_info": {
                "codemirror_mode": {"name": "ipython", "version": 3},
                "file_extension": ".py",
                "mimetype": "text/x-python",
                "name": "python",
                "nbconvert_exporter": "python",
                "pygments_lexer": "ipython3",
                "version": "3.10.0"
            }
        },
        "nbformat": 4,
        "nbformat_minor": 5
    }

    return json.dumps(notebook, indent=2)


def generate_pandera_schema(df: pd.DataFrame, facts: Dict[str, Any]) -> str:
    """
    Generates a production Pandera DataFrameSchema script for data quality assertions.
    """
    columns_facts = facts.get("columns", {})
    
    schema_code = '''"""
Datalysis Automated Data Quality & Schema Assertions
Generated using Pandera (https://pandera.readthedocs.io)
"""

import pandera as pa
from pandera import Column, Check, DataFrameSchema


schema = DataFrameSchema(
    columns={
'''
    for col, fact in columns_facts.items():
        itype = fact.get("inferred_type", "")
        nullable = fact.get("missing_pct", 0) > 0
        checks = []

        if "numerical" in itype and fact.get("numeric_stats"):
            ns = fact["numeric_stats"]
            pa_type = "pa.Float" if "continuous" in itype else "pa.Int"
            min_val = ns.get("min")
            max_val = ns.get("max")
            if min_val is not None and not np.isnan(min_val) and not np.isinf(min_val):
                checks.append(f"Check.greater_than_or_equal_to({min_val})")
            if max_val is not None and not np.isnan(max_val) and not np.isinf(max_val):
                checks.append(f"Check.less_than_or_equal_to({max_val})")
        elif itype == "boolean":
            pa_type = "pa.Bool"
        elif itype == "datetime":
            pa_type = "pa.DateTime"
        else:
            pa_type = "pa.String"
            if fact.get("categorical_stats") and fact["unique_count"] <= 15:
                cats = [c["category"] for c in fact["categorical_stats"].get("top_categories", [])]
                if cats:
                    checks.append(f"Check.isin({repr(cats)})")

        checks_str = f", checks=[{', '.join(checks)}]" if checks else ""
        schema_code += f'        {repr(col)}: Column({pa_type}, nullable={nullable}{checks_str}),\n'

    schema_code += '''    },
    strict=False,
    coerce=True
)


def validate_dataset(df):
    """Validates the dataset against the Datalysis expert quality schema."""
    try:
        validated_df = schema.validate(df, lazy=True)
        print("Data Quality Verification Passed: Zero schema contract violations.")
        return validated_df
    except pa.errors.SchemaErrors as err:
        print("Schema Validation Failed:")
        print(err.failure_cases)
        raise err
'''
    return schema_code
