from django.conf import settings
from django.db import models

from apps.core.models import OrganizationScopedModel


class TriggerType(models.TextChoices):
    LOW_ATTENDANCE = "LOW_ATTENDANCE", "Low Attendance"
    ABSENT_ALERT = "ABSENT_ALERT", "Absent Alert"
    ATTENDANCE_SUMMARY = "ATTENDANCE_SUMMARY", "Attendance Summary"
    ADMIN_ALERT = "ADMIN_ALERT", "Admin Alert"


class ChannelType(models.TextChoices):
    EMAIL = "EMAIL", "Email"
    SMS = "SMS", "SMS"
    WHATSAPP = "WHATSAPP", "WhatsApp"
    IN_APP = "IN_APP", "In-App"


class NotificationTemplate(OrganizationScopedModel):
    trigger_type = models.CharField(max_length=30, choices=TriggerType.choices)
    channel = models.CharField(max_length=15, choices=ChannelType.choices)
    subject = models.CharField(max_length=200, blank=True)
    body_template = models.TextField()
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta(OrganizationScopedModel.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "trigger_type", "channel"],
                condition=models.Q(is_deleted=False),
                name="uniq_active_template_per_org_trigger_channel",
            )
        ]

    def __str__(self):
        return f"{self.trigger_type} - {self.channel}"


class Notification(OrganizationScopedModel):
    class StatusChoices(models.TextChoices):
        PENDING = "PENDING", "Pending"
        SENT = "SENT", "Sent"
        FAILED = "FAILED", "Failed"
        READ = "READ", "Read"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="notifications")
    recipient = models.CharField(max_length=160)
    trigger_type = models.CharField(max_length=30, choices=TriggerType.choices)
    channel = models.CharField(max_length=15, choices=ChannelType.choices)
    status = models.CharField(max_length=10, choices=StatusChoices.choices, default=StatusChoices.PENDING, db_index=True)
    subject = models.CharField(max_length=200, blank=True)
    message_body = models.TextField()
    provider_message_id = models.CharField(max_length=160, blank=True)
    error_message = models.TextField(blank=True)
    retry_count = models.PositiveIntegerField(default=0)
    last_attempt_at = models.DateTimeField(blank=True, null=True)
    sent_at = models.DateTimeField(blank=True, null=True)
    read_at = models.DateTimeField(blank=True, null=True)

    class Meta(OrganizationScopedModel.Meta):
        indexes = [
            models.Index(fields=["organization", "status", "created_at"]),
            models.Index(fields=["organization", "channel", "trigger_type"]),
        ]

    def __str__(self):
        return f"{self.recipient} - {self.channel} - {self.status}"


class NotificationLog(Notification):
    class Meta:
        proxy = True


class NotificationSchedule(OrganizationScopedModel):
    class RepeatInterval(models.TextChoices):
        ONCE = "ONCE", "Once"
        DAILY = "DAILY", "Daily"
        WEEKLY = "WEEKLY", "Weekly"

    class RecipientScope(models.TextChoices):
        CUSTOM = "CUSTOM", "Custom Recipient"
        ALL_STUDENTS = "ALL_STUDENTS", "All Students"
        LOW_ATTENDANCE = "LOW_ATTENDANCE", "Low Attendance Students"
        ADMIN = "ADMIN", "Admin Email"

    title = models.CharField(max_length=220)
    trigger_type = models.CharField(max_length=30, choices=TriggerType.choices)
    channels = models.JSONField(default=list)
    recipient_scope = models.CharField(
        max_length=20,
        choices=RecipientScope.choices,
        default=RecipientScope.CUSTOM,
    )
    recipient = models.CharField(max_length=255, blank=True)
    scheduled_at = models.DateTimeField()
    repeat_interval = models.CharField(
        max_length=10,
        choices=RepeatInterval.choices,
        default=RepeatInterval.ONCE,
    )
    is_active = models.BooleanField(default=True, db_index=True)
    last_run_at = models.DateTimeField(null=True, blank=True)
    next_run_at = models.DateTimeField(null=True, blank=True, db_index=True)
    parameters = models.JSONField(default=dict, blank=True)
    last_error = models.TextField(blank=True)

    class Meta(OrganizationScopedModel.Meta):
        indexes = [
            models.Index(fields=["organization", "is_active", "next_run_at"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.trigger_type})"
