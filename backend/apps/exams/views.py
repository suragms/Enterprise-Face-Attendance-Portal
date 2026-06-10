from io import BytesIO

from django.db import models
from django.http import HttpResponse
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from rest_framework import permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions import IsFacultyOrAbove
from apps.core.mixins import HodDepartmentScopedMixin
from apps.core.student_scoping import is_student_user, scope_queryset_for_student
from apps.core.viewsets import TenantScopedModelViewSet
from apps.exams.models import ExamSchedule
from apps.exams.serializers import ExamScheduleSerializer


class ExamScheduleViewSet(HodDepartmentScopedMixin, TenantScopedModelViewSet):
    queryset = ExamSchedule.objects.select_related("organization", "subject", "department", "course", "semester", "scheduled_by")
    serializer_class = ExamScheduleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy", "publish"]:
            return [permissions.IsAuthenticated(), IsFacultyOrAbove()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        queryset = super().get_queryset()
        if is_student_user(self.request.user):
            queryset = scope_queryset_for_student(queryset, self.request.user)
            queryset = queryset.filter(status=ExamSchedule.Status.PUBLISHED)
        params = self.request.query_params
        for field in ["department", "course", "semester", "subject", "status", "exam_date"]:
            value = params.get(field)
            if value not in (None, ""):
                queryset = queryset.filter(**{field: value})
        if params.get("search"):
            q = params["search"]
            queryset = queryset.filter(
                models.Q(title__icontains=q) |
                models.Q(subject__subject_code__icontains=q) |
                models.Q(subject__name__icontains=q) |
                models.Q(room__icontains=q)
            )
        return queryset.order_by("exam_date", "starts_at")

    def perform_create(self, serializer):
        serializer.save(
            organization=self.request.user.active_organization,
            scheduled_by=self.request.user,
            created_by=self.request.user,
            updated_by=self.request.user,
        )

    @action(detail=True, methods=["post"], url_path="publish")
    def publish(self, request, pk=None):
        exam = self.get_object()
        exam.status = ExamSchedule.Status.PUBLISHED
        exam.updated_by = request.user
        exam.save(update_fields=["status", "updated_by", "updated_at"])
        return Response(self.get_serializer(exam).data)

    @action(detail=False, methods=["get"], url_path="export-pdf")
    def export_pdf(self, request):
        schedules = self.get_queryset().select_related("subject", "semester", "department")
        stream = BytesIO()
        pdf = canvas.Canvas(stream, pagesize=letter)
        y = 760
        pdf.setFont("Helvetica-Bold", 13)
        pdf.drawString(36, y, "HexaAttender Exam Timetable")
        y -= 24
        pdf.setFont("Helvetica", 9)
        for row in schedules[:200]:
            line = f"{row.exam_date} {row.starts_at}-{row.ends_at} | {row.subject.subject_code} | Sem {row.semester.number} | Room {row.room}"
            pdf.drawString(36, y, line[:115])
            y -= 14
            if y < 40:
                pdf.showPage()
                y = 760
                pdf.setFont("Helvetica", 9)
        pdf.save()
        stream.seek(0)
        response = HttpResponse(stream.read(), content_type="application/pdf")
        response["Content-Disposition"] = 'attachment; filename="exam_timetable.pdf"'
        return response
