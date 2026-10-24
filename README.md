<div align="center">
  <img src="assets/logo.png" width="128" height="128" alt="Datalysis Logo" style="border-radius: 24px;" />
  <h1>Datalysis Local Webapp</h1>
  <p><strong>Autonomous Rule-Based Expert System for Tabular Data Analysis, Imputation Diagnostics & ML Preprocessing</strong></p>
  <p><em>100% Local Deterministic Intelligence • Zero External LLMs • Multi-Tenant Session Isolation</em></p>

  <p>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" /></a>
    <a href="https://github.com/dhrrishitvdeka/Datalysis/actions/workflows/ci.yml"><img src="https://github.com/dhrrishitvdeka/Datalysis/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
    <img src="https://img.shields.io/badge/Python-3.10%20%7C%203.11%20%7C%203.12%20%7C%203.13-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python Version" />
    <img src="https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19" />
    <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" />
    <img src="https://img.shields.io/badge/Tests-154%20Passed-brightgreen?style=flat-square" alt="Tests" />
  </p>
</div>

---

## Overview

**Datalysis** is an open-source, high-performance local web application and CLI designed to ingest tabular datasets in any format (CSV, TSV, Excel, JSON, Parquet, Feather), execute comprehensive statistical profiling, and evaluate a built-in **Rule-Based Expert System** to automate discovery, diagnostic analysis, and preprocessing:

- **Data Quality Repair (R-QLT)**: Before profiling, seven conservative rules fix disguised missing values (`?`, `N/A`), numeric sentinels (`-999`), numbers stored as text (`$1,200`, `10%`), yes/no text, inconsistent category labels, infinite values, and stray whitespace. Every repair is listed with its reason and before/after examples, and can be switched off (`auto_repair=false`, `--no-repair`).
- **Missingness Mechanisms & Strategy**: Evaluates null rates and correlations to recommend median, mean, mode, KNN, or explicit categorical missing tokens.
- **Interactive Recipe Customizer**: Full interactive user override of cleaning decisions per column (toggle drops, switch imputation methods, customize outlier bounds, select encodings).
- **Side-by-Side Data Diff Viewer**: Visually compare raw source rows against cleaned records with color-coded badges highlighting imputed cells, clipped outliers, and encoded columns.
- **Supervised Target Mode**: Designate a target feature to automatically detect task type (Binary Classification, Multi-class, Regression), inspect class imbalance, compute Mutual Information feature ranking, and check for target leakage.
- **Target-Protected Cleaning**: A chosen target is never dropped, imputed, encoded, scaled, or clipped. Rows with a missing target are dropped, and the target is placed last in the cleaned data.
- **Leakage-Safe Generated Pipeline**: With a target, the generated `pipeline.py` splits train/test first (stratified when possible), fits imputers, scalers, and encoders on the training rows only, and transforms the test rows with those statistics.
- **Hidden-Duplicate Detection**: Rows that differ only by an ID column are reported (rule `R-INT-01`) and removed after ID columns are pruned.
- **Multi-Format Export**: Download cleaned datasets in **CSV**, **Excel (`.xlsx`)**, **Parquet (`.parquet`)**, or **SQLite (`.db`)**.
- **Jupyter Notebook & Data Assertions Export**: Export runnable **Jupyter Notebooks (`.ipynb`)** and **Pandera (`.py`)** schema quality assertion suites.
- **Outlier Leverage & Skewness**: Tukey 1.5x IQR cutoffs, Winsorization capping, and Log1p/Yeo-Johnson power transformations.
- **Collinearity & Covariance**: High-correlation alerts ($|r| \ge 0.75$) with variance inflation notes and a full Pearson cross-correlation heatmap matrix. Categorical pairs are scored with bias-corrected Cramér's V against the same threshold.
- **Flexible Ingestion**: Nested JSON objects are flattened into dotted columns (`a.b`), list cells are stored as JSON text, Excel workbooks expose a sheet selector, and uploads are capped (200 MB by default, configurable with `DATALYSIS_MAX_UPLOAD_MB`).
- **Multi-User Session Isolation**: Thread-safe `SessionStore` with UUID tokens, LRU cache, and TTL expiration for secure concurrent usage.
- **Dark, Light & System Themes**: Modern UI supporting Dark AMOLED, Clean Modern Light, and System themes with accessible WCAG AA contrast.

---

## Quick Start

```bash
git clone https://github.com/dhrrishitvdeka/Datalysis.git
cd Datalysis
```

### 1. One-Click Launch
- **Windows**: Double-click `run.bat` or run:
  ```powershell
  .\start.ps1
  ```
- **macOS / Linux**:
  ```bash
  ./start.sh
  ```
- **Makefile**:
  ```bash
  make dev
  ```

### 2. Using the Datalysis CLI
Install in editable mode and run directly:
```bash
pip install -e .

# Launch local webapp
datalysis launch --port 8000

# Headless audit: prints the health score and the data-quality repairs, optionally saves the full JSON report
datalysis audit dataset.csv --output report.json
datalysis audit dataset.csv --no-repair   # profile the file exactly as parsed

# Headless cleaning: repair, preprocess, and export in one command
datalysis clean dataset.csv -o cleaned.csv
datalysis clean dataset.csv -o cleaned.parquet --target Survived
datalysis clean dataset.csv -o out.db --format sqlite --no-repair
```

| Command | Arguments | Notes |
| :--- | :--- | :--- |
| `datalysis launch` | `--host` (default `127.0.0.1`), `--port` (default `8000`), `--reload` | Starts the web app |
| `datalysis audit <file>` | `-o`, `--output <report.json>`; `--no-repair` | Applies the R-QLT repairs before profiling; `--no-repair` skips them and profiles the file exactly as parsed |
| `datalysis clean <file>` | `-o`, `--output <out>` (required); `--target COL`; `--format csv\|excel\|parquet\|sqlite`; `--no-repair` | The format is inferred from the output extension (`.csv`, `.xlsx`/`.xls`, `.parquet`, `.db`/`.sqlite`/`.sqlite3`) when `--format` is omitted. `--target` keeps that column untransformed and last. `--no-repair` skips R-QLT. Exit code 1 on a data error, 2 when the format cannot be inferred. |

`datalysis --version` prints the installed version. CLI output is plain ASCII so it works on Windows consoles that use cp1252.

### 3. Using Docker
```bash
docker compose up -d
# Access at http://localhost:8000
```

---

## How the Analysis Pipeline Works

Every upload, sample load, and CLI run passes through the same stages in this order:

1. **Parse**: Detect the format, encoding, and delimiter; flatten nested JSON; select the Excel sheet; strip and de-duplicate column names.
2. **R-QLT repair** (skippable): Apply the data-quality rules column by column.
3. **Fact extraction**: Compute semantic types, distribution statistics, outlier fences, correlations, missingness structure, and duplicate counts on the repaired frame.
4. **Rule inference**: Evaluate the production rules against the facts, resolve conflicts by confidence, record the reasoning trace, and compute the health score.
5. **Target analysis** (optional): Task type, class imbalance, mutual information, and leakage warnings for a chosen target. Choosing a target also regenerates the pipeline script so it excludes and splits on the target.
6. **Preprocessing**: Execute the recipe (automatic, or with per-column overrides) in memory. A target, if set, is protected.
7. **Export**: Cleaned data (CSV, Excel, Parquet, SQLite), the pipeline script, the notebook, the Pandera schema, and the audit report.

**Why repairs run before profiling.** The profiler and the rules only see what is in the frame. If `"$1,200"` and `"?"` are left as they are, the column is profiled as categorical, one-hot encoded instead of scaled, and its mean, skewness, outliers, and correlations are never computed. A `-999` placeholder pulls the mean and inflates the variance, and `"Male"` and `"male "` become two categories. Repairing first means every later statistic and recommendation describes the data as it was meant to be read. The uploaded file is not modified, and the repaired frame is what the rest of the app uses.

---

## Supported Ingestion & Export Formats

| Format | File Extensions | Read Support | Export Support |
| :--- | :--- | :---: | :---: |
| **CSV** | `.csv`, `.txt` | Sniffer + Pandas (auto-delimiter, UTF-8/Latin-1) | Standard CSV |
| **TSV / Tab** | `.tsv`, `.tab` | Tab Sniffer & Delimiter Detection | Tab-delimited CSV |
| **Excel** | `.xlsx`, `.xls` | OpenPyXL reader with sheet selection (`sheet` parameter, selector in the UI) | Multi-sheet workbook (`Cleaned_Data`, `Summary_Overview`, `Column_Schema`) |
| **Parquet** | `.parquet`, `.pqt` | PyArrow binary columnar format | Optimized PyArrow binary |
| **SQLite Database**| `.db`, `.sqlite` | SQLite3 engine | Self-contained SQLite database file |
| **JSON / JSONL** | `.json`, `.jsonl`, `.ndjson` | Python JSON (record lists, wrapped record lists, lines); nested objects flattened to dotted columns | Audit JSON report |
| **Jupyter Notebook**| `.ipynb` | — | Runnable Jupyter Notebook with EDA & modeling starter |
| **Pandera Schema**| `.py` | — | Executable data quality schema assertions |

---

## Core Modules & Capabilities

1. **Executive Overview**: High-density dataset metrics (row count, feature count, missingness rate, duplicate overlap % plus duplicates hidden by ID columns, memory footprint, detected delimiter), type filter pills, column dictionary (quasi-constant columns are tagged), source preview, and an Excel sheet selector.
2. **Data Repairs**: Lists every R-QLT repair with its rule ID, severity, affected cell count, the reason, and before/after examples. The upload screen has an "Auto-repair data quality issues" toggle that applies to uploads and sample datasets.
3. **Interactive Recipe Customizer**: Full user control over the automated recipe:
   - Toggle column retention/drop.
   - Choose imputation: Auto, Median, Mean, Mode, Constant, KNN, or Drop Rows.
   - Outlier mitigation: Auto, Winsorization, Clip IQR, Z-score, or None.
   - Categorical encoding: Auto, One-Hot, Frequency, Ordinal, Binary, or None.
   - Decoupled scaling: Standard (Z-score), Robust, Log1p, or None.
4. **Data Diff Inspector**: Interactive side-by-side comparison of raw vs cleaned records with highlighted badges for transformed values.
5. **Supervised Target Mode**: One-click target feature selection providing task auto-detection, class imbalance breakdown, Mutual Information importance charts, and normalized entropy target leakage alerts. The selected target is sent with every cleaning run so it stays protected.
6. **Data Visualizer**:
   - **Feature Profiler (Univariate)**: Interactive SVG histograms with hover tooltips, 5-point quartile cards, and categorical Pareto frequency bars.
   - **Bivariate Scatter & Trendline**: 2D scatter explorer with color hue grouping, point coordinates on hover, automated linear regression trendlines, and Pearson $r$ / $R^2$ statistics.
   - **Category vs Metric (Grouped)**: Mean and spread bar charts comparing continuous metrics across categorical levels.
   - **Sparsity Grid**: Visual null distribution grid displaying missing value clustering along dataset row slices.
7. **Distributions & Outliers**: Skewness meters, kurtosis, Tukey's 1.5x IQR boundaries, and outlier mitigation strategies.
8. **Collinearity & Covariance**: High-correlation alerts ($|r| \ge 0.75$) with variance inflation notes and a full Pearson cross-correlation heatmap matrix.
9. **Pipeline Code Generator**: Generates a Scikit-Learn `ColumnTransformer` script (`pipeline.py`) preserving untransformed features via passthrough. With a target selected, `clean_and_transform(df)` splits train/test first, fits on the training rows only, and returns `X_train, X_test, y_train, y_test`.

---

## Expert System Rules Database

Datalysis evaluates production rules across 6 families. The R-QLT family runs first and repairs the data; the other five run on the repaired data and produce recommendations. Thresholds below are the values in `backend/app/expert_system/` (`sanitizer.py`, `fact_extractor.py`, `rules.py`, `engine.py`).

### 0. Data Quality Repair Rules (`R-QLT`)
These are pure functions in `sanitizer.py` that return a repair only when the evidence is strong. They are applied per column in this order: `R-QLT-07`, `01`, `03`, `04`, `05`, `06`, `02`.

- **`R-QLT-01` Disguised Missing Values** (`WARNING`): In text columns, cells equal to a placeholder after trimming and case-folding become real missing values. Placeholders: empty string, `?`, `-`, `--`, `na`, `n/a`, `nan`, `null`, `none`, `nil`, `missing`, `unknown`, `undefined`, `#n/a`, `#null!`, `#value!`. Guard: if `unknown` makes up $\ge 50\%$ of the non-null values, it is treated as a real category and left alone.
- **`R-QLT-02` Numeric Sentinel Codes** (`WARNING`): In numeric columns, the codes `-999`, `-9999`, `-99999`, `999`, `9999`, `99999`, and `-1` become missing when all of these hold: the code appears in $\ge 1\%$ of rows; it lies outside the Tukey fences at $3 \times \text{IQR}$ ($Q_1 - 3\,\text{IQR}$ to $Q_3 + 3\,\text{IQR}$) computed on the remaining values (at least 4 are needed); and, for `-1` only, the column has no other negative values.
- **`R-QLT-03` Numeric Stored as Text** (`WARNING`): A text column where every non-null cell is a string is converted to float after removing currency symbols (`$ € £ ₹ ¥`), whitespace, well-formed thousands separators (`1,234`), a trailing `%` (the number is kept as written, `10%` becomes `10.0`), and accounting parentheses (`(123)` becomes `-123`). Threshold: converted only when $\ge 90\%$ of the values parse; the rest become missing. Guard: skipped when $\ge 20\%$ of the values start with a leading zero followed by a digit (zip codes and similar identifiers).
- **`R-QLT-04` Boolean-Like Text** (`INFO`): A text column whose distinct values (ignoring case and spaces) are exactly one of `yes/no`, `y/n`, `true/false`, `t/f` is mapped to 1/0, positive = 1.
- **`R-QLT-05` Category Label Inconsistency** (`WARNING`): Labels that differ only by letter case or spacing are merged into the most frequent spelling (ties go to the one that appears first in the file). Guard: only when the number of distinct values is $\le 50\%$ of the non-null cells; more unique columns are treated as free text.
- **`R-QLT-06` Infinite Values** (`WARNING`): $\pm\infty$ in float columns becomes missing so it can be imputed.
- **`R-QLT-07` Surrounding Whitespace Stripped** (`INFO`): Leading and trailing spaces are removed from text cells.

### 1. Imputation Rules (`R-IMP`)
- **`R-IMP-01`**: Prunes features where missingness $\ge 70.0\%$. Prevents synthetic variance contamination.
- **`R-IMP-02`**: Recommends **Median Imputer** for continuous features with $0 < \text{missing} < 70\%$ and significant skewness ($|\text{skew}| \ge 0.8$) or $\ge 2.0\%$ IQR outliers.
- **`R-IMP-03`**: Recommends **Mean Imputer** for symmetric continuous features ($|\text{skew}| < 0.8$ and $< 2.0\%$ outliers).
- **`R-IMP-04`**: Recommends **KNN (or iterative/MICE) imputation** when a numeric column has $3\% \le \text{missing} \le 40\%$ and appears in a high-correlation pair. High-correlation pairs are collected from $|r| \ge 0.75$, so that is the effective threshold (the rule text mentions $0.65$, but the pair list is the stricter filter). The in-app preprocessor executes this as `KNNImputer(n_neighbors=5)` fitted on all numeric columns; `IterativeImputer` (MICE) is named in the recommendation but is not run.
- **`R-IMP-05`**: Recommends **Mode Imputer** for low-missingness ($0 < \text{missing} < 5.0\%$) categoricals.
- **`R-IMP-06`**: Recommends **'Missing' Constant Token** for moderate/high missingness ($5.0\% \le \text{missing} < 70\%$) categoricals.
- **`R-IMP-07`** (category `MISSINGNESS_STRUCTURE`): Flags columns that go missing together with another column (missingness correlation $\ge 0.5$) and keeps a `<col>_was_missing` indicator next to the imputed value. Applies to $0 < \text{missing} < 70\%$.

Numeric imputations also add a `<col>_was_missing` indicator when missingness is $\ge 3\%$.

### 2. Encoding Rules (`R-ENC`)
- **`R-ENC-01`**: Binary categorical features are mapped directly to 0 and 1 without dimensional growth. A yes/no, true/false, or 1/0 pair always maps positive to 1; any other pair is sorted and mapped in that order, so the result does not depend on row order.
- **`R-ENC-02`**: Low-cardinality nominals ($3 \le k \le 10$) are one-hot encoded: `OneHotEncoder(drop='first', handle_unknown='ignore')` in the generated script, `pd.get_dummies(drop_first=True)` in the in-app cleaner.
- **`R-ENC-03`**: High-cardinality nominals ($k > 10$, uniqueness ratio $< 0.7$) receive **Frequency Encoding** (Target Encoding is named in the recommendation but not executed).
- **`R-ENC-04`**: Detected natural hierarchical sequences with at most 8 levels (e.g. low/medium/high, bronze/silver/gold) receive **Ordinal Integer Encoding** using the detected semantic order, not the order of first appearance.

### 3. Scaling & Outliers (`R-DIST`)
- **`R-DIST-01`**: Right-skewed features ($\text{skew} \ge 1.2$, $\min \ge 0$) receive a **Log1p** transform.
- **`R-DIST-02`**: Skewed features ($|\text{skew}| \ge 1.2$) containing negative values receive a **Yeo-Johnson Power Transformation**.
- **`R-DIST-03`**: Heavy outlier presence ($\ge 2.5\%$ beyond $1.5 \times \text{IQR}$) triggers **Winsorization Capping (1st to 99th percentile)**. The generated script follows the cap with a `RobustScaler`; the in-app cleaner applies only the cap unless a scaler is chosen in the Recipe Customizer.
- **`R-DIST-04`**: Near-Gaussian continuous features ($|\text{skew}| \le 0.8$, excess kurtosis in $[-1, 2]$, outliers $< 2.5\%$) are standardized using **StandardScaler (Z-Score)**.

### 4. Leakage & Collinearity (`R-FLT`)
- **`R-FLT-01`**: Zero-variance constant columns are dropped immediately (a one-row dataset has no variance, so nothing is called constant there).
- **`R-FLT-02`**: Primary keys, row UUIDs, and entity identifiers are dropped to prevent memorization leakage.
- **`R-FLT-03`**: Pairwise correlations $|r| \ge 0.85$ generate multicollinearity redundancy warnings. This is a flag only; nothing is dropped. The correlation alerts shown in the UI start earlier, at $|r| \ge 0.75$, and become critical at $\ge 0.90$.
- **`R-FLT-04`** (advisory): Quasi-constant features, where one value covers $\ge 99\%$ of the non-null rows and the column has at least 2 distinct values. The column is flagged but not dropped, because the rare values may be the signal (for example a fraud flag).

### 5. Datetime Engineering (`R-DAT`)
- **`R-DAT-01`**: Decomposes timestamps into `year`, `month`, `day`, `dayofweek`, `is_weekend`, and cyclical `sin_month`/`cos_month` ($\sin(2\pi m/12)$, $\cos(2\pi m/12)$). When the column contains a time of day, it also adds `hour`, `minute`, `sin_hour`, `cos_hour`, and `is_night`. If any day/month/year value has a first field above 12, every such value in the column is parsed day-first.

### 6. Dataset-Level Integrity (`R-INT`)
- **`R-INT-01`**: Duplicates hidden by identifier columns. Rows that are identical once ID columns are ignored are counted as `hidden_duplicate_rows`, reported in the audit, and removed by the preprocessor, which de-duplicates after ID columns are pruned. Logged with column `(dataset)`.

---

## REST API Reference

Sessions are tracked with the `X-Session-ID` header, a `session_id` query parameter, or the `datalysis_session` cookie. A new session is created when none is supplied.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health status and version |
| `GET` | `/api/sample-datasets` | List pre-packaged sample datasets (Titanic, Telecom, IoT) |
| `POST` | `/api/load-sample/{sample_id}` | Load and profile a sample dataset. Query: `auto_repair` (`true` by default) |
| `POST` | `/api/upload` | Ingest and profile an uploaded tabular file (`multipart/form-data`, field `file`). Query: `auto_repair` (`true` by default), `sheet` (Excel sheet name, first sheet by default) |
| `POST` | `/api/process` | Execute the in-memory preprocessing pipeline. JSON body (all optional): `column_overrides`, `drop_duplicates`, `target_column` |
| `POST` | `/api/supervised/target-analysis` | Supervised analysis of a target column (`?target=COL`): task type, imbalance, mutual information, leakage. Also stores the target and regenerates the pipeline script |
| `GET` | `/api/download-cleaned` | Download cleaned dataset (`?format=csv\|excel\|parquet\|sqlite`) |
| `GET` | `/api/download-pipeline` | Download generated standalone `pipeline.py` script |
| `GET` | `/api/export/notebook` (alias `/api/download-notebook`) | Download runnable Jupyter Notebook (`.ipynb`) |
| `GET` | `/api/export/schema` (alias `/api/download-schema`) | Download Pandera data quality assertion script (`.py`) |
| `GET` | `/api/download-report` | Download JSON audit report |
| `GET` | `/api/visualize/scatter` | Fetch scatter points & regression stats (`x`, `y`, optional `hue`) |
| `GET` | `/api/visualize/grouped` | Fetch grouped aggregations (`cat`, `num`) |
| `GET` | `/api/visualize/missingness` | Fetch chunked missingness sparsity matrix |

### Request details
- **`auto_repair=false`** skips every R-QLT rule, so the file is profiled exactly as parsed.
- **`sheet`** selects an Excel sheet. An unknown name returns `400` with `Sheet 'X' not found. Available sheets: A, B`.
- **Upload limit**: files larger than `DATALYSIS_MAX_UPLOAD_MB` (default 200) return `413` with a message; an empty file returns `400`.
- **`target_column`** (alias `target_variable`, `target_column` wins) protects that column: it is never dropped, imputed, encoded, scaled, or clipped; rows with a missing target are dropped; and it is placed last. The generated pipeline script then splits train/test on it. An unknown column returns `400`.

### Analysis response (upload and sample loading)
Besides `metadata`, `facts`, `inference`, `pipeline_code`, `preview` (first 50 rows), and `session_id`, the response includes:

| Field | Description |
| :--- | :--- |
| `repairs` | List of applied R-QLT repairs: `rule_id`, `rule_name`, `column`, `severity` (`CRITICAL`, `WARNING`, `INFO`), `affected_count`, `description` (the reason), up to 3 `examples` (`before`, `after`), and `replay` (the exact parameters that repeat the repair on a raw file; the generated pipeline script embeds them) |
| `inference.health_score.repairs_applied` | Number of repairs applied. Informational: it is not listed in `critical_issues` and does not change the score |
| `metadata.all_sheets` | Sheet names of an Excel workbook (`null` for other formats) |
| `facts.dataset_summary.hidden_duplicate_rows` | Rows that are duplicates only because of an identifier column |
| `facts.columns[col].dominant_value_pct` | Share of non-null rows taken by the most frequent value |
| `facts.columns[col].is_quasi_constant` | `true` when that share is $\ge 99\%$ and the column is not constant |
| `inference.triggered_rules_log` | Every rule that fired: `column` (`(dataset)` for `R-INT-01`), `rule_id`, `rule_name`, `category`, `severity`, `confidence`, `action_type` |
| `inference.reasoning_trace[].phase` | Includes `DATA_QUALITY_REPAIR` (one entry per repair) and `DATASET_WARNING` (for example fewer than 2 rows) |

---

## Project Structure

```
Datalysis/
├── assets/
│   └── logo.png                        # Official branding emblem
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI application & REST endpoints
│   │   ├── session.py                  # Thread-safe multi-user SessionStore (LRU + TTL)
│   │   ├── schemas.py                  # Strict Pydantic v2 request & response models
│   │   ├── parser.py                   # Multi-format tabular file reader (JSON flattening, Excel sheets)
│   │   ├── sample_data.py              # Sample datasets (Titanic, Churn, IoT)
│   │   ├── preprocessor.py             # Transformation engine with custom recipe & target protection
│   │   ├── exporter.py                 # Multi-format exporter (CSV, Excel, Parquet, SQLite, Notebook)
│   │   ├── supervised.py               # Supervised mode (Mutual info, imbalance, leakage)
│   │   ├── cli.py                      # CLI entrypoint: `datalysis launch`, `audit`, `clean`
│   │   └── expert_system/
│   │       ├── sanitizer.py            # R-QLT data-quality repair rules (run before profiling)
│   │       ├── fact_extractor.py       # Statistical profiling & metadata facts
│   │       ├── encoding.py             # Deterministic binary / ordinal category mappings
│   │       ├── rules.py                # Declarative production rules knowledge base
│   │       ├── engine.py               # Forward inference engine & Health Scorer (0-100)
│   │       └── code_generator.py       # Scikit-Learn Pipeline code generator (train/test aware)
│   ├── requirements.txt
│   └── README.md
├── frontend/
│   ├── public/
│   │   └── logo.png                    # Webapp favicon and brandmark
│   ├── src/
│   │   ├── App.tsx                     # Main dashboard container & tab router
│   │   ├── index.css                   # Theme styling (Dark AMOLED, Light, System)
│   │   ├── context/
│   │   │   └── ThemeContext.tsx        # React Theme Provider
│   │   ├── components/
│   │   │   ├── Navbar.tsx              # Sticky header with brandmark, tabs & theme toggle
│   │   │   ├── UploadZone.tsx          # Drag & drop upload, auto-repair toggle & sample cards
│   │   │   ├── DatasetOverview.tsx     # Column dictionary and source preview
│   │   │   ├── DataRepairs.tsx         # R-QLT repair list with before/after examples
│   │   │   ├── HealthScoreCard.tsx     # Health gauge, grade & subscores
│   │   │   ├── ReasoningTrace.tsx      # Terminal-style cognitive reasoning trace
│   │   │   ├── DataVisualizer.tsx      # Univariate, Scatter, Grouped, and Sparsity views
│   │   │   ├── RecommendationsTable.tsx# Recommendations viewer & recipe trigger
│   │   │   ├── RecipeCustomizer.tsx    # Interactive recipe override editor
│   │   │   ├── TargetNote.tsx          # "Target is protected" notice
│   │   │   ├── DataDiffViewer.tsx      # Side-by-side raw vs cleaned diff inspector
│   │   │   ├── SupervisedTargetModal.tsx# Supervised ML target selection & leakage viewer
│   │   │   ├── OutlierDistribution.tsx # Interactive histograms & IQR boxplots
│   │   │   ├── CorrelationMatrix.tsx   # Collinearity warnings & Pearson heatmap
│   │   │   ├── CodeExport.tsx          # Runnable pipeline.py script viewer
│   │   │   └── CleanedDataPreview.tsx  # In-memory cleaner, diff, and multi-format export
│   │   ├── services/api.ts             # Typed REST client with session management
│   │   └── types/index.ts              # TypeScript interfaces
│   ├── dist/                           # Compiled production SPA (served by FastAPI)
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── tests/
│   ├── test_api.py                     # FastAPI endpoint & visualization tests
│   ├── test_api_extras.py              # Upload limit, sheet selection, target & repair API tests
│   ├── test_cli.py                     # `datalysis audit` / `clean` command tests
│   ├── test_sanitizer.py               # R-QLT repair rule tests
│   ├── test_dataset_rules.py           # Dataset-level rules (R-INT, R-FLT-04, R-IMP-07) & preprocessing
│   ├── test_regressions.py             # Regression tests for fixed bugs
│   ├── test_session.py                 # Multi-user session isolation & LRU cache tests
│   ├── test_recipe_customizer.py       # Custom recipe override tests
│   ├── test_supervised.py              # Target leakage & mutual information tests
│   ├── test_code_generator_passthrough.py # Passthrough retention tests
│   ├── test_code_generator_replay.py  # Generated script replays R-QLT repairs on raw data
│   ├── test_exporter.py                # Multi-format & notebook export tests
│   ├── test_expert_system.py           # Knowledge base & inference tests
│   └── test_parser.py                  # Parser & delimiter sniffing tests
├── Dockerfile                          # Multi-stage production container build
├── docker-compose.yml                  # One-line container orchestration
├── pyproject.toml                      # Standard PEP 518/621 packaging & CLI entrypoint
├── Makefile                            # Developer workflow commands
├── start.sh                            # macOS / Linux startup script
├── start.ps1                           # PowerShell runner
├── run.bat                             # Windows CMD runner
├── CHANGELOG.md                        # Release notes
└── README.md                           # Master repository documentation
```

---

## Testing

Run the automated test suite across all 13 test modules:
```bash
pytest -q
# or using uv:
uv run pytest tests -q
# or with unittest (what CI runs):
PYTHONPATH=. python -m unittest discover -s tests -v
```
*Current test suite: **154 passing tests** covering the parser, the R-QLT repair rules, the rules engine, the multi-format exporter, session isolation, recipe overrides, the code generator, supervised ML mode, the CLI, and the REST API.*

---

## Limitations

- **Sessions live in memory.** Datasets, results, and generated artifacts are lost when the server restarts, and sessions expire after 2 hours of inactivity or when more than 150 are open (least recently used goes first).
- **Whole files are loaded into memory.** The parsed table, the repaired copy, and the untouched original are all kept in the session, so a large file needs a multiple of its size in RAM; sample very large files first. Uploads above 200 MB are rejected by default.
- **The cleaned dataset download is fitted on the full dataset.** Imputation values, scaling statistics, and frequency maps are computed on all rows, so it is suitable for inspection and exploratory work. For modelling, use the generated pipeline with a target selected: it splits first and fits on the training rows only.
- **The generated script and the in-app cleaner are two implementations.** They follow the same recommendations, but details differ (for example `OneHotEncoder` vs `pd.get_dummies`, `KNNImputer` only in the cleaner). The script replays the recorded R-QLT repairs first (`repair_data_quality`), so it runs on the raw file, but the replay only repeats the repairs that were found on the uploaded data: a new file with a different problem (a new missing-value token, a new sentinel code) is not repaired.
- **Heuristics are conservative, not infallible.** The repair rules only fire on strong evidence, but a real `-1` or a category named `unknown` can still be misread in an unusual column. Check the Data Repairs tab, and disable the layer with `auto_repair=false` (API and upload toggle) or `--no-repair` (CLI) when you want the data untouched.
- **Rules are deterministic thresholds.** Semantic typing, identifier detection, and ordinal detection (a fixed list of known sequences) use fixed heuristics and can misclassify unusual columns; use the Recipe Customizer to override them.

---

## Contributing & Community

Contributions are warmly welcomed! Please read our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

For security reports, please refer to our [Security Policy](SECURITY.md).

---

## License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.
