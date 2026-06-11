import pytest
from rest_framework.test import APIClient

from apps.organizations.models import Department


@pytest.mark.django_db
def test_hod_portal_context(hod_user, department):
    client = APIClient()
    client.force_authenticate(hod_user)

    response = client.get("/api/v1/auth/hod/portal-context/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["department"]["id"] == str(department.id)
    assert payload["department_locked"] is True
    assert payload["can_create_hod"] is False
    assert payload["capabilities"]["create_faculty"] is True
    assert payload["capabilities"]["manage_notifications"] is True


@pytest.mark.django_db
def test_hod_dashboard_summary(hod_user, department, faculty_profile, student_instance):
    client = APIClient()
    client.force_authenticate(hod_user)

    response = client.get("/api/v1/auth/hod/dashboard-summary/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["department_id"] == str(department.id)
    assert payload["faculty_count"] == 1
    assert payload["student_count"] == 1
    assert "attendance_percentage" in payload


@pytest.mark.django_db
def test_hod_cannot_create_hod_account(hod_user, department):
    client = APIClient()
    client.force_authenticate(hod_user)

    response = client.post(
        "/api/v1/auth/accounts/hod/",
        {
            "email": "newhod@hexastack.test",
            "username": "newhod",
            "password": "securepassword123",
            "first_name": "New",
            "last_name": "HOD",
            "department_id": str(department.id),
        },
        format="json",
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_hod_student_list_scoped_to_department(hod_user, department, student_instance, organization, branch, course, semester):
    other_department = Department.objects.create(
        organization=organization,
        branch=branch,
        name="Electrical Engineering",
        code="EEE",
    )
    from django.contrib.auth import get_user_model
    from apps.students.models import Student

    User = get_user_model()
    other_user = User.objects.create_user(
        username="otherstudent",
        email="otherstudent@hexastack.test",
        password="securepassword123",
        role="STUDENT",
        active_organization=organization,
        active_branch=branch,
    )
    Student.objects.create(
        organization=organization,
        branch=branch,
        department=other_department,
        course=course,
        semester=semester,
        user=other_user,
        admission_number="ADM-OTHER",
        roll_no="EE-001",
        first_name="Other",
        last_name="Student",
        dob="2005-01-01",
        phone="+919999999998",
        email="otherstudent@hexastack.test",
    )

    client = APIClient()
    client.force_authenticate(hod_user)
    response = client.get("/api/v1/students/")

    assert response.status_code == 200
    roll_numbers = [item["roll_no"] for item in response.json()]
    assert "CS-001" in roll_numbers
    assert "EE-001" not in roll_numbers


@pytest.mark.django_db
def test_hod_cannot_create_student_in_other_department(hod_user, department, organization, branch, course, semester):
    other_department = Department.objects.create(
        organization=organization,
        branch=branch,
        name="Electrical Engineering",
        code="EEE",
    )
    client = APIClient()
    client.force_authenticate(hod_user)

    response = client.post(
        "/api/v1/students/",
        {
            "login_email": "blocked@hexastack.test",
            "login_password": "securepassword123",
            "first_name": "Blocked",
            "last_name": "Student",
            "roll_no": "EE-002",
            "department": str(other_department.id),
            "course": str(course.id),
            "semester": str(semester.id),
        },
        format="json",
    )

    assert response.status_code in {400, 403}


@pytest.mark.django_db
def test_hod_subject_list_scoped_to_department(hod_user, subject_instance, organization, branch, department, course, semester):
    from apps.subjects.models import Subject

    other_department = Department.objects.create(
        organization=organization,
        branch=branch,
        name="Electrical Engineering",
        code="EEE",
    )
    Subject.objects.create(
        organization=organization,
        department=other_department,
        course=course,
        semester=semester,
        subject_code="EEE101",
        name="Power Systems",
        credits=4,
    )

    client = APIClient()
    client.force_authenticate(hod_user)
    response = client.get("/api/v1/subjects/")

    assert response.status_code == 200
    codes = [item["subject_code"] for item in response.json()]
    assert "CSE101" in codes
    assert "EEE101" not in codes


@pytest.mark.django_db
def test_hod_reports_scoped_to_department(hod_user, department):
    client = APIClient()
    client.force_authenticate(hod_user)

    response = client.get("/api/v1/reports/analytics/")

    assert response.status_code == 200


@pytest.mark.django_db
def test_hod_student_creation_without_specifying_department(hod_user, department, course, semester):
    client = APIClient()
    client.force_authenticate(hod_user)

    response = client.post(
        "/api/v1/students/",
        {
            "login_email": "autodept@hexastack.test",
            "login_password": "securepassword123",
            "first_name": "Auto",
            "last_name": "Dept",
            "roll_no": "CS-999",
            "course": str(course.id),
            "semester": str(semester.id),
        },
        format="json",
    )

    assert response.status_code == 201, response.data
    assert response.json()["department"] == department.name
