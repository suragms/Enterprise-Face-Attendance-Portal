from rest_framework.exceptions import PermissionDenied

from apps.core.permissions import normalize_role
from apps.staff.repositories.faculty_repository import FacultyRepository


def is_hod_user(user) -> bool:
    """True only for department HODs, not organization/branch admins."""
    return bool(user and user.is_authenticated and getattr(user, "role", "") == "HOD")


def resolve_hod_department(user):
    return FacultyRepository().resolve_hod_department(user)


def get_hod_departments(user):
    if not is_hod_user(user):
        return []
    from apps.organizations.models import Department, OrganizationMembership
    
    dept_ids = set()
    
    # 1. Get department from OrganizationMembership
    membership = OrganizationMembership.objects.filter(
        user=user,
        organization_id=user.active_organization_id,
        role=OrganizationMembership.Role.HOD,
        is_active=True
    ).first()
    if membership and membership.department_id:
        dept_ids.add(membership.department_id)
        
    # 2. Get departments where user is set as HOD
    managed_depts = Department.objects.filter(
        organization_id=user.active_organization_id,
        hod=user,
        is_active=True,
        is_deleted=False
    ).values_list("id", flat=True)
    dept_ids.update(managed_depts)
    
    return list(dept_ids)


def scope_queryset_for_hod(queryset, user, department_field="department"):
    if not is_hod_user(user):
        return queryset
    dept_ids = get_hod_departments(user)
    if not dept_ids:
        return queryset.none()
    if "__" in department_field:
        return queryset.filter(**{f"{department_field}__id__in": dept_ids})
    return queryset.filter(**{f"{department_field}_id__in": dept_ids})


def enforce_hod_department_access(user, department):
    if not is_hod_user(user):
        return
    dept_ids = get_hod_departments(user)
    if not dept_ids:
        raise PermissionDenied("HOD department is not configured.")
    department_id = getattr(department, "id", department)
    if department_id is None:
        raise PermissionDenied("Department is required.")
    if str(department_id) not in [str(d_id) for d_id in dept_ids]:
        raise PermissionDenied("HOD can only access their assigned department(s).")
