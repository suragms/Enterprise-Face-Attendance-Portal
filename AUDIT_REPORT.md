# HexaAttender Security & Quality Audit Report

**Date:** 2026-10-04  
**Scope:** Full-stack audit & hardening pass (backend Django REST Framework + React frontend)  
**Tests after fixes:** 131 passed (backend `pytest`), frontend `npm run build` passed  
**Status:** ALL CRITICAL WORKFLOWS & SECURITY REQUIREMENTS VERIFIED AND ENFORCED  

---

## Executive summary

This deep correction and verification pass addressed all fine-grained role-based access control (RBAC), multi-tenant isolation, academic scoping, and biometric security requirements for the Enterprise Face Attendance Portal:

1. **Faculty Timetable Permissions**: Fixed `TimetableEntryViewSet` authorization to allow Faculty full object-level CRUD and upsert capability for assigned subjects and departments, while strictly denying Student write operations (`403 FORBIDDEN`).
2. **Resource CRUD & Academic Scoping**: Enforced explicit HOD department boundaries and assigned Faculty scopes across Subjects, Courses, LMS Study Materials, and Notifications. Corrected student LMS material filtering to prevent cross-department leakages.
3. **Tenant & Organization Protection**: Hardened `TenantScopedModelViewSet` and HOD creation logic to prevent browser-submitted `organization_id` parameters from overriding the authenticated user's active tenant organization.
4. **Biometric Face Engine Security**: Server-side face recognition pipeline in `AutomaticAttendanceView` strictly validates active session state, isolates candidates to `get_roster_students(session)`, performs liveness verification, enforces cosine similarity thresholds ($0.65$), and rejects ambiguous top-candidate matches (margin delta $< 0.05$ returns `AMBIGUOUS_FACE`). Standardized response codes returned for all biometric execution states.
5. **Comprehensive Automated Test Coverage**: Expanded unit & integration tests to 131 passing test cases covering role $\times$ endpoint RBAC matrix, cross-tenant/cross-department isolation, biometric ambiguity edge cases, and automatic attendance pipelines.

---

## 1. Permission & RBAC Matrix (Verified)

| Role | Timetable | Subjects | Courses | Study Materials | Notifications | Department/Branch |
|---|---|---|---|---|---|---|
| **SUPER_ADMIN** | Full CRUD | Full CRUD | Full CRUD | Full CRUD | Full CRUD | Full CRUD |
| **ORGANIZATION_ADMIN / BRANCH_ADMIN** | Full Org Scope | Full Org Scope | Full Org Scope | Full Org Scope | Full Org Scope | Read/Branch Scope |
| **HOD** | Department Scope | Department Scope | Department Scope | Department Scope & Approval | Department Scope | Read Dept Scope |
| **FACULTY** | Assigned Subjects/Dept | Assigned Subjects/Dept | Read Only | Assigned Subjects (Draft) | Assigned Cohort Send | Read Only |
| **STUDENT** | Read Only (Self) | Read Only | Read Only | Approved Materials Only | Read Logs (Self Only) | Read Only |

---

## 2. Biometric Verification & Engine Security (Verified)

| Component / Event | Security Rule / Mechanism | Verification Status |
|---|---|---|
| **Payload Authorization** | Image & `session_id` required; client-supplied scores ignored | **Enforced** |
| **Session State** | Session must be `OPEN` and within valid timetable time window | **Enforced** |
| **Candidate Isolation** | Candidate roster restricted strictly to `get_roster_students(session)` | **Enforced** |
| **Liveness Verification** | Real-time liveness check logged via `FaceAuditLog`; failure returns `LIVENESS_FAILED` | **Enforced** |
| **Threshold Floor** | Similarity score floor $\ge 0.65$; lower scores return `FACE_MISMATCH` | **Enforced** |
| **Ambiguity Margin** | If top 2 matches differ by $< 0.05$ score delta, returns `AMBIGUOUS_FACE` | **Enforced** |
| **Duplicate Prevention** | Prevents duplicate check-in if student already `PRESENT`/`LATE`/`EXCUSED` in session | **Enforced** |
| **Embedding Security** | Face vectors encrypted at rest; omitted from normal serializer outputs | **Enforced** |

---

## 3. Test Suite & Verification Results

```
backend/.venv/Scripts/python.exe -m pytest -q
........................................................................ [ 54%]
...........................................................              [100%]
131 passed in 3.58s
```

### Key Test Modules Added/Expanded
- `apps/authentication/tests/test_rbac_matrix.py`: Full role mutation matrix, student mutation block tests, cross-tenant isolation, cross-department HOD isolation, and assigned faculty timetable mutation permissions.
- `apps/face_recognition/tests/test_biometrics_full.py`: Complete end-to-end automatic attendance pipeline, liveness checking, threshold validation, and $< 0.05$ ambiguity score delta rejection.
