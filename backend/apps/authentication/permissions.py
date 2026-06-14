from rest_framework import permissions

from apps.core.permissions import ROLE_RANKS, normalize_role


class IsHODAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        role = normalize_role(getattr(request.user, "role", ""))
        return bool(request.user and request.user.is_authenticated and ROLE_RANKS.get(role, 0) >= ROLE_RANKS["HOD"])


class IsFacultyUser(permissions.BasePermission):
    def has_permission(self, request, view):
        role = normalize_role(getattr(request.user, "role", ""))
        return bool(request.user and request.user.is_authenticated and ROLE_RANKS.get(role, 0) >= ROLE_RANKS["FACULTY"])


class IsStudentUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and normalize_role(getattr(request.user, "role", "")) == "STUDENT"
        )


class IsSuperAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and normalize_role(getattr(request.user, "role", "")) == "SUPER_ADMIN"
        )


class IsHODUser(permissions.BasePermission):
    def has_permission(self, request, view):
        role = normalize_role(getattr(request.user, "role", ""))
        return bool(request.user and request.user.is_authenticated and ROLE_RANKS.get(role, 0) >= ROLE_RANKS["HOD"])


class IsHODOnlyOrSuperAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        role = normalize_role(getattr(request.user, "role", ""))
        return bool(request.user and request.user.is_authenticated and role in {"HOD", "SUPER_ADMIN"})


class IsFacultyOnlyUser(permissions.BasePermission):
    def has_permission(self, request, view):
        role = normalize_role(getattr(request.user, "role", ""))
        return bool(request.user and request.user.is_authenticated and role == "FACULTY")


class IsStudentManagementUser(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        role = getattr(request.user, "role", "")
        rank = ROLE_RANKS.get(role, ROLE_RANKS.get(normalize_role(role), 0))
        return rank >= ROLE_RANKS["FACULTY"]
