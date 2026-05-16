#!/bin/bash
PORT=3200
echo "Stopping VisionCare EMR on port $PORT..."

PID=$(lsof -Pi :$PORT -sTCP:LISTEN -t)

if [ -n "$PID" ]; then
    kill -9 $PID
    echo "[✓] VisionCare EMR (PID $PID) stopped successfully."
else
    echo "[!] WARNING: VisionCare EMR was not found running on port $PORT."
fi
