from django.conf import settings
from django.db import models

from apps.core.fields import EncryptedJSONField
from apps.core.models import OrganizationScopedModel


class FaceEnrollment(OrganizationScopedModel):
    REQUIRED_POSES = ("FRONT", "LEFT", "RIGHT", "UP", "DOWN")

    class SubjectType(models.TextChoices):
        STUDENT = "STUDENT", "Student"
        FACULTY = "FACULTY", "Faculty"
        USER = "USER", "User"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="face_enrollments")
    student = models.ForeignKey("students.Student", on_delete=models.CASCADE, null=True, blank=True, related_name="face_enrollments")
    faculty = models.ForeignKey("staff.Faculty", on_delete=models.CASCADE, null=True, blank=True, related_name="face_enrollments")
    subject_type = models.CharField(max_length=16, choices=SubjectType.choices)
    encrypted_embedding = EncryptedJSONField()
    pose_embeddings = EncryptedJSONField(default=dict, blank=True)
    captured_poses = models.JSONField(default=list, blank=True)
    model_provider = models.CharField(max_length=40, default="ArcFace")
    detector_backend = models.CharField(max_length=40, default="retinaface")
    confidence_threshold = models.FloatField(default=0.68)
    reference_image = models.ImageField(upload_to="face_enrollments/%Y/%m/", blank=True, null=True)
    liveness_score = models.FloatField(default=0.0)
    liveness_checks = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta(OrganizationScopedModel.Meta):
        indexes = [
            models.Index(fields=["organization", "subject_type", "is_active"]),
            models.Index(fields=["organization", "user", "is_active"]),
        ]

    @property
    def embedding(self):
        return self.encrypted_embedding

    def __str__(self):
        return f"{self.subject_type} face enrollment for {self.user_id}"


class FaceAuditLog(OrganizationScopedModel):
    class Event(models.TextChoices):
        ENROLLMENT = "ENROLLMENT", "Enrollment"
        VERIFICATION = "VERIFICATION", "Verification"
        IDENTIFICATION = "IDENTIFICATION", "Identification"
        DETECTION = "DETECTION", "Detection"
        FACE_LOGIN = "FACE_LOGIN", "Face Login"
        LIVENESS_FAILED = "LIVENESS_FAILED", "Liveness Failed"

    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="face_audit_events")
    event = models.CharField(max_length=32, choices=Event.choices, db_index=True)
    success = models.BooleanField(default=False, db_index=True)
    confidence = models.FloatField(default=0.0)
    liveness_score = models.FloatField(default=0.0)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta(OrganizationScopedModel.Meta):
        indexes = [models.Index(fields=["organization", "event", "created_at"])]

    def __str__(self):
        return f"{self.event} / {self.success}"
