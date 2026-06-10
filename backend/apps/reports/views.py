import base64

from django.core.cache import cache
from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.permissions import IsFacultyUser
from apps.reports.enterprise_service import EnterpriseReportService, parse_filters_from_request
from apps.reports.exporters import render_summary_export
from apps.reports.filters import parse_report_filters
from apps.reports.tasks import AsyncResult, generate_report_export


class BaseReportView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsFacultyUser]

    def service(self, request) -> EnterpriseReportService:
        return EnterpriseReportService(request.user)


class DailyReportView(BaseReportView):
    def get(self, request):
        return Response(self.service(request).build_daily(parse_filters_from_request(request)))


class WeeklyReportView(BaseReportView):
    def get(self, request):
        return Response(self.service(request).build_weekly(parse_filters_from_request(request)))


class MonthlyReportView(BaseReportView):
    def get(self, request):
        return Response(self.service(request).build_monthly(parse_filters_from_request(request)))


class SemesterReportView(BaseReportView):
    def get(self, request):
        return Response(self.service(request).build_semester(parse_filters_from_request(request)))


class DepartmentReportView(BaseReportView):
    def get(self, request):
        return Response(self.service(request).build_department(parse_filters_from_request(request)))


class FacultyReportView(BaseReportView):
    def get(self, request):
        return Response(self.service(request).build_faculty(parse_filters_from_request(request)))


class StudentReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        service = EnterpriseReportService(request.user)
        restrict = getattr(request.user, "role", "") == "STUDENT"
        return Response(
            service.build_student(parse_filters_from_request(request), restrict_to_user=restrict)
        )


class SubjectReportView(BaseReportView):
    def get(self, request):
        return Response(self.service(request).build_subject(parse_filters_from_request(request)))


def _export_response(format_name, summary, rows=None):
    payload = render_summary_export(format_name, "export", summary, rows)
    response = HttpResponse(payload["bytes"], content_type=payload["content_type"])
    response["Content-Disposition"] = f'attachment; filename="{payload["filename"]}"'
    return response


class ExportCSVView(BaseReportView):
    def get(self, request):
        org = request.user.active_organization
        report_type = request.query_params.get("report_type", "daily")
        filters = parse_filters_from_request(request).as_dict()
        if request.query_params.get("async") == "true":
            task = generate_report_export.delay(str(org.id), "csv", report_type, filters)
            return Response({"task_id": task.id}, status=status.HTTP_202_ACCEPTED)
        service = self.service(request)
        payload = service.export_payload(report_type, "csv", parse_filters_from_request(request))
        return HttpResponse(payload["bytes"], content_type=payload["content_type"], headers={
            "Content-Disposition": f'attachment; filename="{payload["filename"]}"'
        })


class ExportExcelView(BaseReportView):
    def get(self, request):
        org = request.user.active_organization
        report_type = request.query_params.get("report_type", "daily")
        filters = parse_filters_from_request(request).as_dict()
        if request.query_params.get("async") == "true":
            task = generate_report_export.delay(str(org.id), "excel", report_type, filters)
            return Response({"task_id": task.id}, status=status.HTTP_202_ACCEPTED)
        service = self.service(request)
        payload = service.export_payload(report_type, "excel", parse_filters_from_request(request))
        return HttpResponse(payload["bytes"], content_type=payload["content_type"], headers={
            "Content-Disposition": f'attachment; filename="{payload["filename"]}"'
        })


class ExportPDFView(BaseReportView):
    def get(self, request):
        org = request.user.active_organization
        report_type = request.query_params.get("report_type", "daily")
        filters = parse_filters_from_request(request).as_dict()
        if request.query_params.get("async") == "true":
            task = generate_report_export.delay(str(org.id), "pdf", report_type, filters)
            return Response({"task_id": task.id}, status=status.HTTP_202_ACCEPTED)
        service = self.service(request)
        payload = service.export_payload(report_type, "pdf", parse_filters_from_request(request))
        return HttpResponse(payload["bytes"], content_type=payload["content_type"], headers={
            "Content-Disposition": f'attachment; filename="{payload["filename"]}"'
        })


class ExportTaskStatusView(BaseReportView):
    def get(self, request, task_id):
        task_result = AsyncResult(task_id)
        state = task_result.state
        if state == "SUCCESS":
            result = task_result.result or {}
            if result.get("organization_id") and result.get("organization_id") != str(request.user.active_organization_id):
                return Response({"detail": "Export task does not belong to active organization."}, status=status.HTTP_403_FORBIDDEN)
            return Response(
                {
                    "task_id": task_id,
                    "state": state,
                    "ready": True,
                    "filename": result.get("filename"),
                    "content_type": result.get("content_type"),
                    "history_id": result.get("history_id"),
                }
            )
        if state == "FAILURE":
            return Response(
                {"task_id": task_id, "state": state, "ready": False, "error": str(task_result.result)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return Response({"task_id": task_id, "state": state, "ready": False})


class ExportTaskDownloadView(BaseReportView):
    def get(self, request, task_id):
        task_result = AsyncResult(task_id)
        if task_result.state != "SUCCESS":
            return Response({"detail": "Task is not complete."}, status=status.HTTP_409_CONFLICT)
        result = task_result.result or {}
        if result.get("organization_id") and result.get("organization_id") != str(request.user.active_organization_id):
            return Response({"detail": "Export task does not belong to active organization."}, status=status.HTTP_403_FORBIDDEN)
        content = result.get("content_base64")
        if not content:
            return Response({"detail": "No exported content found."}, status=status.HTTP_404_NOT_FOUND)
        content_bytes = base64.b64decode(content.encode("utf-8"))
        response = HttpResponse(content_bytes, content_type=result.get("content_type", "application/octet-stream"))
        response["Content-Disposition"] = f'attachment; filename="{result.get("filename", "hexaattender_report.bin")}"'
        return response


class AnalyticsDashboardView(BaseReportView):
    def get(self, request):
        service = self.service(request)
        if not service.organization:
            return Response({"detail": "No active organization."}, status=400)
        threshold = float(request.query_params.get("threshold", 75))
        cache_key = f"analytics:dashboard:{service.organization.id}:{int(threshold)}"
        data = cache.get(cache_key)
        if data is None:
            data = service.build_analytics_dashboard(threshold)
            cache.set(cache_key, data, 300)
        return Response(data)


class AnalyticsTrendsView(BaseReportView):
    def get(self, request):
        service = self.service(request)
        cache_key = f"analytics:trends:v2:{service.organization.id}"
        data = cache.get(cache_key)
        if data is None:
            qs = service.scoped_records()
            monthly = []
            for row in qs.values("session__date__year", "session__date__month").annotate(
                total=Count("id"),
                present=Count("id", filter=Q(status__in=["PRESENT", "LATE", "EXCUSED"])),
            ).order_by("session__date__year", "session__date__month"):
                label = f"{row['session__date__year']}-{int(row['session__date__month']):02d}"
                monthly.append({"month": label, "percentage": round((row["present"] / row["total"]) * 100, 2) if row["total"] else 0})
            data = {"monthly": monthly, "trends": monthly}
            cache.set(cache_key, data, 300)
        return Response(data)


class AnalyticsDefaultersView(BaseReportView):
    def get(self, request):
        from apps.reports.repositories import ReportRepository

        threshold = float(request.query_params.get("threshold", 75))
        repo = ReportRepository()
        rows = repo.get_defaulters(threshold, request.user.active_organization)
        return Response({"threshold": threshold, "defaulters": rows})


class AnalyticsAlertsView(BaseReportView):
    def get(self, request):
        return Response({"alerts": [], "generated_at": timezone.now()})


class AnalyticsDepartmentView(BaseReportView):
    def get(self, request):
        data = self.service(request).build_department(parse_filters_from_request(request))
        rows = [
            {"department": r["name"], "attendance": r["avg_attendance"], "students": r["students"]}
            for r in data.get("data", [])
        ]
        return Response({"departments": rows})


class AnalyticsSubjectView(BaseReportView):
    def get(self, request):
        queryset = self.service(request).filtered_records(parse_filters_from_request(request))
        rows = []
        for row in queryset.values("session__subject__subject_code", "session__subject__name").annotate(
            total=Count("id"),
            present=Count("id", filter=Q(status__in=["PRESENT", "LATE", "EXCUSED"])),
            absent=Count("id", filter=Q(status="ABSENT")),
        ).order_by("session__subject__subject_code"):
            rows.append(
                {
                    "subject_code": row["session__subject__subject_code"],
                    "subject_name": row["session__subject__name"],
                    "attendance": round((row["present"] / row["total"]) * 100, 2) if row["total"] else 0,
                    "absent_sessions": row["absent"],
                }
            )
        return Response({"subjects": rows})


class AnalyticsHeatmapView(BaseReportView):
    def get(self, request):
        rows = list(
            self.service(request)
            .filtered_records(parse_filters_from_request(request))
            .values("session__date", "session__hour")
            .annotate(absent=Count("id", filter=Q(status="ABSENT")))
        )
        return Response({"heatmap": rows})


class AnalyticsOverviewView(BaseReportView):
    def get(self, request):
        service = self.service(request)
        filters = parse_filters_from_request(request)
        qs = service.filtered_records(filters)
        today = timezone.localdate()
        weekly_start = today - timezone.timedelta(days=6)
        monthly_start = today.replace(day=1)

        def summary(q):
            total = q.count()
            present = q.filter(status__in=["PRESENT", "LATE", "EXCUSED"]).count()
            return {
                "total": total,
                "present": present,
                "absent": q.filter(status="ABSENT").count(),
                "percentage": round((present / total) * 100, 2) if total else 0,
            }

        return Response(
            {
                "daily": summary(qs.filter(session__date=today)),
                "weekly": summary(qs.filter(session__date__range=[weekly_start, today])),
                "monthly": summary(qs.filter(session__date__range=[monthly_start, today])),
                "faculty_wise": list(
                    qs.values("session__subject__assigned_faculty__staff_code")
                    .annotate(total=Count("id"), present=Count("id", filter=Q(status__in=["PRESENT", "LATE", "EXCUSED"])))
                    .order_by("session__subject__assigned_faculty__staff_code")
                ),
                "department_wise": list(
                    qs.values("session__department__code")
                    .annotate(total=Count("id"), present=Count("id", filter=Q(status__in=["PRESENT", "LATE", "EXCUSED"])))
                    .order_by("session__department__code")
                ),
                "student_wise": service.student_rows(qs),
            }
        )
