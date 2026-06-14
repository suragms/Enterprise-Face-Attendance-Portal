import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_hod_cannot_create_branch_or_department(hod_user, branch):
    client = APIClient()
    client.force_authenticate(hod_user)

    branch_response = client.post(
        "/api/v1/branches/",
        {"name": "Blocked Campus", "code": "BLOCK"},
        format="json",
    )
    assert branch_response.status_code == 403

    department_response = client.post(
        "/api/v1/departments/",
        {"name": "Blocked Department", "code": "BLK", "branch": str(branch.id)},
        format="json",
    )
    assert department_response.status_code == 403


@pytest.mark.django_db
def test_super_admin_can_create_branch_and_department(super_admin_user):
    client = APIClient()
    client.force_authenticate(super_admin_user)

    branch_response = client.post(
        "/api/v1/branches/",
        {"name": "North Campus", "code": "NORTH"},
        format="json",
    )
    assert branch_response.status_code == 201, branch_response.data

    department_response = client.post(
        "/api/v1/departments/",
        {"name": "Information Technology", "code": "IT", "branch": branch_response.data["id"]},
        format="json",
    )
    assert department_response.status_code == 201, department_response.data


@pytest.mark.django_db
def test_faculty_cannot_create_student(faculty_user, department, course, semester):
    client = APIClient()
    client.force_authenticate(faculty_user)

    response = client.post(
        "/api/v1/students/",
        {
            "login_email": "blocked-student@hexastack.test",
            "login_password": "Hexa@12345",
            "first_name": "Blocked",
            "last_name": "Student",
            "roll_no": "CS-BLOCKED",
            "department": str(department.id),
            "course": str(course.id),
            "semester": str(semester.id),
        },
        format="json",
    )

    assert response.status_code == 403
