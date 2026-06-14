from django.db.models import Q

from apps.core.faculty_scoping import is_faculty_user, resolve_faculty_profile
from apps.core.permissions import normalize_role
from apps.organizations.models import Department, OrganizationMembership
from apps.staff.models import Faculty


class FacultyRepository:
    def resolve_hod_department(self, user):
        if not user or not user.is_authenticated or not user.active_organization_id:
            return None

        membership = (
            OrganizationMembership.objects.filter(
                user=user,
                organization_id=user.active_organization_id,
                role=OrganizationMembership.Role.HOD,
                is_active=True,
            )
            .select_related("department")
            .first()
        )
        if membership and membership.department_id:
            return membership.department

        managed = Department.objects.filter(
            organization_id=user.active_organization_id,
            hod=user,
            is_active=True,
            is_deleted=False,
        ).first()
        if managed and membership and not membership.department_id:
            membership.department = managed
            membership.save(update_fields=["department", "updated_at"])
        return managed

    def list_for_user(self, user, *, search=None, department=None, branch=None, is_active=None):
        queryset = Faculty.objects.select_related(
            "organization", "branch", "department", "user"
        ).filter(
            organization_id=user.active_organization_id,
            is_deleted=False,
        )

        role = normalize_role(getattr(user, "role", ""))
        if is_faculty_user(user):
            profile = resolve_faculty_profile(user)
            if not profile:
                return queryset.none()
            return queryset.filter(pk=profile.pk)
        if role == "HOD":
            from apps.core.hod_scoping import get_hod_departments
            dept_ids = get_hod_departments(user)
            if dept_ids:
                queryset = queryset.filter(department_id__in=dept_ids)

        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(staff_code__icontains=search)
                | Q(email__icontains=search)
            )
        if department not in (None, ""):
            queryset = queryset.filter(department_id=department)
        if branch not in (None, ""):
            queryset = queryset.filter(branch_id=branch)
        if is_active not in (None, ""):
            queryset = queryset.filter(is_active=str(is_active).lower() in {"1", "true", "yes"})

        return queryset.order_by("staff_code")

    def get_by_staff_code(self, organization_id, staff_code):
        return Faculty.objects.select_related("organization", "branch", "department", "user").filter(
            organization_id=organization_id,
            staff_code=staff_code,
            is_deleted=False,
        ).first()

    def departments_for_registration(self, user):
        organization_id = user.active_organization_id
        role = normalize_role(getattr(user, "role", ""))

        if role == "HOD":
            from apps.core.hod_scoping import get_hod_departments
            dept_ids = get_hod_departments(user)
            if not dept_ids:
                return [], None, True
            
            departments = Department.objects.filter(id__in=dept_ids, is_active=True, is_deleted=False).order_by("name")
            items = [{"id": str(item.id), "name": item.name, "code": item.code} for item in departments]
            primary_dept = self.resolve_hod_department(user)
            default_id = str(primary_dept.id) if primary_dept else (items[0]["id"] if items else None)
            lock_field = len(items) <= 1
            return items, default_id, lock_field

        departments = Department.objects.filter(
            organization_id=organization_id,
            is_active=True,
            is_deleted=False,
        ).order_by("name")
        items = [{"id": str(item.id), "name": item.name, "code": item.code} for item in departments]
        default_id = str(items[0]["id"]) if items else None
        return items, default_id, False
