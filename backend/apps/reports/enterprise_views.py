from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsFacultyUser
from apps.reports.enterprise_service import EnterpriseReportService, parse_filters_from_request
from apps.reports.filters import parse_report_filters
from apps.reports.models import ReportHistory
from apps.reports.serializers import ReportGenerateSerializer, ReportHistorySerializer
from apps.reports.tasks import generate_report_export


class ReportMetaView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsFacultyUser]

    def get(self, request):
        service = EnterpriseReportService(request.user)
        if not service.organization:
            return Response({"detail": "No active organization."}, status=400)
        return Response(service.filter_meta())


class ReportGenerateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsFacultyUser]

    def post(self, request):
        serializer = ReportGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        service = EnterpriseReportService(request.user)
        if not service.organization:
            return Response({"detail": "No active organization."}, status=400)

        report_type = serializer.validated_data["report_type"]
        export_format = serializer.validated_data["format"]
        format_map = {"csv": "CSV", "excel": "EXCEL", "pdf": "PDF"}
        filters = parse_report_filters(serializer.validated_data.get("filters") or {})
        title = f"{report_type.title()} Report — {timezone.now().strftime('%Y-%m-%d %H:%M')}"

        history = ReportHistory.objects.create(
            organization=service.organization,
            branch=request.user.active_branch,
            department_id=filters.department_id or None,
            semester_id=filters.semester_id or None,
            report_type=ReportHistory.ReportType.ATTENDANCE_SUMMARY,
            title=title,
            generated_by=request.user,
            created_by=request.user,
            updated_by=request.user,
            parameters={"report_type": report_type, "filters": filters.as_dict()},
            file_format=format_map[export_format],
            status=ReportHistory.Status.PENDING,
        )

        if serializer.validated_data["async_export"]:
            task = generate_report_export.delay(
                str(service.organization.id),
                export_format,
                report_type,
                filters.as_dict(),
                str(history.id),
                str(request.user.id),
            )
            history.status = ReportHistory.Status.PROCESSING
            history.parameters = {**history.parameters, "task_id": task.id}
            history.save(update_fields=["status", "parameters", "updated_at"])
            return Response(
                {"task_id": task.id, "history_id": str(history.id), "status": "PROCESSING"},
                status=status.HTTP_202_ACCEPTED,
            )

        payload = service.export_payload(report_type, export_format, filters)
        history.status = ReportHistory.Status.COMPLETED
        history.completed_at = timezone.now()
        history.row_count = len(payload.get("bytes", b""))
        history.file_size_bytes = len(payload.get("bytes", b""))
        history.save(update_fields=["status", "completed_at", "row_count", "file_size_bytes", "updated_at"])
        from django.http import HttpResponse

        response = HttpResponse(payload["bytes"], content_type=payload["content_type"])
        response["Content-Disposition"] = f'attachment; filename="{payload["filename"]}"'
        return response


class ReportHistoryListView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsFacultyUser]

    def get(self, request):
        org = request.user.active_organization
        if not org:
            return Response({"detail": "No active organization."}, status=400)
        qs = ReportHistory.objects.filter(organization=org, is_deleted=False).order_by("-created_at")[:50]
        if request.query_params.get("mine") == "true":
            qs = qs.filter(generated_by=request.user)
        return Response(ReportHistorySerializer(qs, many=True).data)
