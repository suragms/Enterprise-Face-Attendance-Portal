from django.db import models
from rest_framework import permissions

from apps.core.permissions import IsBranchAdminOrAbove
from apps.core.mixins import ArchiveRestoreExportMixin, HodDepartmentScopedMixin
from apps.core.viewsets import TenantScopedModelViewSet
from apps.core.faculty_scoping import scope_subjects_for_faculty
from apps.subjects.models import Subject
from apps.subjects.serializers import SubjectSerializer


class SubjectViewSet(ArchiveRestoreExportMixin, HodDepartmentScopedMixin, TenantScopedModelViewSet):
    queryset = Subject.objects.select_related("organization", "department", "course", "semester", "assigned_faculty")
    serializer_class = SubjectSerializer
    permission_classes = [permissions.IsAuthenticated]
    export_filename = "subjects.csv"

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [permissions.IsAuthenticated(), IsBranchAdminOrAbove()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(models.Q(name__icontains=search) | models.Q(subject_code__icontains=search))
        for field in ["course", "assigned_faculty", "is_active"]:
            value = self.request.query_params.get(field)
            if value not in (None, ""):
                queryset = queryset.filter(**{field: value})
        department = self.request.query_params.get("department")
        if department not in (None, ""):
            queryset = queryset.filter(department_id=department) if len(department) == 36 else queryset.filter(models.Q(department__name=department) | models.Q(department__code=department))
        semester = self.request.query_params.get("semester")
        if semester not in (None, ""):
            queryset = queryset.filter(semester_id=semester) if len(semester) == 36 else queryset.filter(semester__number=semester)
        queryset = scope_subjects_for_faculty(queryset, self.request.user)
        return queryset.order_by("subject_code")
