"""
HexaAttender v2 Enterprise Edition — platform metadata and feature registry.
"""

from __future__ import annotations

VERSION = "2.0.0"
EDITION = "Enterprise"
PRODUCT_NAME = "HexaAttender"
FULL_NAME = f"{PRODUCT_NAME} v{VERSION} {EDITION}"

ROLES = (
    "SUPER_ADMIN",
    "PLATFORM_SUPER_ADMIN",
    "ORGANIZATION_ADMIN",
    "BRANCH_ADMIN",
    "HOD",
    "FACULTY",
    "STUDENT",
)

FEATURES = {
    "multi_organization": True,
    "multi_branch": True,
    "face_recognition_attendance": True,
    "liveness_detection": True,
    "anti_spoofing": True,
    "student_management": True,
    "faculty_management": True,
    "department_management": True,
    "course_management": True,
    "subject_management": True,
    "timetable": True,
    "lms": True,
    "exam_management": True,
    "reports": True,
    "analytics": True,
    "notifications": True,
    "audit_logs": True,
    "security_layer": True,
    "docker_deployment": True,
    "ci_cd": True,
}

AI_STACK = {
    "opencv": True,
    "deepface": True,
    "arcface": True,
    "retinaface": True,
}

SECURITY_STACK = {
    "jwt_http_only_cookies": True,
    "role_permissions": True,
    "aes_embedding_encryption": True,
    "anti_spoofing_liveness": True,
    "login_lockout": True,
}

TECH_STACK = {
    "frontend": ["React 18", "TypeScript", "Vite", "TailwindCSS"],
    "backend": ["Django", "Django REST Framework", "PostgreSQL", "Redis", "Celery"],
}

PHASES = (
    {"id": 1, "name": "Database + Authentication", "slug": "auth"},
    {"id": 2, "name": "Super Admin", "slug": "super-admin"},
    {"id": 3, "name": "HOD", "slug": "hod"},
    {"id": 4, "name": "Faculty", "slug": "faculty"},
    {"id": 5, "name": "Student", "slug": "student"},
    {"id": 6, "name": "Face Recognition", "slug": "face"},
    {"id": 7, "name": "Attendance Engine", "slug": "attendance"},
    {"id": 8, "name": "Reports", "slug": "reports"},
    {"id": 9, "name": "Analytics", "slug": "analytics"},
    {"id": 10, "name": "Notifications", "slug": "notifications"},
    {"id": 11, "name": "Docker + CI/CD", "slug": "devops"},
    {"id": 12, "name": "Testing + Bug Fixes", "slug": "qa"},
)


def build_system_info() -> dict:
    return {
        "product": PRODUCT_NAME,
        "edition": EDITION,
        "version": VERSION,
        "full_name": FULL_NAME,
        "roles": list(ROLES),
        "features": FEATURES,
        "ai_stack": AI_STACK,
        "security_stack": SECURITY_STACK,
        "tech_stack": TECH_STACK,
        "phases": list(PHASES),
    }
