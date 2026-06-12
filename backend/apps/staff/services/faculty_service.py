from django.db import transaction

from apps.authentication.models import User
from apps.organizations.models import AuditLog, OrganizationMembership
from apps.staff.models import Faculty
from apps.staff.repositories.faculty_repository import FacultyRepository
from apps.core.permissions import normalize_role


class FacultyServiceError(Exception):
    def __init__(self, message, *, field=None, status_code=400):
        super().__init__(message)
        self.message = message
        self.field = field
        self.status_code = status_code


class FacultyService:
    def __init__(self, repository=None):
        self.repository = repository or FacultyRepository()

    def registration_context(self, actor):
        departments, default_department_id, department_locked = self.repository.departments_for_registration(actor)
        role = normalize_role(getattr(actor, "role", ""))
        can_create = role in {"HOD", "SUPER_ADMIN"} or getattr(actor, "is_super_admin", False)
        return {
            "can_create": can_create,
            "departments": departments,
            "default_department_id": default_department_id,
            "department_locked": department_locked,
        }

    @transaction.atomic
    def create_faculty(self, actor, payload):
        role = normalize_role(getattr(actor, "role", ""))
        if role not in {"HOD", "SUPER_ADMIN"} and not getattr(actor, "is_super_admin", False):
            raise FacultyServiceError("You are not allowed to create faculty accounts.", status_code=403)

        organization = actor.active_organization
        if organization is None:
            raise FacultyServiceError("Active organization is required.", status_code=400)

        staff_code = str(payload.get("staff_code", "")).strip()
        username = str(payload.get("username") or payload.get("login_username") or "").strip()
        password = str(payload.get("password", "")).strip()
        email = str(payload.get("email", "")).strip()
        phone = str(payload.get("phone", "")).strip()
        designation = str(payload.get("designation", "Lecturer")).strip()
        full_name = str(payload.get("name", "")).strip()

        if not staff_code:
            raise FacultyServiceError("Staff ID is required.", field="staff_code")
        if not username:
            raise FacultyServiceError("Username is required.", field="username")
        if not password:
            raise FacultyServiceError("Password is required.", field="password")
        if not email:
            raise FacultyServiceError("Email is required.", field="email")

        if Faculty.objects.filter(organization=organization, staff_code=staff_code, is_deleted=False).exists():
            raise FacultyServiceError("Staff ID already exists.", field="staff_code", status_code=409)
        if User.objects.filter(username=username).exists():
            raise FacultyServiceError("Username already exists.", field="username", status_code=409)

        first_name = payload.get("first_name") or (full_name.split(" ", 1)[0] if full_name else username)
        last_name = payload.get("last_name") or (full_name.split(" ", 1)[1] if full_name and " " in full_name else "")

        department = self._resolve_department(actor, payload.get("department"))
        branch = actor.active_branch or department.branch

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            role=User.Roles.FACULTY,
            phone=phone or None,
            active_organization=organization,
            active_branch=branch,
        )
        OrganizationMembership.objects.create(
            user=user,
            organization=organization,
            branch=branch,
            department=department,
            role=OrganizationMembership.Role.FACULTY,
            created_by=actor,
            updated_by=actor,
        )

        faculty = Faculty.objects.create(
            organization=organization,
            branch=branch,
            department=department,
            user=user,
            staff_code=staff_code,
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone=phone,
            designation=designation,
            salary=payload.get("salary"),
            max_load_credits=payload.get("max_load_credits") or 12,
            created_by=actor,
            updated_by=actor,
        )

        actor_name = actor.get_full_name() or actor.username
        AuditLog.objects.create(
            organization=organization,
            actor=actor,
            action="faculty.create",
            entity_type="Faculty",
            entity_id=faculty.id,
            metadata={"message": f"HOD {actor_name} created Faculty {faculty.name}"},
        )
        return faculty

    def _resolve_department(self, actor, department_value):
        organization = actor.active_organization
        role = normalize_role(getattr(actor, "role", ""))

        if role == "HOD":
            hod_department = self.repository.resolve_hod_department(actor)
            if not hod_department:
                raise FacultyServiceError(
                    "HOD department is not configured. Assign a department to this HOD account first.",
                    field="department",
                    status_code=400,
                )
            return hod_department

        from apps.organizations.models import Department

        if not department_value:
            raise FacultyServiceError("Department is required.", field="department")

        if isinstance(department_value, Department):
            return department_value

        department_str = str(department_value).strip()
        queryset = Department.objects.filter(organization=organization, is_active=True, is_deleted=False)
        if len(department_str) == 36 and department_str.count("-") == 4:
            department = queryset.filter(id=department_str).first()
        else:
            department = queryset.filter(name__iexact=department_str).first() or queryset.filter(code__iexact=department_str).first()

        if not department:
            raise FacultyServiceError("No active department matches this value.", field="department")
        return department
