# HexaAttender Deployment Runbook

## Production stack
- Docker Compose on a single VM
- Nginx reverse proxy
- Django + Celery + Redis + PostgreSQL
- React frontend served behind Nginx

## First-time setup
1. Copy `.env.prod.example` to `.env.prod` and update secrets.
2. Build and start services:
   - `docker compose up -d --build`
3. Run migrations:
   - `docker compose exec backend python manage.py migrate`
4. Bootstrap required super admin:
   - `docker compose exec backend python manage.py bootstrap_super_admin`

## Health checks
- API: `GET /api/v1/auth/me/` (authenticated)
- Nginx: `http://<host>/`
- DB: `docker compose ps` should report healthy `db`
- Redis: `docker compose ps` should report healthy `redis`

## Backup and restore
- Backup: `./scripts/backup.sh`
- Restore: `./scripts/restore.sh /path/to/backup.sql.gz`

## Upgrade procedure
1. Pull latest code.
2. Rebuild and restart:
   - `docker compose up -d --build`
3. Run migrations:
   - `docker compose exec backend python manage.py migrate`
4. Validate smoke endpoints and login flow.
