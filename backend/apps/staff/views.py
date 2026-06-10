from django.db import models
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsHODUser
from apps.core.permissions import IsFacultyOrAbove, normalize_role
from apps.core.viewsets import TenantScopedModelViewSet
from apps.organizations.models import AuditLog
from apps.staff.models import Faculty
from apps.staff.repositories.faculty_repository import FacultyRepository
from apps.staff.serializers import FacultySerializer
from apps.staff.serializers_faculty import FacultyCreateInputSerializer, FacultyRegistrationContextSerializer
from apps.staff.services.faculty_service import FacultyService, FacultyServiceError
from apps.subjects.models import Subject


class StaffProfileViewSet(TenantScopedModelViewSet):
    queryset = Faculty.objects.select_related("organization", "branch", "department", "user")
    serializer_class = FacultySerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "staff_code"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.faculty_service = FacultyService()
        self.faculty_repository = FacultyRepository()

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [permissions.IsAuthenticated(), IsHODUser()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        params = self.request.query_params
        return self.faculty_repository.list_for_user(
            self.request.user,
            search=params.get("search"),
            department=params.get("department"),
            branch=params.get("branch"),
            is_active=params.get("is_active"),
        )

    @action(detail=False, methods=["get"], url_path="registration-context")
    def registration_context(self, request):
        context = self.faculty_service.registration_context(request.user)
        serializer = FacultyRegistrationContextSerializer(context)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="assign-subjects", permission_classes=[permissions.IsAuthenticated, IsHODUser])
    def assign_subjects(self, request, staff_code=None):
        faculty = self.get_object()
        subject_codes = request.data.get("subject_codes", [])
        if not isinstance(subject_codes, list):
            return Response({"detail": "subject_codes must be a list."}, status=status.HTTP_400_BAD_REQUEST)

        subjects = Subject.objects.filter(
            organization=faculty.organization,
            subject_code__in=subject_codes,
            is_active=True,
        )
        found_codes = set(subjects.values_list("subject_code", flat=True))
        missing_codes = sorted(set(subject_codes) - found_codes)
        if missing_codes:
            return Response({"detail": f"Unknown subject codes: {', '.join(missing_codes)}"}, status=status.HTTP_400_BAD_REQUEST)

        Subject.objects.filter(organization=faculty.organization, assigned_faculty=faculty).exclude(subject_code__in=subject_codes).update(assigned_faculty=None)
        subjects.update(assigned_faculty=faculty, updated_by=request.user)
        return Response(self.get_serializer(faculty).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="assign-classes", permission_classes=[permissions.IsAuthenticated, IsHODUser])
    def assign_classes(self, request, staff_code=None):
        faculty = self.get_object()
        classes = request.data.get("classes", [])
        if not isinstance(classes, list):
            return Response({"detail": "classes must be a list."}, status=status.HTTP_400_BAD_REQUEST)

        assigned_subjects = []
        for class_item in classes:
            course_label = class_item.get("course_code") or class_item.get("course_name") or class_item.get("programme")
            semester_number = class_item.get("semester") or class_item.get("semester_number")
            if not course_label or not semester_number:
                continue
            subjects = Subject.objects.filter(
                organization=faculty.organization,
                semester__number=semester_number,
                is_active=True,
            ).filter(
                models.Q(course__code=course_label)
                | models.Q(course__name=course_label)
                | models.Q(department__name=course_label)
                | models.Q(department__code=course_label)
            )
            subjects.update(assigned_faculty=faculty, updated_by=request.user)
            assigned_subjects.extend(subjects.values_list("subject_code", flat=True))

        return Response(
            {"assigned_subject_codes": sorted(set(assigned_subjects)), "faculty": self.get_serializer(faculty).data},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="assign-courses", permission_classes=[permissions.IsAuthenticated, IsHODUser])
    def assign_courses(self, request, staff_code=None):
        return self.assign_classes(request, staff_code=staff_code)

    @action(detail=True, methods=["post"], url_path="reset-password", permission_classes=[permissions.IsAuthenticated, IsHODUser])
    def reset_password(self, request, staff_code=None):
        faculty = self.get_object()
        new_password = request.data.get("password")
        if not new_password:
            return Response({"detail": "password is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not faculty.user_id:
            return Response({"detail": "No user account linked to this faculty profile."}, status=status.HTTP_400_BAD_REQUEST)
        faculty.user.set_password(str(new_password))
        faculty.user.save(update_fields=["password"])
        AuditLog.objects.create(
            organization=request.user.active_organization,
            actor=request.user,
            action="faculty.reset_password",
            entity_type="Faculty",
            entity_id=faculty.id,
            metadata={"staff_code": faculty.staff_code},
        )
        return Response({"message": "Faculty password reset successfully."}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="disable", permission_classes=[permissions.IsAuthenticated, IsHODUser])
    def disable(self, request, staff_code=None):
        faculty = self.get_object()
        faculty.is_active = False
        faculty.updated_by = request.user
        faculty.save(update_fields=["is_active", "updated_by", "updated_at"])
        if faculty.user_id:
            faculty.user.is_active = False
            faculty.user.save(update_fields=["is_active"])
        AuditLog.objects.create(
            organization=request.user.active_organization,
            actor=request.user,
            action="faculty.disable",
            entity_type="Faculty",
            entity_id=faculty.id,
            metadata={"staff_code": faculty.staff_code},
        )
        return Response({"message": "Faculty account disabled.", "staff_code": faculty.staff_code}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="reactivate", permission_classes=[permissions.IsAuthenticated, IsHODUser])
    def reactivate(self, request, staff_code=None):
        faculty = self.get_object()
        faculty.is_active = True
        faculty.updated_by = request.user
        faculty.save(update_fields=["is_active", "updated_by", "updated_at"])
        if faculty.user_id:
            faculty.user.is_active = True
            faculty.user.save(update_fields=["is_active"])
        AuditLog.objects.create(
            organization=request.user.active_organization,
            actor=request.user,
            action="faculty.reactivate",
            entity_type="Faculty",
            entity_id=faculty.id,
            metadata={"staff_code": faculty.staff_code},
        )
        return Response({"message": "Faculty account reactivated.", "staff_code": faculty.staff_code}, status=status.HTTP_200_OK)


class FacultyCreateAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsHODUser]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.faculty_service = FacultyService()

    def post(self, request):
        serializer = FacultyCreateInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            faculty = self.faculty_service.create_faculty(request.user, serializer.validated_data)
        except FacultyServiceError as exc:
            payload = {"detail": exc.message}
            if exc.field:
                payload = {exc.field: [exc.message]}
            return Response(payload, status=exc.status_code)
        return Response(FacultySerializer(faculty, context={"request": request}).data, status=status.HTTP_201_CREATED)
