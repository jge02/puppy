#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/puppy}"
FRONTEND_DIR="${FRONTEND_DIR:-$APP_DIR/frontend}"
VENV_DIR="${VENV_DIR:-$APP_DIR/.venv}"
API_SERVICE="${API_SERVICE:-puppy-api}"
WEB_SERVICE="${WEB_SERVICE:-puppy-web}"
API_BASE_URL="${API_BASE_URL:-/api}"
GIT_BRANCH="${GIT_BRANCH:-}"

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

echo "[deploy] done"
