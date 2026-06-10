from apps.core.permissions import normalize_role
from apps.students.models import Student


ATTENDANCE_THRESHOLD = 75


def is_student_user(user) -> bool:
    return bool(user and user.is_authenticated and normalize_role(getattr(user, "role", "")) == "STUDENT")


def resolve_student_profile(user):
    if not user or not user.is_authenticated or not user.active_organization_id:
        return None
    return (
        Student.objects.filter(
            user=user,
            organization_id=user.active_organization_id,
            is_deleted=False,
        )
        .select_related("department", "course", "semester", "branch", "organization")
        .first()
    )


def scope_students_to_self(queryset, user):
    """Students may only see their own profile."""
    if not is_student_user(user):
        return queryset
    profile = resolve_student_profile(user)
    if not profile:
        return queryset.none()
    return queryset.filter(pk=profile.pk)


def scope_queryset_for_student(queryset, user, *, department_field="department", semester_field="semester", course_field="course"):
    if not is_student_user(user):
        return queryset
    profile = resolve_student_profile(user)
    if not profile:
        return queryset.none()
    filters = {}
    if department_field and hasattr(queryset.model, department_field.split("__")[0] if "__" in department_field else department_field):
        key = department_field if "__" in department_field else f"{department_field}_id"
        filters[key] = profile.department if "__" in department_field else profile.department_id
    if semester_field:
        key = semester_field if "__" in semester_field else f"{semester_field}_id"
        filters[key] = profile.semester if "__" in semester_field else profile.semester_id
    if course_field:
        key = course_field if "__" in course_field else f"{course_field}_id"
        filters[key] = profile.course if "__" in course_field else profile.course_id
    if filters:
        return queryset.filter(**filters)
    return queryset
