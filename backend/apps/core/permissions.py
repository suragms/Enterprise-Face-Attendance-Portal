from rest_framework import permissions


ROLE_RANKS = {
    "STUDENT": 10,
    "FACULTY": 20,
    "HOD": 40,
    "BRANCH_ADMIN": 45,
    "ORGANIZATION_ADMIN": 48,
    "SUPER_ADMIN": 50,
}

ROLE_ALIASES = {
    "PLATFORM_SUPER_ADMIN": "SUPER_ADMIN",
}


def normalize_role(role):
    return ROLE_ALIASES.get(role, role)


class IsPlatformSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and normalize_role(request.user.role) == "SUPER_ADMIN")


class IsOrganizationAdminOrAbove(permissions.BasePermission):
    def has_permission(self, request, view):
        role = normalize_role(getattr(request.user, "role", ""))
        return bool(request.user and request.user.is_authenticated and ROLE_RANKS.get(role, 0) >= ROLE_RANKS["HOD"])


class IsBranchAdminOrAbove(permissions.BasePermission):
    def has_permission(self, request, view):
        role = normalize_role(getattr(request.user, "role", ""))
        return bool(request.user and request.user.is_authenticated and ROLE_RANKS.get(role, 0) >= ROLE_RANKS["HOD"])


class IsFacultyOrAbove(permissions.BasePermission):
    def has_permission(self, request, view):
        role = normalize_role(getattr(request.user, "role", ""))
        return bool(request.user and request.user.is_authenticated and ROLE_RANKS.get(role, 0) >= ROLE_RANKS["FACULTY"])
