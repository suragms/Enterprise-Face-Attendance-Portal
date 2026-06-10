from django.utils.deprecation import MiddlewareMixin
from django.utils import timezone

from apps.core.permissions import normalize_role


class RoleHierarchyMiddleware(MiddlewareMixin):
    def process_request(self, request):
        user = getattr(request, "user", None)
        if user and user.is_authenticated:
            user.role = normalize_role(getattr(user, "role", ""))
            request.role = user.role
            
            # Heal active_organization if it's currently None
            if not user.active_organization_id:
                membership = user.memberships.filter(is_active=True).select_related("organization", "branch").first()
                if membership:
                    user.active_organization = membership.organization
                    user.active_branch = membership.branch or user.active_branch
                    user.save(update_fields=["active_organization", "active_branch"])
                else:
                    from apps.organizations.models import Organization, OrganizationMembership, Branch
                    first_org = Organization.objects.filter(is_active=True, is_deleted=False).first()
                    if first_org:
                        first_branch = Branch.objects.filter(organization=first_org, is_active=True, is_deleted=False).first()
                        OrganizationMembership.objects.create(
                            user=user,
                            organization=first_org,
                            branch=first_branch,
                            role=user.role,
                            is_active=True,
                        )
                        user.active_organization = first_org
                        user.active_branch = first_branch
                        user.save(update_fields=["active_organization", "active_branch"])
        else:
            request.role = None


class StudentEnrollmentGateMiddleware(MiddlewareMixin):
    ALLOWED_PREFIXES = (
        "/api/v1/auth/",
        "/api/auth/",
        "/api/v1/face-recognition/enroll",
        "/api/face-recognition/enroll",
        "/api/v1/face-recognition/audit-events",
        "/api/face-recognition/audit-events",
    )

    def process_request(self, request):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return None
        if normalize_role(getattr(user, "role", "")) != "STUDENT":
            return None
        from apps.face_recognition.models import FaceEnrollment
        has_enrollment = FaceEnrollment.objects.filter(
            user=user,
            organization=user.active_organization,
            is_active=True,
        ).exists()
        if has_enrollment:
            return None
        path = request.path.rstrip("/")
        if any(path.startswith(prefix.rstrip("/")) for prefix in self.ALLOWED_PREFIXES):
            return None
        from django.http import JsonResponse
        return JsonResponse(
            {
                "detail": "Face enrollment is required to continue. Access is restricted until enrollment is completed.",
                "enrollment_required": True,
                "enrollment_overdue": True,
            },
            status=403,
        )


class AuditActivityMiddleware(MiddlewareMixin):
    MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

    def process_response(self, request, response):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return response
        if request.method not in self.MUTATING_METHODS:
            return response
        if request.path.startswith("/admin"):
            return response
        try:
            from apps.organizations.models import AuditLog

            forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
            ip_address = forwarded.split(",")[0].strip() if forwarded else request.META.get("REMOTE_ADDR")
            AuditLog.objects.create(
                organization=getattr(user, "active_organization", None),
                actor=user,
                action=f"{request.method.lower()}:{request.path}",
                ip_address=ip_address,
                user_agent=request.META.get("HTTP_USER_AGENT", ""),
                metadata={"status_code": response.status_code},
            )
        except Exception:
            # Do not block response for audit failures.
            pass
        return response
