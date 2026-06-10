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
            name="StudyMaterial",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("is_deleted", models.BooleanField(db_index=True, default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("title", models.CharField(max_length=200)),
                ("description", models.TextField(blank=True)),
                ("file", models.FileField(blank=True, null=True, upload_to="materials/%Y/%m/")),
                ("external_video_url", models.URLField(blank=True)),
                ("material_kind", models.CharField(choices=[("PDF", "PDF"), ("PPT", "PPT"), ("DOCX", "DOCX"), ("ZIP", "ZIP"), ("IMAGE", "Image"), ("VIDEO_LINK", "Video Link"), ("OTHER", "Other")], default="OTHER", max_length=16)),
                ("status", models.CharField(choices=[("DRAFT", "Draft"), ("PENDING", "Pending Approval"), ("APPROVED", "Approved"), ("REJECTED", "Rejected")], db_index=True, default="DRAFT", max_length=16)),
                ("tags", models.CharField(blank=True, max_length=200)),
                ("approved_at", models.DateTimeField(blank=True, null=True)),
                ("rejection_reason", models.TextField(blank=True)),
                ("approved_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="approved_study_materials", to=settings.AUTH_USER_MODEL)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="materials_studymaterial_created", to=settings.AUTH_USER_MODEL)),
                ("organization", models.ForeignKey(db_index=True, on_delete=django.db.models.deletion.CASCADE, related_name="materials_studymaterial_items", to="organizations.organization")),
                ("semester", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="study_materials", to="organizations.semester")),
                ("subject", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="study_materials", to="subjects.subject")),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="materials_studymaterial_updated", to=settings.AUTH_USER_MODEL)),
                ("uploaded_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="uploaded_study_materials", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ("-created_at",)},
        ),
        migrations.AddIndex(
            model_name="studymaterial",
            index=models.Index(fields=["organization", "status", "created_at"], name="materials_st_organiz_2d0775_idx"),
        ),
        migrations.AddIndex(
            model_name="studymaterial",
            index=models.Index(fields=["organization", "semester", "subject"], name="materials_st_organiz_5a1cc2_idx"),
        ),
    ]
