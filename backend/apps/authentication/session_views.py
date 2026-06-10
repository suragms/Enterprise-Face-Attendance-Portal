from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.serializers import UserSessionSerializer
from apps.authentication.services import AuthService


class UserSessionListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        sessions = (
            request.user.sessions.filter(is_active=True, is_deleted=False)
            .order_by("-last_seen_at")
        )
        serializer = UserSessionSerializer(sessions, many=True, context={"request": request})
        return Response({"count": sessions.count(), "results": serializer.data})


class UserSessionRevokeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.auth_service = AuthService()

    def post(self, request, session_key):
        try:
            self.auth_service.revoke_session(request.user, session_key)
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_404_NOT_FOUND)
        return Response({"message": "Session revoked."})


class UserSessionRevokeAllView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.auth_service = AuthService()

    def post(self, request):
        current_session_key = request.data.get("current_session_key")
        count = self.auth_service.revoke_all_sessions(request.user, exclude_session_key=current_session_key)
        return Response({"message": f"{count} session(s) revoked.", "revoked_count": count})


class PasswordPolicyView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response(
            {
                "min_length": 8,
                "requires_uppercase": True,
                "requires_lowercase": True,
                "requires_digit": True,
                "requires_special": True,
                "help_text": (
                    "Password must be at least 8 characters and include uppercase, lowercase, "
                    "a number, and a special character."
                ),
            }
        )
