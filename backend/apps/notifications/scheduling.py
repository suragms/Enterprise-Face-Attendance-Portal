"""Scheduled notification processing."""

from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from apps.notifications.models import NotificationSchedule, TriggerType
from apps.notifications.services import (
    dispatch_notification,
    enqueue_notification,
    resolve_schedule_recipients,
)


def compute_next_run(schedule: NotificationSchedule, from_time=None):
    base = from_time or timezone.now()
    if schedule.repeat_interval == NotificationSchedule.RepeatInterval.ONCE:
        return None
    if schedule.repeat_interval == NotificationSchedule.RepeatInterval.DAILY:
        return base + timedelta(days=1)
    if schedule.repeat_interval == NotificationSchedule.RepeatInterval.WEEKLY:
        return base + timedelta(weeks=1)
    return None


def run_schedule(schedule: NotificationSchedule):
    organization = schedule.organization
    context_base = {
        "organization": organization,
        **(schedule.parameters or {}),
    }
    recipients = resolve_schedule_recipients(schedule)
    logs = []
    for recipient_meta in recipients:
        context = {**context_base, **recipient_meta.get("context", {})}
        user = recipient_meta.get("user")
        if user:
            context["user"] = user
        for channel in schedule.channels or []:
            try:
                if channel == "IN_APP" and user:
                    log = enqueue_notification(
                        schedule.trigger_type,
                        channel,
                        str(user.id),
                        context,
                        user=user,
                    )
                else:
                    address = recipient_meta.get("address")
                    if not address:
                        continue
                    log = enqueue_notification(
                        schedule.trigger_type,
                        channel,
                        address,
                        context,
                        user=user,
                    )
                logs.append(log)
            except Exception as exc:
                schedule.last_error = str(exc)
    now = timezone.now()
    schedule.last_run_at = now
    schedule.next_run_at = compute_next_run(schedule, now)
    if schedule.repeat_interval == NotificationSchedule.RepeatInterval.ONCE:
        schedule.is_active = False
    schedule.save(update_fields=["last_run_at", "next_run_at", "is_active", "last_error", "updated_at"])
    return logs


def process_due_schedules():
    now = timezone.now()
    due = NotificationSchedule.objects.filter(
        is_active=True,
        is_deleted=False,
        next_run_at__lte=now,
    )
    processed = 0
    for schedule in due:
        run_schedule(schedule)
        processed += 1
    return processed


def run_low_attendance_batch(organization, threshold=75.0):
    from apps.reports.repositories import ReportRepository
    from apps.students.models import Student

    repo = ReportRepository()
    defaulters = repo.get_defaulters(threshold, organization)
    count = 0
    for row in defaulters:
        student = Student.objects.filter(id=row["student_id"]).select_related("user").first()
        if not student:
            continue
        context = {
            "organization": organization,
            "student_name": row["name"],
            "roll_no": row["roll_no"],
            "attendance_percentage": row["attendance_percentage"],
            "user": student.user,
        }
        if student.email:
            dispatch_notification("LOW_ATTENDANCE", "EMAIL", student.email, context)
            count += 1
        if student.user_id:
            enqueue_notification("LOW_ATTENDANCE", "IN_APP", str(student.user_id), context, user=student.user)
            count += 1
    return count


def run_admin_digest(organization):
    recipient = getattr(settings, "ADMIN_NOTIFICATION_EMAIL", "")
    if not recipient:
        return 0
    dispatch_notification(
        "ADMIN_ALERT",
        "EMAIL",
        recipient,
        {
            "organization": organization,
            "alert_title": "Scheduled Admin Digest",
            "alert_message": "Attendance monitoring summary is ready for review.",
        },
    )
    return 1
