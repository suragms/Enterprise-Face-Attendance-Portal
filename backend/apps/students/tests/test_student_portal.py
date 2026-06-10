import pytest
from rest_framework.test import APIClient

from apps.notifications.models import Notification, TriggerType, ChannelType


@pytest.mark.django_db
def test_student_portal_context(student_user, student_instance):
    client = APIClient()
    client.force_authenticate(student_user)

    response = client.get("/api/v1/auth/student/portal-context/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["roll_no"] == student_instance.roll_no
    assert payload["department"]["code"] == student_instance.department.code
    assert payload["capabilities"]["view_dashboard"] is True


@pytest.mark.django_db
def test_student_dashboard_summary(student_user, student_instance):
    client = APIClient()
    client.force_authenticate(student_user)

    response = client.get("/api/v1/auth/student/dashboard-summary/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["roll_no"] == student_instance.roll_no
    assert "overall_attendance" in payload
    assert "attendance_threshold" in payload


@pytest.mark.django_db
def test_student_report_scoped(student_user, student_instance):
    client = APIClient()
    client.force_authenticate(student_user)

    response = client.get("/api/v1/reports/student/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["report_type"] == "student"
    if payload.get("student", {}).get("roll_no"):
        assert payload["student"]["roll_no"] == student_instance.roll_no


@pytest.mark.django_db
def test_student_notifications_inbox(student_user, organization):
    Notification.objects.create(
        organization=organization,
        user=student_user,
        recipient=student_user.email,
        trigger_type=TriggerType.LOW_ATTENDANCE,
        channel=ChannelType.EMAIL,
        subject="Low attendance",
        message_body="Your attendance is below 75%.",
        created_by=student_user,
        updated_by=student_user,
    )

    client = APIClient()
    client.force_authenticate(student_user)
    response = client.get("/api/v1/notifications/logs/")

    assert response.status_code == 200
    rows = response.json() if isinstance(response.json(), list) else response.json().get("results", response.json())
    if isinstance(rows, dict):
        rows = [rows]
    assert len(rows) >= 1
    assert rows[0]["trigger_type"] == "LOW_ATTENDANCE"


@pytest.mark.django_db
def test_faculty_cannot_access_student_portal_context(faculty_user):
    client = APIClient()
    client.force_authenticate(faculty_user)

    response = client.get("/api/v1/auth/student/portal-context/")

    assert response.status_code == 403
