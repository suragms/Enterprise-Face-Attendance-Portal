from django.db import models
from django.http import FileResponse
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.authentication.permissions import IsHODUser
from apps.core.permissions import IsFacultyOrAbove
from apps.core.mixins import FacultyMaterialScopedMixin, HodDepartmentScopedMixin
from apps.core.student_scoping import scope_queryset_for_student
from apps.core.viewsets import TenantScopedModelViewSet
from apps.materials.models import StudyMaterial
from apps.materials.serializers import StudyMaterialSerializer


class StudyMaterialViewSet(FacultyMaterialScopedMixin, HodDepartmentScopedMixin, TenantScopedModelViewSet):
    queryset = StudyMaterial.objects.select_related(
        "organization", "subject", "semester", "uploaded_by", "approved_by"
    )
    serializer_class = StudyMaterialSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    hod_department_field = "subject__department"

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy", "submit_for_approval"]:
            return [permissions.IsAuthenticated(), IsFacultyOrAbove()]
        if self.action in ["approve", "reject"]:
            return [permissions.IsAuthenticated(), IsHODUser()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params
        if self.request.user.is_student:
            queryset = queryset.filter(status=StudyMaterial.Status.APPROVED)
            queryset = scope_queryset_for_student(
                queryset, self.request.user, department_field=None, course_field=None
            )
        if params.get("search"):
            query = params["search"]
            queryset = queryset.filter(
                models.Q(title__icontains=query)
                | models.Q(description__icontains=query)
                | models.Q(tags__icontains=query)
                | models.Q(subject__subject_code__icontains=query)
            )
        for field in ["status", "subject", "semester", "material_kind", "material_type"]:
            value = params.get(field)
            if value not in (None, ""):
                queryset = queryset.filter(**{field: value})
        return queryset.order_by("-created_at")

    def perform_create(self, serializer):
        material_type = serializer.validated_data.get("material_type", StudyMaterial.MaterialType.NOTES)
        kind_defaults = {
            StudyMaterial.MaterialType.VIDEOS: StudyMaterial.Kind.VIDEO_LINK,
            StudyMaterial.MaterialType.SLIDES: StudyMaterial.Kind.PPT,
            StudyMaterial.MaterialType.ASSIGNMENTS: StudyMaterial.Kind.PDF,
            StudyMaterial.MaterialType.NOTES: StudyMaterial.Kind.PDF,
        }
        serializer.save(
            organization=self.request.user.active_organization,
            uploaded_by=self.request.user,
            created_by=self.request.user,
            updated_by=self.request.user,
            status=StudyMaterial.Status.DRAFT,
            material_kind=kind_defaults.get(material_type, StudyMaterial.Kind.OTHER),
        )

    @action(detail=True, methods=["post"], url_path="submit")
    def submit_for_approval(self, request, pk=None):
        material = self.get_object()
        if material.status not in (StudyMaterial.Status.DRAFT, StudyMaterial.Status.REJECTED):
            return Response(
                {"detail": "Only DRAFT or REJECTED materials can be submitted."},
                status=status.HTTP_409_CONFLICT,
            )
        material.status = StudyMaterial.Status.PENDING
        material.updated_by = request.user
        material.rejection_reason = ""
        material.save(update_fields=["status", "updated_by", "rejection_reason", "updated_at"])
        return Response(self.get_serializer(material).data)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        material = self.get_object()
        if material.status != StudyMaterial.Status.PENDING:
            return Response(
                {"detail": "Only PENDING materials can be approved."},
                status=status.HTTP_409_CONFLICT,
            )
        material.status = StudyMaterial.Status.APPROVED
        material.approved_by = request.user
        material.approved_at = timezone.now()
        material.rejection_reason = ""
        material.updated_by = request.user
        material.save(
            update_fields=[
                "status",
                "approved_by",
                "approved_at",
                "rejection_reason",
                "updated_by",
                "updated_at",
            ]
        )
        return Response(self.get_serializer(material).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        material = self.get_object()
        if material.status != StudyMaterial.Status.PENDING:
            return Response(
                {"detail": "Only PENDING materials can be rejected."},
                status=status.HTTP_409_CONFLICT,
            )
        reason = request.data.get("reason", "")
        material.status = StudyMaterial.Status.REJECTED
        material.rejection_reason = str(reason)
        material.updated_by = request.user
        material.save(update_fields=["status", "rejection_reason", "updated_by", "updated_at"])
        return Response(self.get_serializer(material).data)

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        material = self.get_object()
        if request.user.is_student and material.status != StudyMaterial.Status.APPROVED:
            return Response(
                {"detail": "Material is not approved for students."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if material.file:
            return FileResponse(
                material.file.open("rb"),
                as_attachment=True,
                filename=material.file.name.split("/")[-1],
            )
        if material.external_video_url:
            return Response(
                {
                    "type": "video_link",
                    "url": material.external_video_url,
                    "title": material.title,
                }
            )
        return Response(
            {"detail": "No downloadable content available."},
            status=status.HTTP_404_NOT_FOUND,
        )
