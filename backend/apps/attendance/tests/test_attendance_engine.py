import pytest
from rest_framework.test import APIClient

from apps.attendance.models import AttendanceRecord, AttendanceSession
from apps.timetable.models import Timetable


HOUR_TO_PERIOD = {
    "I": 1,
    "II": 2,
    "III": 3,
    "IV": 4,
    "V": 5,
    "VI": 6,
    "VII": 7,
}


def ensure_timetable(date_value, hour, subject, faculty_profile, student_instance):
    return Timetable.objects.create(
        organization=subject.organization,
        branch=student_instance.branch,
        department=student_instance.department,
        course=student_instance.course,
        semester=student_instance.semester,
        day=date_value.strftime("%A").upper(),
        period=HOUR_TO_PERIOD[hour],
        starts_at="09:30",
        ends_at="10:30",
        subject=subject,
        faculty=faculty_profile,
    )


@pytest.mark.django_db
def test_create_and_open_session(faculty_user, subject_instance, faculty_profile, student_instance):
    import datetime

    date_value = datetime.date(2026, 6, 10)
    ensure_timetable(date_value, "II", subject_instance, faculty_profile, student_instance)
    client = APIClient()
    client.force_authenticate(faculty_user)

    create = client.post(
        "/api/v1/attendance/sessions/create-session/",
        {
            "date": date_value.isoformat(),
            "hour": "II",
            "subject_id": str(subject_instance.id),
        },
        format="json",
    )
    assert create.status_code == 201
    session_id = create.json()["id"]
    assert create.json()["session_status"] == "OPEN"

    duplicate = client.post(
        "/api/v1/attendance/sessions/create-session/",
        {
            "date": date_value.isoformat(),
            "hour": "II",
            "subject_id": str(subject_instance.id),
        },
        format="json",
    )
    assert duplicate.status_code == 400


@pytest.mark.django_db
def test_manual_automatic_system_capture_methods(
    faculty_user, subject_instance, student_instance, faculty_profile
):
    import datetime

    date_value = datetime.date(2026, 6, 11)
    timetable = ensure_timetable(date_value, "III", subject_instance, faculty_profile, student_instance)
    client = APIClient()
    client.force_authenticate(faculty_user)
    session = AttendanceSession.objects.create(
        organization=subject_instance.organization,
        branch=student_instance.branch,
        department=student_instance.department,
        semester=student_instance.semester,
        subject=subject_instance,
        timetable=timetable,
        date=date_value,
        hour="III",
        opened_by=faculty_user,
        created_by=faculty_user,
        updated_by=faculty_user,
    )

    manual = client.post(
        "/api/v1/attendance/engine/manual/",
        {
            "session_id": str(session.id),
            "override_reason": "Class verification",
            "entries": [{"student": str(student_instance.id), "status": "PRESENT"}],
        },
        format="json",
    )
    assert manual.status_code == 201
    assert AttendanceRecord.objects.get(session=session).capture_method == "MANUAL"

    auto = client.post(
        "/api/v1/attendance/engine/automatic/",
        {
            "session_id": str(session.id),
            "entries": [{"student": str(student_instance.id), "status": "LATE", "confidence_score": 0.92}],
        },
        format="json",
    )
    assert auto.status_code == 400
    assert "duplicate" in str(auto.json()).lower()

    system = client.post(
        "/api/v1/attendance/engine/system/",
        {
            "session_id": str(session.id),
            "entries": [{"student": str(student_instance.id), "status": "EXCUSED"}],
        },
        format="json",
    )
    assert system.status_code == 201
    assert AttendanceRecord.objects.get(session=session).capture_method == "SYSTEM"


@pytest.mark.django_db
def test_cross_subject_validation_blocks_duplicate_slot(
    faculty_user, subject_instance, student_instance, organization, department, course, semester, faculty_profile
):
    import datetime
    from apps.subjects.models import Subject

    date_value = datetime.date(2026, 6, 12)
    timetable = ensure_timetable(date_value, "IV", subject_instance, faculty_profile, student_instance)
    other_subject = Subject.objects.create(
        organization=organization,
        department=department,
        course=course,
        semester=semester,
        subject_code="CSE202",
        name="Data Structures",
        credits=4,
    )
    session_a = AttendanceSession.objects.create(
        organization=organization,
        branch=student_instance.branch,
        department=department,
        semester=semester,
        subject=subject_instance,
        timetable=timetable,
        date=date_value,
        hour="IV",
        opened_by=faculty_user,
        created_by=faculty_user,
        updated_by=faculty_user,
    )
    AttendanceRecord.objects.create(
        organization=organization,
        session=session_a,
        student=student_instance,
        status="PRESENT",
        capture_method="MANUAL",
        created_by=faculty_user,
        updated_by=faculty_user,
    )
    session_b = AttendanceSession.objects.create(
        organization=organization,
        branch=student_instance.branch,
        department=department,
        semester=semester,
        subject=other_subject,
        date=date_value,
        hour="IV",
        opened_by=faculty_user,
        created_by=faculty_user,
        updated_by=faculty_user,
    )

    client = APIClient()
    client.force_authenticate(faculty_user)
    response = client.post(
        "/api/v1/attendance/engine/manual/",
        {
            "session_id": str(session_b.id),
            "override_reason": "Attempt duplicate slot",
            "entries": [{"student": str(student_instance.id), "status": "PRESENT"}],
        },
        format="json",
    )
    assert response.status_code == 400
    assert "cross" in str(response.json()).lower() or "already" in str(response.json()).lower()


@pytest.mark.django_db
def test_session_workflow_submit_approve_lock(
    faculty_user, hod_user, subject_instance, student_instance, faculty_profile
):
    import datetime

    date_value = datetime.date(2026, 6, 13)
    timetable = ensure_timetable(date_value, "V", subject_instance, faculty_profile, student_instance)
    client = APIClient()
    session = AttendanceSession.objects.create(
        organization=subject_instance.organization,
        branch=student_instance.branch,
        department=student_instance.department,
        semester=student_instance.semester,
        subject=subject_instance,
        timetable=timetable,
        date=date_value,
        hour="V",
        opened_by=faculty_user,
        created_by=faculty_user,
        updated_by=faculty_user,
    )
    AttendanceRecord.objects.create(
        organization=session.organization,
        session=session,
        student=student_instance,
        status="PRESENT",
        capture_method="MANUAL",
        created_by=faculty_user,
        updated_by=faculty_user,
    )

    client.force_authenticate(faculty_user)
    submit = client.post(f"/api/v1/attendance/sessions/{session.id}/submit/")
    assert submit.status_code == 200
    session.refresh_from_db()
    assert session.session_status == "SUBMITTED"

    client.force_authenticate(hod_user)
    approve = client.post(f"/api/v1/attendance/sessions/{session.id}/approve/")
    assert approve.status_code == 200
    lock = client.post(f"/api/v1/attendance/sessions/{session.id}/lock/")
    assert lock.status_code == 200
    session.refresh_from_db()
    assert session.session_status == "LOCKED"


@pytest.mark.django_db
def test_reject_and_reopen_workflow(hod_user, faculty_user, subject_instance, student_instance, faculty_profile):
    import datetime

    date_value = datetime.date(2026, 6, 15)
    timetable = ensure_timetable(date_value, "VI", subject_instance, faculty_profile, student_instance)
    session = AttendanceSession.objects.create(
        organization=subject_instance.organization,
        branch=student_instance.branch,
        department=student_instance.department,
        semester=student_instance.semester,
        subject=subject_instance,
        timetable=timetable,
        date=date_value,
        hour="VI",
        session_status="SUBMITTED",
        opened_by=faculty_user,
        created_by=faculty_user,
        updated_by=faculty_user,
    )
    AttendanceRecord.objects.create(
        organization=session.organization,
        session=session,
        student=student_instance,
        status="PRESENT",
        capture_method="MANUAL",
        created_by=faculty_user,
        updated_by=faculty_user,
    )

    client = APIClient()
    client.force_authenticate(hod_user)
    reject = client.post(f"/api/v1/attendance/sessions/{session.id}/reject/")
    assert reject.status_code == 200
    session.refresh_from_db()
    assert session.session_status == "REJECTED"

    client.force_authenticate(faculty_user)
    reopen = client.post(f"/api/v1/attendance/sessions/{session.id}/open/")
    assert reopen.status_code == 200
    session.refresh_from_db()
    assert session.session_status == "OPEN"


@pytest.mark.django_db
def test_attendance_submission_non_existent_subject_raises_validation_error(faculty_user):
    client = APIClient()
    client.force_authenticate(faculty_user)

    response = client.post(
        "/api/v1/attendance/engine/automatic/",
        {
            "subject_id": "non-existent-subject",
            "entries": []
        },
        format="json",
    )
    assert response.status_code == 400
    assert "non-existent-subject" in str(response.json())


@pytest.mark.django_db
def test_face_attendance_rejects_low_similarity(faculty_user, subject_instance, student_instance, faculty_profile):
    import datetime

    date_value = datetime.date(2026, 6, 16)
    timetable = ensure_timetable(date_value, "I", subject_instance, faculty_profile, student_instance)
    session = AttendanceSession.objects.create(
        organization=subject_instance.organization,
        branch=student_instance.branch,
        department=student_instance.department,
        semester=student_instance.semester,
        subject=subject_instance,
        timetable=timetable,
        date=date_value,
        hour="I",
        opened_by=faculty_user,
        created_by=faculty_user,
        updated_by=faculty_user,
    )

    client = APIClient()
    client.force_authenticate(faculty_user)
    response = client.post(
        "/api/v1/attendance/engine/automatic/",
        {
            "session_id": str(session.id),
            "entries": [{"student": str(student_instance.id), "status": "PRESENT", "confidence_score": 0.64}],
        },
        format="json",
    )

    assert response.status_code == 400
    assert "threshold" in str(response.json()).lower()


@pytest.mark.django_db
def test_attendance_rejects_outside_timetable(faculty_user, subject_instance, student_instance):
    client = APIClient()
    client.force_authenticate(faculty_user)

    response = client.post(
        "/api/v1/attendance/engine/automatic/",
        {
            "date": "2026-06-17",
            "hour": "II",
            "subject_id": str(subject_instance.id),
            "entries": [{"student": str(student_instance.id), "status": "PRESENT", "confidence_score": 0.91}],
        },
        format="json",
    )

    assert response.status_code == 400
    assert "timetable" in str(response.json()).lower() or "scheduled" in str(response.json()).lower()


@pytest.mark.django_db
def test_faculty_face_attendance_rejects_outside_current_time(
    faculty_user, subject_instance, student_instance, faculty_profile
):
    from django.utils import timezone

    date_value = timezone.localdate()
    timetable = Timetable.objects.create(
        organization=subject_instance.organization,
        branch=student_instance.branch,
        department=student_instance.department,
        course=student_instance.course,
        semester=student_instance.semester,
        day=date_value.strftime("%A").upper(),
        period=1,
        starts_at="00:00",
        ends_at="00:01",
        subject=subject_instance,
        faculty=faculty_profile,
    )
    session = AttendanceSession.objects.create(
        organization=subject_instance.organization,
        branch=student_instance.branch,
        department=student_instance.department,
        semester=student_instance.semester,
        subject=subject_instance,
        timetable=timetable,
        date=date_value,
        hour="I",
        opened_by=faculty_user,
        created_by=faculty_user,
        updated_by=faculty_user,
    )

    client = APIClient()
    client.force_authenticate(faculty_user)
    response = client.post(
        "/api/v1/attendance/engine/automatic/",
        {
            "session_id": str(session.id),
            "entries": [{"student": str(student_instance.id), "status": "PRESENT", "confidence_score": 0.91}],
        },
        format="json",
    )

    assert response.status_code == 400
    assert response.json()["code"] == "outside_timetable_time"
