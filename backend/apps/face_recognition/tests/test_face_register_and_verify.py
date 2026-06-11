import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.face_recognition.models import FaceEnrollment
from apps.face_recognition.services import FaceRecognitionService

User = get_user_model()

@pytest.fixture(autouse=True)
def mock_face_recognition(monkeypatch):
    monkeypatch.setattr(FaceRecognitionService, "verify_liveness", lambda self, image: {
        "success": True,
        "liveness": True,
        "score": 95,
        "checks": {"photo_attack_prevented": True},
        "details": {}
    })
    monkeypatch.setattr(FaceRecognitionService, "encode_face", lambda self, image: {
        "success": True,
        "encoding": [0.12, 0.34],
        "face_count": 1,
        "message": "ok"
    })
    monkeypatch.setattr(FaceRecognitionService, "encode_pose_set", lambda self, pose_images: {
        "success": True,
        "pose_embeddings": {
            "FRONT": [0.1, 0.2],
            "LEFT": [0.3, 0.4],
            "RIGHT": [0.5, 0.6],
            "UP": [0.7, 0.8],
            "DOWN": [0.9, 1.0],
        },
        "captured_poses": ["FRONT", "LEFT", "RIGHT", "UP", "DOWN"]
    })
    monkeypatch.setattr(FaceRecognitionService, "verify_against_pose_set", lambda self, pose_set, encoding, tolerance: {
        "match": True,
        "confidence": 92.5,
        "distance": 0.05,
    })

@pytest.mark.django_db
def test_student_auto_linking_enrollment_and_verification(student_user, student_instance, organization):
    student_user.role = "STUDENT"
    student_user.active_organization = organization
    student_user.save()

    client = APIClient()
    client.force_authenticate(student_user)

    res = client.post(
        "/api/face-recognition/enroll-multi/",
        {
            "pose_images": {
                "FRONT": "data:image/png;base64,1",
                "LEFT": "data:image/png;base64,2",
                "RIGHT": "data:image/png;base64,3",
                "UP": "data:image/png;base64,4",
                "DOWN": "data:image/png;base64,5",
            }
        },
        format="json"
    )
    assert res.status_code == 201, res.data
    
    # Check that the enrollment got correctly auto-linked to the student profile
    enrollment = FaceEnrollment.objects.get(id=res.data["id"])
    assert enrollment.student == student_instance
    assert enrollment.subject_type == FaceEnrollment.SubjectType.STUDENT
    assert enrollment.organization == organization

    # Check verify works when called without roll_no
    verify_res = client.post(
        "/api/face-recognition/verify/",
        {"image": "data:image/png;base64,1"},
        format="json"
    )
    assert verify_res.status_code == 200, verify_res.data
    assert verify_res.data["match"] is True
    assert verify_res.data["identity"]["student_id"] == str(student_instance.id)
    assert verify_res.data["identity"]["subject_type"] == FaceEnrollment.SubjectType.STUDENT

@pytest.mark.django_db
def test_faculty_auto_linking_enrollment(faculty_user, faculty_profile, organization):
    faculty_user.role = "FACULTY"
    faculty_user.active_organization = organization
    faculty_user.save()

    client = APIClient()
    client.force_authenticate(faculty_user)

    res = client.post(
        "/api/face-recognition/enroll-multi/",
        {
            "pose_images": {
                "FRONT": "data:image/png;base64,1",
                "LEFT": "data:image/png;base64,2",
                "RIGHT": "data:image/png;base64,3",
                "UP": "data:image/png;base64,4",
                "DOWN": "data:image/png;base64,5",
            }
        },
        format="json"
    )
    assert res.status_code == 201, res.data
    
    # Check that the enrollment got correctly auto-linked to the faculty profile
    enrollment = FaceEnrollment.objects.get(id=res.data["id"])
    assert enrollment.faculty == faculty_profile
    assert enrollment.subject_type == FaceEnrollment.SubjectType.FACULTY
    assert enrollment.organization == organization
