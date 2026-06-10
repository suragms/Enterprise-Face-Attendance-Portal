import pytest
import json
from django.test import RequestFactory
from django.http import JsonResponse
from apps.core.middleware import StudentEnrollmentGateMiddleware
from apps.face_recognition.models import FaceEnrollment
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.mark.django_db
def test_student_enrollment_gate_middleware_unauthenticated():
    rf = RequestFactory()
    request = rf.get("/api/v1/reports/student/")
    request.user = User()  # Unauthenticated user
    
    middleware = StudentEnrollmentGateMiddleware(lambda req: None)
    response = middleware.process_request(request)
    assert response is None  # Allowed


@pytest.mark.django_db
def test_student_enrollment_gate_middleware_non_student(hod_user):
    rf = RequestFactory()
    request = rf.get("/api/v1/reports/student/")
    request.user = hod_user  # Role HOD
    
    middleware = StudentEnrollmentGateMiddleware(lambda req: None)
    response = middleware.process_request(request)
    assert response is None  # Allowed


@pytest.mark.django_db
def test_student_enrollment_gate_middleware_student_no_enrollment(student_user):
    rf = RequestFactory()
    request = rf.get("/api/v1/reports/student/")
    request.user = student_user  # Role STUDENT, no enrollment
    
    middleware = StudentEnrollmentGateMiddleware(lambda req: None)
    response = middleware.process_request(request)
    
    assert isinstance(response, JsonResponse)
    assert response.status_code == 403
    payload = json.loads(response.content)
    assert payload["enrollment_required"] is True
    assert payload["enrollment_overdue"] is True


@pytest.mark.django_db
def test_student_enrollment_gate_middleware_student_with_enrollment(student_user, organization):
    # Create an active face enrollment
    FaceEnrollment.objects.create(
        user=student_user,
        organization=organization,
        is_active=True,
        subject_type="STUDENT",
        encrypted_embedding=[0.1] * 128,
    )
    
    rf = RequestFactory()
    request = rf.get("/api/v1/reports/student/")
    request.user = student_user
    
    middleware = StudentEnrollmentGateMiddleware(lambda req: None)
    response = middleware.process_request(request)
    assert response is None  # Allowed


@pytest.mark.django_db
def test_student_enrollment_gate_middleware_student_allowed_path(student_user):
    rf = RequestFactory()
    request = rf.get("/api/v1/auth/student/portal-context/")
    request.user = student_user  # STUDENT, no enrollment, but allowed prefix
    
    middleware = StudentEnrollmentGateMiddleware(lambda req: None)
    response = middleware.process_request(request)
    assert response is None  # Allowed
