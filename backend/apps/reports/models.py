from django.conf import settings
from django.db import models

from apps.core.models import OrganizationScopedModel


class ReportHistory(OrganizationScopedModel):
    class ReportType(models.TextChoices):
        ATTENDANCE_SUMMARY = "ATTENDANCE_SUMMARY", "Attendance Summary"
        ATTENDANCE_DETAIL = "ATTENDANCE_DETAIL", "Attendance Detail"
        ATTENDANCE_DEFICIT = "ATTENDANCE_DEFICIT", "Attendance Deficit"
        FACULTY_WORKLOAD = "FACULTY_WORKLOAD", "Faculty Workload"
        STUDENT_PERFORMANCE = "STUDENT_PERFORMANCE", "Student Performance"
        DEPARTMENT_ANALYTICS = "DEPARTMENT_ANALYTICS", "Department Analytics"
        EXAM_TIMETABLE = "EXAM_TIMETABLE", "Exam Timetable"
        TIMETABLE = "TIMETABLE", "Timetable"
        CUSTOM = "CUSTOM", "Custom"

    class FileFormat(models.TextChoices):
        PDF = "PDF", "PDF"
        EXCEL = "EXCEL", "Excel"
        CSV = "CSV", "CSV"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PROCESSING = "PROCESSING", "Processing"
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"
        EXPIRED = "EXPIRED", "Expired"

    report_type = models.CharField(max_length=40, choices=ReportType.choices, db_index=True)
    title = models.CharField(max_length=220)
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_reports",
    )
    branch = models.ForeignKey(
        "organizations.Branch",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="report_history",
    )
    department = models.ForeignKey(
        "organizations.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="report_history",
    )
    semester = models.ForeignKey(
        "organizations.Semester",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="report_history",
    )
    parameters = models.JSONField(default=dict, blank=True)
    file_format = models.CharField(max_length=10, choices=FileFormat.choices, default=FileFormat.PDF)
    storage_path = models.CharField(max_length=500, blank=True)
    file_size_bytes = models.BigIntegerField(null=True, blank=True)
    row_count = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING, db_index=True)
    error_message = models.TextField(blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta(OrganizationScopedModel.Meta):
        verbose_name_plural = "Report history"
        indexes = [
            models.Index(fields=["organization", "report_type", "created_at"]),
            models.Index(fields=["organization", "generated_by", "created_at"]),
            models.Index(fields=["organization", "status", "created_at"]),
            models.Index(fields=["organization", "branch", "department", "report_type"]),
        ]

    def __str__(self):
        return f"{self.report_type} / {self.title} / {self.status}"
