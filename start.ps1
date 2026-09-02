Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "  Launching Datalysis Local Webapp (Autonomous Expert System)        " -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

if (-not (Test-Path ".\.venv\Scripts\python.exe")) {
    Write-Host "Setting up Python virtual environment..." -ForegroundColor Yellow
    python -m venv .venv
    .\.venv\Scripts\pip.exe install -r backend\requirements.txt
}

$env:PYTHONPATH = "."
Write-Host "Opening webapp at http://127.0.0.1:8000 ..." -ForegroundColor Green
Start-Process "http://127.0.0.1:8000"

Write-Host "Starting FastAPI Backend and Built SPA..." -ForegroundColor Green
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
