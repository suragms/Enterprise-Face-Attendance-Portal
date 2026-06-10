import pytest
from rest_framework.test import APIClient

from apps.notifications.models import Notification, NotificationSchedule, NotificationTemplate


@pytest.mark.django_db
def test_notification_meta(admin_user):
    client = APIClient()
    client.force_authenticate(admin_user)
    response = client.get("/api/v1/notifications/meta/")
    assert response.status_code == 200
    payload = response.json()
    assert any(ch["id"] == "IN_APP" for ch in payload["channels"])
    assert "stats" in payload


@pytest.mark.django_db
def test_in_app_trigger(admin_user, student_user, organization):
    NotificationTemplate.objects.create(
        organization=organization,
        trigger_type="LOW_ATTENDANCE",
        channel="IN_APP",
        subject="Attendance alert for {student_name}",
        body_template="Your attendance is {attendance_percentage}%.",
    )
    client = APIClient()
    client.force_authenticate(admin_user)
    response = client.post(
        "/api/v1/notifications/trigger/",
        {
            "trigger_type": "LOW_ATTENDANCE",
            "channel": "IN_APP",
            "recipient": str(student_user.id),
            "user_id": str(student_user.id),
            "context": {"student_name": "John", "attendance_percentage": 70},
        },
        format="json",
    )
    assert response.status_code == 202
    log = Notification.objects.get(id=response.json()["id"])
    assert log.channel == "IN_APP"
    assert log.user_id == student_user.id


@pytest.mark.django_db
def test_schedule_create_and_run(admin_user, organization):
    client = APIClient()
    client.force_authenticate(admin_user)
    create = client.post(
        "/api/v1/notifications/schedules/",
        {
            "title": "Weekly digest",
            "trigger_type": "ADMIN_ALERT",
            "channels": ["EMAIL"],
            "recipient_scope": "ADMIN",
            "recipient": "admin@hexastack.test",
            "scheduled_at": "2026-06-01T09:00:00Z",
            "repeat_interval": "ONCE",
            "is_active": True,
        },
        format="json",
    )
    assert create.status_code == 201
    schedule_id = create.json()["id"]
    run = client.post(f"/api/v1/notifications/schedules/{schedule_id}/run-now/")
    assert run.status_code == 200
    schedule = NotificationSchedule.objects.get(id=schedule_id)
    assert schedule.last_run_at is not None
