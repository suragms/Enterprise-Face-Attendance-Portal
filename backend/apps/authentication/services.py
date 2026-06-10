from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.authentication.repositories import UserRepository
from apps.authentication.security import deactivate_all_user_sessions, deactivate_session_by_refresh_jti
from apps.core.services import BaseService
from apps.organizations.models import AuditLog

User = get_user_model()


class AuthService(BaseService):
    def __init__(self):
        super().__init__()
        self.user_repository = UserRepository()

    def generate_password_reset_link(self, email, request=None):
        user = self.user_repository.get_by_email(email)
        if not user:
            raise ValidationError({"email": "No user is registered with this email address."})

        token = default_token_generator.make_token(user)
        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173").rstrip("/")
        reset_link = f"{frontend_url}/reset-password?uid={uidb64}&token={token}"

        subject = "HexaAttender Password Reset"
        message = (
            f"Hello {user.get_full_name() or user.username},\n\n"
            f"Use the link below to reset your HexaAttender password:\n{reset_link}\n\n"
            "If you did not request this, you can ignore this email."
        )
        send_mail(
            subject,
            message,
            getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@hexaattender.local"),
            [user.email],
            fail_silently=False,
        )
        self.logger.info("Password reset email dispatched for user '%s'", user.username)
        return reset_link, user

    def reset_password(self, uidb64, token, new_password, request=None):
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = self.user_repository.get_by_id(uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise ValidationError({"error": "Invalid reset link parameters."})

        if not user:
            raise ValidationError({"error": "User associated with this reset link does not exist."})
        if not default_token_generator.check_token(user, token):
            raise ValidationError({"error": "The reset token has expired or is invalid."})

        validate_password(new_password, user)
        user.set_password(new_password)
        user.must_change_password = False
        self._invalidate_tokens(user)
        user.save(update_fields=["password", "must_change_password", "token_version"])
        AuditLog.objects.create(
            organization=user.active_organization,
            actor=user,
            action="auth.password_reset",
            ip_address=getattr(request, "META", {}).get("REMOTE_ADDR") if request else None,
            metadata={"method": "reset_link"},
        )
        self.logger.info("Password reset successfully for user '%s'", user.username)
        return True

    def change_password(self, user, old_password, new_password, request=None):
        if not user.check_password(old_password):
            raise ValidationError({"old_password": ["Incorrect current password."]})

        validate_password(new_password, user)
        user.set_password(new_password)
        user.must_change_password = False
        self._invalidate_tokens(user)
        user.save(update_fields=["password", "must_change_password", "token_version"])
        AuditLog.objects.create(
            organization=user.active_organization,
            actor=user,
            action="auth.password_change",
            ip_address=getattr(request, "META", {}).get("REMOTE_ADDR") if request else None,
        )
        self.logger.info("Password changed successfully for user '%s'", user.username)
        return True

    def invalidate_refresh_token(self, raw_refresh):
        if not raw_refresh:
            return False
        try:
            token = RefreshToken(raw_refresh)
            token.blacklist()
            deactivate_session_by_refresh_jti(str(token.get("jti", "")))
            return True
        except TokenError:
            return False

    def revoke_session(self, user, session_key):
        session = user.sessions.filter(session_key=session_key, is_active=True).first()
        if not session:
            raise ValidationError({"detail": "Active session not found."})
        session.is_active = False
        session.logged_out_at = timezone.now()
        session.save(update_fields=["is_active", "logged_out_at", "updated_at"])
        return session

    def revoke_all_sessions(self, user, exclude_session_key=None):
        queryset = user.sessions.filter(is_active=True)
        if exclude_session_key:
            queryset = queryset.exclude(session_key=exclude_session_key)
        count = queryset.update(is_active=False, logged_out_at=timezone.now())
        self._invalidate_tokens(user)
        user.save(update_fields=["token_version"])
        return count

    def _invalidate_tokens(self, user):
        user.token_version = (user.token_version or 0) + 1
        deactivate_all_user_sessions(user)
