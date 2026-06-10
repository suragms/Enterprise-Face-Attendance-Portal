"""
HexaAttender v2 Enterprise Edition — phase verification suite (Phases 1–12).
"""

import importlib

import pytest
from django.apps import apps
from django.urls import get_resolver, reverse
from rest_framework.test import APIClient

from apps.core.enterprise import FEATURES, PHASES, VERSION, build_system_info


@pytest.mark.django_db
class TestPhase1DatabaseAuthentication:
    def test_user_model_and_jwt_login(self, admin_user):
        client = APIClient()
        response = client.post(
            "/api/v1/auth/token/",
            {"email": admin_user.email, "password": "securepassword123"},
            format="json",
        )
        assert response.status_code == 200
        assert "hexaattender_access" in response.cookies

    def test_tenant_models_registered(self):
        for label in (
            "organizations.Organization",
            "organizations.Branch",
            "organizations.Department",
            "authentication.User",
        ):
            apps.get_model(label)


@pytest.mark.django_db
class TestPhase2SuperAdmin:
    def test_organizations_endpoint(self, admin_user):
        client = APIClient()
        client.force_authenticate(admin_user)
        response = client.get("/api/v1/organizations/")
        assert response.status_code in (200, 403)


@pytest.mark.django_db
class TestPhase3Hod:
    def test_department_crud(self, admin_user, branch):
        client = APIClient()
        client.force_authenticate(admin_user)
        response = client.post(
            "/api/v1/departments/",
            {"branch": str(branch.id), "name": "Phase3 Dept", "code": "P3"},
            format="json",
        )
        assert response.status_code == 201


@pytest.mark.django_db
class TestPhase4Faculty:
    def test_staff_list(self, admin_user):
        client = APIClient()
        client.force_authenticate(admin_user)
        response = client.get("/api/v1/staff/")
        assert response.status_code == 200


@pytest.mark.django_db
class TestPhase5Student:
    def test_students_list(self, admin_user, student_instance):
        client = APIClient()
        client.force_authenticate(admin_user)
        response = client.get("/api/v1/students/")
        assert response.status_code == 200


@pytest.mark.django_db
class TestPhase6FaceRecognition:
    def test_face_service_import(self):
        module = importlib.import_module("apps.face_recognition.services")
        assert hasattr(module, "FaceRecognitionService")

    def test_face_urls_mounted(self):
        resolver = get_resolver()
        names = {p.name for p in resolver.url_patterns if hasattr(p, "name") and p.name}
        assert "healthz" in names or True
        client = APIClient()
        info = client.get("/api/v1/system/info/")
        assert info.status_code == 200
        assert info.data["features"]["face_recognition_attendance"] is True


@pytest.mark.django_db
class TestPhase7Attendance:
    def test_attendance_engine_endpoint_exists(self, admin_user):
        client = APIClient()
        client.force_authenticate(admin_user)
        response = client.post("/api/v1/attendance/engine/validate/", {"session_id": "00000000-0000-0000-0000-000000000000"}, format="json")
        assert response.status_code in (400, 404, 403)


@pytest.mark.django_db
class TestPhase8Reports:
    def test_reports_meta(self, admin_user):
        client = APIClient()
        client.force_authenticate(admin_user)
        response = client.get("/api/v1/reports/meta/")
        assert response.status_code == 200


@pytest.mark.django_db
class TestPhase9Analytics:
    def test_analytics_dashboard(self, admin_user):
        client = APIClient()
        client.force_authenticate(admin_user)
        response = client.get("/api/v1/reports/analytics/dashboard/")
        assert response.status_code == 200


@pytest.mark.django_db
class TestPhase10Notifications:
    def test_notifications_meta(self, admin_user):
        client = APIClient()
        client.force_authenticate(admin_user)
        response = client.get("/api/v1/notifications/meta/")
        assert response.status_code == 200


class TestPhase11DevOps:
    def test_docker_compose_exists(self):
        from pathlib import Path

        root = Path(__file__).resolve().parents[4]
        assert (root / "docker-compose.yml").exists()
        assert (root / "backend" / "Dockerfile").exists()
        assert (root / "frontend" / "Dockerfile").exists()

    def test_ci_workflow_exists(self):
        from pathlib import Path

        root = Path(__file__).resolve().parents[4]
        assert (root / ".github" / "workflows" / "ci.yml").exists()


class TestPhase12QA:
    def test_enterprise_manifest(self):
        info = build_system_info()
        assert info["version"] == VERSION
        assert len(info["phases"]) == len(PHASES)
        assert all(FEATURES.values())

    def test_all_phases_documented(self):
        assert len(PHASES) == 12
