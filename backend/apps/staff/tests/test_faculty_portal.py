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
def test_faculty_can_register_student(
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


@pytest.mark.django_db
def test_faculty_can_create_assigned_timetable_slot(
    faculty_user, faculty_profile, subject_instance, branch, department, course, semester
):
    from apps.timetable.models import Timetable

    client = APIClient()
    client.force_authenticate(faculty_user)

    response = client.post(
        "/api/v1/timetable/",
        {
            "branch": str(branch.id),
            "department": str(department.id),
            "course": str(course.id),
            "semester": str(semester.id),
            "subject": str(subject_instance.id),
            "faculty": str(faculty_profile.id),
            "day_of_week": "THURSDAY",
            "period": 4,
            "start_time": "11:30:00",
            "end_time": "12:30:00",
            "room_number": "CSE-204",
        },
        format="json",
    )

    assert response.status_code == 201, response.data
    slot = Timetable.objects.get(id=response.data["id"])
    assert slot.faculty == faculty_profile
    assert slot.subject == subject_instance
    assert slot.room == "CSE-204"


@pytest.mark.django_db
def test_timetable_scoping_and_visibility(
    faculty_user, faculty_profile, student_user, student_instance, subject_instance, branch, department, course, semester
):
    from apps.timetable.models import Timetable
    from apps.staff.models import Faculty
    from django.contrib.auth import get_user_model
    from apps.organizations.models import OrganizationMembership

    User = get_user_model()
    second_fac_user = User.objects.create_user(
        username="faculty_two",
        email="faculty_two@hexastack.test",
        password="securepassword123",
        role="FACULTY",
        active_organization=faculty_user.active_organization,
        active_branch=branch,
    )
    OrganizationMembership.objects.create(
        user=second_fac_user,
        organization=faculty_user.active_organization,
        branch=branch,
        department=department,
        role="FACULTY",
    )
    second_fac_profile = Faculty.objects.create(
        organization=faculty_user.active_organization,
        branch=branch,
        department=department,
        user=second_fac_user,
        staff_code="FAC-002",
        first_name="Alice",
        last_name="Smith",
        email="faculty_two@hexastack.test",
    )

    import datetime
    now_time = datetime.datetime.now().time()
    one_hour_later = (datetime.datetime.now() + datetime.timedelta(hours=1)).time()
    today_day = datetime.datetime.now().strftime("%A").upper()

    slot = Timetable.objects.create(
        organization=faculty_user.active_organization,
        branch=branch,
        department=department,
        course=course,
        semester=semester,
        subject=subject_instance,
        faculty=second_fac_profile,
        day=today_day,
        period=1,
        starts_at=now_time,
        ends_at=one_hour_later,
        is_active=True,
    )

    # 1. Verify Student client can fetch with is_active=true query param without error
    student_client = APIClient()
    student_client.force_authenticate(student_user)
    student_resp = student_client.get("/api/v1/timetable/?is_active=true")
    assert student_resp.status_code == 200
    rows = student_resp.json() if isinstance(student_resp.json(), list) else student_resp.json().get("results", [])
    assert any(row["id"] == str(slot.id) for row in rows)

    # 2. Verify Faculty user can see the slot even if it belongs to second faculty (in same department)
    faculty_client = APIClient()
    faculty_client.force_authenticate(faculty_user)
    fac_resp = faculty_client.get("/api/v1/timetable/")
    assert fac_resp.status_code == 200
    rows = fac_resp.json() if isinstance(fac_resp.json(), list) else fac_resp.json().get("results", [])
    assert any(row["id"] == str(slot.id) for row in rows)

    # 3. Verify Faculty user's current endpoint does NOT return second faculty's slot
    curr_resp = faculty_client.get(f"/api/v1/timetable/current/?day={today_day}")
    assert curr_resp.status_code == 200
    assert curr_resp.json().get("scheduled") is False
