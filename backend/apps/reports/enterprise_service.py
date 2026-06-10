"""Enterprise reporting service: scoped queries, report builders, cache, exports."""

from __future__ import annotations

from django.core.cache import cache
from django.db.models import Count, Q
from django.utils import timezone

from apps.attendance.models import AttendanceRecord
from apps.core.faculty_scoping import scope_attendance_records_for_faculty
from apps.core.hod_scoping import scope_queryset_for_hod
from apps.reports.filters import ReportFilters, default_date_range, parse_report_filters
from apps.reports.exporters import render_summary_export
from apps.staff.models import Faculty
from apps.students.models import Student
from apps.subjects.models import Subject


CACHE_TTL = 300


def _pct(present, total):
    return round((present / total) * 100, 2) if total else 0


def _attended_count(queryset):
    return queryset.filter(status__in=["PRESENT", "LATE", "EXCUSED"]).count()


def _summary(queryset):
    total = queryset.count()
    present = _attended_count(queryset)
    absent = queryset.filter(status="ABSENT").count()
    return {
        "total": total,
        "present": present,
        "absent": absent,
        "percentage": _pct(present, total),
    }


class EnterpriseReportService:
    def __init__(self, user):
        self.user = user
        self.organization = user.active_organization

    def scoped_records(self):
        queryset = AttendanceRecord.objects.filter(organization=self.organization).select_related(
            "student",
            "session",
            "session__subject",
            "session__department",
            "session__semester",
            "session__subject__course",
        )
        queryset = scope_attendance_records_for_faculty(
            scope_queryset_for_hod(queryset, self.user, "session__department"),
            self.user,
        )
        return queryset

    def apply_filters(self, queryset, filters: ReportFilters):
        if filters.subject_id:
            queryset = queryset.filter(session__subject_id=filters.subject_id)
        if filters.subject_code:
            queryset = queryset.filter(session__subject__subject_code=filters.subject_code)
        if filters.department_id:
            queryset = queryset.filter(session__department_id=filters.department_id)
        elif filters.department:
            queryset = queryset.filter(session__department__name=filters.department)
        if filters.course_id:
            queryset = queryset.filter(session__subject__course_id=filters.course_id)
        elif filters.course:
            queryset = queryset.filter(session__subject__course__name=filters.course)
        if filters.semester_id:
            queryset = queryset.filter(session__semester_id=filters.semester_id)
        elif filters.semester:
            semester = filters.semester
            if isinstance(semester, str) and len(semester) == 36 and semester.count("-") == 4:
                queryset = queryset.filter(session__semester_id=semester)
            else:
                queryset = queryset.filter(session__semester__number=semester)
        if filters.faculty_id:
            queryset = queryset.filter(session__subject__assigned_faculty_id=filters.faculty_id)
        elif filters.staff_code:
            queryset = queryset.filter(session__subject__assigned_faculty__staff_code=filters.staff_code)
        if filters.roll_no:
            queryset = queryset.filter(student__roll_no=filters.roll_no)
        if filters.student_id:
            queryset = queryset.filter(student_id=filters.student_id)
        if filters.date:
            queryset = queryset.filter(session__date=filters.date)
        if filters.start_date or filters.end_date:
            start, end = filters.start_date, filters.end_date
            if not start or not end:
                default_start, default_end = default_date_range()
                start = start or default_start
                end = end or default_end
            queryset = queryset.filter(session__date__range=[start, end])
        if filters.month:
            queryset = queryset.filter(session__date__month=filters.month)
        if filters.year:
            queryset = queryset.filter(session__date__year=filters.year)
        return queryset

    def filtered_records(self, filters: ReportFilters):
        return self.apply_filters(self.scoped_records(), filters)

    def student_rows(self, queryset):
        rows = []
        for row in queryset.values(
            "student__roll_no",
            "student__first_name",
            "student__last_name",
            "student__department__name",
            "student__semester__number",
        ).annotate(
            total=Count("id"),
            present=Count("id", filter=Q(status__in=["PRESENT", "LATE", "EXCUSED"])),
            absent=Count("id", filter=Q(status="ABSENT")),
        ).order_by("student__roll_no"):
            total = row["total"] or 0
            present = row["present"] or 0
            percentage = _pct(present, total)
            rows.append(
                {
                    "roll_no": row["student__roll_no"],
                    "name": f"{row['student__first_name']} {row['student__last_name']}".strip(),
                    "department": row["student__department__name"],
                    "semester": row["student__semester__number"],
                    "attendance_percentage": percentage,
                    "promotion_status": "ELIGIBLE" if percentage >= 75 else "DETAINED",
                    "total": total,
                    "present": present,
                    "absent": row["absent"] or 0,
                    "summary": {
                        "total_periods": total,
                        "present_count": present,
                        "absent_count": row["absent"] or 0,
                        "attendance_percentage": percentage,
                    },
                }
            )
        return rows

    def cache_get(self, namespace: str, token: str):
        if not self.organization:
            return None
        key = f"reports:{namespace}:{self.organization.id}:{token}"
        return cache.get(key)

    def cache_set(self, namespace: str, token: str, data, ttl: int = CACHE_TTL):
        if not self.organization:
            return
        key = f"reports:{namespace}:{self.organization.id}:{token}"
        cache.set(key, data, ttl)

    def build_daily(self, filters: ReportFilters):
        report_date = filters.date or timezone.localdate().isoformat()
        qs = self.filtered_records(ReportFilters(**{**filters.as_dict(), "date": report_date}))
        rows = []
        for student in Student.objects.filter(organization=self.organization, is_active=True).select_related(
            "department"
        ):
            student_records = qs.filter(student=student)
            periods = {record.session.hour: record.status for record in student_records.select_related("session")}
            total = student_records.count()
            present = _attended_count(student_records)
            if total:
                rows.append(
                    {
                        "roll_no": student.roll_no,
                        "name": student.name,
                        "department": student.department.name,
                        "periods": periods,
                        "attendance_percentage": _pct(present, total),
                    }
                )
        summary = _summary(qs)
        summary.update({"overall_percentage": summary["percentage"], "total_students": len(rows)})
        return {"report_type": "daily", "date": report_date, "summary": summary, "data": rows, "filters": filters.as_dict()}

    def build_weekly(self, filters: ReportFilters):
        start, end = default_date_range()
        start = filters.start_date or start
        end = filters.end_date or end
        qs = self.filtered_records(ReportFilters(**{**filters.as_dict(), "start_date": start, "end_date": end}))
        chart_data = []
        for row in qs.values("session__date").annotate(
            present=Count("id", filter=Q(status__in=["PRESENT", "LATE", "EXCUSED"])),
            absent=Count("id", filter=Q(status="ABSENT")),
        ).order_by("session__date"):
            chart_data.append(
                {"day": row["session__date"].strftime("%a"), "present": row["present"], "absent": row["absent"]}
            )
        return {
            "report_type": "weekly",
            "start_date": start,
            "end_date": end,
            "summary": _summary(qs),
            "chart_data": chart_data,
            "data": self.student_rows(qs),
            "filters": filters.as_dict(),
        }

    def build_monthly(self, filters: ReportFilters):
        today = timezone.localdate()
        month = filters.month or today.month
        year = filters.year or today.year
        qs = self.filtered_records(ReportFilters(**{**filters.as_dict(), "month": month, "year": year}))
        chart_data = []
        for week in range(1, 6):
            start_day = (week - 1) * 7 + 1
            end_day = week * 7
            week_qs = qs.filter(session__date__day__gte=start_day, session__date__day__lte=end_day)
            total = week_qs.count()
            present = _attended_count(week_qs)
            chart_data.append(
                {
                    "week": f"Week {week}",
                    "present": present,
                    "absent": week_qs.filter(status="ABSENT").count(),
                    "percentage": _pct(present, total),
                }
            )
        return {
            "report_type": "monthly",
            "month": month,
            "year": year,
            "summary": _summary(qs),
            "chart_data": chart_data,
            "filters": filters.as_dict(),
        }

    def build_semester(self, filters: ReportFilters):
        qs = self.filtered_records(filters)
        rows = self.student_rows(qs)
        return {
            "report_type": "semester",
            "summary": {
                **_summary(qs),
                "eligible": len([row for row in rows if row["promotion_status"] == "ELIGIBLE"]),
                "detained": len([row for row in rows if row["promotion_status"] == "DETAINED"]),
            },
            "data": rows,
            "filters": filters.as_dict(),
        }

    def build_department(self, filters: ReportFilters):
        token = filters.cache_token()
        cached = self.cache_get("department", token)
        if cached:
            return cached
        aggregate_rows = list(
            self.filtered_records(filters)
            .values("session__department__code", "session__department__name")
            .annotate(total=Count("id"), present=Count("id", filter=Q(status__in=["PRESENT", "LATE", "EXCUSED"])))
            .order_by("session__department__name")
        )
        rows = []
        for row in aggregate_rows:
            department_name = row["session__department__name"]
            subjects = []
            for subject in Subject.objects.filter(
                organization=self.organization, department__name=department_name, is_active=True
            ):
                subject_qs = self.filtered_records(filters).filter(session__subject=subject)
                subjects.append(
                    {
                        "code": subject.subject_code,
                        "name": subject.name,
                        "avg": _pct(_attended_count(subject_qs), subject_qs.count()),
                    }
                )
            rows.append(
                {
                    "code": row["session__department__code"],
                    "name": department_name,
                    "avg_attendance": _pct(row["present"], row["total"]),
                    "students": Student.objects.filter(
                        organization=self.organization, department__name=department_name, is_active=True
                    ).count(),
                    "subjects": subjects,
                }
            )
        data = {
            "report_type": "department",
            "rows": aggregate_rows,
            "data": rows,
            "chart_data": [{"department": r["name"], "attendance": r["avg_attendance"]} for r in rows],
            "filters": filters.as_dict(),
        }
        self.cache_set("department", token, data)
        return data

    def build_faculty(self, filters: ReportFilters):
        faculty = None
        if filters.faculty_id:
            faculty = Faculty.objects.filter(organization=self.organization, id=filters.faculty_id).first()
        elif filters.staff_code:
            faculty = Faculty.objects.filter(organization=self.organization, staff_code=filters.staff_code).first()
        qs = self.filtered_records(filters)
        subject_queryset = Subject.objects.filter(organization=self.organization, is_active=True)
        if faculty:
            subject_queryset = subject_queryset.filter(assigned_faculty=faculty)
        elif filters.staff_code or filters.faculty_id:
            subject_queryset = subject_queryset.none()
        subject_rows = []
        for subject in subject_queryset:
            subject_qs = qs.filter(session__subject=subject)
            total = subject_qs.count()
            subject_rows.append(
                {
                    "code": subject.subject_code,
                    "name": subject.name,
                    "sessions_held": subject_qs.values("session").distinct().count(),
                    "present": subject_qs.filter(status="PRESENT").count(),
                    "absent": subject_qs.filter(status="ABSENT").count(),
                    "late": subject_qs.filter(status="LATE").count(),
                    "excused": subject_qs.filter(status="EXCUSED").count(),
                    "avg_attendance": _pct(_attended_count(subject_qs), total),
                }
            )
        return {
            "report_type": "faculty",
            "rows": subject_rows,
            "subjects": subject_rows,
            "overall_attendance": _summary(qs)["percentage"],
            "filters": filters.as_dict(),
        }

    def build_student(self, filters: ReportFilters, restrict_to_user=False):
        qs = self.filtered_records(filters)
        if restrict_to_user:
            qs = qs.filter(student__user=self.user)
        rows = self.student_rows(qs)
        selected = rows[0] if rows else {}
        subject_rows = []
        for row in qs.values("session__subject__subject_code", "session__subject__name").annotate(
            total=Count("id"),
            present=Count("id", filter=Q(status="PRESENT")),
            late=Count("id", filter=Q(status="LATE")),
            excused=Count("id", filter=Q(status="EXCUSED")),
            absent=Count("id", filter=Q(status="ABSENT")),
        ):
            attended = row["present"] + row["late"] + row["excused"]
            subject_rows.append(
                {
                    "code": row["session__subject__subject_code"],
                    "name": row["session__subject__name"],
                    **row,
                    "percentage": _pct(attended, row["total"]),
                }
            )
        monthly_trend = []
        for row in qs.values("session__date__month").annotate(
            total=Count("id"),
            present=Count("id", filter=Q(status__in=["PRESENT", "LATE", "EXCUSED"])),
        ).order_by("session__date__month"):
            monthly_trend.append({"month": row["session__date__month"], "percentage": _pct(row["present"], row["total"])})
        summary = _summary(qs)
        return {
            "report_type": "student",
            "rows": rows,
            "student": {
                "roll_no": selected.get("roll_no"),
                "name": selected.get("name"),
                "department": selected.get("department"),
                "semester": selected.get("semester"),
                "overall_attendance": selected.get("attendance_percentage", 0),
                "promotion_status": selected.get("promotion_status", "DETAINED"),
            },
            "subjects": subject_rows,
            "monthly_trend": monthly_trend,
            "summary": {"total_sessions": summary["total"], "total_present": summary["present"], **summary},
            "filters": filters.as_dict(),
        }

    def build_subject(self, filters: ReportFilters):
        qs = self.filtered_records(filters)
        subject = (
            Subject.objects.filter(organization=self.organization, subject_code=filters.subject_code)
            .select_related("department", "semester", "assigned_faculty")
            .first()
            if filters.subject_code
            else None
        )
        rows = []
        for row in qs.values("student__roll_no", "student__first_name", "student__last_name", "student__semester__number").annotate(
            total=Count("id"),
            present=Count("id", filter=Q(status__in=["PRESENT", "LATE", "EXCUSED"])),
            absent=Count("id", filter=Q(status="ABSENT")),
        ):
            percentage = _pct(row["present"], row["total"])
            rows.append(
                {
                    "roll_no": row["student__roll_no"],
                    "name": f"{row['student__first_name']} {row['student__last_name']}".strip(),
                    "semester": row["student__semester__number"],
                    "total_classes": row["total"],
                    "present_count": row["present"],
                    "absent_count": row["absent"],
                    "attendance_percentage": percentage,
                    "promotion_status": "ELIGIBLE" if percentage >= 75 else "DETAINED",
                }
            )
        return {
            "report_type": "subject",
            "rows": rows,
            "students": rows,
            "total_sessions": qs.values("session").distinct().count(),
            "subject": {
                "code": subject.subject_code if subject else "",
                "name": subject.name if subject else "",
                "department": subject.department.name if subject else "",
                "semester": subject.semester.number if subject else "",
                "credits": subject.credits if subject else 0,
                "faculty": subject.assigned_faculty.name if subject and subject.assigned_faculty else "Unassigned",
            },
            "filters": filters.as_dict(),
        }

    def build_report(self, report_type: str, filters: ReportFilters, restrict_student=False):
        builders = {
            "daily": self.build_daily,
            "weekly": self.build_weekly,
            "monthly": self.build_monthly,
            "semester": self.build_semester,
            "department": self.build_department,
            "faculty": self.build_faculty,
            "student": lambda f: self.build_student(f, restrict_to_user=restrict_student),
            "subject": self.build_subject,
        }
        builder = builders.get(report_type)
        if not builder:
            raise ValueError(f"Unsupported report type: {report_type}")
        return builder(filters)

    def export_payload(self, report_type: str, export_format: str, filters: ReportFilters):
        report = self.build_report(report_type, filters)
        summary = report.get("summary", {})
        rows = report.get("data") or report.get("rows") or report.get("students") or []
        if rows and isinstance(rows[0], dict) and "summary" in rows[0]:
            pass
        elif report_type == "student" and report.get("rows"):
            rows = report["rows"]
        return render_summary_export(export_format, report_type, summary, rows)

    def build_analytics_dashboard(self, threshold: float = 75.0):
        from django.db.models.functions import TruncDate

        from apps.face_recognition.models import FaceAuditLog, FaceEnrollment
        from apps.reports.repositories import ReportRepository

        qs = self.scoped_records()
        today = timezone.localdate()
        weekly_start = today - timezone.timedelta(days=6)

        weekly_attendance = []
        for row in (
            qs.filter(session__date__range=[weekly_start, today])
            .values("session__date")
            .annotate(
                present=Count("id", filter=Q(status__in=["PRESENT", "LATE", "EXCUSED"])),
                absent=Count("id", filter=Q(status="ABSENT")),
                total=Count("id"),
            )
            .order_by("session__date")
        ):
            total = row["total"] or 0
            weekly_attendance.append(
                {
                    "date": row["session__date"].isoformat(),
                    "day": row["session__date"].strftime("%a"),
                    "present": row["present"],
                    "absent": row["absent"],
                    "total": total,
                    "percentage": _pct(row["present"], total),
                }
            )

        monthly_rows = list(
            qs.values("session__date__year", "session__date__month")
            .annotate(
                total=Count("id"),
                present=Count("id", filter=Q(status__in=["PRESENT", "LATE", "EXCUSED"])),
                absent=Count("id", filter=Q(status="ABSENT")),
            )
            .order_by("session__date__year", "session__date__month")
        )[-12:]
        monthly_attendance = []
        for row in monthly_rows:
            label = f"{row['session__date__year']}-{int(row['session__date__month']):02d}"
            total = row["total"] or 0
            monthly_attendance.append(
                {
                    "month": label,
                    "present": row["present"],
                    "absent": row["absent"],
                    "total": total,
                    "percentage": _pct(row["present"], total),
                }
            )

        dept_data = self.build_department(ReportFilters())
        department_comparison = [
            {
                "department": r["name"],
                "code": r["code"],
                "attendance": r["avg_attendance"],
                "students": r["students"],
            }
            for r in dept_data.get("data", [])
        ]

        subject_performance = []
        for row in qs.values("session__subject__subject_code", "session__subject__name").annotate(
            total=Count("id"),
            present=Count("id", filter=Q(status__in=["PRESENT", "LATE", "EXCUSED"])),
            absent=Count("id", filter=Q(status="ABSENT")),
        ).order_by("-present")[:20]:
            total = row["total"] or 0
            subject_performance.append(
                {
                    "subject_code": row["session__subject__subject_code"],
                    "subject_name": row["session__subject__name"],
                    "attendance": _pct(row["present"], total),
                    "present": row["present"],
                    "absent": row["absent"],
                    "total": total,
                }
            )

        repo = ReportRepository()
        risk_students = repo.get_defaulters(threshold, self.organization)
        for student in risk_students:
            student["risk_level"] = (
                "critical" if student["attendance_percentage"] < 60 else "high" if student["attendance_percentage"] < threshold else "watch"
            )

        face_qs = FaceAuditLog.objects.filter(organization=self.organization, is_deleted=False)
        face_agg = face_qs.aggregate(
            total=Count("id"),
            success_count=Count("id", filter=Q(success=True)),
            failed_count=Count("id", filter=Q(success=False)),
        )
        total_face = face_agg["total"] or 0
        success_face = face_agg["success_count"] or 0

        face_daily = []
        for row in (
            face_qs.filter(created_at__date__gte=weekly_start)
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(
                total=Count("id"),
                success_count=Count("id", filter=Q(success=True)),
            )
            .order_by("day")
        ):
            attempts = row["total"] or 0
            day_val = row["day"]
            face_daily.append(
                {
                    "date": day_val.isoformat() if hasattr(day_val, "isoformat") else str(day_val),
                    "attempts": attempts,
                    "successful": row["success_count"],
                    "success_rate": _pct(row["success_count"], attempts),
                }
            )

        capture_stats = list(
            qs.values("capture_method")
            .annotate(count=Count("id"))
            .order_by("-count")
        )

        summary_total = qs.count()
        summary_present = _attended_count(qs)
        return {
            "generated_at": timezone.now().isoformat(),
            "threshold": threshold,
            "summary": {
                "overall_attendance": _pct(summary_present, summary_total),
                "total_records": summary_total,
                "risk_count": len(risk_students),
                "department_count": len(department_comparison),
                "subject_count": len(subject_performance),
                "face_success_rate": _pct(success_face, total_face),
            },
            "weekly_attendance": weekly_attendance,
            "monthly_attendance": monthly_attendance,
            "department_comparison": department_comparison,
            "subject_performance": subject_performance,
            "risk_students": risk_students,
            "face_recognition": {
                "success_rate": _pct(success_face, total_face),
                "total_attempts": total_face,
                "successful": success_face,
                "failed": (face_agg["failed_count"] or 0),
                "enrollments": FaceEnrollment.objects.filter(
                    organization=self.organization,
                    is_active=True,
                    is_deleted=False,
                ).count(),
                "daily_trend": face_daily,
                "capture_methods": capture_stats,
                "attendance_face_captures": qs.filter(
                    capture_method="FACE_RECOGNITION"
                ).count(),
            },
        }

    def filter_meta(self):
        from apps.organizations.models import Course, Department, Semester

        org = self.organization
        departments = list(
            Department.objects.filter(organization=org, is_deleted=False, is_active=True).values(
                "id", "name", "code"
            )
        )
        courses = list(
            Course.objects.filter(organization=org, is_deleted=False, is_active=True).values("id", "name", "code")
        )
        semesters = list(
            Semester.objects.filter(organization=org, is_deleted=False).values("id", "number", "course_id")
        )
        subjects = list(
            Subject.objects.filter(organization=org, is_active=True, is_deleted=False).values(
                "id", "subject_code", "name", "department_id", "course_id", "semester_id"
            )
        )
        faculty = list(
            Faculty.objects.filter(organization=org, is_active=True, is_deleted=False).values(
                "id", "staff_code", "first_name", "last_name"
            )
        )
        return {
            "report_types": ["daily", "weekly", "monthly", "semester", "department", "student", "faculty", "subject"],
            "export_formats": ["csv", "excel", "pdf"],
            "filters": {
                "date_range": ["date", "start_date", "end_date", "month", "year"],
                "department": ["department", "department_id"],
                "course": ["course", "course_id"],
                "semester": ["semester", "semester_id"],
                "subject": ["subject_id", "subject_code"],
                "faculty": ["staff_code", "faculty_id"],
                "student": ["roll_no", "student_id"],
            },
            "departments": departments,
            "courses": courses,
            "semesters": semesters,
            "subjects": subjects,
            "faculty": faculty,
        }


def parse_filters_from_request(request) -> ReportFilters:
    return parse_report_filters(request.query_params)
