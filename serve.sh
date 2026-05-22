#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-8000}"

cd "$ROOT"
echo "Serving $ROOT at http://127.0.0.1:$PORT/ (Ctrl+C to stop)"
exec python3 -m http.server "$PORT" --bind 127.0.0.1
