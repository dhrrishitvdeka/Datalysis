# Datalysis Backend

The **Datalysis Backend** is a high-performance Python engine powered by **FastAPI**, **Pandas**, **NumPy**, **Scikit-Learn**, and **SciPy**. It performs automatic file ingestion, statistical fact extraction, deterministic rule-based forward chaining, interactive data visualization aggregation, and code generation.

---

## 🏛 Architecture Overview

```
backend/app/
├── main.py                     # FastAPI REST routes, CORS, session state & static SPA mounting
├── parser.py                   # Multi-format tabular file reader (CSV, TSV, Excel, JSON, Parquet)
├── sample_data.py              # Synthetic/curated sample dataset generators
├── preprocessor.py             # In-memory pipeline execution engine
└── expert_system/
    ├── fact_extractor.py       # Heuristic semantic typing, Tukey IQR, skewness, entropy & correlations
    ├── rules.py                # Declarative production rules knowledge base
    ├── engine.py               # Forward inference engine & Multi-criteria Health Scorer (0-100)
    └── code_generator.py       # Standalone Scikit-Learn ColumnTransformer code synthesis
```

---

## 🔍 Core Subsystems

### 1. Ingestion Engine (`parser.py`)
- **Delimiter Sniffing**: Automatically samples lines and sniffs delimiters (`,`, `\t`, `;`, `|`) with fallback heuristics.
- **Encoding Sniffing**: Iterates through `utf-8`, `utf-8-sig`, `latin-1`, `cp1252`, and `iso-8859-1`.
- **Formats Supported**: CSV, TSV, TXT, Excel (`.xlsx`, `.xls`), JSON/JSONL, Parquet, and Feather.

### 2. Fact Extractor (`fact_extractor.py`)
Extracts comprehensive mathematical and structural facts from tabular data:
- **Semantic Role Classification**: `continuous`, `discrete`, `nominal`, `ordinal`, `datetime`, `boolean`, `identifier`, `constant`.
- **Distribution Metrics**: Mean, median, standard deviation, skewness (Fisher-Pearson), kurtosis, and min/max/IQR quartiles.
- **Outlier Detection**: Tukey's $1.5 \times \text{IQR}$ upper and lower fences with outlier frequencies and percentages.
- **Information Theory**: Shannon entropy (in bits) for categorical distributions.
- **Correlation Matrix**: Full Pearson cross-correlation matrix identifying high-collinearity pairs ($|r| \ge 0.75$).

### 3. Production Rules (`rules.py`) & Inference Engine (`engine.py`)
- Evaluates declarative production rules across 5 rule families (`R-IMP`, `R-ENC`, `R-DIST`, `R-FLT`, `R-DAT`).
- Resolves conflicting recommendations using a confidence-weighted hierarchy.
- **Multi-Criteria Health Scorer**: Computes a 0-100 score and letter grade (`A+` to `F`) across Completeness (30%), Distribution Health (25%), Parsimony (25%), and Encoding Readiness (20%).
- Outputs a timestamped **Cognitive Reasoning Trace** detailing every deduction.

### 4. Scikit-Learn Pipeline Generator (`code_generator.py`)
- Synthesizes a standalone, executable `pipeline.py` script containing:
  - Custom `OutlierCapper` transformer (Winsorization).
  - Preprocessing pipelines for numeric, categorical, and datetime features bundled in a `ColumnTransformer`.

---

## 🧪 Testing

Run backend tests:
```bash
python -m unittest discover -s tests -v
```
