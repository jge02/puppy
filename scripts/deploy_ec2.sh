#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/puppy}"
FRONTEND_DIR="${FRONTEND_DIR:-$APP_DIR/frontend}"
VENV_DIR="${VENV_DIR:-$APP_DIR/.venv}"
API_SERVICE="${API_SERVICE:-puppy-api}"
WEB_SERVICE="${WEB_SERVICE:-puppy-web}"
API_BASE_URL="${API_BASE_URL:-/api}"
GIT_BRANCH="${GIT_BRANCH:-}"
ADMIN_STATS_URL="${ADMIN_STATS_URL:-http://127.0.0.1:8000/admin/stats}"
ADMIN_STATS_RETRIES="${ADMIN_STATS_RETRIES:-15}"
ADMIN_STATS_RETRY_DELAY_SEC="${ADMIN_STATS_RETRY_DELAY_SEC:-2}"

echo "[deploy] app dir: $APP_DIR"
cd "$APP_DIR"

if [[ -n "$GIT_BRANCH" ]]; then
  echo "[deploy] git checkout $GIT_BRANCH"
  git checkout "$GIT_BRANCH"
fi

echo "[deploy] git pull"
git pull --ff-only

if [[ ! -d "$VENV_DIR" ]]; then
  echo "[deploy] creating venv: $VENV_DIR"
  python3 -m venv "$VENV_DIR"
fi

echo "[deploy] install backend dependencies"
"$VENV_DIR/bin/python" -m pip install -U pip
"$VENV_DIR/bin/pip" install -r requirements.txt

echo "[deploy] build frontend"
cd "$FRONTEND_DIR"
npm ci
NEXT_PUBLIC_API_BASE_URL="$API_BASE_URL" npm run build

echo "[deploy] restart services: $API_SERVICE $WEB_SERVICE"
sudo systemctl restart "$API_SERVICE" "$WEB_SERVICE"

echo "[deploy] status"
sudo systemctl --no-pager --full status "$API_SERVICE" "$WEB_SERVICE" | sed -n '1,80p'

if [[ -n "${PUPPY_ADMIN_TOKEN:-}" ]]; then
  echo "[deploy] admin stats: $ADMIN_STATS_URL"
  stats_json=""
  for ((i=1; i<=ADMIN_STATS_RETRIES; i++)); do
    if stats_json="$(curl -fsS --max-time 3 -H "X-Admin-Token: $PUPPY_ADMIN_TOKEN" "$ADMIN_STATS_URL" 2>/dev/null)"; then
      break
    fi
    echo "[deploy] admin stats not ready yet ($i/$ADMIN_STATS_RETRIES), retrying in ${ADMIN_STATS_RETRY_DELAY_SEC}s..."
    sleep "$ADMIN_STATS_RETRY_DELAY_SEC"
  done

  if [[ -n "$stats_json" ]]; then
    echo "$stats_json" | "$VENV_DIR/bin/python" -c 'import json, sys; data=json.load(sys.stdin); users=data.get("users", {}); rel=data.get("relationships", {}); print(f"[deploy] registered={users.get(\"total_registered\", 0)} bound={users.get(\"bound\", 0)} unbound={users.get(\"unbound\", 0)} relationships={rel.get(\"total\", 0)}")'
  else
    echo "[deploy] warning: failed to fetch admin stats from $ADMIN_STATS_URL"
    echo "[deploy] hint: check API listen address/port and service logs:"
    echo "sudo systemctl status $API_SERVICE --no-pager"
    echo "sudo journalctl -u $API_SERVICE -n 100 --no-pager"
  fi
else
  echo "[deploy] skipping admin stats check because PUPPY_ADMIN_TOKEN is not set"
fi

echo "[deploy] done"
