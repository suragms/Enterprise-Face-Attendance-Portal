import pytest
from rest_framework.test import APIClient

from apps.organizations.models import Department


@pytest.mark.django_db
def test_faculty_portal_context(faculty_user, faculty_profile, subject_instance):
    client = APIClient()
    client.force_authenticate(faculty_user)

    response = client.get("/api/v1/auth/faculty/portal-context/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["staff_code"] == faculty_profile.staff_code
    assert payload["department"]["id"] == str(faculty_profile.department_id)
    assert payload["can_create_faculty"] is False
    assert payload["can_create_hod"] is False
    assert payload["can_manage_departments"] is False
    assert payload["capabilities"]["register_students"] is True
    assert len(payload["assigned_subjects"]) >= 1


@pytest.mark.django_db
def test_faculty_dashboard_summary(faculty_user, faculty_profile, student_instance, subject_instance):
    client = APIClient()
    client.force_authenticate(faculty_user)

    response = client.get("/api/v1/auth/faculty/dashboard-summary/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["staff_code"] == faculty_profile.staff_code
    assert payload["registered_students"] == 1
    assert payload["assigned_subjects"] >= 1


@pytest.mark.django_db
def test_faculty_cannot_create_faculty(faculty_user):
    client = APIClient()
    client.force_authenticate(faculty_user)

    response = client.post(
        "/api/v1/faculty/create/",
        {
            "staff_code": "FAC-BLOCKED",
            "name": "Blocked Faculty",
            "email": "blocked@hexastack.test",
            "username": "blockedfaculty",
            "password": "Hexa@12345",
            "designation": "Lecturer",
        },
        format="json",
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_faculty_cannot_create_hod(faculty_user, department):
    client = APIClient()
    client.force_authenticate(faculty_user)

    response = client.post(
        "/api/v1/auth/accounts/hod/",
        {
            "email": "hodblocked@hexastack.test",
            "username": "hodblocked",
            "password": "Hexa@12345",
            "first_name": "Blocked",
            "last_name": "HOD",
            "department_id": str(department.id),
        },
        format="json",
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_faculty_student_list_scoped_to_department(
    faculty_user, faculty_profile, student_instance, organization, branch, department, course, semester
):
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
        username="otherstudent2",
        email="otherstudent2@hexastack.test",
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
        admission_number="ADM-OTHER2",
        roll_no="EE-002",
        first_name="Other",
        last_name="Student",
        dob="2005-01-01",
        phone="+919999999997",
        email="otherstudent2@hexastack.test",
    )

    client = APIClient()
    client.force_authenticate(faculty_user)
    response = client.get("/api/v1/students/")

    assert response.status_code == 200
    roll_numbers = [item["roll_no"] for item in response.json()]
    assert "CS-001" in roll_numbers
    assert "EE-002" not in roll_numbers


@pytest.mark.django_db
def test_faculty_subjects_scoped_to_assigned(faculty_user, subject_instance, organization, branch, department, course, semester):
    from apps.subjects.models import Subject

    Subject.objects.create(
        organization=organization,
        department=department,
        course=course,
        semester=semester,
        subject_code="CSE999",
        name="Unassigned Subject",
        credits=3,
    )

    client = APIClient()
    client.force_authenticate(faculty_user)
    response = client.get("/api/v1/subjects/")

    assert response.status_code == 200
    codes = [item["subject_code"] for item in response.json()]
    assert "CSE101" in codes
    assert "CSE999" not in codes


@pytest.mark.django_db
def test_faculty_can_register_student_in_own_department(
    faculty_user, faculty_profile, department, course, semester
):
    client = APIClient()
    client.force_authenticate(faculty_user)

    response = client.post(
        "/api/v1/students/",
        {
            "login_email": "newfacstudent@hexastack.test",
            "login_password": "Hexa@12345",
            "first_name": "Fac",
            "last_name": "Student",
            "roll_no": "CS-FAC-001",
            "department": str(department.id),
            "course": str(course.id),
            "semester": str(semester.id),
        },
        format="json",
    )

    assert response.status_code == 201
