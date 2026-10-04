import datetime
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.organizations.models import Branch, Course, Department, Organization, OrganizationMembership, Semester
from apps.staff.models import Faculty
from apps.students.models import Student
from apps.subjects.models import Subject
from apps.timetable.models import Timetable
from apps.materials.models import StudyMaterial
from apps.notifications.models import NotificationSchedule

User = get_user_model()


@pytest.fixture
def org_b(db):
    return Organization.objects.create(name="Org B Institute", slug="orgb")


@pytest.fixture
def branch_b(db, org_b):
    return Branch.objects.create(organization=org_b, name="Org B Branch", code="ORGB_BR")


@pytest.fixture
def department_b(db, org_b, branch_b):
    return Department.objects.create(organization=org_b, branch=branch_b, name="Org B Dept", code="ORGB_DP")


@pytest.fixture
def dept_2_same_org(db, organization, branch):
    return Department.objects.create(organization=organization, branch=branch, name="Electrical Eng", code="EEE")


@pytest.fixture
def course_dept_2(db, organization, dept_2_same_org):
    return Course.objects.create(organization=organization, department=dept_2_same_org, name="B.Tech EEE", code="BTEEE")


@pytest.fixture
def hod_user_dept_2(db, organization, branch, dept_2_same_org):
    user = User.objects.create_user(
        username="hod_eee",
        email="hod_eee@hexastack.test",
        password="securepassword123",
        role="HOD",
        active_organization=organization,
        active_branch=branch,
    )
    OrganizationMembership.objects.create(
        user=user,
        organization=organization,
        branch=branch,
        department=dept_2_same_org,
        role=OrganizationMembership.Role.HOD,
    )
    dept_2_same_org.hod = user
    dept_2_same_org.save(update_fields=["hod", "updated_at"])
    return user


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


@pytest.mark.django_db
def test_student_cannot_mutate_academic_data(student_user, department, course, semester, subject_instance):
    client = APIClient()
    client.force_authenticate(student_user)

    # Student cannot create Course
    res = client.post("/api/v1/courses/", {"name": "Hacked Course", "code": "HC", "department": str(department.id)}, format="json")
    assert res.status_code == 403

    # Student cannot create Subject
    res = client.post(
        "/api/v1/subjects/",
        {
            "subject_code": "SUB999",
            "name": "Unauthorized Subject",
            "department": str(department.id),
            "course": str(course.id),
            "semester": str(semester.id),
        },
        format="json",
    )
    assert res.status_code == 403

    # Student cannot update Subject
    res = client.patch(f"/api/v1/subjects/{subject_instance.id}/", {"name": "Hacked Subject"}, format="json")
    assert res.status_code == 403

    # Student cannot create Timetable entry
    res = client.post(
        "/api/v1/timetable/",
        {
            "branch": str(department.branch.id),
            "department": str(department.id),
            "course": str(course.id),
            "semester": str(semester.id),
            "subject": str(subject_instance.id),
            "day": "MONDAY",
            "period": 1,
            "starts_at": "09:00:00",
            "ends_at": "10:00:00",
            "room": "101",
        },
        format="json",
    )
    assert res.status_code == 403


@pytest.mark.django_db
def test_cross_tenant_isolation(hod_user, org_b, branch_b, department_b):
    client = APIClient()
    client.force_authenticate(hod_user)

    # Attempt to access resources belonging to Org B
    res = client.get(f"/api/v1/departments/{department_b.id}/")
    assert res.status_code in (404, 403)

    # Attempt to create Course under Org B's department
    res = client.post(
        "/api/v1/courses/",
        {"name": "Org B Course", "code": "OBC", "department": str(department_b.id)},
        format="json",
    )
    # Organization is overridden to caller's active_organization or validation fails
    if res.status_code == 201:
        assert res.data["organization"] == str(hod_user.active_organization.id)
        assert res.data["organization"] != str(org_b.id)


@pytest.mark.django_db
def test_cross_department_hod_isolation(hod_user, hod_user_dept_2, department, dept_2_same_org, course, course_dept_2):
    client = APIClient()
    client.force_authenticate(hod_user)  # HOD of CSE department

    # HOD CSE attempts to create a Course in EEE department
    res = client.post(
        "/api/v1/courses/",
        {"name": "Cross Dept Course", "code": "CDC", "department": str(dept_2_same_org.id)},
        format="json",
    )
    assert res.status_code == 403


@pytest.mark.django_db
def test_faculty_assigned_subject_timetable_permission(faculty_user, faculty_profile, subject_instance, department, branch, course, semester):
    client = APIClient()
    client.force_authenticate(faculty_user)

    # Faculty can create a timetable entry for their assigned subject
    res = client.post(
        "/api/v1/timetable/",
        {
            "branch": str(branch.id),
            "department": str(department.id),
            "course": str(course.id),
            "semester": str(semester.id),
            "subject": str(subject_instance.id),
            "faculty": str(faculty_profile.id),
            "day": "MONDAY",
            "period": 1,
            "starts_at": "09:00:00",
            "ends_at": "10:00:00",
            "room": "Lab 1",
        },
        format="json",
    )
    assert res.status_code == 201, res.data
    entry_id = res.data["id"]

    # Faculty can update their entry
    res = client.patch(
        f"/api/v1/timetable/{entry_id}/",
        {"room": "Lab 2"},
        format="json",
    )
    assert res.status_code == 200
    assert res.data["room"] == "Lab 2"
