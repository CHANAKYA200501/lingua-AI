#!/usr/bin/env bash
# LinguaAI — Start Backend
set -e
cd "$(dirname "$0")/backend"

if [ ! -d "venv" ]; then
  echo "📦 Creating virtual environment..."
  python3 -m venv venv
fi

source venv/bin/activate
echo "📥 Installing dependencies..."
pip install -r requirements.txt -q

echo ""
echo "🚀 Starting LinguaAI Backend on http://localhost:8000"
echo "📖 API Docs: http://localhost:8000/docs"
echo ""
uvicorn main:app --reload --host 0.0.0.0 --port 8000
