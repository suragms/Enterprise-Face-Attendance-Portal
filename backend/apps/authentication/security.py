from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from apps.authentication.models import LoginAttempt, UserSession
from apps.organizations.models import AuditLog

MAX_FAILED_ATTEMPTS = getattr(settings, "AUTH_MAX_FAILED_ATTEMPTS", 5)
LOCKOUT_SECONDS = getattr(settings, "AUTH_LOCKOUT_SECONDS", 900)


def client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def client_device(request):
    payload = request.data if isinstance(getattr(request, "data", None), dict) else {}
    device = payload.get("device")
    if device:
        return str(device)[:255]
    return (request.META.get("HTTP_USER_AGENT") or "")[:255]


def _lock_key(ip, email):
    return f"auth-lockout:{ip}:{email}".lower()


def _attempts_key(ip, email):
    return f"auth-attempts:{ip}:{email}".lower()


def is_password_locked(request, email):
    return bool(cache.get(_lock_key(client_ip(request), email)))


def lockout_response():
    return {
        "detail": f"Too many failed attempts. Account locked for {LOCKOUT_SECONDS // 60} minutes.",
        "attempts": MAX_FAILED_ATTEMPTS,
        "attempts_remaining": 0,
        "lock_seconds": LOCKOUT_SECONDS,
    }


def record_failed_password_attempt(request, email, user=None, reason="invalid_credentials"):
    ip = client_ip(request)
    attempts = int(cache.get(_attempts_key(ip, email), 0) or 0) + 1
    cache.set(_attempts_key(ip, email), attempts, timeout=LOCKOUT_SECONDS)
    if attempts >= MAX_FAILED_ATTEMPTS:
        cache.set(_lock_key(ip, email), True, timeout=LOCKOUT_SECONDS)
    log_login_attempt(
        request,
        email=email,
        user=user,
        success=False,
        failure_reason=reason,
        login_method="password",
    )
    AuditLog.objects.create(
        organization=getattr(user, "active_organization", None) if user else None,
        actor=user,
        action="auth.login_failed",
        ip_address=ip,
        user_agent=request.META.get("HTTP_USER_AGENT", ""),
        metadata={"email": email, "attempts": attempts, "reason": reason},
    )
    return attempts


def clear_password_lockout(request, email):
    ip = client_ip(request)
    cache.delete(_attempts_key(ip, email))
    cache.delete(_lock_key(ip, email))


def remaining_attempts(request, email):
    attempts = int(cache.get(_attempts_key(client_ip(request), email), 0) or 0)
    return max(0, MAX_FAILED_ATTEMPTS - attempts)


def log_login_attempt(request, *, email, user=None, success, failure_reason="", login_method="password"):
    LoginAttempt.objects.create(
        email=email or "",
        user=user,
        ip_address=client_ip(request),
        user_agent=request.META.get("HTTP_USER_AGENT", ""),
        device_fingerprint=client_device(request),
        success=success,
        failure_reason=failure_reason,
        login_method=login_method,
    )


def create_user_session(user, request, refresh_token, login_method="password"):
    return UserSession.objects.create(
        user=user,
        refresh_jti=str(refresh_token.get("jti", "")),
        ip_address=client_ip(request),
        user_agent=request.META.get("HTTP_USER_AGENT", ""),
        device_fingerprint=client_device(request),
        login_method=login_method,
        is_active=True,
    )


def touch_user_session(refresh_token):
    jti = str(refresh_token.get("jti", ""))
    if not jti:
        return
    UserSession.objects.filter(refresh_jti=jti, is_active=True).update(last_seen_at=timezone.now())


def deactivate_session_by_refresh_jti(jti):
    UserSession.objects.filter(refresh_jti=jti, is_active=True).update(
        is_active=False,
        logged_out_at=timezone.now(),
    )


def deactivate_all_user_sessions(user, exclude_jti=None):
    queryset = UserSession.objects.filter(user=user, is_active=True)
    if exclude_jti:
        queryset = queryset.exclude(refresh_jti=exclude_jti)
    queryset.update(is_active=False, logged_out_at=timezone.now())
