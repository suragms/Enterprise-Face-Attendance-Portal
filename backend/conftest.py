import datetime

import pytest
from django.contrib.auth import get_user_model

from apps.organizations.models import AcademicYear, Branch, Course, Department, Organization, OrganizationMembership, Semester
from apps.staff.models import Faculty
from apps.students.models import Student
from apps.subjects.models import Subject

User = get_user_model()


@pytest.fixture
def organization(db):
    return Organization.objects.create(name="HexaStack Institute", slug="hexastack")


@pytest.fixture
def branch(db, organization):
    return Branch.objects.create(organization=organization, name="Main Campus", code="MAIN")


@pytest.fixture
def department(db, organization, branch):
    return Department.objects.create(organization=organization, branch=branch, name="Computer Science", code="CSE")


@pytest.fixture
def academic_year(db, organization):
    return AcademicYear.objects.create(
        organization=organization,
        name="2026-2027",
        starts_on=datetime.date(2026, 6, 1),
        ends_on=datetime.date(2027, 5, 31),
        is_current=True,
    )


@pytest.fixture
def course(db, organization, department):
    return Course.objects.create(organization=organization, department=department, name="B.Tech Computer Science", code="BTCS")


@pytest.fixture
def semester(db, organization, course, academic_year):
    return Semester.objects.create(
        organization=organization,
        course=course,
        academic_year=academic_year,
        number=1,
        starts_on=datetime.date(2026, 6, 1),
        ends_on=datetime.date(2026, 11, 30),
    )


@pytest.fixture
def hod_user(db, organization, branch, department):
    user = User.objects.create_user(
        username="hoduser",
        email="hod@hexastack.test",
        password="securepassword123",
        role="HOD",
        active_organization=organization,
        active_branch=branch,
    )
    OrganizationMembership.objects.create(
        user=user,
        organization=organization,
        branch=branch,
        department=department,
        role=OrganizationMembership.Role.HOD,
    )
    department.hod = user
    department.save(update_fields=["hod", "updated_at"])
    return user


@pytest.fixture
def super_admin_user(db, organization, branch):
    user = User.objects.create_user(
        username="superadmin",
        email="super@hexastack.test",
        password="securepassword123",
        role="SUPER_ADMIN",
        active_organization=organization,
        active_branch=branch,
    )
    OrganizationMembership.objects.create(
        user=user,
        organization=organization,
        branch=branch,
        role=OrganizationMembership.Role.SUPER_ADMIN,
    )
    return user


@pytest.fixture
def admin_user(db, organization, branch, department):
    user = User.objects.create_user(
        username="orgadmin",
        email="admin@hexastack.test",
        password="securepassword123",
        role="ORGANIZATION_ADMIN",
        active_organization=organization,
        active_branch=branch,
    )
    OrganizationMembership.objects.create(
        user=user,
        organization=organization,
        branch=branch,
        department=department,
        role="ORGANIZATION_ADMIN",
    )
    return user


@pytest.fixture
def faculty_user(db, organization, branch, department):
    user = User.objects.create_user(
        username="faculty",
        email="faculty@hexastack.test",
        password="securepassword123",
        role="FACULTY",
        active_organization=organization,
        active_branch=branch,
    )
    OrganizationMembership.objects.create(
        user=user,
        organization=organization,
        branch=branch,
        department=department,
        role="FACULTY",
    )
    return user


@pytest.fixture
def student_user(db, organization, branch, department):
    user = User.objects.create_user(
        username="student",
        email="student@hexastack.test",
        password="securepassword123",
        role="STUDENT",
        active_organization=organization,
        active_branch=branch,
    )
    OrganizationMembership.objects.create(
        user=user,
        organization=organization,
        branch=branch,
        department=department,
        role="STUDENT",
    )
    return user


@pytest.fixture
def faculty_profile(db, organization, branch, department, faculty_user):
    return Faculty.objects.create(
        organization=organization,
        branch=branch,
        department=department,
        user=faculty_user,
        staff_code="FAC-001",
        first_name="Anita",
        last_name="Nair",
        email="faculty@hexastack.test",
        designation="Assistant Professor",
    )


@pytest.fixture
def student_instance(db, organization, branch, department, course, semester, student_user):
    return Student.objects.create(
        organization=organization,
        branch=branch,
        department=department,
        course=course,
        semester=semester,
        user=student_user,
        admission_number="ADM-001",
        roll_no="CS-001",
        first_name="John",
        last_name="Doe",
        dob=datetime.date(2005, 5, 15),
        phone="+919999999999",
        email="student@hexastack.test",
    )


@pytest.fixture
def subject_instance(db, organization, department, course, semester, faculty_profile):
    return Subject.objects.create(
        organization=organization,
        department=department,
        course=course,
        semester=semester,
        subject_code="CSE101",
        name="Software Engineering",
        credits=4,
        assigned_faculty=faculty_profile,
    )
