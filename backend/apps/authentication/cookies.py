from django.conf import settings
from rest_framework import exceptions
from rest_framework.authentication import CSRFCheck
from rest_framework_simplejwt.authentication import JWTAuthentication


def _enforce_csrf(request):
    check = CSRFCheck(lambda req: None)
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
        raise exceptions.PermissionDenied(f"CSRF Failed: {reason}")


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            return super().authenticate(request)

        raw_token = request.COOKIES.get(settings.JWT_ACCESS_COOKIE_NAME)
        if raw_token is None:
            return None

        if request.method not in ("GET", "HEAD", "OPTIONS", "TRACE"):
            _enforce_csrf(request)
        validated_token = self.get_validated_token(raw_token)
        user = self.get_user(validated_token)
        token_version = validated_token.get("token_version")
        if token_version is not None and token_version != user.token_version:
            return None
        return user, validated_token


def set_auth_cookies(response, access_token, refresh_token):
    secure = settings.JWT_COOKIE_SECURE
    samesite = settings.JWT_COOKIE_SAMESITE
    response.set_cookie(
        settings.JWT_ACCESS_COOKIE_NAME,
        str(access_token),
        max_age=int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds()),
        httponly=True,
        secure=secure,
        samesite=samesite,
    )
    response.set_cookie(
        settings.JWT_REFRESH_COOKIE_NAME,
        str(refresh_token),
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        httponly=True,
        secure=secure,
        samesite=samesite,
    )


def clear_auth_cookies(response):
    response.delete_cookie(settings.JWT_ACCESS_COOKIE_NAME, samesite=settings.JWT_COOKIE_SAMESITE)
    response.delete_cookie(settings.JWT_REFRESH_COOKIE_NAME, samesite=settings.JWT_COOKIE_SAMESITE)
