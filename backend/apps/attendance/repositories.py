from django.core.exceptions import ObjectDoesNotExist
from apps.core.repositories import BaseRepository
from apps.attendance.models import AttendanceSession, AttendanceRecord

class AttendanceSessionRepository(BaseRepository):
    """
    Data operations repository layer for the AttendanceSession model.
    """
    model = AttendanceSession

    def get_by_date_hour_subject(self, date, hour, subject):
        """Safely retrieve a unique attendance session."""
        try:
            return self.model.objects.get(date=date, hour=hour, subject=subject)
        except ObjectDoesNotExist:
            return None

    def get_or_create_session(self, date, hour, subject, defaults=None):
        """Transactionally retrieve or create a new attendance session."""
        return self.model.objects.get_or_create(
            date=date,
            hour=hour,
            subject=subject,
            defaults=defaults
        )


class AttendanceRecordRepository(BaseRepository):
    """
    Data operations repository layer for the AttendanceRecord model.
    """
    model = AttendanceRecord

    def get_by_session_and_student(self, session, student):
        """Safely retrieve an attendance record for a student in a specific session."""
        try:
            return self.model.objects.get(session=session, student=student)
        except ObjectDoesNotExist:
            return None
