from django.conf import settings
from django.db import models

from apps.core.models import AuditableModel, OrganizationScopedModel


class Organization(AuditableModel):
    name = models.CharField(max_length=180)
    slug = models.SlugField(max_length=180, unique=True)
    legal_name = models.CharField(max_length=220, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    address = models.TextField(blank=True)
    timezone = models.CharField(max_length=64, default="Asia/Kolkata")
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta(AuditableModel.Meta):
        indexes = [
            models.Index(fields=["slug", "is_deleted"]),
            models.Index(fields=["is_active", "is_deleted"]),
        ]

    def __str__(self):
        return self.name


class Branch(OrganizationScopedModel):
    name = models.CharField(max_length=180)
    code = models.CharField(max_length=40)
    address = models.TextField(blank=True)
    timezone = models.CharField(max_length=64, default="Asia/Kolkata")
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    geofence_radius = models.FloatField(default=100.0)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta(OrganizationScopedModel.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "code"],
                condition=models.Q(is_deleted=False),
                name="uniq_active_branch_code_per_org",
            )
        ]
        indexes = [models.Index(fields=["organization", "is_active"])]

    def __str__(self):
        return f"{self.organization.name} / {self.name}"


class Department(OrganizationScopedModel):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        INACTIVE = "INACTIVE", "Inactive"

    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name="departments")
    name = models.CharField(max_length=180)
    code = models.CharField(max_length=40)
    description = models.TextField(blank=True)
    hod = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="managed_departments",
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta(OrganizationScopedModel.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "branch", "code"],
                condition=models.Q(is_deleted=False),
                name="uniq_active_department_code_per_branch",
            )
        ]
        indexes = [models.Index(fields=["organization", "branch", "is_active"])]

    def __str__(self):
        return f"{self.branch.code} / {self.name}"

    def save(self, *args, **kwargs):
        self.is_active = self.status == self.Status.ACTIVE
        super().save(*args, **kwargs)


class AcademicYear(OrganizationScopedModel):
    name = models.CharField(max_length=40)
    starts_on = models.DateField()
    ends_on = models.DateField()
    is_current = models.BooleanField(default=False, db_index=True)

    class Meta(OrganizationScopedModel.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "name"],
                condition=models.Q(is_deleted=False),
                name="uniq_active_academic_year_per_org",
            )
        ]

    def __str__(self):
        return self.name


class Course(OrganizationScopedModel):
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="courses")
    name = models.CharField(max_length=180)
    code = models.CharField(max_length=40)
    duration_semesters = models.PositiveSmallIntegerField(default=8)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta(OrganizationScopedModel.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "code"],
                condition=models.Q(is_deleted=False),
                name="uniq_active_course_code_per_org",
            )
        ]

    def __str__(self):
        return self.name


class Semester(OrganizationScopedModel):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="semesters")
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.PROTECT, related_name="semesters")
    number = models.PositiveSmallIntegerField()
    starts_on = models.DateField()
    ends_on = models.DateField()
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta(OrganizationScopedModel.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "course", "academic_year", "number"],
                condition=models.Q(is_deleted=False),
                name="uniq_active_semester_per_course_year",
            )
        ]

    def __str__(self):
        return f"{self.course.code} S{self.number}"


class OrganizationMembership(AuditableModel):
    class Role(models.TextChoices):
        SUPER_ADMIN = "SUPER_ADMIN", "Super Admin"
        HOD = "HOD", "Head of Department"
        FACULTY = "FACULTY", "Faculty"
        STUDENT = "STUDENT", "Student"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="memberships")
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name="memberships")
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name="memberships")
    role = models.CharField(max_length=32, choices=Role.choices)
    role_definition = models.ForeignKey(
        "authentication.Role",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="memberships",
    )
    is_active = models.BooleanField(default=True, db_index=True)
    LEGACY_ROLE_MAP = {
        "PLATFORM_SUPER_ADMIN": Role.SUPER_ADMIN,
        "ORGANIZATION_ADMIN": Role.HOD,
        "BRANCH_ADMIN": Role.HOD,
    }

    class Meta(AuditableModel.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["user", "organization", "role"],
                condition=models.Q(is_deleted=False),
                name="uniq_active_user_role_per_org",
            )
        ]
        indexes = [
            models.Index(fields=["organization", "role", "is_active"]),
            models.Index(fields=["user", "organization", "is_active"]),
        ]

    def __str__(self):
        return f"{self.user_id} / {self.organization_id} / {self.role}"

    def save(self, *args, **kwargs):
        self.role = self.LEGACY_ROLE_MAP.get(self.role, self.role)
        super().save(*args, **kwargs)


class SystemSettings(AuditableModel):
    key = models.CharField(max_length=120, unique=True)
    value = models.JSONField(default=dict)
    description = models.TextField(blank=True)
    is_public = models.BooleanField(default=False)

    def __str__(self):
        return self.key


class AuditLog(AuditableModel):
    organization = models.ForeignKey(Organization, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_events")
    action = models.CharField(max_length=120, db_index=True)
    entity_type = models.CharField(max_length=120, blank=True)
    entity_id = models.UUIDField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta(AuditableModel.Meta):
        indexes = [
            models.Index(fields=["organization", "action", "created_at"]),
            models.Index(fields=["entity_type", "entity_id"]),
        ]

    def __str__(self):
        return f"{self.action} @ {self.created_at:%Y-%m-%d %H:%M}"
