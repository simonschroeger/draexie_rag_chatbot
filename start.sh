#!/bin/bash
# Start the full DRÄXIE stack using nohup (no tmux needed).
# Logs go to /tmp/ollama.log and /tmp/backend.log

PROJECT="$HOME/Desktop/draxil"
cd "$PROJECT"
source .venv/bin/activate

# Kill any existing processes
pkill -f "ollama serve" 2>/dev/null
pkill -f "uvicorn backend" 2>/dev/null
sleep 2

# Start Ollama
echo "Starting Ollama..."
nohup ollama serve > /tmp/ollama.log 2>&1 &
echo "  PID: $!"
sleep 5

# Start Backend
echo "Starting backend..."
nohup uvicorn backend:app --host 0.0.0.0 --port 8000 > /tmp/backend.log 2>&1 &
echo "  PID: $!"

# Wait until backend is ready
echo "Waiting for backend..."
for i in $(seq 1 30); do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo "  Backend is up."
        break
    fi
    sleep 2
done

echo ""
echo "App is at: http://$(hostname -I | awk '{print $1}'):8000"
echo ""
echo "Logs:"
echo "  tail -f /tmp/ollama.log"
echo "  tail -f /tmp/backend.log"
echo ""
echo "To stop everything:"
echo "  pkill -f 'ollama serve'; pkill -f 'uvicorn backend'"
