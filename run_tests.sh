#!/bin/bash
# Run the full test suite.
# Starts backend if not running, waits until ready, then runs all tests.

PROJECT="$HOME/Desktop/draxil"
cd "$PROJECT"
source .venv/bin/activate

# ── Start backend if not up ───────────────────────────────────────────────────
if ! curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "Backend not running — starting stack..."

    pkill -f "ollama serve" 2>/dev/null
    pkill -f "uvicorn backend" 2>/dev/null
    sleep 2

    nohup ollama serve > /tmp/ollama.log 2>&1 &
    sleep 5

    nohup uvicorn backend:app --host 0.0.0.0 --port 8000 > /tmp/backend.log 2>&1 &

    echo "Waiting for backend to be ready (up to 60s)..."
    for i in $(seq 1 30); do
        if curl -s http://localhost:8000/health > /dev/null 2>&1; then
            echo "  Backend is up after ${i}0s."
            break
        fi
        sleep 2
        if [ $i -eq 30 ]; then
            echo "  ERROR: backend did not start. Check /tmp/backend.log"
            exit 1
        fi
    done
else
    echo "Backend already running."
fi

# ── Run tests ─────────────────────────────────────────────────────────────────
echo ""
echo "Running tests..."
echo "================"

DRAXIE_TIMEOUT=300 python -m pytest tests/ -v 2>&1 | tee /tmp/test_results.txt

echo ""
echo "Full results saved to /tmp/test_results.txt"
echo "Summary:"
tail -5 /tmp/test_results.txt
