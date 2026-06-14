import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient
from apps.face_recognition.models import FaceEnrollment

User = get_user_model()

@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_biometrics_fallback_mode_succeeds_in_debug(student_user, student_instance, organization):
    # Set up student user
    student_user.role = "STUDENT"
    student_user.active_organization = organization
    student_user.save()

    client = APIClient()
    client.force_authenticate(student_user)

    # 1. Enroll using the fallback service (no monkeypatching)
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
    
    enrollment = FaceEnrollment.objects.get(id=res.data["id"])
    assert enrollment.student == student_instance
    assert enrollment.subject_type == FaceEnrollment.SubjectType.STUDENT

    # 2. Verify using the fallback service (no monkeypatching)
    verify_res = client.post(
        "/api/face-recognition/verify/",
        {"image": "data:image/png;base64,1"},
        format="json"
    )
    assert verify_res.status_code == 200, verify_res.data
    assert verify_res.data["match"] is True
