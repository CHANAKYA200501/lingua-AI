#!/usr/bin/env bash
# LinguaAI — Start Frontend
set -e
cd "$(dirname "$0")/frontend"

echo "📥 Installing npm dependencies..."
npm install -q

echo ""
echo "🚀 Starting LinguaAI Frontend on http://localhost:3000"
echo ""
npm run dev
