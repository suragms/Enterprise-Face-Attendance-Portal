import pytest
from rest_framework.test import APIClient

from apps.organizations.models import AuditLog, OrganizationMembership
from apps.staff.models import Faculty


@pytest.mark.django_db
def test_hod_registration_context_returns_locked_department(hod_user, department):
    client = APIClient()
    client.force_authenticate(hod_user)

    response = client.get("/api/v1/staff/registration-context/")

    assert response.status_code == 200
    assert response.data["can_create"] is True
    assert response.data["department_locked"] is True
    assert response.data["default_department_id"] == str(department.id)
    assert len(response.data["departments"]) == 1
    assert response.data["departments"][0]["name"] == department.name


@pytest.mark.django_db
def test_hod_can_create_faculty_via_service_endpoint(hod_user, department):
    client = APIClient()
    client.force_authenticate(hod_user)

    response = client.post(
        "/api/v1/faculty/create/",
        {
            "staff_code": "FAC-HOD-001",
            "name": "New Faculty",
            "email": "newfaculty@hexastack.test",
            "phone": "+919900000001",
            "username": "newfaculty",
            "password": "securepassword123",
            "designation": "Lecturer",
        },
        format="json",
    )

    assert response.status_code == 201, response.data
    faculty = Faculty.objects.get(staff_code="FAC-HOD-001")
    assert faculty.department_id == department.id
    assert faculty.user.role == "FACULTY"
    assert AuditLog.objects.filter(action="faculty.create", entity_id=faculty.id).exists()


@pytest.mark.django_db
def test_hod_list_is_scoped_to_own_department(hod_user, department, organization, branch, faculty_profile):
    other_department = department.__class__.objects.create(
        organization=organization,
        branch=branch,
        name="Electrical Engineering",
        code="EEE",
    )
    other_user = faculty_profile.user.__class__.objects.create_user(
        username="otherfaculty",
        email="other@hexastack.test",
        password="securepassword123",
        role="FACULTY",
        active_organization=organization,
        active_branch=branch,
    )
    Faculty.objects.create(
        organization=organization,
        branch=branch,
        department=other_department,
        user=other_user,
        staff_code="FAC-OTHER",
        first_name="Other",
        last_name="Faculty",
        email="other@hexastack.test",
        designation="Lecturer",
    )

    client = APIClient()
    client.force_authenticate(hod_user)
    response = client.get("/api/v1/staff/")

    assert response.status_code == 200
    payload = response.data["results"] if isinstance(response.data, dict) and "results" in response.data else response.data
    staff_codes = [item["staff_code"] for item in payload]
    assert "FAC-001" in staff_codes
    assert "FAC-OTHER" not in staff_codes


@pytest.mark.django_db
def test_faculty_user_cannot_create_faculty(faculty_user):
    client = APIClient()
    client.force_authenticate(faculty_user)

    response = client.post(
        "/api/v1/faculty/create/",
        {
            "staff_code": "FAC-DENY",
            "name": "Denied Faculty",
            "email": "deny@hexastack.test",
            "username": "denyfaculty",
            "password": "securepassword123",
        },
        format="json",
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_student_cannot_access_registration_context(student_user):
    client = APIClient()
    client.force_authenticate(student_user)

    response = client.get("/api/v1/staff/registration-context/")

    assert response.status_code == 200
    assert response.data["can_create"] is False


@pytest.mark.django_db
def test_super_admin_registration_context_lists_all_departments(super_admin_user, organization, department):
    Department = department.__class__
    Department.objects.create(
        organization=organization,
        branch=department.branch,
        name="Mechanical Engineering",
        code="MECH",
    )

    client = APIClient()
    client.force_authenticate(super_admin_user)
    response = client.get("/api/v1/staff/registration-context/")

    assert response.status_code == 200
    assert response.data["can_create"] is True
    assert response.data["department_locked"] is False
    assert len(response.data["departments"]) >= 2


@pytest.mark.django_db
def test_hod_create_requires_configured_department(organization, branch):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    user = User.objects.create_user(
        username="hodmissingdept",
        email="hodmissing@hexastack.test",
        password="securepassword123",
        role="HOD",
        active_organization=organization,
        active_branch=branch,
    )
    OrganizationMembership.objects.create(
        user=user,
        organization=organization,
        branch=branch,
        role=OrganizationMembership.Role.HOD,
    )

    client = APIClient()
    client.force_authenticate(user)
    response = client.post(
        "/api/v1/faculty/create/",
        {
            "staff_code": "FAC-NODEPT",
            "name": "No Dept Faculty",
            "email": "nodept@hexastack.test",
            "username": "nodeptfaculty",
            "password": "securepassword123",
        },
        format="json",
    )

    assert response.status_code == 400
    assert "department" in response.data


@pytest.mark.django_db
def test_hod_account_creation_assigns_department(super_admin_user, organization, department):
    client = APIClient()
    client.force_authenticate(super_admin_user)

    response = client.post(
        "/api/v1/auth/accounts/hod/",
        {
            "email": "newhod@hexastack.test",
            "username": "newhod",
            "first_name": "New",
            "last_name": "HOD",
            "phone": "+919900000099",
            "password": "Hexa@12345",
            "department_id": str(department.id),
        },
        format="json",
    )

    assert response.status_code == 201, response.data
    membership = OrganizationMembership.objects.get(user__username="newhod")
    assert membership.department_id == department.id
    department.refresh_from_db()
    assert department.hod.username == "newhod"
