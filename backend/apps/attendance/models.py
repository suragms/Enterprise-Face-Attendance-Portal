from django.conf import settings
from django.db import models

from apps.core.models import AuditableModel, OrganizationScopedModel
from apps.students.models import Student
from apps.subjects.models import Subject


class AttendanceSession(OrganizationScopedModel):
    class HourChoices(models.TextChoices):
        I = "I", "Period 1"
        II = "II", "Period 2"
        III = "III", "Period 3"
        IV = "IV", "Period 4"
        V = "V", "Period 5"
        VI = "VI", "Period 6"
        VII = "VII", "Period 7"

    class SessionStatus(models.TextChoices):
        OPEN = "OPEN", "Open"
        SUBMITTED = "SUBMITTED", "Submitted"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        LOCKED = "LOCKED", "Locked"

    branch = models.ForeignKey("organizations.Branch", on_delete=models.PROTECT, related_name="attendance_sessions")
    department = models.ForeignKey("organizations.Department", on_delete=models.PROTECT, related_name="attendance_sessions")
    semester = models.ForeignKey("organizations.Semester", on_delete=models.PROTECT, related_name="attendance_sessions")
    timetable = models.ForeignKey("timetable.Timetable", on_delete=models.SET_NULL, null=True, blank=True, related_name="attendance_sessions")
    date = models.DateField()
    hour = models.CharField(max_length=5, choices=HourChoices.choices)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="attendance_sessions")
    session_status = models.CharField(max_length=10, choices=SessionStatus.choices, default=SessionStatus.OPEN)
    total_students = models.PositiveIntegerField(default=0)
    opened_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="opened_attendance_sessions")
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta(OrganizationScopedModel.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "date", "hour", "subject"],
                condition=models.Q(is_deleted=False),
                name="uniq_active_attendance_session",
            )
        ]
        indexes = [
            models.Index(fields=["organization", "date"]),
            models.Index(fields=["organization", "session_status"]),
            models.Index(fields=["organization", "branch", "department"]),
        ]

    def __str__(self):
        return f"{self.date} - {self.hour} - {self.subject.subject_code}"

    @property
    def present_count(self):
        return self.records.filter(status=AttendanceRecord.StatusChoices.PRESENT).count()

    @property
    def absent_count(self):
        return self.records.filter(status=AttendanceRecord.StatusChoices.ABSENT).count()

    @property
    def late_count(self):
        return self.records.filter(status=AttendanceRecord.StatusChoices.LATE).count()

    @property
    def excused_count(self):
        return self.records.filter(status=AttendanceRecord.StatusChoices.EXCUSED).count()

    @property
    def is_locked(self):
        return self.session_status in [
            self.SessionStatus.SUBMITTED,
            self.SessionStatus.APPROVED,
            self.SessionStatus.LOCKED,
        ]

    @property
    def attendance_percentage(self):
        total = self.records.count()
        if total == 0:
            return 0.0
        attended = self.records.filter(status__in=["PRESENT", "LATE", "EXCUSED"]).count()
        return round((attended / total) * 100, 2)


class AttendanceRecord(OrganizationScopedModel):
    class StatusChoices(models.TextChoices):
        PRESENT = "PRESENT", "Present"
        ABSENT = "ABSENT", "Absent"
        LATE = "LATE", "Late"
        EXCUSED = "EXCUSED", "Excused"

    class CaptureMethodChoices(models.TextChoices):
        FACE_RECOGNITION = "FACE_RECOGNITION", "Face Recognition"
        MANUAL = "MANUAL", "Manual"
        SYSTEM = "SYSTEM", "System"
        QR = "QR", "QR"
        IMPORT = "IMPORT", "Import"

    session = models.ForeignKey(AttendanceSession, on_delete=models.CASCADE, related_name="records")
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="attendance_records")
    status = models.CharField(max_length=10, choices=StatusChoices.choices, default=StatusChoices.ABSENT)
    capture_method = models.CharField(max_length=20, choices=CaptureMethodChoices.choices, default=CaptureMethodChoices.MANUAL)
    confidence_score = models.FloatField(blank=True, null=True)
    captured_at = models.DateTimeField(null=True, blank=True)
    correction_notes = models.TextField(blank=True, null=True)
    corrected_at = models.DateTimeField(blank=True, null=True)
    original_status = models.CharField(max_length=10, blank=True, null=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta(OrganizationScopedModel.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["session", "student"],
                condition=models.Q(is_deleted=False),
                name="uniq_active_attendance_record_per_session_student",
            )
        ]
        indexes = [
            models.Index(fields=["organization", "status"]),
            models.Index(fields=["organization", "capture_method"]),
            models.Index(fields=["session", "student", "captured_at"]),
            models.Index(fields=["organization", "student", "captured_at"]),
        ]

    def __str__(self):
        return f"{self.student.roll_no} - {self.session} - {self.status}"


class AttendanceCorrection(AuditableModel):
    record = models.ForeignKey(AttendanceRecord, on_delete=models.CASCADE, related_name="corrections")
    original_status = models.CharField(max_length=10, choices=AttendanceRecord.StatusChoices.choices)
    new_status = models.CharField(max_length=10, choices=AttendanceRecord.StatusChoices.choices)
    correction_note = models.TextField()
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="attendance_corrections")

    class Meta(AuditableModel.Meta):
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.record.student.roll_no}: {self.original_status} -> {self.new_status}"
