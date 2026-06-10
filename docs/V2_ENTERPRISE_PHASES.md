# HexaAttender v2 Enterprise — 12-Phase Implementation Map

Each phase lists primary backend apps, API prefixes, and frontend routes. All phases are **implemented** in this repository.

---

## Phase 1: Database + Authentication

**Goal:** Multi-tenant schema, custom user, JWT cookie auth, lockout.

| Component | Path |
|-----------|------|
| User model | `backend/apps/authentication/models.py` |
| Login / refresh / me | `backend/apps/authentication/views.py`, `urls.py` |
| JWT cookies | `backend/apps/authentication/cookies.py` |
| Lockout | `backend/apps/authentication/security.py` |
| Tenant base models | `backend/apps/core/models.py` |
| Frontend auth | `frontend/src/context/AuthContext.tsx`, `features/auth/` |

**API:** `/api/v1/auth/token/`, `/api/v1/auth/me/`, `/api/v1/auth/token/refresh/`

---

## Phase 2: Super Admin

**Goal:** Organizations, branches, platform settings, audit logs.

| Component | Path |
|-----------|------|
| Organizations API | `backend/apps/organizations/views.py` |
| Frontend admin CRUD | `frontend/src/features/admin/` |
| Super admin tests | `backend/apps/authentication/tests/test_super_admin_portal.py` |

**API:** `/api/v1/organizations/`, `/api/v1/branches/`, `/api/v1/audit-logs/`

**UI:** `/admin/organizations`, `/admin/branches`, `/admin/dashboard`

---

## Phase 3: HOD

**Goal:** Department scope, HOD management, department banner.

| Component | Path |
|-----------|------|
| HOD scoping | `backend/apps/core/hod_scoping.py` |
| Department CRUD | `backend/apps/organizations/views.py` (`DepartmentViewSet`) |
| HOD portal tests | `backend/apps/staff/tests/test_hod_portal.py` |
| Frontend | `frontend/src/hooks/useHodContext.ts`, `HodDepartmentBanner` |

**API:** `/api/v1/departments/`, `/api/v1/memberships/`

---

## Phase 4: Faculty

**Goal:** Staff profiles, subject assignment, faculty portal.

| Component | Path |
|-----------|------|
| Staff API | `backend/apps/staff/views.py` |
| Faculty repository | `backend/apps/staff/repositories/faculty_repository.py` |
| Faculty scoping | `backend/apps/core/faculty_scoping.py` |
| Frontend | `frontend/src/features/staff/`, `layouts/StaffLayout.tsx` |

**API:** `/api/v1/staff/`, `/api/v1/faculty/`

---

## Phase 5: Student

**Goal:** Student CRUD, portal, self-scoped data.

| Component | Path |
|-----------|------|
| Students API | `backend/apps/students/views.py` |
| Student scoping | `backend/apps/core/student_scoping.py` |
| Frontend | `frontend/src/features/students/`, `layouts/StudentLayout.tsx` |

**API:** `/api/v1/students/`

**UI:** `/student/learning`, `/student/timetable`, `/student/attendance`

---

## Phase 6: Face Recognition

**Goal:** ArcFace + RetinaFace enrollment, AES embeddings, liveness.

| Component | Path |
|-----------|------|
| AI service | `backend/apps/face_recognition/services.py` |
| Encrypted fields | `backend/apps/core/fields.py` (`EncryptedJSONField`) |
| API views | `backend/apps/face_recognition/views.py` |
| Frontend | `frontend/src/features/attendance/components/FaceRecognition.tsx` |

**API:** `/api/v1/face-recognition/enroll/`, `verify/`, `identify/`, `detect/`

---

## Phase 7: Attendance Engine

**Goal:** Sessions, manual/face capture, validation, HOD approval.

| Component | Path |
|-----------|------|
| Engine | `backend/apps/attendance/engine.py` |
| Views | `backend/apps/attendance/views.py` |
| Frontend | `AttendanceEngine.tsx`, `CaptureAttendance.tsx` |

**API:** `/api/v1/attendance/sessions/`, `/api/v1/attendance/engine/`

---

## Phase 8: Reports

**Goal:** Enterprise reports, Excel/PDF/CSV, Celery export jobs.

| Component | Path |
|-----------|------|
| Service | `backend/apps/reports/enterprise_service.py` |
| Exporters | `backend/apps/reports/exporters.py` |
| Tasks | `backend/apps/reports/tasks.py` |
| Frontend | `frontend/src/features/reports/` |

**API:** `/api/v1/reports/meta/`, `generate/`, `history/`

---

## Phase 9: Analytics

**Goal:** Dashboard charts, caching, department comparison.

| Component | Path |
|-----------|------|
| Builder | `backend/apps/reports/enterprise_service.py` (`build_analytics_dashboard`) |
| Frontend | `frontend/src/features/analytics/` |

**API:** `/api/v1/reports/analytics/dashboard/`

---

## Phase 10: Notifications

**Goal:** Email/SMS/WhatsApp/In-App, templates, schedules, retries.

| Component | Path |
|-----------|------|
| Services | `backend/apps/notifications/services.py` |
| Scheduling | `backend/apps/notifications/scheduling.py` |
| Celery beat | `config/settings.py` → `CELERY_BEAT_SCHEDULE` |
| Frontend | `frontend/src/features/notifications/` |

**API:** `/api/v1/notifications/meta/`, `templates/`, `schedules/`, `logs/`

---

## Phase 11: Docker + CI/CD

**Goal:** Production containers, nginx, automated pipelines.

| Component | Path |
|-----------|------|
| Compose | `docker-compose.yml` |
| Backend image | `backend/Dockerfile` |
| Frontend image | `frontend/Dockerfile` |
| Nginx | `nginx/conf.d/` |
| CI | `.github/workflows/ci.yml` |
| Deploy | `.github/workflows/deploy.yml` |
| Env template | `.env.prod.example` |

---

## Phase 12: Testing + Bug Fixes

**Goal:** Regression suite, enterprise phase checks, audit fixes.

| Component | Path |
|-----------|------|
| Enterprise tests | `backend/apps/core/tests/test_enterprise_system.py` |
| Phase suite | `backend/apps/core/tests/test_v2_enterprise_phases.py` |
| Auth tests | `backend/apps/authentication/tests/` |
| LMS tests | `backend/apps/materials/tests/test_lms.py` |
| Audit | `AUDIT_REPORT.md` |

**Run:** `pytest -q` (73+ tests), coverage `backend/htmlcov/`

---

## Verification command

```bash
curl http://localhost:8000/api/v1/system/info/
```

Expected: `"version": "2.0.0"`, `"edition": "Enterprise"`, all `features` true.
