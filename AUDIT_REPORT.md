# HexaAttender Security & Quality Audit Report

**Date:** 2026-06-03  
**Scope:** Full-stack audit (backend Django + React frontend)  
**Tests after fixes:** 73 passed (backend), frontend `npm run build` passed  
**Coverage:** 70% line coverage across `apps/` (see `backend/htmlcov/index.html`)

---

## Executive summary

This pass fixed **critical permission and role-model bugs**, hardened several APIs, repaired **4 failing enterprise tests**, and applied **frontend accessibility / Tailwind** corrections. The workspace is **not a git repository**, so apply changes from the modified files listed below rather than a generated `.patch` file.

---

## 1. Permission bugs (fixed)

| Issue | Severity | Fix |
|-------|----------|-----|
| `ORGANIZATION_ADMIN` / `BRANCH_ADMIN` treated as HOD for queryset scoping | Critical | Removed role aliasing in `ROLE_ALIASES`; `is_hod_user()` checks raw role `HOD` only |
| Students could list all org students | High | `scope_students_to_self()` on `StudentViewSet` |
| Faculty could list all org staff | High | Faculty users limited to own profile in `FacultyRepository.list_for_user` |
| Students could list all attendance sessions | High | `scope_queryset_for_student()` on `AttendanceSessionViewSet` |
| Org admin blocked from student CRUD | High | `IsStudentManagementUser` uses `ROLE_RANKS` (includes `ORGANIZATION_ADMIN`) |
| Department API used invalid `Permission \| Permission` | Critical | `DepartmentViewSet` uses `IsOrganizationAdminOrAbove` for writes |
| Notification logs visible to faculty | Medium | Non-admin roles get empty queryset (students still see own) |

---

## 2. API bugs (fixed)

| Issue | Fix |
|-------|-----|
| Login API expects `email`, tests sent `username` | Test updated; login contract documented |
| `User.save()` rewrote `ORGANIZATION_ADMIN` → `HOD` | Removed mapping on save; legacy roles preserved in DB |
| Timetable clash detection returned 0 overlaps | Group clashes by `day`, `period`, `faculty_id` only |
| Student create required login fields on update | `login_email` / `login_password` required only on create |
| Broken DRF permission composition (`A \| B`) | Replaced with explicit permission classes |

---

## 3. Database issues

| Finding | Status |
|---------|--------|
| Soft-delete managers (`ActiveManager`) used consistently | OK |
| Tenant isolation via `TenantScopedModelViewSet` | OK |
| No schema migrations required for this pass | N/A |

**Recommendation:** Add DB indexes on `Notification(user_id, status)` and `AttendanceRecord(session_id, student_id)` if query volume grows.

---

## 4. Security issues

| Issue | Severity | Fix |
|-------|----------|-----|
| `StudyMaterial.status` / `ExamSchedule.status` writable by clients | High | Added to `read_only_fields` |
| Attendance correction IDOR (any org record) | High | Faculty scoped via `scope_attendance_records_for_faculty` |
| Trigger notification `user_id` not tenant-checked | Medium | Filter by active org membership |
| Face endpoints `AllowAny` | Medium | **Not changed** — requires product decision (rate limits / org scope) |
| `DEBUG` / default `SECRET_KEY` in settings | Medium | **Not changed** — enforce via env in deployment |

---

## 5. React / TypeScript

| Finding | Status |
|---------|--------|
| Production build passes (`tsc -b && vite build`) | OK |
| Strict mode / widespread `any` in `ReportsView`, `AttendanceEngine` | Open — refactor incrementally |
| Invalid Tailwind tokens (`slate-450`, `slate-750`, `slate-850`, `slate-250`) | **Fixed** across `frontend/src` |

---

## 6. Performance bottlenecks

| Area | Recommendation |
|------|----------------|
| `face_recognition/services.py` (~7% coverage, heavy CV) | Cache embeddings; async Celery for identify |
| Report generation | Already uses Celery + cache on analytics dashboard |
| N+1 on student list | Already uses `select_related` on viewsets |

---

## 7. Duplicate code (refactoring suggestions)

1. **Merge** `StudentMaterials` and `StudentLearningHub` into one feature module with shared `MaterialCard` / download hook.
2. **Extract** shared subject/faculty label mappers used in `SubjectList`, `Timetable`, and staff serializers.
3. **Unify** report export UI (`ReportsView` + enterprise hook) behind a single `useReportExport` hook with typed payloads.
4. **Centralize** role checks in frontend (`lib/roles.ts`) mirroring backend `ROLE_RANKS`.

---

## 8. UI inconsistencies

| Item | Recommendation |
|------|----------------|
| Mixed page headers (`StudentPageHeader` vs inline h1) | Standardize on one header component per portal |
| Admin vs staff nav labeling | Align "HOD" vs "Admin" copy with backend roles |
| Chart empty states in analytics | Add shared `ChartEmptyState` component |

---

## 9. Accessibility (partially fixed)

| Fix | Files |
|-----|-------|
| Login email/password labels (`sr-only` + `id` / `autoComplete`) | `Login.tsx` |
| Logout `aria-label` on admin/staff layouts | `AdminLayout.tsx`, `StaffLayout.tsx` |
| Student layout logout already had `aria-label` | OK |

**Remaining:** Focus traps in modals, live regions for toast/async job status, keyboard nav on timetable grid.

---

## 10. Test coverage report

```
Total statements: 7121
Covered:          4991
Line coverage:    70%
Tests:            73 passed
HTML report:      backend/htmlcov/index.html
```

### Lowest coverage modules (prioritize next tests)

| Module | Coverage |
|--------|----------|
| `face_recognition/services.py` | 7% |
| `notifications/services.py` | 38% |
| `exams/views.py` | 37% |
| `reports/exporters.py` | 40% |
| `attendance/services.py` | 0% (legacy/unused) |

### Suggested new tests

- Student role: cannot `GET /api/students/` for other roll numbers
- Faculty role: cannot correct attendance for unassigned subject
- Faculty role: cannot set material `status=APPROVED` via API
- Notification trigger with `user_id` outside org → 400/404

---

## Files changed (apply as patch manually)

### Backend
- `apps/core/permissions.py`
- `apps/core/hod_scoping.py`
- `apps/core/student_scoping.py`
- `apps/authentication/models.py`
- `apps/authentication/permissions.py`
- `apps/organizations/views.py`
- `apps/students/views.py`
- `apps/students/serializers.py`
- `apps/staff/repositories/faculty_repository.py`
- `apps/attendance/views.py`
- `apps/materials/serializers.py`
- `apps/exams/serializers.py`
- `apps/notifications/views.py`
- `apps/timetable/views.py`
- `apps/core/tests/test_enterprise_system.py`

### Frontend
- All `frontend/src/**/*.tsx` (invalid Tailwind token replacement)
- `frontend/src/features/auth/components/Login.tsx`
- `frontend/src/layouts/AdminLayout.tsx`
- `frontend/src/layouts/StaffLayout.tsx`

---

## Generating a patch (when git is available)

```bash
cd HexaAttender
git init   # if needed
git add -A
git diff --cached > patches/hexaattender-audit-fixes.patch
```

---

## Deployment notes

1. Run backend tests: `cd backend && .venv\Scripts\python.exe -m pytest`
2. Apply notification migration if pending: `python manage.py migrate notifications`
3. Rebuild frontend: `cd frontend && npm run build`
4. Set production `DEBUG=False`, `SECRET_KEY`, and restrict face-login endpoints if exposed publicly
