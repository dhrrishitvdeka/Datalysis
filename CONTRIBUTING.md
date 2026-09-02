# Contributing to Datalysis

Thank you for your interest in contributing to **Datalysis**! Datalysis is an open-source, local, deterministic expert system for tabular data analysis, imputation diagnostics, and ML preprocessing built without external LLM dependencies.

We welcome contributions of all kinds: new expert production rules, improved statistical diagnostics, parser format support, performance optimizations, bug fixes, and documentation improvements.

---

## 🛠 Local Development Setup

### Prerequisites
- **Python 3.9+** (Python 3.10 or 3.11 recommended)
- **Node.js 18+** & **npm** (only required if developing the frontend UI)
- **Git**

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/datalysis.git
cd datalysis
```

### 2. Backend Setup
```bash
# Create a virtual environment
python -m venv .venv

# Activate virtual environment
# Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# macOS / Linux:
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
```

### 3. Frontend Setup (Optional - only if modifying UI)
```bash
cd frontend
npm install
npm run dev   # Runs Vite dev server at http://localhost:5173
```
To build the frontend SPA into `frontend/dist` for FastAPI to serve:
```bash
npm run build
```

### 4. Running the Complete App
```bash
# From the repository root with virtual environment activated:
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
Open **`http://127.0.0.1:8000`** in your browser.

---

## 🧠 Adding New Production Rules

Datalysis's inference engine is purely deterministic and rule-driven. To add a new heuristic or preprocessing rule:

1. Open [`backend/app/expert_system/rules.py`](backend/app/expert_system/rules.py).
2. Choose the appropriate rule family prefix:
   - `R-IMP-*`: Imputation rules
   - `R-ENC-*`: Encoding rules
   - `R-DIST-*`: Distribution, scaling, and outlier rules
   - `R-FLT-*`: Filtering, leakage, and collinearity rules
   - `R-DAT-*`: Datetime engineering rules
3. Define rule conditions against `ColumnFact` and `DatasetFacts` (extracted in `fact_extractor.py`).
4. Ensure the rule returns:
   - `rule_id`: Unique identifier (e.g. `R-IMP-07`)
   - `confidence`: Heuristic certainty float between `0.0` and `1.0`
   - `rationale`: Clear mathematical/statistical justification
   - `technique`: Name of the concrete Scikit-Learn or data-cleaning transformation
5. Add unit tests in [`tests/test_expert_system.py`](tests/test_expert_system.py) verifying activation.

---

## 🧪 Running Tests

Always ensure the entire test suite passes before submitting a pull request:

```bash
# Set PYTHONPATH to project root
# Windows (PowerShell):
$env:PYTHONPATH="."
python -m unittest discover tests

# Linux / macOS:
PYTHONPATH=. python -m unittest discover tests
```

If you modified the frontend, verify that the TypeScript bundle compiles cleanly:
```bash
cd frontend
npm run build
```

---

## 📝 Pull Request Guidelines

1. **Branch Naming**:
   - `feat/your-feature-name`
   - `fix/issue-description`
   - `docs/what-changed`
2. **Commit Messages**:
   - Write clear, imperative commit messages (e.g., `feat(expert_system): add KNN imputation rule for correlated features`).
3. **No LLM Dependencies**:
   - Datalysis's core design principle is **100% local, deterministic, rule-based intelligence**. Do not introduce external cloud LLM API calls, proprietary OpenAI/Gemini endpoints, or network-bound inference requirements.
4. **Code Style**:
   - Follow PEP 8 for Python code.
   - Keep frontend components minimal, accessible, and adhering to the AMOLED glassmorphic aesthetic.

---

## 📜 Code of Conduct

Please review and adhere to our [Code of Conduct](CODE_OF_CONDUCT.md) in all community interactions.
