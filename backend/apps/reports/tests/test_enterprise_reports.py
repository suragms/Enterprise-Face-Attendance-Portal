import pytest
from rest_framework.test import APIClient

from apps.attendance.models import AttendanceRecord, AttendanceSession


@pytest.mark.django_db
def test_report_meta(admin_user, organization, department, course, semester, subject_instance, faculty_profile):
    client = APIClient()
    client.force_authenticate(admin_user)
    response = client.get("/api/v1/reports/meta/")
    assert response.status_code == 200
    payload = response.json()
    assert "daily" in payload["report_types"]
    assert "excel" in payload["export_formats"]
    assert len(payload["departments"]) >= 1
    assert len(payload["subjects"]) >= 1


@pytest.mark.django_db
def test_report_generate_async(admin_user, organization, branch, department, semester, subject_instance, student_instance):
    session = AttendanceSession.objects.create(
        organization=organization,
        branch=branch,
        department=department,
        semester=semester,
        date="2026-06-01",
        hour="II",
        subject=subject_instance,
    )
    AttendanceRecord.objects.create(
        organization=organization,
        session=session,
        student=student_instance,
        status="PRESENT",
        capture_method="MANUAL",
    )
    client = APIClient()
    client.force_authenticate(admin_user)
    response = client.post(
        "/api/v1/reports/generate/",
        {
            "report_type": "weekly",
            "format": "csv",
            "async_export": True,
            "filters": {"start_date": "2026-06-01", "end_date": "2026-06-07"},
        },
        format="json",
    )
    assert response.status_code == 202
    assert response.json()["task_id"]
    assert response.json()["history_id"]


@pytest.mark.django_db
def test_report_history_list(admin_user, organization):
    client = APIClient()
    client.force_authenticate(admin_user)
    response = client.get("/api/v1/reports/history/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.django_db
def test_reports_with_course_filter(admin_user, organization, branch, department, course, semester, subject_instance, student_instance):
    session = AttendanceSession.objects.create(
        organization=organization,
        branch=branch,
        department=department,
        semester=semester,
        date="2026-06-02",
        hour="I",
        subject=subject_instance,
    )
    AttendanceRecord.objects.create(
        organization=organization,
        session=session,
        student=student_instance,
        status="PRESENT",
        capture_method="MANUAL",
    )
    client = APIClient()
    client.force_authenticate(admin_user)
    response = client.get(f"/api/v1/reports/daily/?date=2026-06-02&course_id={course.id}")
    assert response.status_code == 200
    assert response.json()["summary"]["percentage"] == 100
