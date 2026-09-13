import io
import json
import uuid
from typing import Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Header, Depends, Request, Response, Cookie
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import pandas as pd
import numpy as np
from scipy import stats as sp_stats

from .parser import load_file_to_dataframe
from .expert_system.fact_extractor import extract_dataset_facts
from .expert_system.engine import run_expert_inference
from .expert_system.code_generator import generate_python_pipeline_code
from .preprocessor import execute_preprocessing_pipeline
from .sample_data import SAMPLE_GENERATORS
from .session import session_manager, DatasetSession
from .schemas import (
    AnalysisResponseModel,
    CleaningReportModel,
    ProcessRequestModel,
    TargetAnalysisResponseModel,
    SampleDatasetListResponseModel,
    SampleDatasetInfoModel,
)
from .supervised import analyze_target_variable
from .exporter import export_dataframe, generate_jupyter_notebook, generate_pandera_schema

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
    expose_headers=["X-Session-ID", "Content-Disposition"],
)

DEFAULT_SESSION_ID = "datalysis-default-session"


def resolve_session(
    request: Request,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    session_id: Optional[str] = Query(None),
    cookie_session: Optional[str] = Cookie(None, alias="datalysis_session"),
) -> DatasetSession:
    """
    Extracts session by header, query param, or cookie.
    If no session token is provided, generates a secure isolated UUID session.
    """
    sid = x_session_id or session_id or cookie_session
    if not sid or len(sid.strip()) == 0:
        sid = str(uuid.uuid4())
    else:
        sid = sid.strip()

    request.state.session_id = sid
    return session_manager.get_or_create(sid)


# Compatibility proxy so any external references to CURRENT_SESSION continue to work
class CurrentSessionProxy(dict):
    def __getitem__(self, key):
        sess = session_manager.get_or_create(DEFAULT_SESSION_ID)
        return getattr(sess, key, None)

    def __setitem__(self, key, value):
        sess = session_manager.get_or_create(DEFAULT_SESSION_ID)
        setattr(sess, key, value)

    def get(self, key, default=None):
        sess = session_manager.get_or_create(DEFAULT_SESSION_ID)
        val = getattr(sess, key, None)
        return val if val is not None else default


CURRENT_SESSION = CurrentSessionProxy()


@app.middleware("http")
async def add_session_header(request: Request, call_next):
    response = await call_next(request)
    session_id = getattr(request.state, "session_id", None) or request.headers.get("X-Session-ID") or request.query_params.get("session_id")
    if session_id:
        response.headers["X-Session-ID"] = session_id
        response.set_cookie("datalysis_session", session_id, samesite="lax")
    return response


def analyze_and_cache(df: pd.DataFrame, metadata: Dict[str, Any], session: DatasetSession) -> Dict[str, Any]:
    facts = extract_dataset_facts(df)
    inference = run_expert_inference(facts)
    pipeline_code = generate_python_pipeline_code(facts, inference)

    session.raw_df = df
    session.cleaned_df = None
    session.cleaning_report = None
    session.metadata = metadata
    session.facts = facts
    session.inference = inference
    session.pipeline_code = pipeline_code
    session.custom_recipe = None
    session.target_variable = None
    session.target_analysis = None
    session.touch()

    # Return first 50 rows; NaN becomes JSON null so missing cells stay visible
    preview_df = df.head(50).replace([np.inf, -np.inf], np.nan)
    preview_records = json.loads(preview_df.to_json(orient="records", date_format="iso"))

    return {
        "metadata": metadata,
        "facts": facts,
        "inference": inference,
        "pipeline_code": pipeline_code,
        "preview": preview_records,
        "session_id": session.session_id
    }


@app.get("/api/health")
def healthcheck():
    return {
        "status": "ok",
        "app": "Datalysis Expert System",
        "version": "1.0.0",
        "active_sessions": session_manager.count()
    }


@app.get("/api/sample-datasets", response_model=SampleDatasetListResponseModel)
def list_sample_datasets():
    samples = []
    for sid, info in SAMPLE_GENERATORS.items():
        samples.append(SampleDatasetInfoModel(
            id=sid,
            name=info["name"],
            description=info["description"]
        ))
    return SampleDatasetListResponseModel(samples=samples)


@app.post("/api/load-sample/{sample_id}", response_model=AnalysisResponseModel)
def load_sample(sample_id: str, session: DatasetSession = Depends(resolve_session)):
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
    return analyze_and_cache(df, metadata, session)


@app.post("/api/upload", response_model=AnalysisResponseModel)
async def upload_dataset(
    file: UploadFile = File(...),
    session: DatasetSession = Depends(resolve_session)
):
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        df, metadata = load_file_to_dataframe(content, file.filename or "uploaded_dataset.csv")
        if df.empty:
            raise HTTPException(status_code=400, detail="Could not extract any rows from the file.")

        return analyze_and_cache(df, metadata, session)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")


@app.post("/api/process", response_model=CleaningReportModel)
def execute_cleaning(
    payload: Optional[ProcessRequestModel] = None,
    session: DatasetSession = Depends(resolve_session)
):
    if session.raw_df is None:
        raise HTTPException(status_code=400, detail="No dataset loaded to preprocess.")

    recipe_dict = payload.model_dump() if payload else session.custom_recipe
    if recipe_dict:
        session.custom_recipe = recipe_dict

    cleaned_df, report = execute_preprocessing_pipeline(
        session.raw_df,
        session.facts,
        session.inference,
        recipe_overrides=recipe_dict
    )
    session.cleaned_df = cleaned_df
    session.cleaning_report = report
    session.touch()

    return report


@app.post("/api/supervised/target-analysis", response_model=TargetAnalysisResponseModel)
def analyze_target(
    target: str = Query(..., description="Target column name"),
    session: DatasetSession = Depends(resolve_session)
):
    if session.raw_df is None:
        raise HTTPException(status_code=400, detail="No dataset loaded.")

    try:
        analysis = analyze_target_variable(session.raw_df, target)
        session.target_variable = target
        session.target_analysis = analysis
        session.touch()
        return analysis
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Target analysis failed: {str(e)}")


@app.get("/api/download-cleaned")
def download_cleaned(
    format: str = Query("csv", description="Export format: csv, excel, parquet, sqlite"),
    session: DatasetSession = Depends(resolve_session)
):
    if session.cleaned_df is None:
        if session.raw_df is not None:
            # Auto-run preprocessor if not run yet
            cleaned_df, report = execute_preprocessing_pipeline(
                session.raw_df,
                session.facts,
                session.inference,
                recipe_overrides=session.custom_recipe
            )
            session.cleaned_df = cleaned_df
            session.cleaning_report = report
        else:
            raise HTTPException(status_code=400, detail="No dataset available to download.")

    orig_name = session.metadata.get("filename", "dataset.csv") if session.metadata else "dataset.csv"

    try:
        content_bytes, mime_type, out_filename = export_dataframe(
            session.cleaned_df,
            format=format,
            base_filename=orig_name
        )
        return StreamingResponse(
            io.BytesIO(content_bytes),
            media_type=mime_type,
            headers={"Content-Disposition": f'attachment; filename="{out_filename}"'}
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export data: {str(e)}")


@app.get("/api/download-pipeline")
def download_pipeline_script(session: DatasetSession = Depends(resolve_session)):
    code = session.pipeline_code
    if not code:
        raise HTTPException(status_code=400, detail="No pipeline generated.")

    return Response(
        content=code,
        media_type="text/x-python",
        headers={"Content-Disposition": "attachment; filename=datalysis_pipeline.py"}
    )


@app.get("/api/export/notebook")
@app.get("/api/download-notebook")
def download_notebook(session: DatasetSession = Depends(resolve_session)):
    if session.raw_df is None or not session.pipeline_code:
        raise HTTPException(status_code=400, detail="No active dataset session to export as notebook.")

    nb_json = generate_jupyter_notebook(
        metadata=session.metadata or {},
        facts=session.facts or {},
        inference=session.inference or {},
        pipeline_code=session.pipeline_code or "",
        target_col=session.target_variable
    )

    orig_name = session.metadata.get("filename", "dataset.csv") if session.metadata else "dataset.csv"
    base_name = orig_name.rsplit(".", 1)[0]
    out_name = f"{base_name}_datalysis_notebook.ipynb"

    return Response(
        content=nb_json,
        media_type="application/x-ipynb+json",
        headers={"Content-Disposition": f'attachment; filename="{out_name}"'}
    )


@app.get("/api/export/schema")
@app.get("/api/download-schema")
def download_schema(session: DatasetSession = Depends(resolve_session)):
    if session.raw_df is None or not session.facts:
        raise HTTPException(status_code=400, detail="No active dataset session to generate schema assertions.")

    schema_code = generate_pandera_schema(session.raw_df, session.facts)
    return Response(
        content=schema_code,
        media_type="text/x-python",
        headers={"Content-Disposition": "attachment; filename=schema_assertions.py"}
    )


@app.get("/api/download-report")
def download_analysis_report(session: DatasetSession = Depends(resolve_session)):
    if not session.inference:
        raise HTTPException(status_code=400, detail="No analysis report available.")

    full_report = {
        "metadata": session.metadata,
        "facts": session.facts,
        "inference": session.inference,
        "target_analysis": session.target_analysis
    }
    content = json.dumps(full_report, indent=2, default=str)
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=datalysis_audit_report.json"}
    )


@app.get("/api/visualize/scatter")
def get_scatter_data(
    x: str,
    y: str,
    hue: Optional[str] = None,
    session: DatasetSession = Depends(resolve_session)
):
    df = session.raw_df
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

    # Downsample if large for responsive interactive rendering
    if len(sub_df) > 800:
        sub_df = sub_df.sample(n=800, random_state=42)

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
def get_grouped_data(
    cat: str,
    num: str,
    session: DatasetSession = Depends(resolve_session)
):
    df = session.raw_df
    if df is None:
        raise HTTPException(status_code=400, detail="No dataset loaded.")
    if cat not in df.columns or num not in df.columns:
        raise HTTPException(status_code=400, detail="Invalid columns.")

    sub_df = df[[cat, num]].dropna()
    if sub_df.empty:
        return {"groups": []}

    try:
        sub_df[num] = pd.to_numeric(sub_df[num], errors='coerce')
        sub_df = sub_df.dropna()

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
        grouped.sort(key=lambda g: g["mean"], reverse=True)
        return {"groups": grouped}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/visualize/missingness")
def get_missingness_matrix(
    chunks: int = 60,
    session: DatasetSession = Depends(resolve_session)
):
    df = session.raw_df
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


# Mount built frontend SPA if frontend/dist exists
import os
from fastapi.staticfiles import StaticFiles
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if os.path.isdir(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
