# HexaAttender v2 Enterprise — Security

## Authentication

- **JWT** stored in **HTTP-only** cookies (`hexaattender_access`, `hexaattender_refresh`)
- Refresh rotation with token blacklist
- CSRF token returned on login for unsafe methods
- Session version invalidation on password change / logout

## Authorization

- Role hierarchy: `STUDENT` < `FACULTY` < `HOD` < `BRANCH_ADMIN` / `ORGANIZATION_ADMIN` < `SUPER_ADMIN`
- Tenant isolation via `active_organization` on every scoped queryset
- HOD department scoping (`apps/core/hod_scoping.py`)
- Faculty subject/session scoping (`apps/core/faculty_scoping.py`)
- Student self-scoping (`apps/core/student_scoping.py`)

## Face data protection

- Embeddings stored in `EncryptedJSONField` (Fernet derived from `DJANGO_SECRET_KEY`)
- Optional dedicated key: set strong `DJANGO_SECRET_KEY` in production (128+ random chars)
- Liveness pipeline: Laplacian variance, blink heuristic, texture checks (`verify_liveness`)
- Face audit log for failed liveness and verification events

## Brute-force protection

- Login throttle: `10/minute` (`throttle_scope=login`)
- Failed attempt counter with Redis/local cache
- Lockout after `AUTH_MAX_FAILED_ATTEMPTS` (default 5) for `AUTH_LOCKOUT_SECONDS` (default 900)

## Transport & headers

- `SECURE_SSL_REDIRECT`, HSTS, `X-Frame-Options: DENY` in production
- CORS restricted when `DEBUG=False`
- `JWT_COOKIE_SECURE=True` in production

## Deployment checklist

1. Set `DJANGO_DEBUG=False`
2. Set unique `DJANGO_SECRET_KEY`
3. Use PostgreSQL + Redis (`REQUIRE_REDIS_FOR_SECURITY=True` recommended)
4. Configure `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`
5. Terminate TLS at nginx; forward `X-Forwarded-Proto`
6. Restrict face endpoints to authenticated faculty where policy requires

## Reporting vulnerabilities

Contact your platform administrator or HexaStack security channel. Do not commit secrets to the repository.
