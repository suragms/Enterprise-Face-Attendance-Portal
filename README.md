# HexaAttender v2.0.0 Enterprise Edition

Multi-tenant attendance management for universities and colleges: face recognition, LMS, exams, analytics, and enterprise reporting.

## Architecture

| Layer | Stack |
|-------|--------|
| Frontend | React 18, TypeScript, Vite, TailwindCSS |
| Backend | Django 4.2, Django REST Framework |
| Data | PostgreSQL, Redis |
| Workers | Celery + Celery Beat |
| AI | OpenCV, DeepFace, ArcFace, RetinaFace |
| Security | JWT HTTP-only cookies, RBAC, AES-encrypted embeddings, liveness anti-spoofing, login lockout |

## Roles

- **Super Admin** — platform-wide organizations and branches
- **Organization / Branch Admin** — tenant administration
- **HOD** — department-scoped management
- **Faculty** — subjects, attendance, materials
- **Student** — learning hub, timetable, notifications

## Quick start (development)

### Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 15+ (or `USE_SQLITE=True` for smoke tests)
- Redis 7+ (optional locally; required for production lockouts/Celery)

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy ..\.env.example ..\.env
python manage.py migrate
python manage.py bootstrap_super_admin
python manage.py runserver
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

### System manifest API

```http
GET /api/v1/system/info/
```

Returns version, features, AI stack, security stack, and 12-phase roadmap metadata.

## Docker (production)

```powershell
copy .env.prod.example .env.prod
# Edit secrets in .env.prod
docker compose up -d --build
```

Services: `db`, `redis`, `backend`, `celery`, `celery-beat`, `frontend`, `nginx` (port 80).

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`):

- Backend: `manage.py check`, `pytest`
- Frontend: `npm ci`, `npm run build`
- Optional: Docker Compose config validation

Deploy workflow: `.github/workflows/deploy.yml`

## Project structure

```
HexaAttender/
├── backend/          # Django apps (authentication, organizations, attendance, …)
├── frontend/         # React SPA
├── nginx/            # Reverse proxy
├── docker-compose.yml
├── docs/             # Enterprise phase documentation
├── scripts/          # Bootstrap helpers
└── .env.example
```

## Documentation

- [V2 Enterprise Phases](docs/V2_ENTERPRISE_PHASES.md) — 12-phase implementation map
- [Security](SECURITY.md) — JWT, encryption, liveness, lockout
- [Audit Report](AUDIT_REPORT.md) — recent quality/security audit

## Testing

```powershell
cd backend
pytest -q
pytest apps/core/tests/test_v2_enterprise_phases.py -v
pytest --cov=apps --cov-report=html
```

```powershell
cd frontend
npm run build
```

## License

Proprietary — HexaStack / HexaAttender Enterprise.
