import pytest
from rest_framework.test import APIClient

from django.utils import timezone
from apps.attendance.models import AttendanceRecord, AttendanceSession


@pytest.mark.django_db
def test_analytics_dashboard_endpoint(
    admin_user, organization, branch, department, semester, subject_instance, student_instance
):
    session = AttendanceSession.objects.create(
        organization=organization,
        branch=branch,
        department=department,
        semester=semester,
        date=timezone.localdate(),
        hour="II",
        subject=subject_instance,
    )
    AttendanceRecord.objects.create(
        organization=organization,
        session=session,
        student=student_instance,
        status="PRESENT",
        capture_method="FACE_RECOGNITION",
    )

    client = APIClient()
    client.force_authenticate(admin_user)
    response = client.get("/api/v1/reports/analytics/dashboard/?threshold=75")

    assert response.status_code == 200
    payload = response.json()
    assert "weekly_attendance" in payload
    assert "monthly_attendance" in payload
    assert "department_comparison" in payload
    assert "subject_performance" in payload
    assert "risk_students" in payload
    assert "face_recognition" in payload
    assert payload["summary"]["overall_attendance"] == 100
    assert len(payload["weekly_attendance"]) >= 1
