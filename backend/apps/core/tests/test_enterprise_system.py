import datetime

import pytest
from django.db import connection
from rest_framework.test import APIClient

from apps.attendance.models import AttendanceRecord, AttendanceSession
from apps.face_recognition.models import FaceEnrollment
from apps.notifications.models import Notification, NotificationTemplate
from apps.organizations.models import Branch, Course, Department, Organization, Semester
from apps.staff.models import Faculty
from apps.students.models import Student
from apps.subjects.models import Subject
from apps.timetable.models import Timetable


@pytest.mark.django_db
def test_soft_delete_and_tenant_isolation(organization, branch):
    other_org = Organization.objects.create(name="Other Institute", slug="other")
    Branch.objects.create(organization=other_org, name="Other Campus", code="OTHER")

    assert Branch.objects.for_organization(organization).count() == 1
    branch.delete()

    assert Branch.objects.filter(id=branch.id).count() == 0
    assert Branch.all_objects.filter(id=branch.id, is_deleted=True).exists()


@pytest.mark.django_db
def test_cookie_jwt_login_and_me_endpoint(admin_user):
    client = APIClient()
    response = client.post(
        "/api/auth/token/",
        {"email": "admin@hexastack.test", "password": "securepassword123"},
        format="json",
    )

    assert response.status_code == 200
    assert "access" not in response.data
    assert "hexaattender_access" in response.cookies
    assert response.data["user"]["role"] == "ORGANIZATION_ADMIN"

    me = client.get("/api/auth/me/")
    assert me.status_code == 200
    assert me.data["username"] == "orgadmin"


@pytest.mark.django_db
def test_organization_branch_department_crud_is_tenant_scoped(super_admin_user, organization, branch):
    client = APIClient()
    client.force_authenticate(super_admin_user)

    response = client.post("/api/departments/", {"branch": str(branch.id), "name": "AI Lab", "code": "AIL"}, format="json")

    assert response.status_code == 201
    assert str(response.data["organization"]) == str(organization.id)
    assert Department.objects.filter(organization=organization, code="AIL").exists()


@pytest.mark.django_db
def test_timetable_subject_faculty_relationship(admin_user, organization, branch, department, course, semester, subject_instance, faculty_profile):
    entry = Timetable.objects.create(
        organization=organization,
        branch=branch,
        department=department,
        course=course,
        semester=semester,
        day="MONDAY",
        period=1,
        starts_at=datetime.time(9, 0),
        ends_at=datetime.time(10, 0),
        subject=subject_instance,
        faculty=faculty_profile,
        created_by=admin_user,
        updated_by=admin_user,
    )

    assert entry.subject.assigned_faculty == faculty_profile
    assert entry.semester.course == course


@pytest.mark.django_db
def test_faculty_subject_and_day_schedule_api_accept_controlled_natural_keys(admin_user, organization, branch, department, course, semester, faculty_profile):
    client = APIClient()
    client.force_authenticate(admin_user)

    faculty_response = client.post(
        "/api/staff/",
        {
            "staff_code": "FAC-002",
            "name": "Grace Hopper",
            "department": "Computer Science",
            "designation": "Senior Lecturer",
            "email": "grace@hexastack.test",
            "phone": "+919900001111",
            "username": "gracehopper",
            "password": "securepassword123",
            "max_load_credits": 12,
        },
        format="json",
    )
    assert faculty_response.status_code == 201
    assert Faculty.objects.filter(organization=organization, staff_code="FAC-002").exists()

    subject_response = client.post(
        "/api/subjects/",
        {
            "subject_code": "CSE201",
            "name": "Distributed Systems",
            "department": "Computer Science",
            "semester": 1,
            "credits": 4,
            "assigned_staff": "FAC-002",
        },
        format="json",
    )
    assert subject_response.status_code == 201
    created_subject = Subject.objects.get(organization=organization, subject_code="CSE201")
    assert created_subject.course == course
    assert created_subject.semester == semester
    assert created_subject.assigned_faculty.staff_code == "FAC-002"

    assignment_response = client.post(
        "/api/staff/FAC-002/assign-subjects/",
        {"subject_codes": ["CSE201"]},
        format="json",
    )
    assert assignment_response.status_code == 200

    class_assignment_response = client.post(
        "/api/staff/FAC-002/assign-classes/",
        {"classes": [{"course_code": "BTCS", "semester": 1}]},
        format="json",
    )
    assert class_assignment_response.status_code == 200
    assert "CSE201" in class_assignment_response.data["assigned_subject_codes"]

    timetable_response = client.post(
        "/api/timetable/",
        {
            "day": "MONDAY",
            "programme": "Computer Science",
            "semester": 1,
            "period_1": "CSE201",
            "period_2": None,
        },
        format="json",
    )
    assert timetable_response.status_code == 201
    assert Timetable.objects.filter(
        organization=organization,
        department=department,
        semester=semester,
        day="MONDAY",
        period=1,
        subject=created_subject,
    ).exists()


@pytest.mark.django_db
def test_timetable_detect_clashes_reports_faculty_overlap_overload_and_unassigned(admin_user, organization, branch, department, course, semester, academic_year, faculty_profile, subject_instance):
    unassigned_subject = Subject.objects.create(
        organization=organization,
        department=department,
        course=course,
        semester=semester,
        subject_code="CSE404",
        name="Cloud Security",
        credits=3,
    )
    overloaded_subject = Subject.objects.create(
        organization=organization,
        department=department,
        course=course,
        semester=semester,
        subject_code="CSE405",
        name="Distributed Databases",
        credits=20,
        assigned_faculty=faculty_profile,
    )
    faculty_profile.max_load_credits = 4
    faculty_profile.save(update_fields=["max_load_credits"])

    Timetable.objects.create(
        organization=organization,
        branch=branch,
        department=department,
        course=course,
        semester=semester,
        day="TUESDAY",
        period=1,
        starts_at=datetime.time(9, 0),
        ends_at=datetime.time(10, 0),
        subject=subject_instance,
        faculty=faculty_profile,
    )
    other_department = Department.objects.create(organization=organization, branch=branch, name="AI Research", code="AIR")
    other_course = Course.objects.create(organization=organization, department=other_department, name="B.Tech AI Research", code="BTAI")
    other_semester = Semester.objects.create(
        organization=organization,
        course=other_course,
        academic_year=academic_year,
        number=1,
        starts_on=datetime.date(2026, 6, 1),
        ends_on=datetime.date(2026, 11, 30),
    )
    Timetable.objects.create(
        organization=organization,
        branch=branch,
        department=other_department,
        course=other_course,
        semester=other_semester,
        day="TUESDAY",
        period=1,
        starts_at=datetime.time(9, 0),
        ends_at=datetime.time(10, 0),
        subject=overloaded_subject,
        faculty=faculty_profile,
    )

    client = APIClient()
    client.force_authenticate(admin_user)
    response = client.get("/api/timetable/detect-clashes/")

    assert response.status_code == 200
    assert response.data["summary"]["faculty_clashes"] == 1
    assert response.data["summary"]["workload_warnings"] == 1
    assert response.data["summary"]["unassigned_warnings"] == 1
    assert response.data["clashes"]["unassigned_warnings"][0]["subject_code"] == unassigned_subject.subject_code


@pytest.mark.django_db
def test_attendance_manual_engine_workflow(admin_user, organization, branch, department, semester, subject_instance, student_instance):
    timetable = Timetable.objects.create(
        organization=organization,
        branch=branch,
        department=department,
        course=subject_instance.course,
        semester=semester,
        day="MONDAY",
        period=1,
        starts_at=datetime.time(8, 30),
        ends_at=datetime.time(9, 30),
        subject=subject_instance,
        faculty=subject_instance.assigned_faculty,
    )
    session = AttendanceSession.objects.create(
        organization=organization,
        branch=branch,
        department=department,
        semester=semester,
        date=datetime.date(2026, 6, 1),
        hour="I",
        subject=subject_instance,
        timetable=timetable,
        opened_by=admin_user,
    )
    client = APIClient()
    client.force_authenticate(admin_user)

    response = client.post(
        "/api/attendance/engine/manual/",
        {
            "session_id": str(session.id),
            "override_reason": "Verified in class",
            "entries": [{"student": str(student_instance.id), "status": "PRESENT"}],
        },
        format="json",
    )

    assert response.status_code == 201
    record = AttendanceRecord.objects.get(session=session, student=student_instance)
    assert record.status == "PRESENT"
    assert record.capture_method == "MANUAL"

    submit = client.post(f"/api/attendance/sessions/{session.id}/submit/")
    assert submit.status_code == 200
    approve = client.post(f"/api/attendance/sessions/{session.id}/approve/")
    assert approve.status_code == 200
    session.refresh_from_db()
    assert session.session_status == "APPROVED"


@pytest.mark.django_db
def test_attendance_engine_accepts_ui_payloads_validates_and_unlocks(admin_user, subject_instance, student_instance):
    client = APIClient()
    client.force_authenticate(admin_user)
    Timetable.objects.create(
        organization=subject_instance.organization,
        branch=student_instance.branch,
        department=student_instance.department,
        course=student_instance.course,
        semester=student_instance.semester,
        day="TUESDAY",
        period=3,
        starts_at=datetime.time(10, 30),
        ends_at=datetime.time(11, 30),
        subject=subject_instance,
        faculty=subject_instance.assigned_faculty,
    )

    manual = client.post(
        "/api/attendance/engine/manual/",
        {
            "date": "2026-06-02",
            "hour": "III",
            "subject_id": subject_instance.subject_code,
            "override_reason": "Manual roster verification",
            "entries": [{"roll_no": student_instance.roll_no, "status": "LATE"}],
        },
        format="json",
    )
    assert manual.status_code == 201
    session = AttendanceSession.objects.get(date="2026-06-02", hour="III", subject=subject_instance)
    manual_record = AttendanceRecord.objects.get(session=session, student=student_instance)
    assert manual_record.status == "LATE"
    assert manual_record.capture_method == "MANUAL"
    assert session.total_students == 1

    automatic = client.post(
        "/api/attendance/engine/automatic/",
        {
            "date": "2026-06-02",
            "hour": "III",
            "subject_id": subject_instance.subject_code,
            "entries": [{"roll_no": student_instance.roll_no, "status": "PRESENT", "confidence_score": 96.5}],
        },
        format="json",
    )
    assert automatic.status_code == 400
    assert "duplicate" in str(automatic.data).lower()
    manual_record.refresh_from_db()
    assert manual_record.status == "LATE"
    assert manual_record.capture_method == "MANUAL"

    validation = client.post("/api/attendance/engine/validate/", {"session_id": str(session.id)}, format="json")
    assert validation.status_code == 200
    assert validation.data["validation"]["is_valid"] is True
    assert validation.data["validation"]["attendance_percentage"] == 100

    submit = client.post(f"/api/attendance/sessions/{session.id}/submit/")
    assert submit.status_code == 200
    approve = client.post(f"/api/attendance/sessions/{session.id}/approve/")
    assert approve.status_code == 200
    lock = client.post(f"/api/attendance/sessions/{session.id}/lock/")
    assert lock.status_code == 200
    locked_write = client.post(
        "/api/attendance/engine/manual/",
        {
            "date": "2026-06-02",
            "hour": "III",
            "subject_id": subject_instance.subject_code,
            "override_reason": "Should be blocked",
            "entries": [{"roll_no": student_instance.roll_no, "status": "ABSENT"}],
        },
        format="json",
    )
    assert locked_write.status_code == 409

    unlock = client.post(f"/api/attendance/sessions/{session.id}/unlock/")
    assert unlock.status_code == 200
    session.refresh_from_db()
    assert session.session_status == "APPROVED"


@pytest.mark.django_db
def test_face_enrollment_encrypts_embedding(monkeypatch, admin_user, organization):
    from apps.face_recognition.services import FaceRecognitionService

    monkeypatch.setattr(
        FaceRecognitionService,
        "verify_liveness",
        lambda self, image: {"success": True, "liveness": True, "score": 98, "checks": {"laplacian": True}, "details": {"laplacian_variance": 140}},
    )
    monkeypatch.setattr(FaceRecognitionService, "encode_face", lambda self, image: {"success": True, "encoding": [0.12, 0.34], "face_count": 1, "message": "ok"})

    client = APIClient()
    client.force_authenticate(admin_user)
    response = client.post(
        "/api/face-recognition/register/",
        {"user_id": str(admin_user.id), "subject_type": "USER", "image": "data:image/png;base64,ZmFrZQ=="},
        format="json",
    )

    assert response.status_code == 201
    assert response.data["liveness_score"] == 98
    enrollment = FaceEnrollment.objects.get(id=response.data["id"])
    assert enrollment.embedding == [0.12, 0.34]

    with connection.cursor() as cursor:
        cursor.execute("select encrypted_embedding from face_recognition_faceenrollment where id = %s", [enrollment.id.hex])
        raw_value = cursor.fetchone()[0]
    assert raw_value.startswith("gAAAAA")


@pytest.mark.django_db
def test_face_student_registration_verification_and_detection_contract(monkeypatch, admin_user, organization, student_instance):
    from apps.face_recognition.services import FaceRecognitionService

    def fake_liveness(self, image):
        return {
            "success": True,
            "liveness": True,
            "score": 96,
            "checks": {
                "photo_attack_prevented": True,
                "screen_attack_prevented": True,
                "eye_blink_passed": True,
                "pose_validation_passed": True,
            },
            "details": {"laplacian_variance": 122.4, "fft_ratio": 0.31},
        }

    monkeypatch.setattr(FaceRecognitionService, "verify_liveness", fake_liveness)
    monkeypatch.setattr(FaceRecognitionService, "encode_face", lambda self, image: {"success": True, "encoding": [0.2, 0.4, 0.6], "face_count": 1, "message": "ok"})
    monkeypatch.setattr(FaceRecognitionService, "compare_faces", lambda self, known, probe, tolerance=0.68: {"match": True, "distance": 0.05, "confidence": 92.65, "message": "MATCH"})
    monkeypatch.setattr(
        FaceRecognitionService,
        "detect_faces_in_frame",
        lambda self, image: {
            "success": True,
            "face_count": 1,
            "locations": [{"top": 10, "right": 60, "bottom": 70, "left": 20, "width": 40, "height": 60}],
            "message": "detected",
        },
    )

    def fake_identify(self, image, enrolled):
        assert enrolled[0]["roll_no"] == student_instance.roll_no
        assert enrolled[0]["name"] == student_instance.name
        assert enrolled[0]["student_id"] == str(student_instance.id)
        return {
            "success": True,
            "identified": [
                {
                    "roll_no": enrolled[0]["roll_no"],
                    "name": enrolled[0]["name"],
                    "confidence": 94.2,
                    "location": {"top": 10, "right": 60, "bottom": 70, "left": 20},
                }
            ],
            "unidentified_count": 0,
            "total_faces": 1,
            "message": "identified",
        }

    monkeypatch.setattr(FaceRecognitionService, "identify_faces_in_frame", fake_identify)

    client = APIClient()
    client.force_authenticate(admin_user)
    register = client.post(
        "/api/face-recognition/register/",
        {"roll_no": student_instance.roll_no, "image": "data:image/png;base64,ZmFrZQ=="},
        format="json",
    )
    assert register.status_code == 201
    enrollment = FaceEnrollment.objects.get(id=register.data["id"])
    assert enrollment.student == student_instance
    assert enrollment.user == student_instance.user
    assert enrollment.subject_type == FaceEnrollment.SubjectType.STUDENT

    verify = client.post(
        "/api/face-recognition/verify/",
        {"roll_no": student_instance.roll_no, "image": "data:image/png;base64,ZmFrZQ=="},
        format="json",
    )
    assert verify.status_code == 200
    assert verify.data["match"] is True
    assert verify.data["confidence"] == 92.65
    assert verify.data["student_name"] == student_instance.name
    assert verify.data["identity"]["roll_no"] == student_instance.roll_no
    assert verify.data["liveness_checks"]["eye_blink_passed"] is True

    detect = client.post("/api/face-recognition/detect/", {"image": "data:image/png;base64,ZmFrZQ=="}, format="json")
    assert detect.status_code == 200
    assert detect.data["identified"][0]["roll_no"] == student_instance.roll_no
    assert detect.data["identified"][0]["name"] == student_instance.name
    assert detect.data["liveness_score"] == 96
    assert detect.data["identification_success"] is True


@pytest.mark.django_db
def test_reports_analytics_and_notifications(admin_user, organization, branch, department, semester, subject_instance, student_instance):
    session = AttendanceSession.objects.create(
        organization=organization,
        branch=branch,
        department=department,
        semester=semester,
        date=datetime.date(2026, 6, 1),
        hour="II",
        subject=subject_instance,
    )
    AttendanceRecord.objects.create(
        organization=organization,
        session=session,
        student=student_instance,
        status="PRESENT",
        capture_method="MANUAL",
    )

    client = APIClient()
    client.force_authenticate(admin_user)

    daily = client.get("/api/reports/daily/?date=2026-06-01")
    assert daily.status_code == 200
    assert daily.data["summary"]["percentage"] == 100
    assert daily.data["summary"]["overall_percentage"] == 100
    assert daily.data["data"][0]["roll_no"] == student_instance.roll_no
    assert daily.data["data"][0]["periods"]["II"] == "PRESENT"

    weekly = client.get("/api/reports/weekly/?start_date=2026-06-01&end_date=2026-06-07")
    assert weekly.status_code == 200
    assert weekly.data["chart_data"][0]["present"] == 1
    assert weekly.data["data"][0]["summary"]["attendance_percentage"] == 100

    monthly = client.get("/api/reports/monthly/?month=6&year=2026")
    assert monthly.status_code == 200
    assert monthly.data["chart_data"][0]["percentage"] == 100

    semester_report = client.get("/api/reports/semester/?semester=1&department=Computer Science")
    assert semester_report.status_code == 200
    assert semester_report.data["summary"]["eligible"] == 1

    department_report = client.get("/api/reports/department/")
    assert department_report.status_code == 200
    assert department_report.data["data"][0]["avg_attendance"] == 100

    faculty_report = client.get("/api/reports/faculty/?staff_code=FAC-001")
    assert faculty_report.status_code == 200
    assert faculty_report.data["overall_attendance"] == 100
    assert faculty_report.data["subjects"][0]["code"] == subject_instance.subject_code

    student_report = client.get(f"/api/reports/student/?roll_no={student_instance.roll_no}")
    assert student_report.status_code == 200
    assert student_report.data["student"]["overall_attendance"] == 100
    assert student_report.data["subjects"][0]["code"] == subject_instance.subject_code

    subject_report = client.get(f"/api/reports/subject/?subject_code={subject_instance.subject_code}")
    assert subject_report.status_code == 200
    assert subject_report.data["subject"]["code"] == subject_instance.subject_code
    assert subject_report.data["students"][0]["attendance_percentage"] == 100

    csv_export = client.get(f"/api/reports/export/csv/?subject_code={subject_instance.subject_code}")
    assert csv_export.status_code == 200
    assert csv_export["Content-Type"] == "text/csv"

    trends = client.get("/api/reports/analytics/trends/")
    assert trends.status_code == 200
    assert len(trends.data["trends"]) == 1

    notification = client.post(
        "/api/notifications/trigger/",
        {
            "trigger_type": "ATTENDANCE_SUMMARY",
            "channel": "EMAIL",
            "recipient": "admin@hexastack.test",
            "subject": "Summary",
            "message_body": "Attendance summary ready",
        },
        format="json",
    )
    assert notification.status_code == 202
    assert str(notification.data["organization"]) == str(organization.id)

    NotificationTemplate.objects.create(
        organization=organization,
        trigger_type="LOW_ATTENDANCE",
        channel="EMAIL",
        subject="Attendance warning for {student_name}",
        body_template="{student_name} attendance is {attendance_percentage}%.",
    )
    templated = client.post(
        "/api/notifications/trigger/",
        {
            "trigger_type": "LOW_ATTENDANCE",
            "channel": "EMAIL",
            "recipient": "student@hexastack.test",
            "context": {"student_name": "John Doe", "attendance_percentage": 72.5},
        },
        format="json",
    )
    assert templated.status_code == 202
    assert templated.data["subject"] == "Attendance warning for John Doe"
    assert templated.data["message_body"] == "John Doe attendance is 72.5%."

    log = Notification.objects.get(id=templated.data["id"])
    log.status = "FAILED"
    log.error_message = "Transient provider failure"
    log.save(update_fields=["status", "error_message"])
    retry = client.post(f"/api/notifications/logs/{log.id}/retry/")
    assert retry.status_code == 202


@pytest.mark.django_db
def test_student_data_requires_active_organization(admin_user, student_instance):
    client = APIClient()
    client.force_authenticate(admin_user)

    response = client.get("/api/students/")

    assert response.status_code == 200
    assert len(response.data["results"] if "results" in response.data else response.data) == 1


@pytest.mark.django_db
def test_student_ui_crud_archive_restore_contract(admin_user, organization, department, course, semester):
    client = APIClient()
    client.force_authenticate(admin_user)

    created = client.post(
        "/api/students/",
        {
            "roll_no": "CS-777",
            "name": "Ada Lovelace",
            "department": "Computer Science",
            "semester": 1,
            "dob": "2005-12-10",
            "email": "ada@hexastack.test",
            "phone": "+919900007777",
            "campus_status": "HOSTELLER",
            "login_email": "ada@hexastack.test",
            "login_password": "securepassword123",
        },
        format="json",
    )
    assert created.status_code == 201
    student = Student.objects.get(organization=organization, roll_no="CS-777")
    assert student.first_name == "Ada"
    assert student.last_name == "Lovelace"
    assert student.department == department
    assert student.course == course
    assert student.semester == semester
    assert created.data["name"] == "Ada Lovelace"
    assert created.data["department"] == "Computer Science"
    assert created.data["semester"] == 1
    assert created.data["is_archived"] is False

    updated = client.put(
        "/api/students/CS-777/",
        {
            "roll_no": "CS-777",
            "name": "Ada Byron",
            "department": "Computer Science",
            "semester": 1,
            "dob": "2005-12-10",
            "email": "ada@hexastack.test",
            "phone": "+919900007777",
            "campus_status": "DAY_SCHOLAR",
        },
        format="json",
    )
    assert updated.status_code == 200
    student.refresh_from_db()
    assert student.name == "Ada Byron"
    assert student.campus_status == "DAY_SCHOLAR"

    archived = client.post("/api/students/CS-777/archive/")
    assert archived.status_code == 200
    assert archived.data["is_archived"] is True
    assert Student.objects.filter(organization=organization, roll_no="CS-777").count() == 0
    archived_list = client.get("/api/students/?is_archived=true")
    archived_results = archived_list.data["results"] if "results" in archived_list.data else archived_list.data
    assert any(row["roll_no"] == "CS-777" for row in archived_results)

    restored = client.post("/api/students/CS-777/restore/")
    assert restored.status_code == 200
    assert restored.data["is_archived"] is False
    assert Student.objects.filter(organization=organization, roll_no="CS-777").exists()
