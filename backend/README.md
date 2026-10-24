# Datalysis Backend

The **Datalysis Backend** is a Python engine powered by **FastAPI**, **Pandas**, **NumPy**, **Scikit-Learn**, and **SciPy**. It performs file ingestion, data-quality repair, statistical fact extraction, deterministic rule-based forward chaining, interactive data visualization aggregation, preprocessing, and code generation.

---

## Architecture Overview

```
backend/app/
├── main.py                     # FastAPI REST routes, CORS, session state & static SPA mounting
├── parser.py                   # Multi-format tabular file reader (CSV, TSV, Excel, JSON, Parquet, Feather)
├── sample_data.py              # Synthetic/curated sample dataset generators
├── preprocessor.py             # In-memory pipeline execution engine (recipe overrides, target protection)
├── exporter.py                 # CSV / Excel / Parquet / SQLite export, Jupyter notebook, Pandera schema
├── supervised.py               # Target analysis: task type, imbalance, mutual information, leakage
├── session.py                  # Thread-safe multi-user session store (LRU + TTL)
├── schemas.py                  # Pydantic v2 request and response models
├── cli.py                      # `datalysis launch`, `datalysis audit`, `datalysis clean`
└── expert_system/
    ├── sanitizer.py            # R-QLT data-quality repair rules, run before fact extraction
    ├── fact_extractor.py       # Semantic typing, Tukey IQR, skewness, entropy, correlations, duplicates
    ├── encoding.py             # Deterministic binary / ordinal category mappings
    ├── rules.py                # Declarative production rules knowledge base
    ├── engine.py               # Forward inference engine & multi-criteria Health Scorer (0-100)
    └── code_generator.py       # Standalone Scikit-Learn ColumnTransformer code synthesis
```

Request flow for an upload: `parser` -> `sanitizer` (skipped with `auto_repair=false`) -> `fact_extractor` -> `engine` (applies `rules`) -> `code_generator`. The result is cached in a session; `/api/process` then runs `preprocessor` on the repaired frame.

---

## Core Subsystems

### 1. Ingestion Engine (`parser.py`)
- **Delimiter Sniffing**: Samples lines and sniffs delimiters (`,`, `\t`, `;`, `|`) with fallback heuristics.
- **Encoding Sniffing**: Tries `utf-8`, `utf-8-sig`, `cp1252`, then `iso-8859-1`/`latin1`.
- **Formats Supported**: CSV, TSV, TXT, Excel (`.xlsx`, `.xls`), JSON/JSONL, Parquet, and Feather.
- **Nested JSON**: Nested objects are flattened into dotted columns (`a.b`); list or dict cells that remain are stored as JSON text so every cell is hashable.
- **Excel sheets**: `sheet` picks a sheet by name (default: first); the response lists `all_sheets`. An unknown sheet raises an error naming the available ones.
- **Upload limit**: `main.py` rejects files above `DATALYSIS_MAX_UPLOAD_MB` (default 200) with HTTP 413.

### 2. Data Quality Repair (`expert_system/sanitizer.py`)
Seven R-QLT rules, each a pure function `rule(series, column) -> None | (new_series, repair)`. A rule returns `None` unless the evidence is strong, so it only fires when clearly right. Order: whitespace (`R-QLT-07`), disguised missing (`01`), numeric text (`03`), boolean text (`04`), label inconsistency (`05`), infinite values (`06`), numeric sentinels (`02`). Each repair records the rule, column, severity, affected cell count, the reason, up to 3 before/after examples, and a `replay` dict with the exact parameters that repeat the repair on a raw file (used by the generated script). See the root README for every threshold.

### 3. Fact Extractor (`fact_extractor.py`)
Extracts mathematical and structural facts from the (repaired) table:
- **Semantic Role Classification**: `numerical_continuous`, `numerical_discrete`, `categorical_nominal`, `categorical_ordinal`, `datetime`, `boolean`, `identifier`, `constant`, `free_text`.
- **Distribution Metrics**: Mean, median, standard deviation, skewness, kurtosis, and min/max/IQR quartiles.
- **Outlier Detection**: Tukey's $1.5 \times \text{IQR}$ fences (and $3 \times \text{IQR}$ extreme count) with frequencies and percentages.
- **Information Theory**: Shannon entropy (in bits) for categorical distributions.
- **Association**: Pearson correlation for numeric pairs and bias-corrected Cramér's V for categorical pairs; pairs at $|r| \ge 0.75$ are listed (critical at $0.90$).
- **Structure**: dominant-value share and quasi-constant flag per column; missingness correlation between columns; exact duplicates and duplicates hidden by identifier columns.

### 4. Production Rules (`rules.py`) & Inference Engine (`engine.py`)
- Evaluates declarative production rules across the `R-IMP`, `R-ENC`, `R-DIST`, `R-FLT`, and `R-DAT` families, plus dataset-level `R-INT-01`.
- Resolves conflicting imputation recommendations with a confidence-weighted choice (multivariate imputation is preferred when it fires).
- **Multi-Criteria Health Scorer**: Computes a 0-100 score and letter grade (`A+` to `F`) across Completeness (30%), Distribution Health (25%), Parsimony (25%), and Encoding Readiness (20%). Repair counts are shown as information only and do not change the score.
- Outputs a timestamped **Reasoning Trace** (phases include `DATA_QUALITY_REPAIR` and `DATASET_WARNING`) and a `triggered_rules_log` of every rule that fired.

### 5. Preprocessor (`preprocessor.py`)
Executes the recipe in memory: pruning, target-row filtering, de-duplication (after ID columns are pruned), datetime expansion, imputation (including `KNNImputer(n_neighbors=5)`), outlier capping, scaling, and encoding. With a `target_col`, the target is never transformed, rows without a target are dropped, and the target is moved to the last column.

### 6. Scikit-Learn Pipeline Generator (`code_generator.py`)
- Synthesizes a standalone, executable `pipeline.py` script containing:
  - Custom `OutlierCapper` transformer (Winsorization), frequency encoder, and datetime feature extractor.
  - Preprocessing pipelines for numeric, categorical, binary, and datetime features bundled in a `ColumnTransformer`.
  - With a target: `clean_and_transform(df)` splits train/test first (stratified when possible), fits on the training rows only, and returns `X_train, X_test, y_train, y_test`.
- `build_repair_section` copies the sanitizer's `replay_*` functions into the script (via `inspect`) and lists every recorded repair with its `replay` parameters in `DATA_QUALITY_REPAIRS`. `clean_and_transform` calls `repair_data_quality(df)` first, so the script runs on the raw file. Pass `repairs=session.repairs` to `generate_python_pipeline_code`; without it the script has no repair step.

---

## Testing

Run backend tests from the repository root:
```bash
python -m pytest -q
# or, as CI does:
PYTHONPATH=. python -m unittest discover -s tests -v
```
