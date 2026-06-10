import csv
import datetime
import io

from django.db.models import Count, Q
from openpyxl import Workbook
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from rest_framework.exceptions import ValidationError

from apps.attendance.models import AttendanceRecord
from apps.core.services import BaseService
from apps.reports.repositories import ReportRepository
from apps.students.models import Student
from apps.subjects.models import Subject


class ReportService(BaseService):
    def __init__(self):
        super().__init__()
        self.report_repository = ReportRepository()

    def _records(self, organization=None):
        queryset = AttendanceRecord.objects.select_related("student", "session", "session__subject")
        if organization is not None:
            queryset = queryset.filter(organization=organization)
        return queryset

    def _summary(self, queryset):
        total = queryset.count()
        attended = queryset.filter(status__in=["PRESENT", "LATE", "EXCUSED"]).count()
        return {"total": total, "attended": attended, "absent": queryset.filter(status="ABSENT").count(), "percentage": round((attended / total) * 100, 2) if total else 0}

    def get_daily_report(self, date, subject_id=None, organization=None):
        queryset = self._records(organization).filter(session__date=date)
        if subject_id:
            queryset = queryset.filter(session__subject_id=subject_id)
        return {"report_type": "Daily", "date": date, "summary": self._summary(queryset)}

    def get_weekly_report(self, start_date, end_date, organization=None):
        queryset = self._records(organization).filter(session__date__range=[start_date, end_date])
        return {"report_type": "Weekly", "start_date": start_date, "end_date": end_date, "summary": self._summary(queryset)}

    def get_monthly_report(self, month, year, organization=None):
        queryset = self._records(organization).filter(session__date__month=int(month), session__date__year=int(year))
        return {"report_type": "Monthly", "month": month, "year": year, "summary": self._summary(queryset)}

    def get_semester_report(self, semester, department=None, organization=None):
        queryset = self._records(organization).filter(session__semester_id=semester)
        if department:
            queryset = queryset.filter(session__department_id=department)
        return {"report_type": "Semester", "summary": self._summary(queryset)}

    def get_department_report(self, organization=None):
        rows = list(
            self._records(organization)
            .values("session__department__name")
            .annotate(total=Count("id"), attended=Count("id", filter=Q(status__in=["PRESENT", "LATE", "EXCUSED"])))
        )
        return {"report_type": "Department-Wise", "data": rows}

    def get_faculty_report(self, faculty_id, organization=None):
        rows = list(
            self._records(organization)
            .filter(session__subject__assigned_faculty_id=faculty_id)
            .values("session__subject__subject_code", "session__subject__name")
            .annotate(total=Count("id"), attended=Count("id", filter=Q(status__in=["PRESENT", "LATE", "EXCUSED"])))
        )
        return {"report_type": "Faculty", "subjects": rows}

    def get_defaulters_report(self, threshold=75.0, organization=None):
        defaulters = self.report_repository.get_defaulters(threshold, organization)
        return {"threshold": threshold, "count": len(defaulters), "defaulters": defaulters}

    def get_student_report(self, student_id, organization=None):
        student = Student.objects.filter(id=student_id).first()
        if student is None:
            student = Student.objects.filter(roll_no=student_id).first()
        if student is None:
            raise ValidationError({"error": f"Student '{student_id}' not found."})
        queryset = self._records(organization or student.organization).filter(student=student)
        return {"report_type": "Student-Wise", "student": {"id": str(student.id), "roll_no": student.roll_no, "name": student.name}, "summary": self._summary(queryset)}

    def get_subject_report(self, subject_code, organization=None):
        subject = Subject.objects.filter(subject_code=subject_code).first()
        if subject is None:
            raise ValidationError({"error": f"Subject '{subject_code}' not found."})
        queryset = self._records(organization or subject.organization).filter(session__subject=subject)
        return {"report_type": "Subject", "subject": {"code": subject.subject_code, "name": subject.name}, "summary": self._summary(queryset)}

    def generate_csv_report(self, report_type, data):
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Report Type", report_type])
        for key, value in data.get("summary", data).items():
            writer.writerow([key, value])
        return output.getvalue()

    def generate_excel_report(self, report_type, data):
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = f"{report_type.title()} Report"
        sheet.append(["HexaAttender", f"{report_type.title()} Report"])
        sheet.append(["Generated", datetime.datetime.now().isoformat(timespec="seconds")])
        for key, value in data.get("summary", data).items():
            sheet.append([key, value])
        output = io.BytesIO()
        workbook.save(output)
        return output.getvalue()

    def generate_pdf_report(self, report_type, data):
        output = io.BytesIO()
        pdf = canvas.Canvas(output, pagesize=letter)
        pdf.drawString(72, 750, f"HexaAttender {report_type.title()} Report")
        y = 720
        for key, value in data.get("summary", data).items():
            pdf.drawString(72, y, f"{key}: {value}")
            y -= 20
        pdf.save()
        return output.getvalue()

    def get_analytics_trends(self, organization=None):
        rows = list(
            self._records(organization)
            .values("session__date")
            .annotate(total=Count("id"), attended=Count("id", filter=Q(status__in=["PRESENT", "LATE", "EXCUSED"])))
            .order_by("session__date")
        )
        return {"trends": rows}

    def get_analytics_alerts(self, organization=None):
        return self.get_defaulters_report(75, organization)

    def get_analytics_departments(self, organization=None):
        return self.get_department_report(organization)

    def get_analytics_subjects(self, organization=None):
        rows = list(
            self._records(organization)
            .values("session__subject__subject_code", "session__subject__name")
            .annotate(total=Count("id"), attended=Count("id", filter=Q(status__in=["PRESENT", "LATE", "EXCUSED"])))
        )
        return {"subjects": rows}

    def get_analytics_heatmap(self, organization=None):
        rows = list(self._records(organization).values("session__date", "session__hour").annotate(absent=Count("id", filter=Q(status="ABSENT"))))
        return {"heatmap": rows}
