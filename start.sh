#!/bin/bash

# Where Is My Room - Startup Script
# ICAN Academy

echo "🚀 Starting Where Is My Room..."
echo ""

# Check if node_modules exists
if [ ! -d "server/node_modules" ]; then
  echo "📦 Installing dependencies..."
  cd server
  npm install
  cd ..
  echo ""
fi

# Start the server in the background
echo "🌐 Starting server on port 5557..."
cd server
node server.js &
SERVER_PID=$!
cd ..

# Wait for server to start
sleep 2

# Open the client in default browser
echo "🖥️  Opening display in browser..."
open http://localhost:5557

echo ""
# Start Cloudflare tunnel if not already running
if ! pgrep -f "cloudflared tunnel run cosmodrive" > /dev/null 2>&1; then
    echo "🌐 Starting Cloudflare Tunnel..."
    cloudflared tunnel run cosmodrive &
    sleep 2
    echo "✅ Cloudflare Tunnel started"
else
    echo "🌐 Cloudflare Tunnel already running"
fi

echo "✅ Where Is My Room is running!"
echo "📊 Server: http://localhost:5557"
echo "🌍 Public: https://rooms.icanacademy.work"
echo "🛑 To stop: Press Ctrl+C or run: kill $SERVER_PID"
echo ""

# Keep script running
wait $SERVER_PID
