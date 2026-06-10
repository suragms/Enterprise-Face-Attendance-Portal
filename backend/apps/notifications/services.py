import logging

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from apps.notifications.models import Notification, NotificationSchedule, NotificationTemplate

logger = logging.getLogger(__name__)

MAX_AUTO_RETRIES = 3


def render_template(template_text, context):
    if not template_text:
        return ""
    safe_context = {k: ("" if v is None else v) for k, v in context.items() if k != "organization"}
    try:
        return template_text.format(**safe_context)
    except KeyError as exc:
        raise ValueError(f"Missing template context value: {exc}") from exc


def _resolve_template(organization, trigger_type, channel):
    return NotificationTemplate.objects.filter(
        organization=organization,
        trigger_type=trigger_type,
        channel=channel,
        is_active=True,
        is_deleted=False,
    ).first()


def _render_content(organization, trigger_type, channel, context, subject_override="", body_override=""):
    template = _resolve_template(organization, trigger_type, channel)
    if template:
        raw_body = template.body_template
        subject = template.subject or "HexaAttender Alert"
    else:
        raw_body = body_override or context.get("message_body", "")
        subject = subject_override or context.get("subject", f"HexaAttender {trigger_type}")

    rendered_body = render_template(raw_body, context)
    rendered_subject = render_template(subject, context) if channel == "EMAIL" else render_template(subject, context)
    if channel != "EMAIL":
        rendered_subject = rendered_subject or context.get("alert_title", "Notification")
    return rendered_subject, rendered_body


def send_email(recipient, subject, body):
    sent = send_mail(
        subject=subject or "HexaAttender Notification",
        message=body,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
        recipient_list=[recipient],
        fail_silently=False,
    )
    return sent == 1, None if sent == 1 else "Email backend did not accept the message."


def send_sms(recipient, body):
    provider = getattr(settings, "SMS_PROVIDER", "")
    if not provider:
        return False, "SMS provider is not configured."
    if provider.lower() == "console":
        logger.info("SMS to %s: %s", recipient, body[:120])
        return True, None
    return False, f"Unsupported SMS provider '{provider}'."


def send_whatsapp(recipient, body):
    provider = getattr(settings, "WHATSAPP_PROVIDER", "")
    if not provider:
        return False, "WhatsApp provider is not configured."
    if provider.lower() == "console":
        logger.info("WhatsApp to %s: %s", recipient, body[:120])
        return True, None
    return False, f"Unsupported WhatsApp provider '{provider}'."


def send_in_app(log_entry):
    if not log_entry.user_id:
        return False, "In-app notification requires a linked user account."
    log_entry.provider_message_id = f"inapp-{log_entry.id}"
    return True, None


def _send(log_entry):
    try:
        if log_entry.channel == "EMAIL":
            return send_email(log_entry.recipient, log_entry.subject, log_entry.message_body)
        if log_entry.channel == "SMS":
            return send_sms(log_entry.recipient, log_entry.message_body)
        if log_entry.channel == "WHATSAPP":
            return send_whatsapp(log_entry.recipient, log_entry.message_body)
        if log_entry.channel == "IN_APP":
            return send_in_app(log_entry)
        return False, f"Unsupported notification channel '{log_entry.channel}'."
    except Exception as exc:
        logger.exception("Notification dispatch failed")
        return False, str(exc)


def deliver_notification(log_entry):
    log_entry.last_attempt_at = timezone.now()
    success, error = _send(log_entry)
    log_entry.status = Notification.StatusChoices.SENT if success else Notification.StatusChoices.FAILED
    log_entry.error_message = error or ""
    if success:
        log_entry.sent_at = timezone.now()
    log_entry.save(
        update_fields=["status", "error_message", "sent_at", "last_attempt_at", "provider_message_id", "updated_at"]
    )
    return log_entry


def enqueue_notification(trigger_type, channel, recipient, context, user=None, subject="", message_body=""):
    organization = context.get("organization")
    if organization is None:
        from apps.organizations.models import Organization

        organization = Organization.objects.first()

    rendered_subject, rendered_body = _render_content(
        organization, trigger_type, channel, context, subject, message_body
    )

    log_entry = Notification.objects.create(
        organization=organization,
        user=user or context.get("user"),
        recipient=recipient,
        trigger_type=trigger_type,
        channel=channel,
        status=Notification.StatusChoices.PENDING,
        subject=rendered_subject if channel in ("EMAIL", "IN_APP") else "",
        message_body=rendered_body,
        retry_count=0,
        created_by=context.get("created_by"),
        updated_by=context.get("updated_by"),
    )

    from apps.notifications.tasks import dispatch_notification_task

    dispatch_notification_task.delay(str(log_entry.id))
    return log_entry


def dispatch_notification(trigger_type, channel, recipient, context, subject_prefix=""):
    organization = context.get("organization")
    if organization is None:
        from apps.organizations.models import Organization

        organization = Organization.objects.first()

    rendered_subject, rendered_body = _render_content(organization, trigger_type, channel, context)
    if subject_prefix:
        rendered_subject = f"{subject_prefix} {rendered_subject}"

    log_entry = Notification.objects.create(
        organization=organization,
        user=context.get("user"),
        recipient=recipient,
        trigger_type=trigger_type,
        channel=channel,
        status=Notification.StatusChoices.PENDING,
        subject=rendered_subject if channel in ("EMAIL", "IN_APP") else "",
        message_body=rendered_body,
        retry_count=0,
    )
    return deliver_notification(log_entry)


def retry_notification(log_entry):
    if log_entry.retry_count >= MAX_AUTO_RETRIES:
        log_entry.error_message = f"Maximum retry attempts ({MAX_AUTO_RETRIES}) reached."
        log_entry.status = Notification.StatusChoices.FAILED
        log_entry.save(update_fields=["error_message", "status", "updated_at"])
        return log_entry
    log_entry.retry_count += 1
    log_entry.status = Notification.StatusChoices.PENDING
    log_entry.error_message = ""
    log_entry.save(update_fields=["retry_count", "status", "error_message", "updated_at"])
    return deliver_notification(log_entry)


def resolve_schedule_recipients(schedule: NotificationSchedule):
    organization = schedule.organization
    if schedule.recipient_scope == NotificationSchedule.RecipientScope.CUSTOM:
        return [{"address": schedule.recipient, "context": schedule.parameters or {}}]
    if schedule.recipient_scope == NotificationSchedule.RecipientScope.ADMIN:
        admin_email = getattr(settings, "ADMIN_NOTIFICATION_EMAIL", "") or schedule.recipient
        return [{"address": admin_email, "context": schedule.parameters or {}}]
    if schedule.recipient_scope == NotificationSchedule.RecipientScope.ALL_STUDENTS:
        from apps.students.models import Student

        rows = []
        for student in Student.objects.filter(organization=organization, is_active=True, is_deleted=False):
            rows.append(
                {
                    "address": student.email or student.phone,
                    "user": student.user,
                    "context": {
                        "student_name": student.name,
                        "roll_no": student.roll_no,
                        "attendance_percentage": 0,
                    },
                }
            )
        return rows
    if schedule.recipient_scope == NotificationSchedule.RecipientScope.LOW_ATTENDANCE:
        from apps.reports.repositories import ReportRepository

        threshold = float((schedule.parameters or {}).get("threshold", 75))
        rows = []
        for row in ReportRepository().get_defaulters(threshold, organization):
            from apps.students.models import Student

            student = Student.objects.filter(id=row["student_id"]).select_related("user").first()
            rows.append(
                {
                    "address": (student.email if student else "") or (student.phone if student else ""),
                    "user": student.user if student else None,
                    "context": row,
                }
            )
        return rows
    return []


def trigger_absent_alert(attendance_record_id):
    from apps.attendance.models import AttendanceRecord

    record = AttendanceRecord.objects.select_related(
        "student", "student__user", "session__subject", "organization"
    ).filter(pk=attendance_record_id).first()
    if not record or record.status != "ABSENT":
        return []

    student = record.student
    context = {
        "organization": record.organization,
        "student_name": student.name,
        "roll_no": student.roll_no,
        "hour": record.session.hour,
        "subject_name": record.session.subject.name,
        "date": str(record.session.date),
        "message_body": "{student_name} was absent for {subject_name} on {date}, period {hour}.",
        "user": student.user,
    }
    logs = []
    if student.email:
        logs.append(dispatch_notification("ABSENT_ALERT", "EMAIL", student.email, context))
    if student.phone:
        logs.append(dispatch_notification("ABSENT_ALERT", "SMS", student.phone, context))
    if student.user_id:
        logs.append(
            enqueue_notification("ABSENT_ALERT", "IN_APP", str(student.user_id), context, user=student.user)
        )
    return logs


def trigger_low_attendance_alert(student_id):
    from apps.reports.repositories import ReportRepository
    from apps.students.models import Student

    student = Student.objects.filter(id=student_id).select_related("user").first()
    if student is None:
        student = Student.objects.filter(roll_no=student_id).select_related("user").first()
    if student is None:
        return []
    pct = ReportRepository().get_student_overall_percentage(student.id, student.organization)
    if pct >= 75.0:
        return []
    context = {
        "organization": student.organization,
        "student_name": student.name,
        "roll_no": student.roll_no,
        "attendance_percentage": pct,
        "user": student.user,
        "message_body": "{student_name}'s attendance is {attendance_percentage}%, below the required threshold.",
    }
    logs = []
    if student.email:
        logs.append(dispatch_notification("LOW_ATTENDANCE", "EMAIL", student.email, context))
    if student.phone:
        logs.append(dispatch_notification("LOW_ATTENDANCE", "SMS", student.phone, context))
    if student.user_id:
        logs.append(
            enqueue_notification("LOW_ATTENDANCE", "IN_APP", str(student.user_id), context, user=student.user)
        )
    return logs


def trigger_attendance_summary(session_id):
    from apps.attendance.models import AttendanceSession

    session = AttendanceSession.objects.select_related(
        "organization", "subject__assigned_faculty__user"
    ).filter(pk=session_id).first()
    if session is None:
        return []
    faculty_user = None
    recipient = ""
    if session.subject.assigned_faculty:
        faculty_user = session.subject.assigned_faculty.user
        recipient = getattr(faculty_user, "email", "") or ""
    if not recipient:
        return []
    context = {
        "organization": session.organization,
        "summary_date": str(session.date),
        "subject_name": session.subject.name,
        "attendance_percentage": getattr(session, "attendance_percentage", 0),
        "user": faculty_user,
        "message_body": "Attendance summary for {subject_name} on {summary_date}: {attendance_percentage}%.",
    }
    logs = [dispatch_notification("ATTENDANCE_SUMMARY", "EMAIL", recipient, context)]
    if faculty_user:
        logs.append(
            enqueue_notification(
                "ATTENDANCE_SUMMARY",
                "IN_APP",
                str(faculty_user.id),
                context,
                user=faculty_user,
            )
        )
    return logs


def trigger_admin_notification(alert_title, alert_message, organization=None):
    from apps.organizations.models import Organization

    org = organization or Organization.objects.first()
    recipient = getattr(settings, "ADMIN_NOTIFICATION_EMAIL", "")
    if not recipient:
        logger.warning("ADMIN_NOTIFICATION_EMAIL is not configured.")
        return []
    return [
        dispatch_notification(
            "ADMIN_ALERT",
            "EMAIL",
            recipient,
            {
                "organization": org,
                "alert_title": alert_title,
                "alert_message": alert_message,
                "message_body": "{alert_title}: {alert_message}",
            },
        )
    ]


def get_notification_meta():
    return {
        "triggers": [
            {"id": "ABSENT_ALERT", "label": "Absent Alert", "variables": ["student_name", "roll_no", "subject_name", "date", "hour"]},
            {"id": "LOW_ATTENDANCE", "label": "Low Attendance", "variables": ["student_name", "roll_no", "attendance_percentage"]},
            {"id": "ATTENDANCE_SUMMARY", "label": "Attendance Summary", "variables": ["subject_name", "summary_date", "attendance_percentage"]},
            {"id": "ADMIN_ALERT", "label": "Admin Alert", "variables": ["alert_title", "alert_message"]},
        ],
        "channels": [
            {"id": "EMAIL", "label": "Email"},
            {"id": "SMS", "label": "SMS"},
            {"id": "WHATSAPP", "label": "WhatsApp"},
            {"id": "IN_APP", "label": "In-App"},
        ],
        "statuses": ["PENDING", "SENT", "FAILED", "READ"],
        "recipient_scopes": [
            {"id": "CUSTOM", "label": "Custom Recipient"},
            {"id": "ALL_STUDENTS", "label": "All Students"},
            {"id": "LOW_ATTENDANCE", "label": "Low Attendance Students"},
            {"id": "ADMIN", "label": "Admin Email"},
        ],
        "repeat_intervals": ["ONCE", "DAILY", "WEEKLY"],
        "max_retries": MAX_AUTO_RETRIES,
    }
