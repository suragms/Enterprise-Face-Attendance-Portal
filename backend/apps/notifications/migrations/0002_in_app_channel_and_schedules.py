# Generated manually for notification management enhancements

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name="notification",
            name="channel",
            field=models.CharField(
                choices=[
                    ("EMAIL", "Email"),
                    ("SMS", "SMS"),
                    ("WHATSAPP", "WhatsApp"),
                    ("IN_APP", "In-App"),
                ],
                max_length=15,
            ),
        ),
        migrations.AlterField(
            model_name="notificationtemplate",
            name="channel",
            field=models.CharField(
                choices=[
                    ("EMAIL", "Email"),
                    ("SMS", "SMS"),
                    ("WHATSAPP", "WhatsApp"),
                    ("IN_APP", "In-App"),
                ],
                max_length=15,
            ),
        ),
        migrations.CreateModel(
            name="NotificationSchedule",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("is_deleted", models.BooleanField(db_index=True, default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("title", models.CharField(max_length=220)),
                ("trigger_type", models.CharField(
                    choices=[
                        ("LOW_ATTENDANCE", "Low Attendance"),
                        ("ABSENT_ALERT", "Absent Alert"),
                        ("ATTENDANCE_SUMMARY", "Attendance Summary"),
                        ("ADMIN_ALERT", "Admin Alert"),
                    ],
                    max_length=30,
                )),
                ("channels", models.JSONField(default=list)),
                ("recipient_scope", models.CharField(
                    choices=[
                        ("CUSTOM", "Custom Recipient"),
                        ("ALL_STUDENTS", "All Students"),
                        ("LOW_ATTENDANCE", "Low Attendance Students"),
                        ("ADMIN", "Admin Email"),
                    ],
                    default="CUSTOM",
                    max_length=20,
                )),
                ("recipient", models.CharField(blank=True, max_length=255)),
                ("scheduled_at", models.DateTimeField()),
                ("repeat_interval", models.CharField(
                    choices=[
                        ("ONCE", "Once"),
                        ("DAILY", "Daily"),
                        ("WEEKLY", "Weekly"),
                    ],
                    default="ONCE",
                    max_length=10,
                )),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("last_run_at", models.DateTimeField(blank=True, null=True)),
                ("next_run_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("parameters", models.JSONField(blank=True, default=dict)),
                ("last_error", models.TextField(blank=True)),
                ("created_by", models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="%(class)s_created",
                    to=settings.AUTH_USER_MODEL,
                )),
                ("organization", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="%(class)s_set",
                    to="organizations.organization",
                )),
                ("updated_by", models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="%(class)s_updated",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                "indexes": [
                    models.Index(fields=["organization", "is_active", "next_run_at"], name="notif_sched_org_active_next_idx"),
                ],
            },
        ),
    ]
