from django.db import models
from apps.core.models import OrganizationScopedModel
from apps.staff.models import Faculty


class Subject(OrganizationScopedModel):
    department = models.ForeignKey("organizations.Department", on_delete=models.PROTECT, related_name="subjects")
    course = models.ForeignKey("organizations.Course", on_delete=models.PROTECT, related_name="subjects")
    semester = models.ForeignKey("organizations.Semester", on_delete=models.PROTECT, related_name="subjects")
    subject_code = models.CharField(max_length=40)
    name = models.CharField(max_length=160)
    credits = models.PositiveIntegerField(default=3, help_text="Subject credit hour allocation.")
    assigned_faculty = models.ForeignKey(
        Faculty,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='subjects',
        help_text="The lecturer assigned to teach this subject."
    )
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta(OrganizationScopedModel.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "subject_code"],
                condition=models.Q(is_deleted=False),
                name="uniq_active_subject_code_per_org",
            )
        ]
        indexes = [models.Index(fields=["organization", "department", "semester"])]

    def __str__(self):
        return f"{self.subject_code} - {self.name}"
