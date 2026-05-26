#!/bin/bash
PORT=3200
echo "========================================================"
echo "  Starting VisionCare EMR - Luna Eye Hospital on port $PORT..."
echo "========================================================"

# Check if port is in use
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "[!] WARNING: Port $PORT is already in use!"
    read -p "Do you want to continue anyway? (y/n): " choice
    if [ "$choice" != "y" ]; then
        exit 1
    fi
fi

# Start backend server
echo "[1/2] Launching backend server..."
cd "$(dirname "$0")/server"
node index.js &

# Wait for initialization
echo "[2/2] Initializing environment..."
sleep 3

echo ""
echo "VisionCare EMR is running at: http://localhost:$PORT"
echo ""

# Open browser (cross-platform)
if command -v xdg-open > /dev/null; then
  xdg-open "http://localhost:$PORT/login"
elif command -v open > /dev/null; then
  open "http://localhost:$PORT/login"
else
  echo "Please open http://localhost:$PORT/login in your browser."
fi

echo "Keep this terminal open while using the app."
wait
