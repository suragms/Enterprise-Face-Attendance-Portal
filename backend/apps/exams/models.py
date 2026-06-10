from django.conf import settings
from django.db import models

from apps.core.models import OrganizationScopedModel


class ExamSchedule(OrganizationScopedModel):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PUBLISHED = "PUBLISHED", "Published"

    title = models.CharField(max_length=200)
    subject = models.ForeignKey("subjects.Subject", on_delete=models.CASCADE, related_name="exam_schedules")
    department = models.ForeignKey("organizations.Department", on_delete=models.CASCADE, related_name="exam_schedules")
    course = models.ForeignKey("organizations.Course", on_delete=models.CASCADE, related_name="exam_schedules")
    semester = models.ForeignKey("organizations.Semester", on_delete=models.CASCADE, related_name="exam_schedules")
    exam_date = models.DateField(db_index=True)
    starts_at = models.TimeField()
    ends_at = models.TimeField()
    room = models.CharField(max_length=64)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT, db_index=True)
    scheduled_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="scheduled_exams")

    class Meta(OrganizationScopedModel.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "subject", "exam_date", "starts_at"],
                condition=models.Q(is_deleted=False),
                name="uniq_active_exam_slot_per_subject",
            )
        ]
        indexes = [
            models.Index(fields=["organization", "exam_date", "semester"]),
            models.Index(fields=["organization", "department", "course"]),
        ]

    def __str__(self):
        return f"{self.subject.subject_code} {self.exam_date} {self.starts_at}"
