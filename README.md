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
    <img src="https://img.shields.io/badge/Tests-41%20Passed-brightgreen?style=flat-square" alt="Tests" />
  </p>
</div>

---

## Overview

**Datalysis** is an open-source, high-performance local web application and CLI designed to ingest tabular datasets in any format (CSV, TSV, Excel, JSON, Parquet, Feather), execute comprehensive statistical profiling, and evaluate a built-in **Rule-Based Expert System** to automate discovery, diagnostic analysis, and preprocessing:

- **Missingness Mechanisms & Strategy**: Evaluates null rates and correlations to recommend median, mean, mode, KNN, or explicit categorical missing tokens.
- **Interactive Recipe Customizer**: Full interactive user override of cleaning decisions per column (toggle drops, switch imputation methods, customize outlier bounds, select encodings).
- **Side-by-Side Data Diff Viewer**: Visually compare raw source rows against cleaned records with color-coded badges highlighting imputed cells, clipped outliers, and encoded columns.
- **Supervised Target Mode**: Designate a target feature to automatically detect task type (Binary Classification, Multi-class, Regression), inspect class imbalance, compute Mutual Information feature ranking, and check for target leakage.
- **Multi-Format Export**: Download cleaned datasets in **CSV**, **Excel (`.xlsx`)**, **Parquet (`.parquet`)**, or **SQLite (`.db`)**.
- **Jupyter Notebook & Data Assertions Export**: Export runnable **Jupyter Notebooks (`.ipynb`)** and **Pandera (`.py`)** schema quality assertion suites.
- **Outlier Leverage & Skewness**: Tukey 1.5x IQR cutoffs, Winsorization capping, and Log1p/Yeo-Johnson power transformations.
- **Collinearity & Covariance**: High-correlation alerts ($|r| \ge 0.75$) with variance inflation notes and a full Pearson cross-correlation heatmap matrix.
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

# Or run headless local audit on any tabular file
datalysis audit dataset.csv --output report.json
```

### 3. Using Docker
```bash
docker compose up -d
# Access at http://localhost:8000
```

---

## Supported Ingestion & Export Formats

| Format | File Extensions | Read Support | Export Support |
| :--- | :--- | :---: | :---: |
| **CSV** | `.csv`, `.txt` | Sniffer + Pandas (auto-delimiter, UTF-8/Latin-1) | Standard CSV |
| **TSV / Tab** | `.tsv`, `.tab` | Tab Sniffer & Delimiter Detection | Tab-delimited CSV |
| **Excel** | `.xlsx`, `.xls` | OpenPyXL multi-sheet reader | Multi-sheet workbook (`Cleaned_Data`, `Summary_Overview`, `Column_Schema`) |
| **Parquet** | `.parquet`, `.pqt` | PyArrow binary columnar format | Optimized PyArrow binary |
| **SQLite Database**| `.db`, `.sqlite` | SQLite3 engine | Self-contained SQLite database file |
| **JSON / JSONL** | `.json`, `.jsonl`, `.ndjson` | Python JSON (records, split, lines) | Audit JSON report |
| **Jupyter Notebook**| `.ipynb` | — | Runnable Jupyter Notebook with EDA & modeling starter |
| **Pandera Schema**| `.py` | — | Executable data quality schema assertions |

---

## Core Modules & Capabilities

1. **Executive Overview**: High-density dataset metrics (row count, feature count, missingness rate, duplicate overlap %, memory footprint, detected delimiter), type filter pills, column dictionary, and source preview.
2. **Interactive Recipe Customizer**: Full user control over the automated recipe:
   - Toggle column retention/drop.
   - Choose imputation: Auto, Median, Mean, Mode, Constant, KNN, or Drop Rows.
   - Outlier mitigation: Auto, Winsorization, Clip IQR, Z-score, or None.
   - Categorical encoding: Auto, One-Hot, Frequency, Ordinal, Binary, or None.
   - Decoupled scaling: Standard (Z-score), Robust, Log1p, or None.
3. **Data Diff Inspector**: Interactive side-by-side comparison of raw vs cleaned records with highlighted badges for transformed values.
4. **Supervised Target Mode**: One-click target feature selection providing task auto-detection, class imbalance breakdown, Mutual Information importance charts, and normalized entropy target leakage alerts.
5. **Data Visualizer**:
   - **Feature Profiler (Univariate)**: Interactive SVG histograms with hover tooltips, 5-point quartile cards, and categorical Pareto frequency bars.
   - **Bivariate Scatter & Trendline**: 2D scatter explorer with color hue grouping, point coordinates on hover, automated linear regression trendlines, and Pearson $r$ / $R^2$ statistics.
   - **Category vs Metric (Grouped)**: Mean and spread bar charts comparing continuous metrics across categorical levels.
   - **Sparsity Grid**: Visual null distribution grid displaying missing value clustering along dataset row slices.
6. **Distributions & Outliers**: Skewness meters, kurtosis, Tukey's 1.5x IQR boundaries, and outlier mitigation strategies.
7. **Collinearity & Covariance**: High-correlation alerts ($|r| \ge 0.75$) with variance inflation notes and a full Pearson cross-correlation heatmap matrix.
8. **Pipeline Code Generator**: Generates clean, production-ready Scikit-Learn `ColumnTransformer` script (`pipeline.py`) preserving untransformed features via passthrough.

---

## Expert System Rules Database

Datalysis evaluates production rules across 5 specialized families:

### 1. Imputation Rules (`R-IMP`)
- **`R-IMP-01`**: Prunes features where missingness $\ge 70.0\%$. Prevents synthetic variance contamination.
- **`R-IMP-02`**: Recommends **Median Imputer + Missing Indicator** for continuous features with significant skewness ($|\text{skew}| \ge 0.8$) or outliers.
- **`R-IMP-03`**: Recommends **Mean Imputer** for Gaussian symmetric continuous distributions.
- **`R-IMP-04`**: Recommends **Iterative (MICE) or KNN Imputer** when a missing column has strong linear correlation ($|r| \ge 0.65$) with complete peer features.
- **`R-IMP-05`**: Recommends **Mode Imputer** for low-missingness ($< 5.0\%$) categoricals.
- **`R-IMP-06`**: Recommends **'Missing' Constant Token** for moderate/high missingness ($\ge 5.0\%$) categoricals.

### 2. Encoding Rules (`R-ENC`)
- **`R-ENC-01`**: Binary categorical features are mapped directly to 0 and 1 without dimensional growth.
- **`R-ENC-02`**: Low-cardinality nominals ($3 \le k \le 10$) are transformed with `OneHotEncoder(drop='first', handle_unknown='ignore')`.
- **`R-ENC-03`**: High-cardinality nominals ($k > 10$) trigger **Frequency or Target Encoding** recommendations.
- **`R-ENC-04`**: Detected natural hierarchical sequences (e.g. low/med/high, bronze/silver/gold) receive ordered **Ordinal Integer Encoding**.

### 3. Scaling & Outliers (`R-DIST`)
- **`R-DIST-01`**: Extreme right-skewed positive features ($\text{skew} \ge 1.2, \min \ge 0$) receive **Log1p** or **Yeo-Johnson Power Transformations**.
- **`R-DIST-02`**: Skewed features containing negative values receive **Yeo-Johnson Power Transformations**.
- **`R-DIST-03`**: Heavy outlier presence ($\ge 2.5\%$ beyond $1.5 \times \text{IQR}$) triggers **Winsorization Capping (1st to 99th percentile)** and **RobustScaler**.
- **`R-DIST-04`**: Near-Gaussian continuous features are standardized using **StandardScaler (Z-Score)**.

### 4. Leakage & Collinearity (`R-FLT`)
- **`R-FLT-01`**: Zero-variance constant columns are dropped immediately.
- **`R-FLT-02`**: Primary keys, row UUIDs, and entity identifiers are dropped to prevent memorization leakage.
- **`R-FLT-03`**: Pairwise Pearson correlations $|r| \ge 0.85$ generate multicollinearity redundancy warnings.

### 5. Datetime Engineering (`R-DAT`)
- **`R-DAT-01`**: Decomposes timestamps into `year`, `month`, `day`, `day_of_week`, `is_weekend`, `hour`, `minute`, and cyclical trigonometric components ($\sin(2\pi m/12)$ and $\cos(2\pi m/12)$).

---

## REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health status |
| `GET` | `/api/sample-datasets` | List pre-packaged sample datasets (Titanic, Telecom, IoT) |
| `POST` | `/api/load-sample/{sample_id}` | Load and profile a sample dataset |
| `POST` | `/api/upload` | Ingest and profile an uploaded tabular file (`multipart/form-data`) |
| `POST` | `/api/process` | Execute full in-memory preprocessing pipeline with optional custom recipe |
| `POST` | `/api/set-target` | Run supervised analysis on target column (leakage, imbalance, mutual information) |
| `GET` | `/api/download-cleaned` | Download cleaned dataset (`?format=csv|excel|parquet|sqlite`) |
| `GET` | `/api/download-pipeline` | Download generated standalone `pipeline.py` script |
| `GET` | `/api/download-notebook` | Download runnable Jupyter Notebook (`.ipynb`) |
| `GET` | `/api/download-pandera-schema` | Download Pandera data quality assertion script (`.py`) |
| `GET` | `/api/download-report` | Download JSON audit report |
| `GET` | `/api/visualize/scatter` | Fetch scatter points & regression stats (`x`, `y`, optional `hue`) |
| `GET` | `/api/visualize/grouped` | Fetch grouped aggregations (`cat`, `num`) |
| `GET` | `/api/visualize/missingness` | Fetch chunked missingness sparsity matrix |

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
│   │   ├── parser.py                   # Multi-format tabular file reader
│   │   ├── sample_data.py              # Sample datasets (Titanic, Churn, IoT)
│   │   ├── preprocessor.py             # Transformation engine with custom recipe support
│   │   ├── exporter.py                 # Multi-format exporter (CSV, Excel, Parquet, SQLite, Notebook)
│   │   ├── supervised.py               # Supervised mode (Mutual info, imbalance, leakage)
│   │   ├── cli.py                      # CLI entrypoint for `datalysis launch` & `datalysis audit`
│   │   └── expert_system/
│   │       ├── fact_extractor.py       # Statistical profiling & metadata facts
│   │       ├── rules.py                # Declarative production rules knowledge base
│   │       ├── engine.py               # Forward inference engine & Health Scorer (0-100)
│   │       └── code_generator.py       # Scikit-Learn Pipeline code generator
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
│   │   │   ├── UploadZone.tsx          # Drag & drop upload & sample cards
│   │   │   ├── DatasetOverview.tsx     # Column dictionary and source preview
│   │   │   ├── HealthScoreCard.tsx     # Health gauge, grade & subscores
│   │   │   ├── ReasoningTrace.tsx      # Terminal-style cognitive reasoning trace
│   │   │   ├── DataVisualizer.tsx      # Univariate, Scatter, Grouped, and Sparsity views
│   │   │   ├── RecommendationsTable.tsx# Recommendations viewer & recipe trigger
│   │   │   ├── RecipeCustomizer.tsx    # Interactive recipe override editor
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
│   ├── test_session.py                 # Multi-user session isolation & LRU cache tests
│   ├── test_recipe_customizer.py       # Custom recipe override tests
│   ├── test_supervised.py              # Target leakage & mutual information tests
│   ├── test_code_generator_passthrough.py # Passthrough retention tests
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
└── README.md                           # Master repository documentation
```

---

## Testing

Run the automated test suite across all 8 test modules:
```bash
pytest -v
# or using uv:
uv run pytest tests -v
```
*Current test suite: **41 passing tests** covering parser, rules engine, multi-format exporter, session isolation, recipe overrides, code generator, and supervised ML mode.*

---

## Contributing & Community

Contributions are warmly welcomed! Please read our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

For security reports, please refer to our [Security Policy](SECURITY.md).

---

## License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.
