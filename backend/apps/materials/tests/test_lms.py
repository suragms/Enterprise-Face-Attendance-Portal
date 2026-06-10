import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.materials.models import StudyMaterial


def _upload_notes(client, subject_instance, semester):
    file_obj = SimpleUploadedFile("notes.pdf", b"%PDF-1.4 test content", content_type="application/pdf")
    return client.post(
        "/api/v1/materials/",
        {
            "title": "Unit 1 Notes",
            "description": "Intro chapter",
            "subject": str(subject_instance.id),
            "semester": str(semester.id),
            "material_type": "NOTES",
            "file": file_obj,
        },
        format="multipart",
    )


@pytest.mark.django_db
def test_lms_material_workflow(faculty_user, hod_user, student_user, student_instance, subject_instance, semester):
    faculty_client = APIClient()
    faculty_client.force_authenticate(faculty_user)

    create_resp = _upload_notes(faculty_client, subject_instance, semester)
    assert create_resp.status_code == 201
    material_id = create_resp.json()["id"]
    assert create_resp.json()["status"] == "DRAFT"
    assert create_resp.json()["material_type"] == "NOTES"

    submit_resp = faculty_client.post(f"/api/v1/materials/{material_id}/submit/")
    assert submit_resp.status_code == 200
    assert submit_resp.json()["status"] == "PENDING"

    hod_client = APIClient()
    hod_client.force_authenticate(hod_user)
    approve_resp = hod_client.post(f"/api/v1/materials/{material_id}/approve/")
    assert approve_resp.status_code == 200
    assert approve_resp.json()["status"] == "APPROVED"

    student_client = APIClient()
    student_client.force_authenticate(student_user)
    list_resp = student_client.get("/api/v1/materials/")
    assert list_resp.status_code == 200
    rows = list_resp.json() if isinstance(list_resp.json(), list) else list_resp.json().get("results", [])
    assert any(row["id"] == material_id for row in rows)

    download_resp = student_client.get(f"/api/v1/materials/{material_id}/download/")
    assert download_resp.status_code == 200
    assert download_resp.get("Content-Disposition", "").startswith("attachment")


@pytest.mark.django_db
def test_student_cannot_see_draft_materials(faculty_user, student_user, student_instance, subject_instance, semester):
    faculty_client = APIClient()
    faculty_client.force_authenticate(faculty_user)
    create_resp = _upload_notes(faculty_client, subject_instance, semester)
    material_id = create_resp.json()["id"]

    student_client = APIClient()
    student_client.force_authenticate(student_user)
    list_resp = student_client.get("/api/v1/materials/")
    rows = list_resp.json() if isinstance(list_resp.json(), list) else list_resp.json().get("results", [])
    assert not any(row["id"] == material_id for row in rows)


@pytest.mark.django_db
def test_video_material_download_returns_link(faculty_user, hod_user, student_user, student_instance, subject_instance, semester):
    faculty_client = APIClient()
    faculty_client.force_authenticate(faculty_user)

    create_resp = faculty_client.post(
        "/api/v1/materials/",
        {
            "title": "Lecture Recording",
            "description": "Week 1",
            "subject": str(subject_instance.id),
            "semester": str(semester.id),
            "material_type": "VIDEOS",
            "external_video_url": "https://example.com/video/1",
        },
        format="json",
    )
    assert create_resp.status_code == 201
    material_id = create_resp.json()["id"]

    faculty_client.post(f"/api/v1/materials/{material_id}/submit/")
    hod_client = APIClient()
    hod_client.force_authenticate(hod_user)
    hod_client.post(f"/api/v1/materials/{material_id}/approve/")

    student_client = APIClient()
    student_client.force_authenticate(student_user)
    download_resp = student_client.get(f"/api/v1/materials/{material_id}/download/")
    assert download_resp.status_code == 200
    payload = download_resp.json()
    assert payload["type"] == "video_link"
    assert payload["url"] == "https://example.com/video/1"


@pytest.mark.django_db
def test_lms_hub_summary(faculty_user, hod_user, subject_instance, semester):
    faculty_client = APIClient()
    faculty_client.force_authenticate(faculty_user)
    _upload_notes(faculty_client, subject_instance, semester)

    hod_client = APIClient()
    hod_client.force_authenticate(hod_user)
    hub_resp = hod_client.get("/api/v1/materials/hub/")
    assert hub_resp.status_code == 200
    payload = hub_resp.json()
    assert payload["courses_count"] >= 1
    assert "workflow" in payload
    assert payload["workflow_steps"][-1] == "Student Download"
    assert payload["materials_by_type"]["NOTES"] >= 1


@pytest.mark.django_db
def test_material_type_filter(faculty_user, subject_instance, semester):
    faculty_client = APIClient()
    faculty_client.force_authenticate(faculty_user)
    _upload_notes(faculty_client, subject_instance, semester)

    filtered = faculty_client.get("/api/v1/materials/?material_type=NOTES")
    assert filtered.status_code == 200
    rows = filtered.json() if isinstance(filtered.json(), list) else filtered.json().get("results", [])
    assert rows
    assert all(row["material_type"] == "NOTES" for row in rows)


@pytest.mark.django_db
def test_hod_reject_workflow(faculty_user, hod_user, subject_instance, semester):
    faculty_client = APIClient()
    faculty_client.force_authenticate(faculty_user)
    create_resp = _upload_notes(faculty_client, subject_instance, semester)
    material_id = create_resp.json()["id"]
    faculty_client.post(f"/api/v1/materials/{material_id}/submit/")

    hod_client = APIClient()
    hod_client.force_authenticate(hod_user)
    reject_resp = hod_client.post(
        f"/api/v1/materials/{material_id}/reject/",
        {"reason": "Incomplete content"},
        format="json",
    )
    assert reject_resp.status_code == 200
    assert reject_resp.json()["status"] == "REJECTED"
    assert "Incomplete" in reject_resp.json()["rejection_reason"]

    resubmit = faculty_client.post(f"/api/v1/materials/{material_id}/submit/")
    assert resubmit.status_code == 200
    assert resubmit.json()["status"] == "PENDING"
