from django.db.models import Count
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.student_scoping import is_student_user, resolve_student_profile, scope_queryset_for_student
from apps.exams.models import ExamSchedule
from apps.materials.models import StudyMaterial
from apps.organizations.models import Course
from apps.subjects.models import Subject


class LmsHubView(APIView):
    """Aggregated LMS data for admin, faculty, HOD, and student portals."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        org = request.user.active_organization
        if not org:
            return Response({"detail": "No active organization."}, status=400)

        materials_qs = StudyMaterial.objects.filter(organization=org, is_deleted=False)
        exams_qs = ExamSchedule.objects.filter(organization=org, is_deleted=False)
        courses_qs = Course.objects.filter(organization=org, is_deleted=False, is_active=True)

        if is_student_user(request.user):
            profile = resolve_student_profile(request.user)
            if profile:
                materials_qs = materials_qs.filter(
                    status=StudyMaterial.Status.APPROVED,
                    semester_id=profile.semester_id,
                )
                exams_qs = exams_qs.filter(
                    status=ExamSchedule.Status.PUBLISHED,
                    semester_id=profile.semester_id,
                )
                courses_qs = courses_qs.filter(id=profile.course_id)
            else:
                materials_qs = materials_qs.none()
                exams_qs = exams_qs.none()
                courses_qs = courses_qs.none()

        material_stats = {
            row["material_type"]: row["count"]
            for row in materials_qs.values("material_type").annotate(count=Count("id"))
        }
        workflow = {
            "draft": materials_qs.filter(status=StudyMaterial.Status.DRAFT).count(),
            "pending": materials_qs.filter(status=StudyMaterial.Status.PENDING).count(),
            "approved": materials_qs.filter(status=StudyMaterial.Status.APPROVED).count(),
            "rejected": materials_qs.filter(status=StudyMaterial.Status.REJECTED).count(),
        }

        return Response(
            {
                "courses_count": courses_qs.count(),
                "materials_count": materials_qs.count(),
                "exams_count": exams_qs.count(),
                "materials_by_type": {
                    "NOTES": material_stats.get("NOTES", 0),
                    "ASSIGNMENTS": material_stats.get("ASSIGNMENTS", 0),
                    "SLIDES": material_stats.get("SLIDES", 0),
                    "VIDEOS": material_stats.get("VIDEOS", 0),
                },
                "workflow": workflow,
                "workflow_steps": [
                    "Faculty Upload",
                    "Submit for Approval",
                    "HOD Approval",
                    "Student Download",
                ],
            }
        )
