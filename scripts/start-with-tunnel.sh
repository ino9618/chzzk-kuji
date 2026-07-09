#!/usr/bin/env bash
# Starts the chzzk-kuji dev server (backend :3000 + Vite client :5173) and a
# free Cloudflare quick tunnel pointed at it, so the admin/overlay pages are
# reachable from another device for as long as this script keeps running.
#
# The tunnel URL is random and changes every time you run this script --
# that's expected for a no-account "quick tunnel". Press Ctrl+C once to stop
# both the app and the tunnel together.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CLOUDFLARED="${CLOUDFLARED_BIN:-$HOME/Desktop/Claude/.claude/bin/cloudflared}"

if [ ! -x "$CLOUDFLARED" ]; then
  echo "cloudflared not found at $CLOUDFLARED (set CLOUDFLARED_BIN to override)" >&2
  exit 1
fi

cd "$PROJECT_DIR"

cleanup() {
  echo ""
  echo "Stopping..."
  [ -n "${APP_PID:-}" ] && kill "$APP_PID" 2>/dev/null || true
  [ -n "${TUNNEL_PID:-}" ] && kill "$TUNNEL_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting chzzk-kuji (server :3000 + client :5173)..."
npm run dev > /tmp/chzzk-kuji-app.log 2>&1 &
APP_PID=$!

echo "Waiting for the client dev server to come up..."
for _ in $(seq 1 30); do
  if curl -s -o /dev/null "http://localhost:5173/admin.html"; then
    break
  fi
  sleep 1
done

echo "Starting Cloudflare quick tunnel..."
"$CLOUDFLARED" tunnel --url http://localhost:5173 > /tmp/chzzk-kuji-tunnel.log 2>&1 &
TUNNEL_PID=$!

TUNNEL_URL=""
for _ in $(seq 1 30); do
  TUNNEL_URL=$(grep -o 'https://[a-zA-Z0-9.-]*\.trycloudflare\.com' /tmp/chzzk-kuji-tunnel.log | head -1 || true)
  [ -n "$TUNNEL_URL" ] && break
  sleep 1
done

if [ -z "$TUNNEL_URL" ]; then
  echo "Could not detect the tunnel URL -- check /tmp/chzzk-kuji-tunnel.log" >&2
else
  echo ""
  echo "======================================================================"
  echo " 관리자 화면: $TUNNEL_URL/admin.html"
  echo " 오버레이:    $TUNNEL_URL/overlay.html"
  echo " 사용법:      $TUNNEL_URL/manual.html"
  echo "======================================================================"
  echo " 이 창을 켜둔 동안에만 접속 가능합니다. 끄려면 Ctrl+C."
  echo ""
fi

wait "$APP_PID" "$TUNNEL_PID"
