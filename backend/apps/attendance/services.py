from django.db import transaction
from django.db.models import Count
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.attendance.models import AttendanceCorrection, AttendanceRecord, AttendanceSession
from apps.core.services import BaseService
from apps.students.models import Student
from apps.subjects.models import Subject


class AttendanceService(BaseService):
    def _get_subject(self, subject_id, organization):
        subject = Subject.objects.filter(organization=organization).filter(id=subject_id).first()
        if subject is None:
            subject = Subject.objects.filter(organization=organization, subject_code=subject_id).first()
        if subject is None:
            raise ValidationError({"error": f"Subject '{subject_id}' not found."})
        return subject

    def _get_or_create_session(self, date, hour, subject, user):
        return AttendanceSession.objects.get_or_create(
            organization=subject.organization,
            date=date,
            hour=hour,
            subject=subject,
            defaults={
                "branch": subject.department.branch,
                "department": subject.department,
                "semester": subject.semester,
                "session_status": AttendanceSession.SessionStatus.OPEN,
                "opened_by": user,
                "created_by": user,
                "updated_by": user,
            },
        )

    def save_automatic_attendance(self, date, hour, subject_id, entries, user):
        subject = self._get_subject(subject_id, user.active_organization)
        session, created = self._get_or_create_session(date, hour, subject, user)
        if session.is_locked:
            raise ValidationError({"error": f"This session is {session.session_status} and cannot be modified."})
        return self._upsert_records(session, entries, user, AttendanceRecord.CaptureMethodChoices.FACE_RECOGNITION)

    def save_manual_attendance(self, date, hour, subject_id, entries, user):
        subject = self._get_subject(subject_id, user.active_organization)
        session, created = self._get_or_create_session(date, hour, subject, user)
        if session.is_locked:
            raise ValidationError({"error": f"This session is {session.session_status} and cannot be modified."})
        result = self._upsert_records(session, entries, user, AttendanceRecord.CaptureMethodChoices.MANUAL)
        result["session_created"] = created
        return result

    def _upsert_records(self, session, entries, user, method):
        inserted = 0
        updated = 0
        skipped_duplicates = 0
        errors = []
        seen = set()
        with transaction.atomic():
            for entry in entries:
                student_ref = entry.get("student") or entry.get("student_id") or entry.get("roll_no")
                if student_ref in seen:
                    skipped_duplicates += 1
                    continue
                seen.add(student_ref)
                student = Student.objects.filter(organization=session.organization).filter(id=student_ref).first()
                if student is None:
                    student = Student.objects.filter(organization=session.organization, roll_no=student_ref).first()
                if student is None:
                    errors.append(f"Student {student_ref} not found.")
                    continue
                overlap = AttendanceRecord.objects.filter(
                    organization=session.organization,
                    session__date=session.date,
                    session__hour=session.hour,
                    student=student,
                ).exclude(session=session).first()
                if overlap:
                    errors.append(f"Student {student.roll_no} already has attendance for this slot.")
                    continue
                record, created = AttendanceRecord.objects.update_or_create(
                    organization=session.organization,
                    session=session,
                    student=student,
                    defaults={
                        "status": entry["status"],
                        "capture_method": method,
                        "confidence_score": entry.get("confidence_score"),
                        "captured_at": timezone.now(),
                        "updated_by": user,
                    },
                )
                if created:
                    record.created_by = user
                    record.save(update_fields=["created_by"])
                    inserted += 1
                else:
                    updated += 1
        return {
            "session_id": session.id,
            "session_created": False,
            "inserted": inserted,
            "updated": updated,
            "skipped_duplicates": skipped_duplicates,
            "errors": errors,
        }

    def correct_attendance_record(self, record_id, new_status, correction_notes, user):
        record = AttendanceRecord.objects.filter(organization=user.active_organization, id=record_id).first()
        if record is None:
            raise ValidationError({"error": f"Attendance record '{record_id}' not found."})
        if record.session.session_status == AttendanceSession.SessionStatus.LOCKED:
            raise ValidationError({"error": "This session is locked and finalized."})
        old_status = record.status
        with transaction.atomic():
            AttendanceCorrection.objects.create(
                record=record,
                original_status=old_status,
                new_status=new_status,
                correction_note=correction_notes,
                user=user,
                created_by=user,
                updated_by=user,
            )
            record.original_status = old_status
            record.status = new_status
            record.correction_notes = correction_notes
            record.corrected_at = timezone.now()
            record.updated_by = user
            record.save()
        return {
            "record_id": record.id,
            "previous_status": old_status,
            "new_status": new_status,
            "correction_notes": correction_notes,
            "corrected_at": str(record.corrected_at),
            "corrected_by": user.email,
        }

    def validate_attendance_session(self, session_id):
        session = AttendanceSession.objects.get(id=session_id)
        records = session.records.select_related("student")
        recorded = set(records.values_list("student_id", flat=True))
        expected = set(Student.objects.filter(organization=session.organization, semester=session.semester, is_active=True).values_list("id", flat=True))
        missing = list(expected - recorded)
        duplicates = records.values("student").annotate(count=Count("id")).filter(count__gt=1)
        return {
            "session_id": session.id,
            "date": str(session.date),
            "hour": session.hour,
            "subject": session.subject.subject_code,
            "session_status": session.session_status,
            "validation": {
                "is_valid": not missing and not duplicates.exists(),
                "total_class_strength": len(expected),
                "total_records": records.count(),
                "present": records.filter(status="PRESENT").count(),
                "absent": records.filter(status="ABSENT").count(),
                "late": records.filter(status="LATE").count(),
                "excused": records.filter(status="EXCUSED").count(),
                "missing_students": [str(item) for item in missing[:20]],
                "missing_count": len(missing),
                "duplicate_entries": list(duplicates.values_list("student_id", flat=True)),
                "attendance_percentage": session.attendance_percentage,
            },
        }

    def submit_session(self, session_id, user):
        return self._transition(session_id, user, [AttendanceSession.SessionStatus.OPEN, AttendanceSession.SessionStatus.REJECTED], AttendanceSession.SessionStatus.SUBMITTED)

    def approve_session(self, session_id, user):
        return self._transition(session_id, user, [AttendanceSession.SessionStatus.SUBMITTED], AttendanceSession.SessionStatus.APPROVED)

    def reject_session(self, session_id, user):
        return self._transition(session_id, user, [AttendanceSession.SessionStatus.SUBMITTED], AttendanceSession.SessionStatus.REJECTED)

    def lock_session(self, session_id, user):
        return self._transition(session_id, user, [AttendanceSession.SessionStatus.APPROVED], AttendanceSession.SessionStatus.LOCKED)

    def unlock_session(self, session_id, user):
        return self._transition(session_id, user, [AttendanceSession.SessionStatus.LOCKED], AttendanceSession.SessionStatus.APPROVED)

    def _transition(self, session_id, user, allowed, target):
        session = AttendanceSession.objects.filter(organization=user.active_organization, id=session_id).first()
        if session is None:
            raise ValidationError({"error": f"Session '{session_id}' not found."})
        if session.session_status not in allowed:
            raise ValidationError({"error": f"Cannot transition {session.session_status} to {target}."})
        session.session_status = target
        session.updated_by = user
        if target == AttendanceSession.SessionStatus.SUBMITTED:
            session.submitted_at = timezone.now()
        if target == AttendanceSession.SessionStatus.APPROVED:
            session.approved_at = timezone.now()
        session.save()
        return session
