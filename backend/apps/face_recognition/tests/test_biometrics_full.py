import datetime
import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from apps.attendance.models import AttendanceSession, AttendanceRecord
from apps.face_recognition.models import FaceEnrollment
from apps.face_recognition.services import FaceRecognitionService
from apps.students.models import Student
from apps.timetable.models import Timetable

User = get_user_model()


@pytest.fixture
def student_instance_2(db, organization, branch, department, course, semester):
    user2 = User.objects.create_user(
        username="student2",
        email="student2@hexastack.test",
        password="securepassword123",
        role="STUDENT",
        active_organization=organization,
        active_branch=branch,
    )
    return Student.objects.create(
        organization=organization,
        branch=branch,
        department=department,
        course=course,
        semester=semester,
        user=user2,
        admission_number="ADM-002",
        roll_no="CS-002",
        first_name="Jane",
        last_name="Smith",
        dob=datetime.date(2005, 6, 20),
        phone="+919888888888",
        email="student2@hexastack.test",
    )


@pytest.mark.django_db
def test_automatic_attendance_full_biometric_pipeline(
    monkeypatch, faculty_user, subject_instance, student_instance, faculty_profile, organization
):
    # Setup mock face recognition for pipeline
    monkeypatch.setattr(FaceRecognitionService, "verify_liveness", lambda self, image: {
        "success": True, "liveness": True, "score": 95, "checks": {}, "details": {}
    })
    monkeypatch.setattr(FaceRecognitionService, "encode_face", lambda self, image: {
        "success": True, "encoding": [0.1, 0.2], "face_count": 1, "message": "ok"
    })
    monkeypatch.setattr(FaceRecognitionService, "verify_against_pose_set", lambda self, pose_set, encoding, tolerance: {
        "match": True, "confidence": 90.0, "distance": 0.05
    })

    # Enroll student_instance
    FaceEnrollment.objects.create(
        organization=organization,
        user=student_instance.user,
        student=student_instance,
        subject_type=FaceEnrollment.SubjectType.STUDENT,
        encrypted_embedding=[0.1, 0.2],
        pose_embeddings={"FRONT": [0.1, 0.2]},
        captured_poses=["FRONT"],
    )

    date_value = timezone.localdate()
    now_time = timezone.localtime().time()
    start_t = (datetime.datetime.combine(date_value, now_time) - datetime.timedelta(minutes=10)).time()
    end_t = (datetime.datetime.combine(date_value, now_time) + datetime.timedelta(minutes=10)).time()

    timetable = Timetable.objects.create(
        organization=organization,
        branch=student_instance.branch,
        department=student_instance.department,
        course=student_instance.course,
        semester=student_instance.semester,
        day=date_value.strftime("%A").upper(),
        period=1,
        starts_at=start_t,
        ends_at=end_t,
        subject=subject_instance,
        faculty=faculty_profile,
    )
    session = AttendanceSession.objects.create(
        organization=organization,
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

    # 1. Image with verified face match
    res = client.post(
        "/api/v1/attendance/engine/automatic/",
        {
            "session_id": str(session.id),
            "image": "data:image/png;base64,valid_face_image",
        },
        format="json",
    )
    assert res.status_code == 201, res.data
    assert res.data["code"] == "VERIFIED"
    assert res.data["student_id"] == str(student_instance.id)


@pytest.mark.django_db
def test_automatic_attendance_ambiguity_rejection(
    monkeypatch, faculty_user, subject_instance, student_instance, student_instance_2, faculty_profile, organization
):
    # Setup mock face recognition with ambiguous scores (top 2 delta < 0.05)
    monkeypatch.setattr(FaceRecognitionService, "verify_liveness", lambda self, image: {
        "success": True, "liveness": True, "score": 95, "checks": {}, "details": {}
    })
    monkeypatch.setattr(FaceRecognitionService, "encode_face", lambda self, image: {
        "success": True, "encoding": [0.1, 0.2], "face_count": 1, "message": "ok"
    })

    # Top student similarity 0.90, second student similarity 0.88 (delta 0.02 < 0.05 margin)
    def mock_verify_pose_set(self, pose_set, encoding, tolerance):
        if pose_set.get("student_id") == str(student_instance.id):
            return {"match": True, "confidence": 90.0, "distance": 0.05}
        return {"match": True, "confidence": 88.0, "distance": 0.06}

    monkeypatch.setattr(FaceRecognitionService, "verify_against_pose_set", mock_verify_pose_set)

    # Enroll both students
    FaceEnrollment.objects.create(
        organization=organization,
        user=student_instance.user,
        student=student_instance,
        subject_type=FaceEnrollment.SubjectType.STUDENT,
        encrypted_embedding=[0.1, 0.2],
        pose_embeddings={"FRONT": [0.1, 0.2], "student_id": str(student_instance.id)},
        captured_poses=["FRONT"],
    )
    FaceEnrollment.objects.create(
        organization=organization,
        user=student_instance_2.user,
        student=student_instance_2,
        subject_type=FaceEnrollment.SubjectType.STUDENT,
        encrypted_embedding=[0.1, 0.2],
        pose_embeddings={"FRONT": [0.1, 0.2], "student_id": str(student_instance_2.id)},
        captured_poses=["FRONT"],
    )

    date_value = timezone.localdate()
    now_time = timezone.localtime().time()
    start_t = (datetime.datetime.combine(date_value, now_time) - datetime.timedelta(minutes=10)).time()
    end_t = (datetime.datetime.combine(date_value, now_time) + datetime.timedelta(minutes=10)).time()

    timetable = Timetable.objects.create(
        organization=organization,
        branch=student_instance.branch,
        department=student_instance.department,
        course=student_instance.course,
        semester=student_instance.semester,
        day=date_value.strftime("%A").upper(),
        period=1,
        starts_at=start_t,
        ends_at=end_t,
        subject=subject_instance,
        faculty=faculty_profile,
    )
    session = AttendanceSession.objects.create(
        organization=organization,
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

    res = client.post(
        "/api/v1/attendance/engine/automatic/",
        {
            "session_id": str(session.id),
            "image": "data:image/png;base64,ambiguous_image",
        },
        format="json",
    )
    assert res.status_code == 400
    assert res.data["code"] == "AMBIGUOUS_FACE"
