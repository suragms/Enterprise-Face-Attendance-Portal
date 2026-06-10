from django.conf import settings
from django.db import models
from apps.core.models import OrganizationScopedModel


class Faculty(OrganizationScopedModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='faculty_profile',
        help_text="The login user credentials linked to this staff profile."
    )
    branch = models.ForeignKey("organizations.Branch", on_delete=models.PROTECT, related_name="faculty")
    department = models.ForeignKey("organizations.Department", on_delete=models.PROTECT, related_name="faculty")
    staff_code = models.CharField(
        max_length=40,
        verbose_name="Faculty code",
        help_text="Unique staff code identification."
    )
    first_name = models.CharField(max_length=120)
    last_name = models.CharField(max_length=120, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    designation = models.CharField(max_length=100)
    salary = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    max_load_credits = models.PositiveIntegerField(
        default=12,
        help_text="Maximum workload guideline credits."
    )
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta(OrganizationScopedModel.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "staff_code"],
                condition=models.Q(is_deleted=False),
                name="uniq_active_faculty_code_per_org",
            )
        ]
        indexes = [
            models.Index(fields=["organization", "branch", "department"]),
            models.Index(fields=["organization", "is_active"]),
        ]

    @property
    def name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.user.get_full_name()

    def __str__(self):
        return f"{self.staff_code} - {self.name or self.user.username}"


class StaffProfile(Faculty):
    class Meta:
        proxy = True


class HOD(OrganizationScopedModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="hod_profile",
    )
    branch = models.ForeignKey("organizations.Branch", on_delete=models.PROTECT, related_name="hods")
    department = models.OneToOneField(
        "organizations.Department",
        on_delete=models.PROTECT,
        related_name="hod_profile",
    )
    employee_code = models.CharField(max_length=40, blank=True)
    first_name = models.CharField(max_length=120)
    last_name = models.CharField(max_length=120, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta(OrganizationScopedModel.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "department"],
                condition=models.Q(is_deleted=False),
                name="uniq_active_hod_per_department",
            ),
            models.UniqueConstraint(
                fields=["organization", "employee_code"],
                condition=models.Q(is_deleted=False) & ~models.Q(employee_code=""),
                name="uniq_active_hod_code_per_org",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "branch", "department"]),
            models.Index(fields=["organization", "is_active"]),
        ]

    @property
    def name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.user.get_full_name()

    def __str__(self):
        return f"{self.employee_code or self.user.username} - {self.name}"
