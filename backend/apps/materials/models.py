from django.conf import settings
from django.db import models

from apps.core.models import OrganizationScopedModel


class StudyMaterial(OrganizationScopedModel):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PENDING = "PENDING", "Pending Approval"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    class Kind(models.TextChoices):
        PDF = "PDF", "PDF"
        PPT = "PPT", "PPT"
        DOCX = "DOCX", "DOCX"
        ZIP = "ZIP", "ZIP"
        IMAGE = "IMAGE", "Image"
        VIDEO_LINK = "VIDEO_LINK", "Video Link"
        OTHER = "OTHER", "Other"

    class MaterialType(models.TextChoices):
        NOTES = "NOTES", "Notes"
        ASSIGNMENTS = "ASSIGNMENTS", "Assignments"
        SLIDES = "SLIDES", "Slides"
        VIDEOS = "VIDEOS", "Videos"

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    subject = models.ForeignKey("subjects.Subject", on_delete=models.CASCADE, related_name="study_materials")
    semester = models.ForeignKey("organizations.Semester", on_delete=models.CASCADE, related_name="study_materials")
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="uploaded_study_materials")
    file = models.FileField(upload_to="materials/%Y/%m/", blank=True, null=True)
    external_video_url = models.URLField(blank=True)
    material_kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.OTHER)
    material_type = models.CharField(
        max_length=16,
        choices=MaterialType.choices,
        default=MaterialType.NOTES,
        db_index=True,
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT, db_index=True)
    tags = models.CharField(max_length=200, blank=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="approved_study_materials")
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    class Meta(OrganizationScopedModel.Meta):
        indexes = [
            models.Index(fields=["organization", "status", "created_at"]),
            models.Index(fields=["organization", "semester", "subject"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.status})"
