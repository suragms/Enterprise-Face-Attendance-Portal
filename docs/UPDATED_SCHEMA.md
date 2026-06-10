# HexaAttender Updated Schema

## Role Hierarchy
- `SUPER_ADMIN` -> creates `HOD`
- `HOD` -> creates `FACULTY`
- `FACULTY` -> creates `STUDENT`
- `STUDENT` -> no self-registration

## Core Tables

### `authentication_user`
- `id` (UUID, PK)
- `username` (unique)
- `email` (unique expected by login flow)
- `password` (hashed)
- `first_name`, `last_name`, `phone`
- `role` (`SUPER_ADMIN|HOD|FACULTY|STUDENT`)
- `active_organization_id` (FK -> `organizations_organization`)
- `active_branch_id` (FK -> `organizations_branch`)
- `must_change_password`, `is_active`, `is_staff`, `is_superuser`

### `organizations_organizationmembership`
- `id` (UUID, PK)
- `user_id` (FK -> `authentication_user`)
- `organization_id` (FK -> `organizations_organization`)
- `branch_id` (nullable FK -> `organizations_branch`)
- `department_id` (nullable FK -> `organizations_department`)
- `role` (`SUPER_ADMIN|HOD|FACULTY|STUDENT`)
- `is_active`
- Audit fields (`created_at`, `updated_at`, `created_by`, `updated_by`)

### `staff_faculty`
- Faculty profile linked to `authentication_user` (`user_id`)
- Created only by HOD endpoints/permissions

### `students_student`
- Student profile linked to `authentication_user` (`user_id`)
- Created only by Faculty endpoints/permissions
- Includes academic attributes (`roll_no`, `department`, `course`, `semester`, etc.)

### `face_recognition_faceenrollment`
- `user_id` + optional `student_id`/`faculty_id`
- `encrypted_embedding` (encrypted biometric vector)
- `model_provider` (ArcFace), `detector_backend` (RetinaFace)
- `liveness_score`, `liveness_checks`

### `face_recognition_faceauditlog`
- Face event logs (`ENROLLMENT`, `VERIFICATION`, `FACE_LOGIN`, `LIVENESS_FAILED`, etc.)
- `actor_id`, `success`, `confidence`, `liveness_score`, `metadata`

### `attendance_attendancesession`
- Session metadata per period/date/subject

### `attendance_attendancerecord`
- Attendance record per student/session
- Auto-marked as `PRESENT` on successful student face-verified login

### `organizations_auditlog`
- Global audit trail for API mutating activity and auth/account events

## Auth/Flow Notes
- JWT access/refresh tokens are set as `HttpOnly` cookies.
- Client uses `credentials: include`; no JWT storage in localStorage.
- Student login requires:
  1. `POST /api/v1/auth/initiate-login` with `email + password`
  2. `POST /api/v1/auth/verify-face`
  3. `POST /api/v1/auth/complete-login`
