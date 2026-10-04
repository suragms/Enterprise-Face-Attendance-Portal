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


class IsTimetableManagerOrAssignedFaculty(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        role = normalize_role(getattr(request.user, "role", ""))
        return ROLE_RANKS.get(role, 0) >= ROLE_RANKS["FACULTY"]

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        role = normalize_role(getattr(user, "role", ""))
        if role == "SUPER_ADMIN":
            return True
        if role in {"HOD", "BRANCH_ADMIN", "ORGANIZATION_ADMIN"}:
            from apps.core.hod_scoping import is_hod_user, get_hod_departments
            if is_hod_user(user):
                hod_depts = get_hod_departments(user)
                return obj.department_id in hod_depts
            return True
        if role == "FACULTY":
            from apps.core.faculty_scoping import resolve_faculty_profile
            profile = resolve_faculty_profile(user)
            if not profile:
                return False
            if obj.department_id != profile.department_id:
                return False
            return obj.faculty_id == profile.id or bool(obj.subject and obj.subject.assigned_faculty_id == profile.id) or obj.created_by_id == user.id
        return False


class IsSubjectManagerOrAssignedFaculty(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        role = normalize_role(getattr(request.user, "role", ""))
        return ROLE_RANKS.get(role, 0) >= ROLE_RANKS["FACULTY"]

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        role = normalize_role(getattr(user, "role", ""))
        if role == "SUPER_ADMIN":
            return True
        if role in {"HOD", "BRANCH_ADMIN", "ORGANIZATION_ADMIN"}:
            from apps.core.hod_scoping import is_hod_user, get_hod_departments
            if is_hod_user(user):
                hod_depts = get_hod_departments(user)
                return obj.department_id in hod_depts
            return True
        if role == "FACULTY":
            from apps.core.faculty_scoping import resolve_faculty_profile
            profile = resolve_faculty_profile(user)
            if not profile:
                return False
            if obj.department_id != profile.department_id:
                return False
            return obj.assigned_faculty_id == profile.id or obj.created_by_id == user.id
        return False
