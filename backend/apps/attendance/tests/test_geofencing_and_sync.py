import pytest
from rest_framework.test import APIClient
from rest_framework import status
from django.utils import timezone
from apps.attendance.models import AttendanceRecord, AttendanceSession
from apps.face_recognition.models import FaceEnrollment
from apps.face_recognition.services import FaceRecognitionService
from apps.organizations.models import Branch
from apps.timetable.models import Timetable
from apps.subjects.models import Subject


@pytest.fixture(autouse=True)
def mock_face_recognition(monkeypatch):
    monkeypatch.setattr(FaceRecognitionService, "verify_liveness", lambda self, image: {
        "success": True,
        "liveness": True,
        "score": 98,
        "checks": {"photo_attack_prevented": True, "screen_attack_prevented": True},
        "details": {}
    })
    monkeypatch.setattr(FaceRecognitionService, "encode_face", lambda self, image: {
        "success": True,
        "encoding": [0.12] * 512,
        "face_count": 1,
        "message": "ok"
    })
    monkeypatch.setattr(FaceRecognitionService, "compare_faces", lambda self, known_encoding, test_encoding, tolerance: {
        "match": True,
        "confidence": 95.0,
        "distance": 0.02,
        "message": "MATCH"
    })
    monkeypatch.setattr(FaceRecognitionService, "verify_against_pose_set", lambda self, pose_set, encoding, tolerance: {
        "match": True,
        "confidence": 95.0,
        "distance": 0.02,
        "best_pose": "FRONT",
        "message": "MATCH"
    })


@pytest.mark.django_db
def test_student_self_checkin_success(student_user, student_instance, subject_instance, organization):
    # Setup student role & active organization/branch
    student_user.role = "STUDENT"
    student_user.active_organization = organization
    student_user.active_branch = student_instance.branch
    student_user.save()

    # Configure Branch Geofencing Coordinates (e.g. Bangalore center)
    branch = student_instance.branch
    branch.latitude = 12.9716
    branch.longitude = 77.5946
    branch.geofence_radius = 100.0  # 100 meters
    branch.save()

    # Create active face enrollment
    FaceEnrollment.objects.create(
        organization=organization,
        user=student_user,
        student=student_instance,
        subject_type="STUDENT",
        encrypted_embedding=[0.12] * 512,
        pose_embeddings={"FRONT": [0.12] * 512},
        is_active=True
    )

    # Create open attendance session for today matching student's class
    today = timezone.localdate()
    session = AttendanceSession.objects.create(
        organization=organization,
        branch=branch,
        department=student_instance.department,
        semester=student_instance.semester,
        subject=subject_instance,
        date=today,
        hour="II",
        session_status="OPEN",
        opened_by=student_user,
        created_by=student_user,
        updated_by=student_user
    )

    client = APIClient()
    client.force_authenticate(student_user)

    # Trigger Self Check-in with coordinates inside the 100m geofence (approx 10m away)
    response = client.post(
        "/api/v1/attendance/engine/self-checkin/",
        {
            "latitude": 12.9717,
            "longitude": 77.5947,
            "image": "data:image/jpeg;base64,mockbase64image"
        },
        format="json"
    )

    assert response.status_code == 200, response.data
    assert response.data["success"] is True
    
    # Verify attendance record was successfully logged
    record = AttendanceRecord.objects.get(session=session, student=student_instance)
    assert record.status == "PRESENT"
    assert record.capture_method == "FACE_RECOGNITION"
    assert record.metadata.get("self_service") is True
    assert record.metadata.get("distance_meters") < 100.0


@pytest.mark.django_db
def test_student_self_checkin_outside_geofence(student_user, student_instance, subject_instance, organization):
    student_user.role = "STUDENT"
    student_user.active_organization = organization
    student_user.active_branch = student_instance.branch
    student_user.save()

    branch = student_instance.branch
    branch.latitude = 12.9716
    branch.longitude = 77.5946
    branch.geofence_radius = 100.0
    branch.save()

    # Create active face enrollment
    FaceEnrollment.objects.create(
        organization=organization,
        user=student_user,
        student=student_instance,
        subject_type="STUDENT",
        encrypted_embedding=[0.12] * 512,
        is_active=True
    )

    # Create open attendance session for today
    today = timezone.localdate()
    session = AttendanceSession.objects.create(
        organization=organization,
        branch=branch,
        department=student_instance.department,
        semester=student_instance.semester,
        subject=subject_instance,
        date=today,
        hour="II",
        session_status="OPEN",
        opened_by=student_user,
        created_by=student_user,
        updated_by=student_user
    )

    client = APIClient()
    client.force_authenticate(student_user)

    # Trigger self check-in from coordinates outside the geofence (e.g. New York coordinates)
    response = client.post(
        "/api/v1/attendance/engine/self-checkin/",
        {
            "latitude": 40.7128,
            "longitude": -74.0060,
            "image": "data:image/jpeg;base64,mockbase64image"
        },
        format="json"
    )

    assert response.status_code == 400
    assert "outside the allowed branch boundary" in response.data["error"]
    
    # Assert no attendance record was created
    assert not AttendanceRecord.objects.filter(session=session, student=student_instance).exists()


@pytest.mark.django_db
def test_student_self_checkin_no_active_session(student_user, student_instance, organization):
    student_user.role = "STUDENT"
    student_user.active_organization = organization
    student_user.active_branch = student_instance.branch
    student_user.save()

    branch = student_instance.branch
    branch.latitude = 12.9716
    branch.longitude = 77.5946
    branch.geofence_radius = 100.0
    branch.save()

    FaceEnrollment.objects.create(
        organization=organization,
        user=student_user,
        student=student_instance,
        subject_type="STUDENT",
        encrypted_embedding=[0.12] * 512,
        is_active=True
    )

    client = APIClient()
    client.force_authenticate(student_user)

    # Call self check-in without an open session
    response = client.post(
        "/api/v1/attendance/engine/self-checkin/",
        {
            "latitude": 12.9716,
            "longitude": 77.5946,
            "image": "data:image/jpeg;base64,mock"
        },
        format="json"
    )

    assert response.status_code == 404
    assert "no active open attendance session" in response.data["error"].lower()


@pytest.mark.django_db
def test_biometric_device_sync_ingestion(faculty_user, faculty_profile, student_instance, subject_instance, organization):
    # Setup HOD or faculty account
    faculty_user.role = "FACULTY"
    faculty_user.active_organization = organization
    faculty_user.save()

    # Configure timetable entry for Period II (9:30 AM - 10:30 AM)
    timetable_entry = Timetable.objects.create(
        organization=organization,
        branch=student_instance.branch,
        department=student_instance.department,
        course=student_instance.course,
        semester=student_instance.semester,
        day="MONDAY",
        period=2,  # Period II
        starts_at="09:30:00",
        ends_at="10:30:00",
        subject=subject_instance,
        faculty=faculty_profile,
        is_active=True
    )

    client = APIClient()
    client.force_authenticate(faculty_user)

    # Post raw BioEnable-style device logs to sync API
    response = client.post(
        "/api/v1/attendance/engine/device-sync/",
        {
            "device_id": "MAIN_GATE_TERMINAL_A",
            "device_name": "Main Entrance biometric reader",
            "logs": [
                {
                    "roll_no": student_instance.roll_no,
                    # Monday at 09:45 AM maps to Monday Period II
                    "timestamp": "2026-06-15T09:45:00Z",
                    "status": "PRESENT",
                    "confidence_score": 92.5
                }
            ]
        },
        format="json"
    )

    assert response.status_code == 200, response.data
    assert response.data["synced_records"] == 1
    
    # Assert session was automatically resolved/created for the timetable subject
    session = AttendanceSession.objects.get(
        organization=organization,
        date="2026-06-15",
        hour="II",
        subject=subject_instance
    )
    assert session.session_status == "OPEN"
    
    # Assert attendance record was successfully logged
    record = AttendanceRecord.objects.get(session=session, student=student_instance)
    assert record.status == "PRESENT"
    assert record.capture_method == "FACE_RECOGNITION"
    assert record.metadata.get("synced_from_device") is True
    assert record.metadata.get("device_id") == "MAIN_GATE_TERMINAL_A"
