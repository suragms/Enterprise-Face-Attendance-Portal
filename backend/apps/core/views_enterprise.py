from django.http import JsonResponse
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.enterprise import build_system_info


class PublicHealthView(APIView):
    """Liveness probe for Docker / load balancers."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        return JsonResponse({"status": "ok", "service": "hexaattender-api"})


class EnterpriseSystemInfoView(APIView):
    """HexaAttender v2 Enterprise capability manifest."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response(build_system_info())


class EnterpriseSystemInfoAuthenticatedView(APIView):
    """Authenticated system info including active tenant context."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        payload = build_system_info()
        payload["tenant"] = {
            "active_organization_id": str(user.active_organization_id) if user.active_organization_id else None,
            "active_branch_id": str(user.active_branch_id) if user.active_branch_id else None,
            "role": getattr(user, "role", None),
        }
        return Response(payload)
