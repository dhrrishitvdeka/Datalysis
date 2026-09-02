@echo off
echo =====================================================================
echo  Launching Datalysis Local Webapp (Autonomous Expert System)
echo =====================================================================

cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Creating virtual environment...
    python -m venv .venv
    .\.venv\Scripts\pip.exe install -r backend\requirements.txt
)

set PYTHONPATH=.
echo Starting Datalysis Server on http://127.0.0.1:8000 ...
start http://127.0.0.1:8000
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
