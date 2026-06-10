import csv
from io import StringIO

from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.hod_scoping import scope_queryset_for_hod
from apps.core.faculty_scoping import (
    scope_attendance_records_for_faculty,
    scope_materials_for_faculty,
    scope_queryset_for_faculty,
    scope_subjects_for_faculty,
)


class ArchiveRestoreExportMixin:
    """Adds archive, restore, and CSV export actions to auditable viewsets."""

    export_filename = "export.csv"

    def _archived_queryset(self):
        model = self.queryset.model
        queryset = model.all_objects.filter(is_deleted=True)
        user = self.request.user
        organization_field = getattr(self, "organization_field", None)
        if organization_field and hasattr(model, organization_field):
            from apps.core.permissions import normalize_role

            if normalize_role(getattr(user, "role", "")) != "SUPER_ADMIN":
                organization = getattr(self, "get_active_organization", lambda: None)()
                if organization is None:
                    return queryset.none()
                queryset = queryset.filter(**{f"{organization_field}_id": organization.id})
        return queryset

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.query_params.get("is_archived") == "true":
            return self._archived_queryset()
        return queryset

    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        instance.refresh_from_db()
        return Response(self.get_serializer(instance).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, *args, **kwargs):
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        lookup_value = self.kwargs[lookup_url_kwarg]
        instance = self._archived_queryset().get(**{self.lookup_field: lookup_value})
        instance.is_deleted = False
        instance.deleted_at = None
        instance.updated_by = request.user
        instance.save(update_fields=["is_deleted", "deleted_at", "updated_by", "updated_at"])
        return Response(self.get_serializer(instance).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        rows = serializer.data
        if not rows:
            return Response({"detail": "No records to export."}, status=status.HTTP_404_NOT_FOUND)

        buffer = StringIO()
        writer = csv.DictWriter(buffer, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in writer.fieldnames})

        response = HttpResponse(buffer.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{self.export_filename}"'
        return response


class HodDepartmentScopedMixin:
    """Restrict HOD users to records in their assigned department."""

    hod_department_field = "department"

    def filter_queryset_for_hod(self, queryset):
        return scope_queryset_for_hod(queryset, self.request.user, self.hod_department_field)

    def get_queryset(self):
        queryset = super().get_queryset()
        return self.filter_queryset_for_hod(queryset)


class FacultyDepartmentScopedMixin:
    """Restrict faculty users to records in their assigned department."""

    faculty_department_field = "department"

    def filter_queryset_for_faculty(self, queryset):
        return scope_queryset_for_faculty(queryset, self.request.user, self.faculty_department_field)

    def get_queryset(self):
        queryset = super().get_queryset()
        return self.filter_queryset_for_faculty(queryset)


class FacultySubjectScopedMixin:
    """Restrict faculty users to their assigned subjects."""

    def filter_queryset_for_faculty_subjects(self, queryset):
        return scope_subjects_for_faculty(queryset, self.request.user)

    def get_queryset(self):
        queryset = super().get_queryset()
        return self.filter_queryset_for_faculty_subjects(queryset)


class FacultyMaterialScopedMixin:
    def filter_queryset_for_faculty_materials(self, queryset):
        return scope_materials_for_faculty(queryset, self.request.user)

    def get_queryset(self):
        queryset = super().get_queryset()
        return self.filter_queryset_for_faculty_materials(queryset)
