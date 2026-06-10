from rest_framework.exceptions import PermissionDenied

from apps.core.permissions import normalize_role
from apps.staff.models import Faculty


def is_faculty_user(user) -> bool:
    return bool(user and user.is_authenticated and normalize_role(getattr(user, "role", "")) == "FACULTY")


def resolve_faculty_profile(user):
    if not user or not user.is_authenticated or not user.active_organization_id:
        return None
    return (
        Faculty.objects.filter(
            user=user,
            organization_id=user.active_organization_id,
            is_active=True,
            is_deleted=False,
        )
        .select_related("department", "branch")
        .first()
    )


def assigned_subject_ids(user):
    profile = resolve_faculty_profile(user)
    if not profile:
        return []
    from apps.subjects.models import Subject

    return list(
        Subject.objects.filter(
            organization_id=user.active_organization_id,
            assigned_faculty=profile,
            is_active=True,
            is_deleted=False,
        ).values_list("id", flat=True)
    )


def scope_queryset_for_faculty(queryset, user, department_field="department"):
    if not is_faculty_user(user):
        return queryset
    profile = resolve_faculty_profile(user)
    if not profile:
        return queryset.none()
    if "__" in department_field:
        return queryset.filter(**{department_field: profile.department})
    return queryset.filter(**{f"{department_field}_id": profile.department_id})


def scope_attendance_records_for_faculty(queryset, user):
    if not is_faculty_user(user):
        return queryset
    profile = resolve_faculty_profile(user)
    if not profile:
        return queryset.none()
    return queryset.filter(session__subject__assigned_faculty=profile)


def scope_attendance_sessions_for_faculty(queryset, user):
    if not is_faculty_user(user):
        return queryset
    profile = resolve_faculty_profile(user)
    if not profile:
        return queryset.none()
    return queryset.filter(subject__assigned_faculty=profile)


def scope_materials_for_faculty(queryset, user):
    if not is_faculty_user(user):
        return queryset
    profile = resolve_faculty_profile(user)
    if not profile:
        return queryset.none()
    from django.db.models import Q

    return queryset.filter(Q(uploaded_by=user) | Q(subject__assigned_faculty=profile))


def scope_subjects_for_faculty(queryset, user):
    if not is_faculty_user(user):
        return queryset
    profile = resolve_faculty_profile(user)
    if not profile:
        return queryset.none()
    return queryset.filter(assigned_faculty=profile)


def enforce_faculty_department_access(user, department):
    if not is_faculty_user(user):
        return
    profile = resolve_faculty_profile(user)
    if not profile:
        raise PermissionDenied("Faculty profile is not configured.")
    department_id = getattr(department, "id", department)
    if str(department_id) != str(profile.department_id):
        raise PermissionDenied("Faculty can only manage students in their assigned department.")
