import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from apps.organizations.models import Organization, Branch

User = get_user_model()

@pytest.mark.django_db
def test_super_admin_defaults_to_first_organization(organization):
    # Create a super admin user with no active organization
    super_admin = User.objects.create_user(
        username="test_super_admin",
        email="test_super@hexastack.test",
        password="securepassword123",
        role="SUPER_ADMIN",
        active_organization=None
    )
    
    client = APIClient()
    client.force_authenticate(super_admin)
    
    # Hit /api/auth/me/
    response = client.get("/api/auth/me/")
    assert response.status_code == 200
    
    # Verify that the active_organization was automatically set to the first organization
    super_admin.refresh_from_db()
    assert super_admin.active_organization == organization
    assert str(response.data["active_organization"]) == str(organization.id)


@pytest.mark.django_db
def test_create_branch_raises_validation_error_when_no_active_organization():
    # Create a super admin and ensure no organizations exist in DB
    Organization.objects.all().delete()
    super_admin = User.objects.create_user(
        username="test_super_admin_no_org",
        email="test_super_no_org@hexastack.test",
        password="securepassword123",
        role="SUPER_ADMIN",
        active_organization=None
    )
    
    client = APIClient()
    client.force_authenticate(super_admin)
    
    # Try creating a branch
    response = client.post(
        "/api/branches/",
        {"name": "New Branch", "code": "NEWB"},
        format="json"
    )
    
    # Should raise 400 Bad Request validation error because active organization is not set
    assert response.status_code == 400
    assert "organization" in response.data or "non_field_errors" in response.data or "detail" in response.data


@pytest.mark.django_db
def test_create_branch_duplicate_code_raises_validation_error(organization, branch):
    # Create a super admin whose active organization is set
    super_admin = User.objects.create_user(
        username="test_super_admin_dup",
        email="test_super_dup@hexastack.test",
        password="securepassword123",
        role="SUPER_ADMIN",
        active_organization=organization
    )
    
    client = APIClient()
    client.force_authenticate(super_admin)
    
    # Try to create a branch with the same code 'MAIN' in the same organization
    response = client.post(
        "/api/branches/",
        {"name": "Another Main Campus", "code": "MAIN"},
        format="json"
    )
    
    # Should raise 400 Bad Request due to duplicate branch code
    assert response.status_code == 400
    assert "code" in response.data
    assert "already exists in this organization" in str(response.data["code"])


@pytest.mark.django_db
def test_switch_organization_reissues_cookies(organization):
    # Create another organization
    other_org = Organization.objects.create(
        name="Other Test Org",
        slug="otherorg",
        is_active=True
    )
    
    super_admin = User.objects.create_user(
        username="test_super_admin_switch",
        email="test_super_switch@hexastack.test",
        password="securepassword123",
        role="SUPER_ADMIN",
        active_organization=organization
    )
    
    client = APIClient()
    client.force_authenticate(super_admin)
    
    # Call switch-organization API to switch to other_org
    response = client.post(
        "/api/auth/switch-organization/",
        {"organization_id": str(other_org.id)},
        format="json"
    )
    
    assert response.status_code == 200
    
    # Check that cookies are re-issued in the response headers (set-cookie)
    from django.conf import settings
    access_cookie_name = settings.JWT_ACCESS_COOKIE_NAME
    refresh_cookie_name = settings.JWT_REFRESH_COOKIE_NAME
    
    assert access_cookie_name in response.cookies
    assert refresh_cookie_name in response.cookies
    
    # Verify that the active organization is indeed changed in the database
    super_admin.refresh_from_db()
    assert super_admin.active_organization == other_org


@pytest.mark.django_db
def test_case_insensitive_department_matching(organization, branch, department, course, semester, super_admin_user):
    # Test that serializers and services resolve the department correctly
    # even with leading/trailing spaces and different casing.
    from rest_framework.request import Request
    from rest_framework.test import APIRequestFactory
    from apps.students.serializers import StudentSerializer
    from apps.staff.serializers import FacultySerializer
    from apps.subjects.serializers import SubjectSerializer
    from apps.staff.services.faculty_service import FacultyService

    # 1. StudentSerializer
    from rest_framework.test import force_authenticate
    factory = APIRequestFactory()
    django_request = factory.post("/api/students/")
    force_authenticate(django_request, user=super_admin_user)
    req = Request(django_request)

    data = {
        "roll_no": "STU123",
        "name": "Jane Doe",
        "department": "  computer science  ",
        "year": 1,
        "semester": 1,
        "dob": "2005-05-15",
        "phone": "+919999999999",
        "login_email": "jane@hexastack.test",
        "login_password": "somepassword123",
    }
    serializer = StudentSerializer(data=data, context={"request": req})
    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data["department"] == department

    # 2. FacultySerializer
    faculty_data = {
        "staff_code": "FAC123",
        "name": "Prof Jane",
        "department": "  cse  ",
        "designation": "Assistant Professor",
        "email": "jane_prof@hexastack.test",
        "login_username": "janeprof",
        "password": "securepassword123",
    }
    fac_serializer = FacultySerializer(data=faculty_data, context={"request": req})
    assert fac_serializer.is_valid(), fac_serializer.errors
    assert fac_serializer.validated_data["department"] == department

    # 3. SubjectSerializer
    subj_data = {
        "subject_code": "CSE102",
        "name": "Data Structures",
        "credits": 4,
        "semester": 1,
        "department": "  Computer Science  ",
        "course": "  btcs  ",
    }
    subj_serializer = SubjectSerializer(data=subj_data, context={"request": req})
    assert subj_serializer.is_valid(), subj_serializer.errors
    assert subj_serializer.validated_data["department"] == department
    assert subj_serializer.validated_data["course"] == course

    # 4. FacultyService
    svc = FacultyService()
    svc_payload = {
        "staff_code": "FAC124",
        "username": "janeprof2",
        "password": "securepassword123",
        "email": "jane_prof2@hexastack.test",
        "department": "  cOmPuTeR sCiEnCe  ",
    }
    faculty = svc.create_faculty(super_admin_user, svc_payload)
    assert faculty.department == department

