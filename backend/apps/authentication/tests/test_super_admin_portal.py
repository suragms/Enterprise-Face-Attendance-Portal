import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.organizations.models import Organization

User = get_user_model()


@pytest.mark.django_db
def test_super_admin_dashboard_summary(super_admin_user, organization, department, hod_user):
    client = APIClient()
    client.force_authenticate(super_admin_user)

    response = client.get("/api/v1/auth/super-admin/dashboard-summary/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_departments"] == 1
    assert payload["total_hod"] == 1
    assert "attendance_percentage" in payload
    assert "face_recognition_success_rate" in payload


@pytest.mark.django_db
def test_organization_archive_restore_export(super_admin_user):
    org = Organization.objects.create(name="Archive Org", slug="archive-org")
    client = APIClient()
    client.force_authenticate(super_admin_user)

    archive_response = client.post(f"/api/v1/organizations/{org.id}/archive/")
    assert archive_response.status_code == 200

    list_response = client.get("/api/v1/organizations/?is_archived=true")
    assert list_response.status_code == 200
    payload = list_response.json()
    archived_count = payload.get("count") if isinstance(payload, dict) else len(payload)
    assert archived_count >= 1

    restore_response = client.post(f"/api/v1/organizations/{org.id}/restore/")
    assert restore_response.status_code == 200

    export_response = client.get("/api/v1/organizations/export/")
    assert export_response.status_code == 200
    assert export_response["Content-Type"].startswith("text/csv")


@pytest.mark.django_db
def test_student_management_allowed_for_super_admin(super_admin_user, department, course, semester):
    client = APIClient()
    client.force_authenticate(super_admin_user)
    response = client.post(
        "/api/v1/students/",
        {
            "email": "newstudent@hexastack.test",
            "first_name": "Test",
            "last_name": "Student",
            "roll_no": "CS2026001",
            "department": str(department.id),
            "course": str(course.id),
            "semester": str(semester.id),
        },
        format="json",
    )
    assert response.status_code in {201, 400}
