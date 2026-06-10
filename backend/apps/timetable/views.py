from django.utils import timezone
from django.db.models import Count, Sum
from io import BytesIO
from django.http import HttpResponse
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.core.mixins import HodDepartmentScopedMixin
from apps.core.permissions import IsBranchAdminOrAbove
from apps.core.viewsets import TenantScopedModelViewSet
from apps.organizations.models import Branch, Course, Department, Semester
from apps.staff.models import Faculty
from apps.subjects.models import Subject
from apps.core.hod_scoping import enforce_hod_department_access, scope_queryset_for_hod
from apps.core.student_scoping import is_student_user, scope_queryset_for_student
from apps.timetable.models import Timetable
from apps.timetable.serializers import TimetableEntrySerializer


class TimetableEntryViewSet(HodDepartmentScopedMixin, TenantScopedModelViewSet):
    queryset = Timetable.objects.select_related("organization", "branch", "department", "course", "semester", "subject", "faculty")
    serializer_class = TimetableEntrySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [permissions.IsAuthenticated(), IsBranchAdminOrAbove()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        queryset = super().get_queryset()
        if is_student_user(self.request.user):
            queryset = scope_queryset_for_student(queryset, self.request.user)
        for field in ["branch", "department", "course", "semester", "faculty", "subject", "day", "period", "is_active"]:
            value = self.request.query_params.get(field)
            if value not in (None, ""):
                queryset = queryset.filter(**{field: value})
        return queryset.order_by("day", "period")

    def create(self, request, *args, **kwargs):
        if any(key.startswith("period_") for key in request.data):
            return self._upsert_day_schedule(request)
        return super().create(request, *args, **kwargs)

    def _upsert_day_schedule(self, request):
        organization = request.user.active_organization
        branch = request.user.active_branch or Branch.objects.filter(organization=organization, is_active=True).order_by("code").first()
        department_value = request.data.get("department") or request.data.get("programme")
        semester_value = request.data.get("semester")
        day = request.data.get("day")

        department = Department.objects.filter(organization=organization, is_active=True).filter(
            name=department_value
        ).first() or Department.objects.filter(organization=organization, is_active=True, code=department_value).first()
        if not all([branch, department, semester_value, day]):
            return Response({"detail": "Branch, department, day, and semester are required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            enforce_hod_department_access(request.user, department)
        except PermissionDenied as exc:
            return Response({"detail": exc.detail}, status=status.HTTP_403_FORBIDDEN)

        course = Course.objects.filter(organization=organization, department=department, is_active=True).order_by("code").first()
        semester = Semester.objects.filter(organization=organization, course=course, number=semester_value, is_active=True).order_by("-academic_year__starts_on").first()
        if not course or not semester:
            return Response({"detail": "No active course/semester matches the selected department."}, status=status.HTTP_400_BAD_REQUEST)

        slots = {
            1: ("08:30", "09:30"),
            2: ("09:30", "10:30"),
            3: ("10:30", "11:30"),
            4: ("11:30", "12:30"),
            5: ("13:30", "14:30"),
            6: ("14:30", "15:30"),
            7: ("15:30", "16:30"),
        }
        changed = []
        for period, (starts_at, ends_at) in slots.items():
            subject_code = request.data.get(f"period_{period}")
            existing = Timetable.objects.filter(
                organization=organization,
                semester=semester,
                day=day,
                period=period,
            ).first()
            if not subject_code:
                if existing:
                    existing.soft_delete(user=request.user)
                continue

            subject = Subject.objects.filter(organization=organization, subject_code=subject_code, is_active=True).first()
            if not subject:
                return Response({"detail": f"Subject {subject_code} was not found."}, status=status.HTTP_400_BAD_REQUEST)
            faculty = subject.assigned_faculty or Faculty.objects.filter(organization=organization, department=department, is_active=True).order_by("staff_code").first()
            if not faculty:
                return Response({"detail": f"No faculty assignment is available for {subject_code}."}, status=status.HTTP_400_BAD_REQUEST)

            entry, _ = Timetable.objects.update_or_create(
                organization=organization,
                semester=semester,
                day=day,
                period=period,
                defaults={
                    "branch": branch,
                    "department": department,
                    "course": course,
                    "starts_at": starts_at,
                    "ends_at": ends_at,
                    "subject": subject,
                    "faculty": faculty,
                    "updated_by": request.user,
                    "is_deleted": False,
                    "deleted_at": None,
                },
            )
            if not entry.created_by:
                entry.created_by = request.user
                entry.save(update_fields=["created_by"])
            changed.append(entry)

        return Response(TimetableEntrySerializer(changed, many=True, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="current")
    def current(self, request):
        now = timezone.localtime()
        day = request.query_params.get("day", now.strftime("%A").upper())
        qs = self.get_queryset().filter(day=day, starts_at__lte=now.time(), ends_at__gte=now.time()).first()
        if not qs:
            return Response({"scheduled": False, "day": day}, status=status.HTTP_200_OK)
        return Response({"scheduled": True, "entry": self.get_serializer(qs).data}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="detect-clashes")
    def detect_clashes(self, request):
        queryset = self.get_queryset().filter(is_active=True).select_related("faculty", "subject", "semester", "course")
        faculty_clashes = []
        workload_warnings = []
        unassigned_warnings = []

        clash_groups = (
            queryset.filter(faculty_id__isnull=False)
            .values("day", "period", "faculty_id")
            .annotate(total=Count("id"))
            .filter(total__gt=1)
            .order_by("day", "period", "faculty_id")
        )
        for group in clash_groups:
            faculty = Faculty.objects.filter(pk=group["faculty_id"]).first()
            faculty_name = ""
            faculty_code = ""
            if faculty:
                faculty_name = f"{faculty.first_name} {faculty.last_name}".strip()
                faculty_code = faculty.staff_code
            entries = queryset.filter(day=group["day"], period=group["period"], faculty_id=group["faculty_id"])
            cohorts = [f"{entry.course.code} S{entry.semester.number}" for entry in entries]
            faculty_clashes.append(
                {
                    "day": group["day"],
                    "period": f"Period {group['period']}",
                    "faculty_code": faculty_code,
                    "message": f"{faculty_name} is assigned to {group['total']} classes at the same time: {', '.join(cohorts)}.",
                }
            )

        faculty_loads = (
            scope_queryset_for_hod(
                Subject.objects.filter(organization=request.user.active_organization, is_active=True, assigned_faculty__isnull=False),
                request.user,
            )
            .values("assigned_faculty_id", "assigned_faculty__staff_code", "assigned_faculty__first_name", "assigned_faculty__last_name", "assigned_faculty__max_load_credits")
            .annotate(total_credits=Sum("credits"))
            .order_by("assigned_faculty__staff_code")
        )
        for load in faculty_loads:
            max_load = load["assigned_faculty__max_load_credits"] or 0
            total_credits = load["total_credits"] or 0
            if max_load and total_credits > max_load:
                faculty_name = f"{load['assigned_faculty__first_name']} {load['assigned_faculty__last_name']}".strip() or load["assigned_faculty__staff_code"]
                workload_warnings.append(
                    {
                        "day": "ALL",
                        "period": "All Day",
                        "faculty_code": load["assigned_faculty__staff_code"],
                        "message": f"{faculty_name} has {total_credits} assigned credits, exceeding the configured limit of {max_load}.",
                    }
                )

        unassigned_subjects = scope_queryset_for_hod(
            Subject.objects.filter(
                organization=request.user.active_organization,
                is_active=True,
                assigned_faculty__isnull=True,
            ).select_related("department", "course", "semester"),
            request.user,
        )
        for subject in unassigned_subjects:
            unassigned_warnings.append(
                {
                    "day": "ALL",
                    "period": "Unassigned",
                    "subject_code": subject.subject_code,
                    "message": f"{subject.subject_code} - {subject.name} has no faculty assigned for {subject.course.code} semester {subject.semester.number}.",
                }
            )

        return Response(
            {
                "clashes": {
                    "faculty_clashes": faculty_clashes,
                    "workload_warnings": workload_warnings,
                    "unassigned_warnings": unassigned_warnings,
                },
                "summary": {
                    "faculty_clashes": len(faculty_clashes),
                    "workload_warnings": len(workload_warnings),
                    "unassigned_warnings": len(unassigned_warnings),
                    "total": len(faculty_clashes) + len(workload_warnings) + len(unassigned_warnings),
                },
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="export-pdf")
    def export_pdf(self, request):
        entries = self.get_queryset().select_related("subject", "semester", "faculty")
        stream = BytesIO()
        pdf = canvas.Canvas(stream, pagesize=letter)
        y = 760
        pdf.setFont("Helvetica-Bold", 13)
        pdf.drawString(36, y, "HexaAttender Timetable")
        y -= 24
        pdf.setFont("Helvetica", 9)
        for row in entries[:300]:
            line = f"{row.day} P{row.period} {row.starts_at}-{row.ends_at} | {row.subject.subject_code} | Sem {row.semester.number} | {row.faculty.staff_code}"
            pdf.drawString(36, y, line[:115])
            y -= 14
            if y < 40:
                pdf.showPage()
                y = 760
                pdf.setFont("Helvetica", 9)
        pdf.save()
        stream.seek(0)
        response = HttpResponse(stream.read(), content_type="application/pdf")
        response["Content-Disposition"] = 'attachment; filename="timetable.pdf"'
        return response
