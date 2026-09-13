#!/usr/bin/env bash
# Datalysis cross-platform Unix/macOS startup script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================================"
echo "          Datalysis - Autonomous Expert Preprocessing        "
echo "============================================================"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python 3 is required but not installed."
    exit 1
fi

# Check Node
if ! command -v node &> /dev/null; then
    echo "⚠️ Warning: Node.js is not found. Attempting to run with existing frontend build if present."
fi

# Activate virtualenv if present
if [ -d ".venv" ]; then
    echo "📦 Activating virtual environment (.venv)..."
    source .venv/bin/activate
elif [ -d "venv" ]; then
    echo "📦 Activating virtual environment (venv)..."
    source venv/bin/activate
fi

# Install backend dependencies
echo "📥 Checking Python dependencies..."
python3 -m pip install -q -r backend/requirements.txt

# If frontend/dist does not exist and npm is available, build it
if [ ! -d "frontend/dist" ] && command -v npm &> /dev/null; then
    echo "🔨 Building frontend assets..."
    cd frontend
    npm install --silent
    npm run build
    cd ..
fi

echo "🚀 Starting Datalysis backend on http://127.0.0.1:8000..."
python3 -m backend.app.cli launch --host 0.0.0.0 --port 8000 --reload
