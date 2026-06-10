import uuid

from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone

from apps.core.models import AuditableModel

class User(AbstractUser):
    class Roles(models.TextChoices):
        SUPER_ADMIN = 'SUPER_ADMIN', 'Super Admin'
        HOD = 'HOD', 'Head of Department'
        FACULTY = 'FACULTY', 'Faculty'
        STUDENT = 'STUDENT', 'Student'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.CharField(
        max_length=32,
        choices=Roles.choices,
        default=Roles.FACULTY,
        help_text="Role indicating user privileges in HexaAttender."
    )
    role_definition = models.ForeignKey(
        "authentication.Role",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
    )
    phone = models.CharField(max_length=20, blank=True, null=True)
    active_organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='active_users',
    )
    active_branch = models.ForeignKey(
        'organizations.Branch',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='active_users',
    )
    must_change_password = models.BooleanField(default=False)
    token_version = models.PositiveIntegerField(default=1)
    first_login_at = models.DateTimeField(null=True, blank=True)

    LEGACY_ROLE_MAP = {
        "PLATFORM_SUPER_ADMIN": Roles.SUPER_ADMIN,
        "ORGANIZATION_ADMIN": Roles.HOD,
        "BRANCH_ADMIN": Roles.HOD,
    }

    @property
    def normalized_role(self):
        return self.LEGACY_ROLE_MAP.get(self.role, self.role)

    @property
    def is_super_admin(self):
        return self.normalized_role == self.Roles.SUPER_ADMIN or self.is_superuser

    @property
    def is_hod(self):
        return self.normalized_role == self.Roles.HOD or self.is_super_admin

    @property
    def is_faculty(self):
        return self.normalized_role == self.Roles.FACULTY

    @property
    def is_student(self):
        return self.normalized_role == self.Roles.STUDENT

    @property
    def is_platform_super_admin(self):
        return self.is_super_admin

    @property
    def is_org_admin(self):
        return self.is_hod

    @property
    def is_branch_admin(self):
        return self.is_hod

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"

    @property
    def enrollment_due_at(self):
        if not self.first_login_at:
            return None
        return self.first_login_at + timezone.timedelta(days=5)

    class Meta(AbstractUser.Meta):
        indexes = [
            models.Index(fields=["role", "is_active"]),
            models.Index(fields=["active_organization", "role"]),
            models.Index(fields=["email"]),
        ]


class Role(AuditableModel):
    """Platform role catalog aligned with User.Roles hierarchy."""

    code = models.CharField(max_length=32)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    rank = models.PositiveSmallIntegerField(default=10, db_index=True)
    is_system = models.BooleanField(default=True)

    class Meta(AuditableModel.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["code"],
                condition=models.Q(is_deleted=False),
                name="uniq_active_role_code",
            )
        ]
        indexes = [
            models.Index(fields=["rank", "is_deleted"]),
        ]

    def __str__(self):
        return self.name


class Permission(AuditableModel):
    """Fine-grained authorization codes grouped by module."""

    code = models.CharField(max_length=80)
    name = models.CharField(max_length=160)
    module = models.CharField(max_length=60, db_index=True)
    description = models.TextField(blank=True)

    class Meta(AuditableModel.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["code"],
                condition=models.Q(is_deleted=False),
                name="uniq_active_permission_code",
            )
        ]
        indexes = [
            models.Index(fields=["module", "code"]),
        ]

    def __str__(self):
        return self.code


class RolePermission(AuditableModel):
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="role_permissions")
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name="role_permissions")

    class Meta(AuditableModel.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=["role", "permission"],
                condition=models.Q(is_deleted=False),
                name="uniq_active_role_permission",
            )
        ]
        indexes = [
            models.Index(fields=["role", "permission"]),
        ]

    def __str__(self):
        return f"{self.role.code} -> {self.permission.code}"


class LoginAttempt(AuditableModel):
    class LoginMethod(models.TextChoices):
        PASSWORD = "password", "Password"
        FACE = "face", "Face"
        TOKEN = "token", "Token"

    email = models.EmailField(db_index=True)
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="login_attempts",
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True, db_index=True)
    user_agent = models.TextField(blank=True)
    device_fingerprint = models.CharField(max_length=255, blank=True)
    success = models.BooleanField(default=False, db_index=True)
    failure_reason = models.CharField(max_length=120, blank=True)
    login_method = models.CharField(max_length=20, choices=LoginMethod.choices, default=LoginMethod.PASSWORD)

    class Meta(AuditableModel.Meta):
        indexes = [
            models.Index(fields=["email", "success", "created_at"]),
            models.Index(fields=["ip_address", "created_at"]),
            models.Index(fields=["user", "created_at"]),
        ]

    def __str__(self):
        status = "success" if self.success else "failed"
        return f"{self.email} / {status} / {self.created_at:%Y-%m-%d %H:%M}"


class UserSession(AuditableModel):
    class LoginMethod(models.TextChoices):
        PASSWORD = "password", "Password"
        FACE = "face", "Face"
        TOKEN = "token", "Token"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sessions")
    session_key = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    refresh_jti = models.CharField(max_length=64, blank=True, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    device_fingerprint = models.CharField(max_length=255, blank=True)
    login_method = models.CharField(max_length=20, choices=LoginMethod.choices, default=LoginMethod.PASSWORD)
    is_active = models.BooleanField(default=True, db_index=True)
    last_seen_at = models.DateTimeField(auto_now=True)
    logged_out_at = models.DateTimeField(null=True, blank=True)

    class Meta(AuditableModel.Meta):
        indexes = [
            models.Index(fields=["user", "is_active", "last_seen_at"]),
            models.Index(fields=["refresh_jti", "is_active"]),
            models.Index(fields=["ip_address", "created_at"]),
        ]

    def __str__(self):
        return f"{self.user_id} / {self.session_key} / active={self.is_active}"
