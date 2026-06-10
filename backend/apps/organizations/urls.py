from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.organizations.views import (
    AcademicYearViewSet,
    AuditLogViewSet,
    BranchViewSet,
    CourseViewSet,
    DepartmentViewSet,
    OrganizationMembershipViewSet,
    OrganizationViewSet,
    SemesterViewSet,
    SystemSettingsViewSet,
)

router = DefaultRouter()
router.register("organizations", OrganizationViewSet)
router.register("branches", BranchViewSet)
router.register("departments", DepartmentViewSet)
router.register("academic-years", AcademicYearViewSet)
router.register("courses", CourseViewSet)
router.register("semesters", SemesterViewSet)
router.register("memberships", OrganizationMembershipViewSet)
router.register("system-settings", SystemSettingsViewSet)
router.register("audit-logs", AuditLogViewSet)

urlpatterns = [path("", include(router.urls))]
