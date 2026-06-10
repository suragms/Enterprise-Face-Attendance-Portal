from django.db.models import Count, Q

from apps.attendance.models import AttendanceRecord
from apps.core.repositories import BaseRepository
from apps.students.models import Student


class ReportRepository(BaseRepository):
    model = AttendanceRecord

    def get_student_overall_percentage(self, student_id, organization=None):
        queryset = self.model.objects.filter(student_id=student_id)
        if organization is not None:
            queryset = queryset.filter(organization=organization)
        result = queryset.aggregate(
            total=Count("id"),
            attended=Count("id", filter=Q(status__in=["PRESENT", "LATE", "EXCUSED"])),
        )
        total = result["total"] or 0
        return 100.0 if total == 0 else round(((result["attended"] or 0) / total) * 100, 2)

    def get_defaulters(self, threshold=75.0, organization=None):
        students = Student.objects.filter(is_active=True)
        if organization is not None:
            students = students.filter(organization=organization)
        students = students.annotate(
            total_classes=Count("attendance_records"),
            attended=Count("attendance_records", filter=Q(attendance_records__status__in=["PRESENT", "LATE", "EXCUSED"])),
            missed=Count("attendance_records", filter=Q(attendance_records__status="ABSENT")),
        )
        rows = []
        for student in students:
            pct = 100.0 if student.total_classes == 0 else round((student.attended / student.total_classes) * 100, 2)
            if pct < threshold:
                rows.append({
                    "student_id": str(student.id),
                    "roll_no": student.roll_no,
                    "name": student.name,
                    "department": student.department.name,
                    "semester": student.semester.number,
                    "attendance_percentage": pct,
                    "classes_missed": student.missed,
                    "classes_total": student.total_classes,
                    "contact_number": student.phone,
                    "email": student.email,
                })
        return rows
