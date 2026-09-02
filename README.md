<div align="center">
  <img src="assets/logo.png" width="128" height="128" alt="Datalysis Logo" style="border-radius: 24px;" />
  <h1>Datalysis Local Webapp</h1>
  <p><strong>Autonomous Rule-Based Expert System for Tabular Data Analysis, Imputation Diagnostics & ML Preprocessing</strong></p>
  <p><em>Minimal Modern Glassmorphed AMOLED • 100% Local Deterministic Intelligence • Zero External LLMs</em></p>

  <p>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" /></a>
    <a href="https://github.com/dhrrishitvdeka/Datalysis/actions/workflows/ci.yml"><img src="https://github.com/dhrrishitvdeka/Datalysis/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
    <img src="https://img.shields.io/badge/Python-3.10%20%7C%203.11%20%7C%203.12-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python Version" />
    <img src="https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19" />
    <img src="https://img.shields.io/badge/Intelligence-100%25%20Deterministic%20(No%20LLM)-emerald?style=flat-square" alt="No LLM" />
    <img src="https://img.shields.io/badge/Tests-15%20Passed-brightgreen?style=flat-square" alt="Tests" />
  </p>
</div>

---

## 🌟 Overview

**Datalysis** is a high-performance local web application designed to ingest tabular datasets in any format (CSV, TSV, Excel, JSON, Parquet, Feather), execute comprehensive statistical profiling, and evaluate a built-in **Rule-Based Expert System** to automate the discovery of:
- **Missingness mechanisms** (MCAR, MAR, MNAR heuristics) and tailored imputation strategies (median, mean, MICE multivariate, categorical tokens).
- **Outlier leverage & heavy skewness** (1.5x IQR boundaries, Winsorization capping, Log1p/Yeo-Johnson power transformations).
- **Categorical encoding** (One-Hot Encoding, Binary mapping, Ordinal hierarchies, High-cardinality Target/Frequency encoding).
- **Multicollinearity & Variance Inflation (VIF)** (Pearson cross-correlation matrix with redundancy alerts).
- **Data leakage & uninformative features** (zero-variance constant elimination, primary key / UUID identification).
- **Datetime engineering** (cyclical sine/cosine decompositions and calendar feature extraction).
- **Interactive vector visualizations** (Univariate histograms with IQR bounds, 2D scatter plots with automated linear regression trendlines, grouped categorical bars, and missingness sparsity matrices).

Unlike typical AI tools that rely on cloud APIs, OpenAI/Gemini tokens, or unstable internet connections, Datalysis runs on an **internal mathematical production rule base** and **deterministic inference engine**, delivering instant explanations, cognitive reasoning audit logs, and runnable Scikit-Learn pipeline code.

---

## 🚀 Quick Start

```bash
git clone https://github.com/dhrrishitvdeka/Datalysis.git
cd Datalysis
```

### 1. Launch with One Click (Recommended)
Double-click `run.bat` (or run `./start.ps1` in PowerShell):
```powershell
.\start.ps1
```
This automatically initializes the environment, boots the FastAPI server, and opens `http://127.0.0.1:8000` in your default browser.

### 2. Manual Command Line
```bash
# 1. Activate virtual environment
.\.venv\Scripts\activate

# 2. Run backend (serves both REST API and compiled React SPA)
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

---

## 📂 Supported Formats & Parsing

| Format | Extensions | Engine | Dialect Handling |
| :--- | :--- | :--- | :--- |
| **CSV** | `.csv`, `.txt` | Sniffer + Pandas | Sniffs `,`, `;`, `\|`, auto-detects UTF-8/Latin-1/CP1252 |
| **TSV / Tab** | `.tsv`, `.tab` | Tab Sniffer | Tab-delimited parsing with robust fallback handling |
| **Excel** | `.xlsx`, `.xls` | OpenPyXL | Sheet auto-detection and multi-sheet metadata |
| **JSON** | `.json`, `.jsonl`, `.ndjson` | Python JSON | Records, split, lines, nested objects |
| **Parquet** | `.parquet`, `.pqt` | PyArrow | High-performance binary columnar format |
| **Feather** | `.feather`, `.arrow` | PyArrow | Zero-copy Arrow IPC tables |

---

## 🎨 Design System: AMOLED Glassmorphism (Anti-AI-Slop)

Datalysis adheres to a strict developer-grade aesthetic inspired by Linear, Vercel, and modern industrial design:
- **Pitch-Black AMOLED Base (`#000000`)**: Zero washed-out blue/slate shades; pure black contrast with a subtle $24\text{px}$ micro-grid dot texture.
- **Precision Frosted Glass**: Translucent panels (`bg-zinc-950/70`, `backdrop-blur-xl`) with crisp hairline borders (`border-white/[0.08]`) and interior bevel highlights.
- **Monochrome-First Hierarchy**: Pure white (`#FFFFFF`) headings, cool silver (`#A1A1AA`) metadata, and tabular monospace figures.
- **Zero AI-Slop Clichés**: No rainbow purple/cyan gradients, no neon glow boxes, and no buzzword badges. Color is strictly functional (muted emerald for healthy, amber for warnings, rose for prunings).

---

## 📊 Feature Modules & Tabs

1. **Executive Overview**: High-density dataset metrics (row count, feature count, missingness rate, duplicate overlap %, memory footprint, detected delimiter) and raw source matrix table.
2. **Data Visualizer**: Dedicated interactive analytics section:
   - **Feature Profiler (Univariate)**: Interactive SVG histograms with hover tooltips, 5-point quartile cards, and categorical Pareto frequency bars.
   - **Bivariate Scatter & Trendline**: Interactive 2D scatter explorer with color hue grouping, point coordinates on hover, automated linear regression trendline, and Pearson $r$ / $R^2$ statistics.
   - **Category vs Metric (Grouped)**: Mean and spread bar charts comparing continuous metrics across categorical levels.
   - **Sparsity Matrix**: Visual null distribution grid displaying missing value clustering along dataset rows.
3. **Feature Recipes**: Comprehensive column recommendations table with status badges and an interactive "Inspect" modal revealing all triggered production rules and confidence levels.
4. **Distributions & Outliers**: Skewness meters, kurtosis, Tukey's 1.5x IQR boundaries, and outlier mitigation strategies (Winsorization, RobustScaler).
5. **Collinearity & Covariance**: High-correlation alerts ($|r| \ge 0.75$) with variance inflation notes and a full Pearson cross-correlation heatmap matrix.
6. **Pipeline Code**: One-click Scikit-Learn `ColumnTransformer` script synthesis (`pipeline.py`).
7. **Cleaned Dataset**: In-memory dataset transformer with before/after diff metrics and instant cleaned CSV download ($0$ missing cells).

---

## 🧠 Expert System Rules Architecture

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
- **`R-DAT-01`**: Decomposes timestamps into `year`, `month`, `day`, `day_of_week`, `is_weekend`, and cyclical trigonometric components ($\sin(2\pi m/12)$ and $\cos(2\pi m/12)$).

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health status |
| `GET` | `/api/sample-datasets` | List pre-packaged sample datasets (Titanic, Telecom, IoT) |
| `POST` | `/api/load-sample/{sample_id}` | Load and profile a sample dataset |
| `POST` | `/api/upload` | Ingest and profile an uploaded tabular file (`multipart/form-data`) |
| `POST` | `/api/process` | Execute full in-memory preprocessing pipeline |
| `GET` | `/api/download-cleaned` | Download cleaned dataset as CSV |
| `GET` | `/api/download-pipeline` | Download generated standalone `pipeline.py` script |
| `GET` | `/api/download-report` | Download JSON audit report |
| `GET` | `/api/visualize/scatter` | Fetch scatter points & regression stats (`x`, `y`, optional `hue`) |
| `GET` | `/api/visualize/grouped` | Fetch grouped aggregations (`cat`, `num`) |
| `GET` | `/api/visualize/missingness` | Fetch chunked missingness sparsity matrix |

---

## 🛠 Project Structure

```
Datalysis/
├── assets/
│   └── logo.png                        # Official branding emblem
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI application & REST endpoints
│   │   ├── parser.py                   # Multi-format tabular file reader
│   │   ├── sample_data.py              # Realistic sample datasets (Titanic, Churn, IoT)
│   │   ├── preprocessor.py             # In-memory transformation & cleaning engine
│   │   └── expert_system/
│   │       ├── fact_extractor.py       # Statistical profiling & metadata facts
│   │       ├── rules.py                # Declarative production rules knowledge base
│   │       ├── engine.py               # Forward inference engine & Health Scorer (0-100)
│   │       └── code_generator.py       # Scikit-Learn Pipeline Python code generator
│   ├── requirements.txt
│   └── README.md                       # Backend technical documentation
├── frontend/
│   ├── public/
│   │   └── logo.png                    # Webapp favicon and brandmark
│   ├── src/
│   │   ├── App.tsx                     # Main dashboard container & tab router
│   │   ├── index.css                   # AMOLED glassmorphic design utilities
│   │   ├── components/
│   │   │   ├── Navbar.tsx              # Sticky header with brandmark & tabs
│   │   │   ├── UploadZone.tsx          # Drag & drop upload & sample cards
│   │   │   ├── DatasetOverview.tsx     # Column dictionary and source preview
│   │   │   ├── HealthScoreCard.tsx     # Health gauge, grade & subscores
│   │   │   ├── ReasoningTrace.tsx      # Terminal-style cognitive reasoning trace
│   │   │   ├── DataVisualizer.tsx      # Univariate, Scatter, Grouped, and Sparsity views
│   │   │   ├── RecommendationsTable.tsx# Per-feature recommendations & "Why?" drawer
│   │   │   ├── OutlierDistribution.tsx # Interactive histograms & IQR boxplots
│   │   │   ├── CorrelationMatrix.tsx   # Collinearity warnings & Pearson heatmap
│   │   │   ├── CodeExport.tsx          # Runnable pipeline.py script viewer
│   │   │   └── CleanedDataPreview.tsx  # In-memory cleaner, diff, and CSV export
│   │   ├── services/api.ts             # Typed REST client
│   │   └── types/index.ts              # TypeScript interfaces
│   ├── dist/                           # Compiled production SPA (served by FastAPI)
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── README.md                       # Frontend UI architecture documentation
├── tests/
│   ├── test_parser.py                  # Parser & delimiter sniffing tests
│   ├── test_expert_system.py           # Knowledge base & inference tests
│   └── test_api.py                     # FastAPI endpoint & visualization tests
├── run.bat                             # Windows CMD runner
├── start.ps1                           # PowerShell runner
└── README.md                           # Master repository documentation
```

---

## 🧪 Testing

Run the automated test suite across all parser, expert system, and API integration suites:
```powershell
$env:PYTHONPATH="."
.\.venv\Scripts\python.exe -m unittest discover tests
```
*Current test suite: 15 passing tests in ~0.3s.*

---

## 🤝 Contributing & Community

Contributions are warmly welcomed! Please read our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

For security reports, please refer to our [Security Policy](SECURITY.md).

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.
