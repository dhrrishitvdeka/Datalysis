import io
import json
from typing import Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
import pandas as pd
import numpy as np
from scipy import stats as sp_stats

from .parser import load_file_to_dataframe
from .expert_system.fact_extractor import extract_dataset_facts
from .expert_system.engine import run_expert_inference
from .expert_system.code_generator import generate_python_pipeline_code
from .preprocessor import execute_preprocessing_pipeline
from .sample_data import SAMPLE_GENERATORS

app = FastAPI(
    title="Datalysis Local Webapp - Expert Preprocessing AI",
    description="Autonomous local tabular analysis and preprocessing expert system without LLMs.",
    version="1.0.0"
)

# Enable CORS for local development & Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for active session dataset
CURRENT_SESSION: Dict[str, Any] = {
    "raw_df": None,
    "cleaned_df": None,
    "metadata": None,
    "facts": None,
    "inference": None,
    "pipeline_code": None,
    "cleaning_report": None
}

def analyze_and_cache(df: pd.DataFrame, metadata: Dict[str, Any]) -> Dict[str, Any]:
    facts = extract_dataset_facts(df)
    inference = run_expert_inference(facts)
    pipeline_code = generate_python_pipeline_code(facts, inference)

    CURRENT_SESSION["raw_df"] = df
    CURRENT_SESSION["cleaned_df"] = None
    CURRENT_SESSION["cleaning_report"] = None
    CURRENT_SESSION["metadata"] = metadata
    CURRENT_SESSION["facts"] = facts
    CURRENT_SESSION["inference"] = inference
    CURRENT_SESSION["pipeline_code"] = pipeline_code

    # Return first 50 rows; NaN becomes JSON null so missing cells stay visible
    preview_df = df.head(50).replace([np.inf, -np.inf], np.nan)
    preview_records = json.loads(preview_df.to_json(orient="records", date_format="iso"))

    return {
        "metadata": metadata,
        "facts": facts,
        "inference": inference,
        "pipeline_code": pipeline_code,
        "preview": preview_records
    }

@app.get("/api/health")
def healthcheck():
    return {"status": "ok", "app": "Datalysis Expert System", "version": "1.0.0"}

@app.get("/api/sample-datasets")
def list_sample_datasets():
    samples = []
    for sid, info in SAMPLE_GENERATORS.items():
        samples.append({
            "id": sid,
            "name": info["name"],
            "description": info["description"]
        })
    return {"samples": samples}

@app.post("/api/load-sample/{sample_id}")
def load_sample(sample_id: str):
    if sample_id not in SAMPLE_GENERATORS:
        raise HTTPException(status_code=404, detail=f"Sample '{sample_id}' not found.")
    
    info = SAMPLE_GENERATORS[sample_id]
    df = info["generator"]()
    metadata = {
        "filename": f"{sample_id}_sample.csv",
        "extension": ".csv",
        "file_size_kb": round(df.memory_usage(deep=True).sum() / 1024, 2),
        "detected_encoding": "utf-8",
        "detected_delimiter": ",",
        "format": "csv",
        "rows": len(df),
        "columns": len(df.columns),
        "sample_name": info["name"]
    }
    return analyze_and_cache(df, metadata)

@app.post("/api/upload")
async def upload_dataset(file: UploadFile = File(...)):
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        
        df, metadata = load_file_to_dataframe(content, file.filename or "uploaded_dataset.csv")
        if df.empty:
            raise HTTPException(status_code=400, detail="Could not extract any rows from the file.")
        
        return analyze_and_cache(df, metadata)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

@app.post("/api/process")
def execute_cleaning():
    if CURRENT_SESSION["raw_df"] is None:
        raise HTTPException(status_code=400, detail="No dataset loaded to preprocess.")

    cleaned_df, report = execute_preprocessing_pipeline(
        CURRENT_SESSION["raw_df"],
        CURRENT_SESSION["facts"],
        CURRENT_SESSION["inference"]
    )
    CURRENT_SESSION["cleaned_df"] = cleaned_df
    CURRENT_SESSION["cleaning_report"] = report

    return report

@app.get("/api/download-cleaned")
def download_cleaned():
    if CURRENT_SESSION["cleaned_df"] is None:
        if CURRENT_SESSION["raw_df"] is not None:
            # Auto-run preprocessor if not run yet
            cleaned_df, report = execute_preprocessing_pipeline(
                CURRENT_SESSION["raw_df"],
                CURRENT_SESSION["facts"],
                CURRENT_SESSION["inference"]
            )
            CURRENT_SESSION["cleaned_df"] = cleaned_df
            CURRENT_SESSION["cleaning_report"] = report
        else:
            raise HTTPException(status_code=400, detail="No dataset available to download.")

    csv_buffer = io.StringIO()
    CURRENT_SESSION["cleaned_df"].to_csv(csv_buffer, index=False)
    csv_bytes = csv_buffer.getvalue().encode("utf-8")

    orig_name = CURRENT_SESSION.get("metadata", {}).get("filename", "data")
    base_name = orig_name.rsplit(".", 1)[0]
    out_name = f"{base_name}_datalysis_cleaned.csv"

    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{out_name}"'}
    )

@app.get("/api/visualize/scatter")
def get_scatter_data(x: str, y: str, hue: Optional[str] = None):
    df = CURRENT_SESSION.get("raw_df")
    if df is None:
        raise HTTPException(status_code=400, detail="No dataset loaded.")
    if x not in df.columns or y not in df.columns:
        raise HTTPException(status_code=400, detail="Invalid feature columns.")

    cols = [x, y]
    if hue and hue in df.columns:
        cols.append(hue)

    sub_df = df[cols].dropna()
    if sub_df.empty:
        return {"points": [], "stats": None}

    # Downsample if large for responsive interactive SVG rendering
    if len(sub_df) > 600:
        sub_df = sub_df.sample(n=600, random_state=42)

    points = []
    for _, row in sub_df.iterrows():
        try:
            pt = {
                "x": float(row[x]),
                "y": float(row[y]),
                "hue": str(row[hue]) if hue and hue in row else None
            }
            points.append(pt)
        except (ValueError, TypeError):
            continue

    # Linear trendline stats (slope, intercept, r)
    stats = None
    if len(points) >= 3:
        try:
            x_vals = [p["x"] for p in points]
            y_vals = [p["y"] for p in points]
            slope, intercept, r_value, p_value, std_err = sp_stats.linregress(x_vals, y_vals)
            stats = {
                "slope": round(float(slope), 4),
                "intercept": round(float(intercept), 4),
                "r_value": round(float(r_value), 3),
                "r_squared": round(float(r_value ** 2), 3),
                "total_points": len(points)
            }
        except Exception:
            pass

    return {"points": points, "stats": stats}

@app.get("/api/visualize/grouped")
def get_grouped_data(cat: str, num: str):
    df = CURRENT_SESSION.get("raw_df")
    if df is None:
        raise HTTPException(status_code=400, detail="No dataset loaded.")
    if cat not in df.columns or num not in df.columns:
        raise HTTPException(status_code=400, detail="Invalid columns.")

    sub_df = df[[cat, num]].dropna()
    if sub_df.empty:
        return {"groups": []}

    try:
        # Convert numeric column safely
        sub_df[num] = pd.to_numeric(sub_df[num], errors='coerce')
        sub_df = sub_df.dropna()

        # Top 15 categories by frequency
        top_cats = sub_df[cat].value_counts().head(15).index.tolist()
        sub_df = sub_df[sub_df[cat].isin(top_cats)]

        grouped = []
        for cat_val, grp in sub_df.groupby(cat):
            vals = grp[num].dropna().values
            if len(vals) > 0:
                grouped.append({
                    "category": str(cat_val),
                    "count": int(len(vals)),
                    "mean": round(float(np.mean(vals)), 2),
                    "median": round(float(np.median(vals)), 2),
                    "q25": round(float(np.percentile(vals, 25)), 2),
                    "q75": round(float(np.percentile(vals, 75)), 2),
                    "min": round(float(np.min(vals)), 2),
                    "max": round(float(np.max(vals)), 2)
                })
        # Sort by mean descending
        grouped.sort(key=lambda g: g["mean"], reverse=True)
        return {"groups": grouped}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/visualize/missingness")
def get_missingness_matrix(chunks: int = 60):
    df = CURRENT_SESSION.get("raw_df")
    if df is None:
        raise HTTPException(status_code=400, detail="No dataset loaded.")

    n_rows = len(df)
    chunk_size = max(1, n_rows // chunks)
    
    matrix_data = []
    cols = list(df.columns)

    for i in range(0, n_rows, chunk_size):
        chunk = df.iloc[i : i + chunk_size]
        row_stat = {
            "row_start": i,
            "row_end": min(n_rows, i + chunk_size),
            "missing_pcts": {c: round(float(chunk[c].isna().mean() * 100), 1) for c in cols}
        }
        matrix_data.append(row_stat)

    return {
        "columns": cols,
        "total_rows": n_rows,
        "chunks": matrix_data
    }

@app.get("/api/download-pipeline")
def download_pipeline_script():
    code = CURRENT_SESSION.get("pipeline_code")
    if not code:
        raise HTTPException(status_code=400, detail="No pipeline generated.")

    return Response(
        content=code,
        media_type="text/x-python",
        headers={"Content-Disposition": "attachment; filename=datalysis_pipeline.py"}
    )

@app.get("/api/download-report")
def download_analysis_report():
    if not CURRENT_SESSION.get("inference"):
        raise HTTPException(status_code=400, detail="No analysis report available.")

    full_report = {
        "metadata": CURRENT_SESSION["metadata"],
        "facts": CURRENT_SESSION["facts"],
        "inference": CURRENT_SESSION["inference"]
    }
    content = json.dumps(full_report, indent=2, default=str)
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=datalysis_audit_report.json"}
    )

# Mount built frontend SPA if frontend/dist exists
import os
from fastapi.staticfiles import StaticFiles
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if os.path.isdir(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
