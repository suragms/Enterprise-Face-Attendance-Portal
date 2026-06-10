from django.db import models
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.authentication.permissions import IsStudentManagementUser
from apps.core.mixins import HodDepartmentScopedMixin
from apps.core.faculty_scoping import scope_queryset_for_faculty
from apps.core.student_scoping import scope_students_to_self
from apps.core.permissions import normalize_role
from apps.core.viewsets import TenantScopedModelViewSet
from apps.students.models import Student
from apps.students.serializers import StudentSerializer


class StudentViewSet(HodDepartmentScopedMixin, TenantScopedModelViewSet):
    serializer_class = StudentSerializer
    queryset = Student.objects.select_related("organization", "branch", "department", "course", "semester", "user")
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "roll_no"

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy", "archive", "restore"]:
            return [permissions.IsAuthenticated(), IsStudentManagementUser()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        include_archived = self.request.query_params.get("is_archived")
        if include_archived == "true":
            queryset = Student.all_objects.select_related("organization", "branch", "department", "course", "semester", "user")
            user = self.request.user
            if normalize_role(getattr(user, "role", None)) != "SUPER_ADMIN":
                queryset = queryset.filter(organization=user.active_organization)
            queryset = self.filter_queryset_for_hod(queryset)
            queryset = scope_queryset_for_faculty(queryset, user)
            queryset = scope_students_to_self(queryset, user)
            queryset = queryset.filter(is_deleted=True)
        else:
            queryset = super().get_queryset()
        queryset = self.filter_queryset_for_hod(queryset)
        queryset = scope_queryset_for_faculty(queryset, self.request.user)
        queryset = scope_students_to_self(queryset, self.request.user)
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                models.Q(first_name__icontains=search)
                | models.Q(last_name__icontains=search)
                | models.Q(roll_no__icontains=search)
                | models.Q(admission_number__icontains=search)
                | models.Q(email__icontains=search)
            )
        for field in ["branch", "course", "campus_status", "is_active"]:
            value = self.request.query_params.get(field)
            if value not in (None, ""):
                queryset = queryset.filter(**{field: value})
        department = self.request.query_params.get("department")
        if department not in (None, ""):
            queryset = queryset.filter(department_id=department) if len(department) == 36 else queryset.filter(models.Q(department__name=department) | models.Q(department__code=department))
        semester = self.request.query_params.get("semester")
        if semester not in (None, ""):
            queryset = queryset.filter(semester_id=semester) if len(semester) == 36 else queryset.filter(semester__number=semester)
        return queryset.order_by("roll_no")

    def get_object(self):
        if self.action == "restore":
            queryset = Student.all_objects.filter(organization=self.request.user.active_organization)
            return queryset.get(roll_no=self.kwargs[self.lookup_field])
        return super().get_object()

    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, roll_no=None):
        student = self.get_object()
        student.is_deleted = True
        student.deleted_at = timezone.now()
        student.updated_by = request.user
        student.save(update_fields=["is_deleted", "deleted_at", "updated_by", "updated_at"])
        return Response(self.get_serializer(student).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, roll_no=None):
        student = self.get_object()
        student.is_deleted = False
        student.deleted_at = None
        student.updated_by = request.user
        student.save(update_fields=["is_deleted", "deleted_at", "updated_by", "updated_at"])
        return Response(self.get_serializer(student).data, status=status.HTTP_200_OK)
