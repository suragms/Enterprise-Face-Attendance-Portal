from rest_framework.exceptions import PermissionDenied

from apps.core.permissions import normalize_role
from apps.staff.repositories.faculty_repository import FacultyRepository


def is_hod_user(user) -> bool:
    """True only for department HODs, not organization/branch admins."""
    return bool(user and user.is_authenticated and getattr(user, "role", "") == "HOD")


def resolve_hod_department(user):
    return FacultyRepository().resolve_hod_department(user)


def scope_queryset_for_hod(queryset, user, department_field="department"):
    if not is_hod_user(user):
        return queryset
    department = resolve_hod_department(user)
    if not department:
        return queryset.none()
    if "__" in department_field:
        return queryset.filter(**{department_field: department})
    return queryset.filter(**{f"{department_field}_id": department.id})


def enforce_hod_department_access(user, department):
    if not is_hod_user(user):
        return
    hod_department = resolve_hod_department(user)
    if not hod_department:
        raise PermissionDenied("HOD department is not configured.")
    department_id = getattr(department, "id", department)
    if department_id is None:
        raise PermissionDenied("Department is required.")
    if str(department_id) != str(hod_department.id):
        raise PermissionDenied("HOD can only access their assigned department.")
