from django.conf import settings
from django.db import models

from apps.core.models import OrganizationScopedModel


class Student(OrganizationScopedModel):
    class CampusStatus(models.TextChoices):
        DAY_SCHOLAR = 'DAY_SCHOLAR', 'Day Scholar'
        HOSTELLER = 'HOSTELLER', 'Hosteller'

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="student_profile",
    )
    branch = models.ForeignKey("organizations.Branch", on_delete=models.PROTECT, related_name="students")
    department = models.ForeignKey("organizations.Department", on_delete=models.PROTECT, related_name="students")
    course = models.ForeignKey("organizations.Course", on_delete=models.PROTECT, related_name="students")
    semester = models.ForeignKey("organizations.Semester", on_delete=models.PROTECT, related_name="students")
    admission_number = models.CharField(max_length=40)
    roll_no = models.CharField(max_length=40)
    first_name = models.CharField(max_length=120)
    last_name = models.CharField(max_length=120, blank=True)
    dob = models.DateField(null=True, blank=True, verbose_name="Date of Birth")
    address = models.TextField(blank=True, null=True)
    phone = models.CharField(max_length=20, verbose_name="Mobile Number")
    email = models.EmailField(verbose_name="Email ID", blank=True, null=True)
    campus_status = models.CharField(
        max_length=20,
        choices=CampusStatus.choices,
        default=CampusStatus.DAY_SCHOLAR,
        verbose_name="Campus Status"
    )
    guardian_name = models.CharField(max_length=140, blank=True)
    guardian_phone = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    joined_on = models.DateField(null=True, blank=True)

    class Meta(OrganizationScopedModel.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "admission_number"],
                condition=models.Q(is_deleted=False),
                name="uniq_active_student_admission_per_org",
            ),
            models.UniqueConstraint(
                fields=["organization", "roll_no", "semester"],
                condition=models.Q(is_deleted=False),
                name="uniq_active_student_roll_per_semester",
            ),
        ]
        indexes = [
            models.Index(fields=['organization', 'branch', 'department']),
            models.Index(fields=['organization', 'semester', 'is_active']),
            models.Index(fields=['email']),
            models.Index(fields=['phone']),
        ]

    @property
    def name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def __str__(self):
        return f"{self.roll_no} - {self.name}"
