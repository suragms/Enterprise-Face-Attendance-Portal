from rest_framework import permissions, viewsets

from apps.authentication.permissions import IsHODUser
from apps.core.permissions import IsBranchAdminOrAbove, IsOrganizationAdminOrAbove, IsPlatformSuperAdmin
from apps.core.mixins import ArchiveRestoreExportMixin, HodDepartmentScopedMixin
from apps.core.viewsets import TenantScopedModelViewSet
from apps.organizations.models import (
    AcademicYear,
    AuditLog,
    Branch,
    Course,
    Department,
    Organization,
    OrganizationMembership,
    Semester,
    SystemSettings,
)
from apps.organizations.serializers import (
    AcademicYearSerializer,
    AuditLogSerializer,
    BranchSerializer,
    CourseSerializer,
    DepartmentSerializer,
    OrganizationMembershipSerializer,
    OrganizationSerializer,
    SemesterSerializer,
    SystemSettingsSerializer,
)


class OrganizationViewSet(ArchiveRestoreExportMixin, viewsets.ModelViewSet):
    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer
    export_filename = "organizations.csv"

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated(), IsOrganizationAdminOrAbove()]
        return [permissions.IsAuthenticated(), IsPlatformSuperAdmin()]

    def get_queryset(self):
        user = self.request.user
        if user.is_super_admin:
            return self.queryset
        return Organization.objects.filter(memberships__user=user, memberships__is_active=True).distinct()

    def perform_create(self, serializer):
        org = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        # Automatically create SUPER_ADMIN membership for the creator (super admin)
        OrganizationMembership.objects.get_or_create(
            user=self.request.user,
            organization=org,
            role=OrganizationMembership.Role.SUPER_ADMIN,
            defaults={
                "is_active": True,
                "created_by": self.request.user,
                "updated_by": self.request.user,
            }
        )



class BranchViewSet(ArchiveRestoreExportMixin, TenantScopedModelViewSet):
    queryset = Branch.objects.select_related("organization")
    serializer_class = BranchSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrganizationAdminOrAbove]
    export_filename = "branches.csv"


class DepartmentViewSet(ArchiveRestoreExportMixin, TenantScopedModelViewSet):
    queryset = Department.objects.select_related("organization", "branch", "hod")
    serializer_class = DepartmentSerializer
    export_filename = "departments.csv"

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsOrganizationAdminOrAbove()]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_super_admin:
            return queryset
        from apps.staff.repositories.faculty_repository import FacultyRepository

        hod_department = FacultyRepository().resolve_hod_department(user)
        if hod_department:
            return queryset.filter(id=hod_department.id)
        return queryset


class AcademicYearViewSet(ArchiveRestoreExportMixin, TenantScopedModelViewSet):
    queryset = AcademicYear.objects.select_related("organization")
    serializer_class = AcademicYearSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrganizationAdminOrAbove]
    export_filename = "academic-years.csv"


class CourseViewSet(ArchiveRestoreExportMixin, HodDepartmentScopedMixin, TenantScopedModelViewSet):
    queryset = Course.objects.select_related("organization", "department")
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticated, IsBranchAdminOrAbove]
    export_filename = "courses.csv"

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsBranchAdminOrAbove()]


class SemesterViewSet(ArchiveRestoreExportMixin, HodDepartmentScopedMixin, TenantScopedModelViewSet):
    queryset = Semester.objects.select_related("organization", "course", "academic_year")
    serializer_class = SemesterSerializer
    permission_classes = [permissions.IsAuthenticated, IsBranchAdminOrAbove]
    export_filename = "semesters.csv"
    hod_department_field = "course__department"


class OrganizationMembershipViewSet(TenantScopedModelViewSet):
    queryset = OrganizationMembership.objects.select_related("organization", "branch", "department", "user")
    serializer_class = OrganizationMembershipSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrganizationAdminOrAbove]


class SystemSettingsViewSet(viewsets.ModelViewSet):
    queryset = SystemSettings.objects.all()
    serializer_class = SystemSettingsSerializer
    permission_classes = [permissions.IsAuthenticated, IsPlatformSuperAdmin]


class AuditLogViewSet(TenantScopedModelViewSet):
    queryset = AuditLog.objects.select_related("organization", "actor")
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsPlatformSuperAdmin]
    http_method_names = ["get", "head", "options"]
