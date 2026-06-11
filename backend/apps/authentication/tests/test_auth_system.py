import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core import mail
from rest_framework.test import APIClient

from apps.authentication.models import LoginAttempt, UserSession

User = get_user_model()
STRONG_PASSWORD = "SecurePass1!"


@pytest.fixture(autouse=True)
def clear_auth_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def auth_client(db, organization, branch, department):
    user = User.objects.create_user(
        username="authuser",
        email="authuser@hexastack.test",
        password=STRONG_PASSWORD,
        role="HOD",
        active_organization=organization,
        active_branch=branch,
    )
    from apps.organizations.models import OrganizationMembership

    OrganizationMembership.objects.create(
        user=user,
        organization=organization,
        branch=branch,
        department=department,
        role="HOD",
    )
    return user


def _login(client, email, password):
    challenge = client.post(
        "/api/v1/auth/initiate-login/",
        {"mode": "password", "email": email, "password": password},
        format="json",
    )
    assert challenge.status_code == 200, challenge.data
    complete = client.post(
        "/api/v1/auth/complete-login/",
        {"challenge_id": challenge.data["challenge_id"], "device": "pytest-client"},
        format="json",
    )
    return complete


@pytest.mark.django_db
def test_initiate_and_complete_login_sets_cookies(auth_client):
    client = APIClient()
    response = _login(client, auth_client.email, STRONG_PASSWORD)
    assert response.status_code == 200
    assert "hexaattender_access" in response.cookies
    assert "hexaattender_refresh" in response.cookies
    assert response.data["user"]["role"] == "HOD"
    assert LoginAttempt.objects.filter(email=auth_client.email, success=True).exists()
    assert UserSession.objects.filter(user=auth_client, is_active=True).exists()


@pytest.mark.django_db
def test_me_endpoint_returns_authenticated_user(auth_client):
    client = APIClient()
    _login(client, auth_client.email, STRONG_PASSWORD)
    me = client.get("/api/v1/auth/me/")
    assert me.status_code == 200
    assert me.data["email"] == auth_client.email


@pytest.mark.django_db
def test_password_lockout_after_five_failures(auth_client):
    client = APIClient()
    for index in range(4):
        response = client.post(
            "/api/v1/auth/initiate-login/",
            {"mode": "password", "email": auth_client.email, "password": "wrong-password"},
            format="json",
        )
        assert response.status_code == 401, response.data
    locked = client.post(
        "/api/v1/auth/initiate-login/",
        {"mode": "password", "email": auth_client.email, "password": "wrong-password"},
        format="json",
    )
    assert locked.status_code == 429
    assert LoginAttempt.objects.filter(email=auth_client.email, success=False).count() >= 5


@pytest.mark.django_db
def test_logout_clears_cookies_and_records_audit(auth_client):
    client = APIClient()
    _login(client, auth_client.email, STRONG_PASSWORD)
    logout = client.post("/api/v1/auth/logout/")
    assert logout.status_code == 200
    assert not UserSession.objects.filter(user=auth_client, is_active=True).exists()


@pytest.mark.django_db
def test_refresh_token_rotation(auth_client):
    client = APIClient()
    login_response = _login(client, auth_client.email, STRONG_PASSWORD)
    old_refresh = login_response.cookies.get("hexaattender_refresh").value
    refresh_response = client.post("/api/v1/auth/token/refresh/")
    assert refresh_response.status_code == 200
    new_refresh = refresh_response.cookies.get("hexaattender_refresh").value
    assert new_refresh != old_refresh


@pytest.mark.django_db
def test_change_password_invalidates_existing_session(auth_client):
    client = APIClient()
    _login(client, auth_client.email, STRONG_PASSWORD)
    change = client.post(
        "/api/v1/auth/change-password/",
        {"old_password": STRONG_PASSWORD, "new_password": "NewSecure1!"},
        format="json",
    )
    assert change.status_code == 200
    auth_client.refresh_from_db()
    assert auth_client.check_password("NewSecure1!")
    me = client.get("/api/v1/auth/me/")
    assert me.status_code == 401


@pytest.mark.django_db
def test_forgot_password_sends_email(auth_client):
    client = APIClient()
    mail.outbox.clear()
    response = client.post(
        "/api/v1/auth/forgot-password/",
        {"email": auth_client.email},
        format="json",
    )
    assert response.status_code == 200
    assert len(mail.outbox) == 1
    assert auth_client.email in mail.outbox[0].to


@pytest.mark.django_db
def test_reset_password_with_valid_token(auth_client):
    from django.contrib.auth.tokens import default_token_generator
    from django.utils.http import urlsafe_base64_encode
    from django.utils.encoding import force_bytes

    token = default_token_generator.make_token(auth_client)
    uidb64 = urlsafe_base64_encode(force_bytes(auth_client.pk))
    client = APIClient()
    response = client.post(
        "/api/v1/auth/reset-password/",
        {"uidb64": uidb64, "token": token, "new_password": "ResetSecure1!"},
        format="json",
    )
    assert response.status_code == 200
    auth_client.refresh_from_db()
    assert auth_client.check_password("ResetSecure1!")


@pytest.mark.django_db
def test_password_policy_endpoint():
    client = APIClient()
    response = client.get("/api/v1/auth/password-policy/")
    assert response.status_code == 200
    assert response.data["min_length"] == 8
    assert response.data["requires_special"] is True


@pytest.mark.django_db
def test_sessions_list_requires_authentication(auth_client):
    client = APIClient()
    _login(client, auth_client.email, STRONG_PASSWORD)
    sessions = client.get("/api/v1/auth/sessions/")
    assert sessions.status_code == 200
    assert sessions.data["count"] >= 1


@pytest.mark.django_db
def test_legacy_token_login_with_email(auth_client):
    client = APIClient()
    response = client.post(
        "/api/v1/auth/token/",
        {"email": auth_client.email, "password": STRONG_PASSWORD},
        format="json",
    )
    assert response.status_code == 200
    assert "hexaattender_access" in response.cookies


@pytest.mark.django_db
def test_student_login_with_face_verification(monkeypatch, student_instance, organization, branch):
    from apps.face_recognition.models import FaceEnrollment
    from apps.face_recognition.services import FaceRecognitionService
    
    FaceEnrollment.objects.create(
        organization=organization,
        user=student_instance.user,
        student=student_instance,
        subject_type=FaceEnrollment.SubjectType.STUDENT,
        encrypted_embedding=[0.12, 0.34],
        pose_embeddings={
            "FRONT": [0.12, 0.34],
            "LEFT": [0.56, 0.78],
        },
        captured_poses=["FRONT", "LEFT"],
        is_active=True
    )
    
    monkeypatch.setattr(FaceRecognitionService, "verify_liveness", lambda self, image: {
        "success": True,
        "liveness": True,
        "score": 95,
        "checks": {"photo_attack_prevented": True, "screen_attack_prevented": True},
        "details": {}
    })
    monkeypatch.setattr(FaceRecognitionService, "encode_face", lambda self, image: {
        "success": True,
        "encoding": [0.56, 0.78],
        "face_count": 1,
        "message": "ok"
    })
    
    client = APIClient()
    
    init_res = client.post(
        "/api/v1/auth/initiate-login/",
        {"mode": "password", "email": student_instance.user.email, "password": "securepassword123"},
        format="json"
    )
    assert init_res.status_code == 200
    assert init_res.data["face_required"] is True
    challenge_id = init_res.data["challenge_id"]
    
    verify_res = client.post(
        "/api/v1/auth/verify-face/",
        {"challenge_id": challenge_id, "image": "data:image/png;base64,ZmFrZQ=="},
        format="json"
    )
    assert verify_res.status_code == 200
    assert verify_res.data["verified"] is True
    
    complete_res = client.post(
        "/api/v1/auth/complete-login/",
        {"challenge_id": challenge_id},
        format="json"
    )
    assert complete_res.status_code == 200
    assert "hexaattender_access" in complete_res.cookies

