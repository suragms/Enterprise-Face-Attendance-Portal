# HexaAttender v2 Enterprise — Windows bootstrap
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Write-Host "HexaAttender v2 Enterprise bootstrap" -ForegroundColor Cyan

if (-not (Test-Path "$Root\.env")) {
    Copy-Item "$Root\.env.example" "$Root\.env"
    Write-Host "Created .env from .env.example"
}

Push-Location "$Root\backend"
if (-not (Test-Path ".venv")) {
    python -m venv .venv
}
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt -q
$env:DJANGO_SETTINGS_MODULE = "config.settings"
python manage.py migrate --noinput
python manage.py bootstrap_super_admin 2>$null
Pop-Location

Push-Location "$Root\frontend"
if (-not (Test-Path "node_modules")) {
    npm install
}
Pop-Location

Write-Host "Done. Start backend: cd backend; .\.venv\Scripts\activate; python manage.py runserver"
Write-Host "Start frontend: cd frontend; npm run dev"
Write-Host "System info: http://localhost:8000/api/v1/system/info/"
