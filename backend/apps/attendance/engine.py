"""
Central attendance engine: session lifecycle helpers, roster checks, and record upserts.
"""
from django.db import IntegrityError, models
from django.utils.dateparse import parse_date
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.attendance.models import AttendanceCorrection, AttendanceRecord, AttendanceSession
from apps.core.faculty_scoping import enforce_faculty_subject_access
from apps.core.hod_scoping import enforce_hod_department_access
from apps.students.models import Student
from apps.subjects.models import Subject
from apps.timetable.models import Timetable


VALID_STATUSES = {choice[0] for choice in AttendanceRecord.StatusChoices.choices}
FACE_SIMILARITY_THRESHOLD = 0.65
HOUR_TO_PERIOD = {
    "I": 1,
    "II": 2,
    "III": 3,
    "IV": 4,
    "V": 5,
    "VI": 6,
    "VII": 7,
}


def normalize_session_date(value):
    if not value:
        return timezone.localdate()
    if hasattr(value, "strftime"):
        return value
    parsed = parse_date(str(value))
    if not parsed:
        raise ValidationError({"date": "Invalid date. Use YYYY-MM-DD."})
    return parsed


def session_is_writable(session: AttendanceSession) -> bool:
    return session.session_status in (
        AttendanceSession.SessionStatus.OPEN,
        AttendanceSession.SessionStatus.REJECTED,
    )


def get_roster_students(session: AttendanceSession):
    """Active students in the session cohort (department + course + semester)."""
    course = session.subject.course_id
    return Student.objects.filter(
        organization=session.organization,
        department=session.department,
        course_id=course,
        semester=session.semester,
        is_active=True,
        is_deleted=False,
    ).order_by("roll_no")


def check_cross_subject_conflict(session: AttendanceSession, student: Student):
    """Block same date/hour attendance in a different subject."""
    conflict = (
        AttendanceRecord.objects.filter(
            organization=session.organization,
            session__date=session.date,
            session__hour=session.hour,
            student=student,
            is_deleted=False,
        )
        .exclude(session=session)
        .select_related("session__subject")
        .first()
    )
    if conflict:
        other_code = conflict.session.subject.subject_code
        raise ValidationError(
            {
                "detail": f"Student {student.roll_no} already has attendance for period {session.hour} in {other_code}.",
                "code": "cross_subject_conflict",
                "roll_no": student.roll_no,
                "other_subject": other_code,
            }
        )


def enforce_session_actor_access(session: AttendanceSession, user):
    enforce_hod_department_access(user, session.department)
    enforce_faculty_subject_access(user, session.subject)


def resolve_timetable_for_session(session: AttendanceSession):
    day = session.date.strftime("%A").upper()
    period = HOUR_TO_PERIOD.get(session.hour)
    if not period:
        return None
    return (
        Timetable.objects.filter(
            organization=session.organization,
            branch=session.branch,
            department=session.department,
            course=session.subject.course,
            semester=session.semester,
            subject=session.subject,
            day=day,
            period=period,
            is_active=True,
            is_deleted=False,
        )
        .select_related("faculty", "subject")
        .first()
    )


def resolve_timetable_for_values(*, organization, branch, department, course, semester, subject, date, hour):
    day = date.strftime("%A").upper()
    period = HOUR_TO_PERIOD.get(hour)
    if not period:
        return None
    return (
        Timetable.objects.filter(
            organization=organization,
            branch=branch,
            department=department,
            course=course,
            semester=semester,
            subject=subject,
            day=day,
            period=period,
            is_active=True,
            is_deleted=False,
        )
        .select_related("faculty", "subject")
        .first()
    )


def enforce_session_timetable(session: AttendanceSession, user=None):
    timetable = session.timetable or resolve_timetable_for_session(session)
    if not timetable:
        raise ValidationError(
            {
                "detail": "Attendance is allowed only during a scheduled timetable period.",
                "code": "outside_timetable",
            }
        )
    if session.timetable_id != timetable.id:
        session.timetable = timetable
        session.save(update_fields=["timetable", "updated_at"])
    if user:
        enforce_faculty_subject_access(user, timetable.subject)
    return timetable


def enforce_session_current_time(session: AttendanceSession):
    timetable = session.timetable or resolve_timetable_for_session(session)
    if not timetable:
        raise ValidationError(
            {
                "detail": "Attendance is allowed only during a scheduled timetable period.",
                "code": "outside_timetable",
            }
        )
    now = timezone.localtime()
    if session.date != now.date() or not (timetable.starts_at <= now.time() <= timetable.ends_at):
        raise ValidationError(
            {
                "detail": "Attendance can be marked only during the selected timetable slot.",
                "code": "outside_timetable_time",
                "slot": {
                    "date": session.date.isoformat(),
                    "starts_at": timetable.starts_at.isoformat(),
                    "ends_at": timetable.ends_at.isoformat(),
                },
            }
        )
    return timetable


def normalize_similarity(value):
    if value is None:
        return None
    try:
        score = float(value)
    except (TypeError, ValueError):
        return None
    if score > 1:
        score = score / 100.0
    return score


def enforce_face_entry(entry):
    score_value = entry.get("similarity_score")
    if score_value is None:
        score_value = entry.get("confidence_score")
    similarity = normalize_similarity(score_value)
    if similarity is None:
        raise ValidationError(
            {
                "detail": "Face attendance requires a verification similarity score.",
                "code": "face_verification_required",
            }
        )
    if similarity < FACE_SIMILARITY_THRESHOLD:
        raise ValidationError(
            {
                "detail": "Face verification similarity is below the required threshold.",
                "code": "face_similarity_below_threshold",
                "threshold": FACE_SIMILARITY_THRESHOLD,
                "similarity": round(similarity, 4),
            }
        )


def normalize_entries(request, session: AttendanceSession, entries: list) -> list[dict]:
    from apps.attendance.serializers import ManualAttendanceEntrySerializer

    if not entries:
        return []

    organization = request.user.active_organization
    roster_ids = set(get_roster_students(session).values_list("id", flat=True))
    seen_students = set()
    seen_rolls = set()
    normalized = []

    if all("student" in entry for entry in entries):
        serializer = ManualAttendanceEntrySerializer(data=entries, many=True)
        serializer.is_valid(raise_exception=True)
        raw_entries = serializer.validated_data
        for entry, original_entry in zip(raw_entries, entries):
            if "confidence_score" not in entry and "confidence_score" in original_entry:
                entry["confidence_score"] = original_entry.get("confidence_score")
            if "similarity_score" not in entry and "similarity_score" in original_entry:
                entry["similarity_score"] = original_entry.get("similarity_score")
            student = Student.objects.get(id=entry["student"], organization=organization)
            _append_entry(normalized, seen_students, seen_rolls, roster_ids, session, student, entry)
        return normalized

    for entry in entries:
        roll_no = entry.get("roll_no") or entry.get("student_roll")
        if not roll_no:
            raise ValidationError({"detail": "Each entry requires roll_no or student id."})
        if roll_no in seen_rolls:
            continue
        seen_rolls.add(roll_no)
        student = Student.objects.filter(
            organization=session.organization,
            roll_no=roll_no,
            semester=session.semester,
            is_active=True,
            is_deleted=False,
        ).first()
        if not student:
            raise ValidationError({"detail": f"Student roll {roll_no} not found in session roster."})
        payload = {
            "status": entry.get("status", "PRESENT"),
            "confidence_score": entry.get("confidence_score"),
            "similarity_score": entry.get("similarity_score"),
            "override_reason": entry.get("override_reason"),
        }
        _append_entry(normalized, seen_students, seen_rolls, roster_ids, session, student, payload)

    return normalized


def _append_entry(normalized, seen_students, seen_rolls, roster_ids, session, student, entry):
    if student.id in seen_students:
        return
    if student.id not in roster_ids:
        raise ValidationError(
            {
                "detail": f"Student {student.roll_no} is not in the session roster (department/course/semester).",
                "code": "roster_validation",
                "roll_no": student.roll_no,
            }
        )
    status = entry.get("status", "PRESENT")
    if status not in VALID_STATUSES:
        raise ValidationError({"detail": f"Invalid status '{status}'."})
    check_cross_subject_conflict(session, student)
    seen_students.add(student.id)
    seen_rolls.add(student.roll_no)
    normalized.append(
        {
            "student": student,
            "status": status,
            "confidence_score": entry.get("confidence_score"),
            "similarity_score": entry.get("similarity_score"),
            "override_reason": entry.get("override_reason"),
        }
    )


def upsert_records(
    session: AttendanceSession,
    entries: list[dict],
    *,
    user,
    capture_method: str,
    override_reason: str = "",
) -> int:
    if not session_is_writable(session):
        raise ValidationError({"detail": f"Session is {session.session_status} and cannot be modified."})

    enforce_session_actor_access(session, user)
    enforce_session_timetable(session, user)
    upserted = 0
    for entry in entries:
        if capture_method == AttendanceRecord.CaptureMethodChoices.FACE_RECOGNITION:
            enforce_face_entry(entry)
            existing = AttendanceRecord.objects.filter(
                organization=session.organization,
                session=session,
                student=entry["student"],
                is_deleted=False,
            ).first()
            if existing and existing.status in {
                AttendanceRecord.StatusChoices.PRESENT,
                AttendanceRecord.StatusChoices.LATE,
                AttendanceRecord.StatusChoices.EXCUSED,
            }:
                raise ValidationError(
                    {
                        "detail": f"Duplicate face attendance is not allowed for {entry['student'].roll_no}.",
                        "code": "duplicate_attendance",
                        "roll_no": entry["student"].roll_no,
                    }
                )
            if getattr(user, "role", "") == "FACULTY":
                enforce_session_current_time(session)
        metadata = {}
        if override_reason:
            metadata = {
                "manual_override": True,
                "override_reason": override_reason,
                "verified_by_role": getattr(user, "role", ""),
            }
        defaults = {
            "status": entry["status"],
            "capture_method": capture_method,
            "confidence_score": entry.get("confidence_score"),
            "captured_at": timezone.now(),
            "updated_by": user,
            "metadata": metadata,
        }
        if override_reason:
            defaults["correction_notes"] = override_reason

        for _ in range(2):
            try:
                record, created = AttendanceRecord.objects.update_or_create(
                    organization=session.organization,
                    session=session,
                    student=entry["student"],
                    defaults=defaults,
                )
                if created:
                    record.created_by = user
                    record.save(update_fields=["created_by"])
                if entry["status"] == "ABSENT":
                    try:
                        from apps.notifications.tasks import trigger_absent_alert_task

                        trigger_absent_alert_task.delay(str(record.id))
                    except Exception:
                        pass
                upserted += 1
                break
            except IntegrityError:
                continue
        else:
            raise IntegrityError("Unable to upsert attendance record due to concurrent writes.")

    refresh_session_strength(session)
    return upserted


def refresh_session_strength(session: AttendanceSession):
    session.total_students = get_roster_students(session).count()
    session.save(update_fields=["total_students", "updated_at"])


def validate_session(session: AttendanceSession) -> dict:
    students = get_roster_students(session)
    records = AttendanceRecord.objects.filter(
        organization=session.organization,
        session=session,
        is_deleted=False,
    ).select_related("student", "session__subject")

    expected_rolls = set(students.values_list("roll_no", flat=True))
    recorded_rolls = set(records.values_list("student__roll_no", flat=True))
    missing = sorted(expected_rolls - recorded_rolls)

    duplicates = [
        row["student__roll_no"]
        for row in records.values("student__roll_no")
        .annotate(total=models.Count("id"))
        .filter(total__gt=1)
    ]

    cross_subject_conflicts = []
    for record in records:
        other = (
            AttendanceRecord.objects.filter(
                organization=session.organization,
                session__date=session.date,
                session__hour=session.hour,
                student=record.student,
                is_deleted=False,
            )
            .exclude(session=session)
            .select_related("session__subject")
            .first()
        )
        if other:
            cross_subject_conflicts.append(
                {
                    "roll_no": record.student.roll_no,
                    "other_subject": other.session.subject.subject_code,
                }
            )

    roster_invalid = sorted(
        records.exclude(student_id__in=students.values_list("id", flat=True)).values_list(
            "student__roll_no", flat=True
        )
    )

    total_records = records.count()
    attended = records.filter(status__in=["PRESENT", "LATE", "EXCUSED"]).count()

    return {
        "is_valid": not missing and not duplicates and not cross_subject_conflicts and not roster_invalid,
        "total_class_strength": students.count(),
        "total_records": total_records,
        "present": records.filter(status="PRESENT").count(),
        "absent": records.filter(status="ABSENT").count(),
        "late": records.filter(status="LATE").count(),
        "excused": records.filter(status="EXCUSED").count(),
        "missing_count": len(missing),
        "missing_students": missing,
        "duplicate_entries": duplicates,
        "cross_subject_conflicts": cross_subject_conflicts,
        "roster_invalid_students": roster_invalid,
        "corrected_records": records.exclude(corrected_at__isnull=True).count(),
        "attendance_percentage": round((attended / total_records) * 100, 2) if total_records else 0,
    }


def resolve_or_create_session(request) -> AttendanceSession:
    session_id = request.data.get("session_id")
    if session_id:
        try:
            return AttendanceSession.objects.get(id=session_id, organization=request.user.active_organization)
        except AttendanceSession.DoesNotExist:
            raise ValidationError({"session_id": "Attendance session not found."})

    subject_value = request.data.get("subject_id") or request.data.get("subject")
    if not subject_value:
        raise ValidationError({"subject_id": "subject_id is required."})
    subject_filter = models.Q(subject_code=subject_value)
    if isinstance(subject_value, str) and len(subject_value) == 36 and subject_value.count("-") == 4:
        subject_filter |= models.Q(id=subject_value)
    try:
        subject = Subject.objects.select_related("department", "department__branch", "semester", "course").get(
            subject_filter,
            organization=request.user.active_organization,
        )
    except Subject.DoesNotExist:
        raise ValidationError({"subject_id": f"Subject with code or ID '{subject_value}' does not exist."})
    date_value = normalize_session_date(request.data.get("date"))
    hour_value = request.data.get("hour") or "I"
    branch = request.user.active_branch or subject.department.branch
    timetable = resolve_timetable_for_values(
        organization=request.user.active_organization,
        branch=branch,
        department=subject.department,
        course=subject.course,
        semester=subject.semester,
        subject=subject,
        date=date_value,
        hour=hour_value,
    )
    if not timetable:
        raise ValidationError(
            {
                "detail": "Attendance is allowed only during a scheduled timetable period.",
                "code": "outside_timetable",
            }
        )
    for _ in range(2):
        try:
            session, _ = AttendanceSession.objects.get_or_create(
                organization=request.user.active_organization,
                date=date_value,
                hour=hour_value,
                subject=subject,
                defaults={
                    "branch": branch,
                    "department": subject.department,
                    "semester": subject.semester,
                    "timetable": timetable,
                    "session_status": AttendanceSession.SessionStatus.OPEN,
                    "opened_by": request.user,
                    "created_by": request.user,
                    "updated_by": request.user,
                },
            )
            enforce_session_actor_access(session, request.user)
            enforce_session_timetable(session, request.user)
            refresh_session_strength(session)
            return session
        except IntegrityError:
            continue
    raise IntegrityError("Unable to create attendance session due to concurrent writes.")


def create_session_from_payload(request) -> AttendanceSession:
    """Explicit session creation (Create Session)."""
    subject_value = request.data.get("subject_id") or request.data.get("subject")
    if not subject_value:
        raise ValidationError({"detail": "subject_id is required."})
    subject_filter = models.Q(subject_code=subject_value)
    if isinstance(subject_value, str) and len(subject_value) == 36 and subject_value.count("-") == 4:
        subject_filter |= models.Q(id=subject_value)
    try:
        subject = Subject.objects.select_related("department", "department__branch", "semester", "course").get(
            subject_filter,
            organization=request.user.active_organization,
        )
    except Subject.DoesNotExist:
        raise ValidationError({"subject_id": f"Subject with code or ID '{subject_value}' does not exist."})
    date_value = normalize_session_date(request.data.get("date"))
    hour_value = request.data.get("hour") or "I"
    branch = request.user.active_branch or subject.department.branch
    timetable = resolve_timetable_for_values(
        organization=request.user.active_organization,
        branch=branch,
        department=subject.department,
        course=subject.course,
        semester=subject.semester,
        subject=subject,
        date=date_value,
        hour=hour_value,
    )
    if not timetable:
        raise ValidationError(
            {
                "detail": "Attendance is allowed only during a scheduled timetable period.",
                "code": "outside_timetable",
            }
        )
    try:
        session = AttendanceSession.objects.create(
            organization=request.user.active_organization,
            date=date_value,
            hour=hour_value,
            subject=subject,
            branch=branch,
            department=subject.department,
            semester=subject.semester,
            timetable=timetable,
            session_status=AttendanceSession.SessionStatus.OPEN,
            opened_by=request.user,
            created_by=request.user,
            updated_by=request.user,
        )
    except IntegrityError as exc:
        raise ValidationError(
            {"detail": "A session already exists for this date, hour, and subject."}
        ) from exc
    enforce_session_actor_access(session, request.user)
    enforce_session_timetable(session, request.user)
    refresh_session_strength(session)
    return session
