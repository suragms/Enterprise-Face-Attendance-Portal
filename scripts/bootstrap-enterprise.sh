#!/usr/bin/env bash
# HexaAttender v2 Enterprise — Unix bootstrap
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "HexaAttender v2 Enterprise bootstrap"

if [[ ! -f "$ROOT/.env" ]]; then
  cp "$ROOT/.env.example" "$ROOT/.env"
  echo "Created .env from .env.example"
fi

cd "$ROOT/backend"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -q
export DJANGO_SETTINGS_MODULE=config.settings
python manage.py migrate --noinput
python manage.py bootstrap_super_admin 2>/dev/null || true

cd "$ROOT/frontend"
npm install

echo "Done."
echo "Backend:  cd backend && source .venv/bin/activate && python manage.py runserver"
echo "Frontend: cd frontend && npm run dev"
echo "Manifest: http://localhost:8000/api/v1/system/info/"
