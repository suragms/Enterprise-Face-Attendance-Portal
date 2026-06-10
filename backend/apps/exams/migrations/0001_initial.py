from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("organizations", "0002_department_management_fields"),
        ("subjects", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ExamSchedule",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("is_deleted", models.BooleanField(db_index=True, default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("title", models.CharField(max_length=200)),
                ("exam_date", models.DateField(db_index=True)),
                ("starts_at", models.TimeField()),
                ("ends_at", models.TimeField()),
                ("room", models.CharField(max_length=64)),
                ("notes", models.TextField(blank=True)),
                ("status", models.CharField(choices=[("DRAFT", "Draft"), ("PUBLISHED", "Published")], db_index=True, default="DRAFT", max_length=12)),
                ("course", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="exam_schedules", to="organizations.course")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="exams_examschedule_created", to=settings.AUTH_USER_MODEL)),
                ("department", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="exam_schedules", to="organizations.department")),
                ("organization", models.ForeignKey(db_index=True, on_delete=django.db.models.deletion.CASCADE, related_name="exams_examschedule_items", to="organizations.organization")),
                ("scheduled_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="scheduled_exams", to=settings.AUTH_USER_MODEL)),
                ("semester", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="exam_schedules", to="organizations.semester")),
                ("subject", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="exam_schedules", to="subjects.subject")),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="exams_examschedule_updated", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ("-created_at",)},
        ),
        migrations.AddIndex(
            model_name="examschedule",
            index=models.Index(fields=["organization", "exam_date", "semester"], name="exams_exams_organiz_342355_idx"),
        ),
        migrations.AddIndex(
            model_name="examschedule",
            index=models.Index(fields=["organization", "department", "course"], name="exams_exams_organiz_f2c9f5_idx"),
        ),
        migrations.AddConstraint(
            model_name="examschedule",
            constraint=models.UniqueConstraint(condition=models.Q(("is_deleted", False)), fields=("organization", "subject", "exam_date", "starts_at"), name="uniq_active_exam_slot_per_subject"),
        ),
    ]
