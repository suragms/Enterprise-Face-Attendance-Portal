import pytest
from rest_framework.test import APIClient

from apps.attendance.models import AttendanceRecord, AttendanceSession


@pytest.mark.django_db
def test_create_and_open_session(faculty_user, subject_instance):
    client = APIClient()
    client.force_authenticate(faculty_user)

    create = client.post(
        "/api/v1/attendance/sessions/create-session/",
        {
            "date": "2026-06-10",
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
            "date": "2026-06-10",
            "hour": "II",
            "subject_id": str(subject_instance.id),
        },
        format="json",
    )
    assert duplicate.status_code == 400


@pytest.mark.django_db
def test_manual_automatic_system_capture_methods(
    faculty_user, subject_instance, student_instance
):
    client = APIClient()
    client.force_authenticate(faculty_user)
    session = AttendanceSession.objects.create(
        organization=subject_instance.organization,
        branch=student_instance.branch,
        department=student_instance.department,
        semester=student_instance.semester,
        subject=subject_instance,
        date="2026-06-11",
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
            "entries": [{"student": str(student_instance.id), "status": "LATE"}],
        },
        format="json",
    )
    assert auto.status_code == 201
    assert AttendanceRecord.objects.get(session=session).capture_method == "FACE_RECOGNITION"

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
    faculty_user, subject_instance, student_instance, organization, department, course, semester
):
    from apps.subjects.models import Subject

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
        date="2026-06-12",
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
        date="2026-06-12",
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
    faculty_user, hod_user, subject_instance, student_instance
):
    client = APIClient()
    session = AttendanceSession.objects.create(
        organization=subject_instance.organization,
        branch=student_instance.branch,
        department=student_instance.department,
        semester=student_instance.semester,
        subject=subject_instance,
        date="2026-06-13",
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
def test_reject_and_reopen_workflow(hod_user, faculty_user, subject_instance, student_instance):
    session = AttendanceSession.objects.create(
        organization=subject_instance.organization,
        branch=student_instance.branch,
        department=student_instance.department,
        semester=student_instance.semester,
        subject=subject_instance,
        date="2026-06-14",
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
