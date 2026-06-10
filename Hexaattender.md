# HexaAttender — Comprehensive System Documentation

> **Prepared by:** Surag | HexaStack Solutions
> **Website:** [https://www.hexastacksolutions.com](https://www.hexastacksolutions.com)
> **Product:** HexaAttender — AI-Powered Face Recognition Attendance Management System
> **Version:** 1.0 (Production Release 2026)
> **Stack:** Django REST Framework (Backend) · React + TypeScript + Vite (Frontend) · PostgreSQL · OpenCV · DeepFace · Docker

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [User Roles & Access Hierarchy](#3-user-roles--access-hierarchy)
4. [Page-by-Page Feature Reference](#4-page-by-page-feature-reference)
   - 4.1 [Login Page](#41-login-page)
   - 4.2 [Forgot Password Page](#42-forgot-password-page)
   - 4.3 [Reset Password Page](#43-reset-password-page)
   - 4.4 [Super Admin / HOD Admin Dashboard](#44-super-admin--hod-admin-dashboard)
   - 4.5 [Student Management Page](#45-student-management-page)
   - 4.6 [Staff Management Page](#46-staff-management-page)
   - 4.7 [Subject Management Page](#47-subject-management-page)
   - 4.8 [Timetable Management Page](#48-timetable-management-page)
   - 4.9 [Face Recognition Console](#49-face-recognition-console)
   - 4.10 [Capture Attendance Page](#410-capture-attendance-page)
   - 4.11 [Attendance Engine Page](#411-attendance-engine-page)
   - 4.12 [Reports Page](#412-reports-page)
   - 4.13 [Analytics Dashboard](#413-analytics-dashboard)
   - 4.14 [Notification Manager Page](#414-notification-manager-page)
   - 4.15 [Student Portal (Student Dashboard)](#415-student-portal-student-dashboard)
   - 4.16 [Faculty Staff Portal](#416-faculty-staff-portal)
5. [Face Recognition System — Deep Dive](#5-face-recognition-system--deep-dive)
6. [Attendance Workflow — End to End](#6-attendance-workflow--end-to-end)
7. [Session States & Approval Workflow](#7-session-states--approval-workflow)
8. [Notification System](#8-notification-system)
9. [Reports & Export System](#9-reports--export-system)
10. [Security & Authentication](#10-security--authentication)
11. [Database Schema Overview](#11-database-schema-overview)
12. [Deployment Architecture](#12-deployment-architecture)
13. [API Endpoint Reference](#13-api-endpoint-reference)
14. [Super Admin Credentials](#14-super-admin-credentials)

---

## 1. System Overview

**HexaAttender** is an enterprise-grade, AI-powered Attendance Management System built for academic institutions. It replaces traditional paper-based or manual attendance registers with an automated, face recognition-driven platform that marks students present the moment their face is identified by the system camera.

### Core Philosophy

- **Zero Manual Friction:** Students are automatically marked present on face recognition — no need to press any button or scan a card.
- **Role-Driven Access:** Four distinct user roles (Super Admin, HOD Admin, Faculty, Student) with isolated views and permissions.
- **Audit-First Design:** Every attendance record, correction, and administrative action is timestamped and logged with the acting user's identity.
- **Notification Intelligence:** Automatic alerts dispatched via Email, SMS, and WhatsApp when a student is absent or crosses a low-attendance threshold.
- **Multi-Layer Security:** JWT authentication, face liveness detection (anti-spoofing), AES-encrypted biometric vectors, and role-based API permissions.

---

## 2. Technology Stack

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui + Lucide Icons |
| Charts | Recharts (BarChart, AreaChart) |
| Routing | React Router v6 (lazy-loaded routes) |
| Auth State | React Context API + localStorage |

### Backend
| Layer | Technology |
|-------|-----------|
| Framework | Django 4.2 + Django REST Framework |
| Auth | JWT via `djangorestframework-simplejwt` |
| Database | PostgreSQL (default) / SQLite (dev) |
| Face Engine | OpenCV, dlib, `face_recognition` (128-dim embeddings) |
| Demographics | DeepFace (age, gender, emotion analysis) |
| Reports | openpyxl (Excel), ReportLab (PDF), csv (CSV) |
| Encryption | `cryptography` (AES — biometric vectors at rest) |
| Deployment | Docker + Nginx (reverse proxy) |

### Infrastructure
| Component | Detail |
|-----------|--------|
| Containerization | Docker Compose (backend + frontend + nginx + postgres) |
| CI/CD | GitHub Actions (`.github/workflows/deploy.yml`) |
| Web Server | Nginx (SSL-ready, `default.ssl.conf.example` included) |
| Logging | Rotating file logger → `backend/logs/hexatrack_errors.log` |

---

## 3. User Roles & Access Hierarchy

HexaAttender implements a strict four-tier role hierarchy. Each role has an isolated dashboard layout and a scoped set of pages.

```
┌──────────────────────────────────────────────────────┐
│                   SUPER ADMIN                        │
│  Full system control — all departments, all data     │
│  Password: AthulTs@123!                              │
├──────────────────────────────────────────────────────┤
│                   HOD ADMIN                          │
│  Department-level control — registers faculty,       │
│  approves sessions, views department reports         │
├──────────────────────────────────────────────────────┤
│                   FACULTY                            │
│  Class-level control — takes attendance,             │
│  views own session reports, manages student lists    │
├──────────────────────────────────────────────────────┤
│                   STUDENT                            │
│  Read-only — views own attendance records,           │
│  subject-wise breakdown, promotion standing          │
└──────────────────────────────────────────────────────┘
```

### Role Permissions Matrix

| Feature | Super Admin | HOD Admin | Faculty | Student |
|---------|:-----------:|:---------:|:-------:|:-------:|
| Register Departments / HODs | ✅ | ❌ | ❌ | ❌ |
| Register Faculty | ✅ | ✅ | ❌ | ❌ |
| Register Students | ✅ | ✅ | ✅ | ❌ |
| Enroll Student Face Biometrics | ✅ | ✅ | ✅ | ❌ |
| Take Attendance (Face / Manual) | ✅ | ✅ | ✅ | ❌ |
| Approve / Reject Attendance Sessions | ✅ | ✅ | ❌ | ❌ |
| View All Departments' Reports | ✅ | ❌ | ❌ | ❌ |
| View Department Reports | ✅ | ✅ | ❌ | ❌ |
| View Own Class Reports | ✅ | ✅ | ✅ | ❌ |
| View Own Attendance | ✅ | ✅ | ✅ | ✅ |
| Manage Notification Templates | ✅ | ✅ | ❌ | ❌ |
| Configure Timetable | ✅ | ✅ | ❌ | ❌ |
| Manage Subjects | ✅ | ✅ | ❌ | ❌ |

---

## 4. Page-by-Page Feature Reference

### 4.1 Login Page

**URL:** `/login`
**Access:** Public (unauthenticated)

The Login page is the single entry point for all four user roles. It presents a clean, minimal card interface with the HexaAttender brand logo and a role-selection grid.

#### Features

**Role Switcher (2×2 Grid)**
The top section of the login form shows four role buttons in a pill-grid layout:

| Button | Icon | Role Assigned |
|--------|------|---------------|
| Super Admin | ✨ Sparkles | `SUPER_ADMIN` |
| Admin HOD | 🛡️ Shield | `ADMIN` |
| Faculty Staff | 👤 UserCheck | `FACULTY` |
| Student View | 🎓 GraduationCap | `STUDENT` |

Selecting a role auto-populates the username field with a role-appropriate identifier. This is a **demo quick-switch** feature for showcase/testing.

**Login Form Fields**
- **Username / Identity** — text field pre-populated per selected role
- **Security Hashed Password** — password field (masked)
- **Forgot Password?** — link to `/forgot-password`
- **Sign In to Portal** — submit button

**Post-Login Routing**
After authentication, users are redirected to role-specific dashboards:

| Role | Redirect URL |
|------|-------------|
| SUPER_ADMIN | `/admin` |
| ADMIN (HOD) | `/admin` |
| FACULTY | `/staff` |
| STUDENT | `/student` |

**Security Notes**
- Passwords are hashed server-side using Django's default PBKDF2 hashing
- Login issues JWT access + refresh tokens stored in `localStorage`
- Session persistence is managed via `AuthContext` and `localStorage`

---

### 4.2 Forgot Password Page

**URL:** `/forgot-password`
**Access:** Public

A simple one-field form where the user enters their registered email address. The backend generates a secure one-time reset link using Django's `default_token_generator` and dispatches it. For privacy, the response is always `"A secure password reset link has been dispatched to your email if a matching account exists"` regardless of whether the email exists (prevents user enumeration).

**Fields:** Email address input

---

### 4.3 Reset Password Page

**URL:** `/reset-password?uid=<uidb64>&token=<token>`
**Access:** Public (link-authenticated)

Accessed via the email reset link. The user enters and confirms a new password. The `uidb64` and `token` URL parameters are validated server-side before the password change is committed.

**Fields:** New Password · Confirm New Password

---

### 4.4 Super Admin / HOD Admin Dashboard

**URL:** `/admin`
**Access:** SUPER_ADMIN, ADMIN (HOD)
**Layout:** `AdminLayout` — left sidebar navigation with collapsible menu

The main command center. The view rendered adapts based on the logged-in user's role.

#### Super Admin View — Statistics Cards (6 Cards)

| Card | Metric |
|------|--------|
| Total Students | Count of registered students |
| Total Faculty Staff | Count across all departments |
| Total Departments | Institutional department count |
| Total Subjects | Across all programmes |
| Today's Attendance | Count logged by face recognition |
| Attendance Percentage | System-wide daily average |

#### HOD Admin View — Statistics Cards (4 Cards)

| Card | Metric |
|------|--------|
| Total Students Registered | Department-scoped count |
| Active Faculty Staff | Department-scoped |
| Subjects Configured | Across department programmes |
| Today's Avg Attendance | Department percentage |

#### Charts (Both Views)

**Weekly Attendance Bar Chart** — 5-day bar chart (Mon–Fri) showing daily attendance percentage using Recharts `BarChart`. Custom emerald-themed tooltip.

**Monthly Attendance Area Chart** — 5-month trend area chart (Jan–May) using Recharts `AreaChart` with gradient fill.

**Department Standing Bar Chart** (Super Admin only) — Bar chart comparing student count and attendance standing across CS, SE, EE, ME, CE departments.

#### Recent Audit Activity Log

A time-ordered log of the last few system actions, displaying:
- Action type (e.g., "Face enrolled successfully")
- Subject entity (e.g., student roll number and name)
- Acting user (e.g., "Admin (Surag M S)")
- Relative timestamp (e.g., "10 mins ago")

---

### 4.5 Student Management Page

**URL:** `/admin/students`
**Access:** SUPER_ADMIN, ADMIN, FACULTY
**Component:** `StudentList.tsx`

Full CRUD management interface for the student roster.

#### Features

**Student Table Columns**
- Roll Number (primary key, unique)
- Student Name
- Department
- Year & Semester
- Date of Birth
- Phone / Email
- Campus Status (Day Scholar / Hosteller)
- Face Enrolled status badge (✅ Enrolled / ⚠️ Pending)
- Actions (Edit · Archive)

**Search & Filter**
- Live search by name or roll number
- Filter by department, semester, year, face enrollment status
- Toggle to show/hide archived students

**Add New Student Form**
A slide-in panel or modal with fields:
- Roll Number · Full Name · Department · Year · Semester
- Date of Birth · Phone · Email · Address
- Campus Status (Day Scholar / Hosteller)

**Face Enrollment Status**
Each student row shows whether their biometric face data is enrolled. Un-enrolled students cannot be identified by the face recognition system. The `face_enrolled` boolean flag and encrypted `face_vector` (128-D embedding) are stored in the database.

**Archive vs. Delete**
Students are soft-deleted via `is_archived = True`. Archived students are hidden from active rosters and attendance capture but their historical records are preserved.

**Data Model Fields**
```
roll_no (PK)   name              department    year          semester
dob            phone             email         address       campus_status
face_enrolled  face_vector (AES) photo_path    is_archived
```

---

### 4.6 Staff Management Page

**URL:** `/admin/staff`
**Access:** SUPER_ADMIN, ADMIN (HOD)
**Component:** `StaffList.tsx`

Management console for faculty staff profiles.

#### Features

**Staff Table Columns**
- Staff Code (`Scode` — primary key)
- Full Name
- Father's Name (`ssname`)
- Department
- Designation
- Salary (decimal)
- Email · Phone
- Username (linked system user)
- Assigned Subjects (count + expandable list)
- Assigned Classes (Programme + Semester cohorts)
- Workload (credit hours)
- Recent Session History

**Registering a Faculty Member**
HOD or Super Admin fills a registration form with:
- Staff Code · Full Name · Father's Name · Department · Designation · Salary
- Email · Phone
- Username + Password (creates a linked `User` account with `FACULTY` role)

**Subject Assignment**
Each staff member can be assigned one or more subjects from the subject catalogue. Subject load is tracked in credit hours (e.g., 3 credits per subject).

**Session History Panel**
For each faculty, a history of their attendance sessions is shown:
- Date · Period Hour · Subject Code · Class Cohort
- Total Students / Present / Absent
- Session Status (OPEN / LOCKED)

---

### 4.7 Subject Management Page

**URL:** `/admin/subjects`
**Access:** SUPER_ADMIN, ADMIN
**Component:** `SubjectList.tsx`

CRUD interface for academic subjects.

#### Features

**Subject Table Columns**
- Subject Code (PK, e.g., `MCS-101`)
- Subject Name
- Programme (e.g., MCS, BSCS, MPhil)
- Semester (1–8)
- Credits (default: 3)
- Department
- Assigned Staff (lecturer name + code)

**Add / Edit Subject Form**
Fields: Subject Code · Name · Programme · Semester · Credits · Department · Assigned Staff (dropdown from staff roster)

**Staff Assignment**
A subject is linked to a `StaffProfile` via foreign key. If the assigned staff leaves, the field is set to NULL without deleting the subject (`SET_NULL`).

---

### 4.8 Timetable Management Page

**URL:** `/admin/timetable`
**Access:** SUPER_ADMIN, ADMIN
**Component:** `Timetable.tsx`

A 7-period × 6-day grid timetable editor for each academic programme and semester combination.

#### Features

**Timetable Grid**
For a selected Programme + Semester:
- Rows: Days (Monday through Saturday)
- Columns: 7 periods with fixed time slots

| Period | Time Slot |
|--------|-----------|
| Period I | 08:30 AM – 09:30 AM |
| Period II | 09:30 AM – 10:30 AM |
| Period III | 10:30 AM – 11:30 AM |
| Period IV | 11:30 AM – 12:30 PM |
| Period V | 01:30 PM – 02:30 PM |
| Period VI | 02:30 PM – 03:30 PM |
| Period VII | 03:30 PM – 04:30 PM |

Each cell is a subject selector. Selecting a subject for a slot creates a `TimetableEntry` record in the database.

**Programme / Semester Selector**
Filter controls allow switching between different programme and semester combinations (e.g., MCS Semester I, BSCS Semester III).

**Unique Constraint**
Each `(day, programme, semester)` combination is unique — only one timetable row per day per class cohort.

---

### 4.9 Face Recognition Console

**URL:** `/admin/face-recognition` | `/staff/face-recognition`
**Access:** SUPER_ADMIN, ADMIN, FACULTY
**Component:** `FaceRecognition.tsx`

A multi-tab biometric interface powered by the system's webcam and the backend OpenCV/dlib/DeepFace engine.

#### Tabs

##### Tab 1 — Register Face
Used to enroll a student's face biometric template for the first time.

**Workflow:**
1. Select the student from the enrolled database list (searchable dropdown)
2. Click **Start Camera** to activate the webcam (640×480, front-facing)
3. Position the student's face within the camera frame
4. Click **Capture & Register** — the frame is encoded as base64 and sent to `POST /api/face-recognition/register/`
5. The backend runs the **Liveness / Anti-Spoofing Check** before accepting the image
6. If liveness passes, the 128-dimensional face embedding vector is computed and stored in the database (AES-encrypted)
7. A confirmation with liveness score, encoding dimensions, and enrollment status is shown

**Liveness Detection Checks (Anti-Spoofing)**
The system verifies that the image comes from a real person — not a photo, printed image, or screen replay — using four simultaneous checks:

| Check | Method | Detects |
|-------|--------|---------|
| Photo Attack Prevention | Laplacian variance (texture analysis) | Flat printed photos |
| Screen Attack Prevention | FFT frequency ratio analysis | Screen replay attacks |
| Eye Blink Validation | Eye Aspect Ratio (EAR) | Closed eyes / no blink |
| Pose Validation | Facial landmark pose ratio | Extreme angles |

A composite **Liveness Score (0–100%)** is computed. Only images passing all four checks are accepted for registration.

##### Tab 2 — Verify Face
One-to-one face matching for a specific student.

**Workflow:**
1. Select a student (who must be already enrolled)
2. Capture a webcam frame
3. The backend compares the new 128-D embedding against the stored reference using **Euclidean distance** with a tolerance of `0.45`
4. Returns: Match status · Distance score · Confidence percentage

**Matching Algorithm**
```
Distance = ||known_vector − test_vector||₂
Confidence = (1 − distance / tolerance) × 100%
Match = distance ≤ 0.45
```

##### Tab 3 — Detect Faces
Multi-face detection in a single frame using the HOG (Histogram of Oriented Gradients) model.

Returns bounding box coordinates `(top, right, bottom, left)` for each detected face, enabling real-time face localization without identity matching.

##### Tab 4 — Analyze Face
DeepFace demographic attribute analysis of a captured frame.

Returns:
- **Estimated Age**
- **Dominant Gender** (Male / Female)
- **Dominant Emotion** (happy, sad, angry, neutral, surprise, fear, disgust)
- **Emotion Scores** — percentage confidence for each emotion
- **Dominant Race** classification

This tab is informational and does not affect attendance records.

---

### 4.10 Capture Attendance Page

**URL:** `/admin/attendance-capture` | `/staff/capture`
**Access:** SUPER_ADMIN, ADMIN, FACULTY
**Component:** `CaptureAttendance.tsx`

Live classroom attendance capture using the webcam for face-recognition-based batch identification.

#### Workflow

1. Faculty selects **Date**, **Period Hour** (I–VII), and **Subject**
2. Clicks **Start Camera** to activate the webcam stream
3. Points the camera at the classroom / students
4. Clicks **Scan for Attendance** — the live frame is sent to the recognition endpoint
5. The system identifies all recognized faces in the frame simultaneously
6. Recognized students are displayed with their name, roll number, and confidence score
7. Faculty reviews the auto-captured list and clicks **Submit Attendance**
8. Records are batch-inserted to the database via `POST /api/attendance/automatic/`

#### Automatic Attendance Logic
- Attendance is marked **PRESENT** with `capture_method = FACE_RECOGNITION`
- Each record stores the `confidence_score` (0–100%)
- Duplicate submissions for the same session are silently skipped (idempotent insert)
- Cross-session overlap is checked — a student cannot be marked present in two subjects at the same hour

---

### 4.11 Attendance Engine Page

**URL:** `/admin/attendance` | `/staff` (Faculty home)
**Access:** SUPER_ADMIN, ADMIN, FACULTY
**Component:** `AttendanceEngine.tsx`

The core attendance management hub combining session management, manual entry, and correction capabilities.

#### Features

**Session Selector**
Dropdowns for Date · Period Hour · Subject to load or create an attendance session.

**Attendance Grid**
A full class roster table showing each student's name, roll number, and an editable status selector:
- **PRESENT** · **ABSENT** · **LATE** · **EXCUSED**

**Capture Methods**
- **Face Recognition** — auto-imported from the Capture Attendance workflow
- **Manual Entry** — faculty manually marks each student (`capture_method = MANUAL_ENTRY`)
- **Correction** — overrides a previous record with a reason note (`capture_method = CORRECTION`)

**Correction Audit Trail**
When a manual correction is applied:
- The original status is saved to `original_status`
- Correction notes are stored in `correction_notes`
- Timestamp is recorded in `corrected_at`
- The acting user is logged via the `updated_by` audit field

**Session Locking**
Once a session is submitted, it enters a locked state and can no longer be modified without HOD approval (see Session States section).

**Real-Time Counts**
The session card displays live counts of:
- Present · Absent · Late · Excused · Total Enrolled
- Attendance Percentage = (Present + Late + Excused) / Total × 100

---

### 4.12 Reports Page

**URL:** `/admin/reports` | `/staff/reports`
**Access:** SUPER_ADMIN, ADMIN, FACULTY
**Component:** `ReportsView.tsx`

Comprehensive attendance reports with multiple time-range views and export capabilities.

#### Report Types

**Daily Report**
- Date picker to select any single date
- Optional subject filter
- Grid: Each student as a row, 7 period columns showing status per period
- Summary: Total present entries, total possible entries, overall daily percentage

**Weekly Report**
- Date range picker (any 7-day span)
- Grid: Each student as a row with Mon–Sat columns
- Per-day counts: Present / Total
- Chart: Day-wise present vs. absent bar chart

**Monthly Report**
- Month + Year selector
- Grid: Each student with Week 1–4 breakdown
- Summary per student: Total periods, present count, absent count, percentage
- Month-level overall percentage

**Semester Report**
- Full semester aggregation
- Per-student totals with promotion eligibility flag (≥75% threshold)
- Subject-wise breakdown per student

**Subject Report**
- Filter by specific subject code
- All sessions for that subject with per-student attendance history

#### Export Formats
All reports can be exported from the Reports page:

| Format | Description |
|--------|-------------|
| **Excel (.xlsx)** | Multi-sheet workbook with styled tables (via openpyxl) |
| **PDF (.pdf)** | Formatted printable report (via ReportLab) |
| **CSV (.csv)** | Raw data export for external tools |
| **Print** | Browser print dialog trigger |

---

### 4.13 Analytics Dashboard

**URL:** `/admin/analytics` | `/staff/analytics`
**Access:** SUPER_ADMIN, ADMIN, FACULTY
**Component:** `AnalyticsDashboard.tsx`

Advanced visual analytics with Recharts-powered charts for institutional insight.

#### Analytics Panels

- **Attendance Trend** — Multi-period area chart over configurable date range
- **Department Comparison** — Grouped bar chart comparing attendance across departments
- **Subject Performance** — Attendance ranking by subject
- **At-Risk Students** — Students below the 75% attendance threshold
- **Cohort Analysis** — Programme × Semester attendance heatmap
- **Daily Pattern** — Hour-by-hour attendance distribution across periods

---

### 4.14 Notification Manager Page

**URL:** `/admin/notifications`
**Access:** SUPER_ADMIN, ADMIN
**Component:** `NotificationManager.tsx`

Full notification template management and dispatch log viewer.

#### Notification Trigger Types

| Trigger | When Fired |
|---------|-----------|
| `ABSENT_ALERT` | Student marked absent in a session |
| `LOW_ATTENDANCE` | Student's cumulative attendance falls below threshold |
| `ATTENDANCE_SUMMARY` | Scheduled consolidated summary dispatch |
| `ADMIN_ALERT` | System events (e.g., new biometric enrollment) |

#### Notification Channels

| Channel | Description |
|---------|-------------|
| `EMAIL` | Email transmission to student/guardian |
| `SMS` | SMS text message |
| `WHATSAPP` | WhatsApp message |

#### Template Management
Each `(trigger_type, channel)` combination has one template (enforced as a unique constraint). Templates use interpolatable placeholders: `{student_name}`, `{roll_no}`, `{date}`, `{percentage}`, etc.

**Template fields:** Trigger Type · Channel · Subject (for email) · Body Template · Active/Inactive toggle

#### Notification Log
A searchable audit table of every notification dispatch attempt:
- Recipient (email / mobile number)
- Trigger type · Channel · Status (SENT / FAILED / PENDING)
- Message body · Error message (if failed)
- Timestamp

---

### 4.15 Student Portal (Student Dashboard)

**URL:** `/student`
**Access:** STUDENT only
**Layout:** `StudentLayout`
**Component:** `StudentDashboard.tsx`

A read-only personal attendance dashboard for students.

#### Features

**Welcome Banner**
- Personalized greeting with full name
- Academic programme, semester, roll number
- Promotion Standing badge (ELIGIBLE / AT RISK based on ≥75% threshold)

**Stats Cards (3 Cards)**

| Card | Data |
|------|------|
| My Overall Attendance | Cumulative percentage (required: 75.0%) |
| Total Session Classes | Count of total periods held, present slots |
| Absence Count | Hours absent; excused count separately noted |

**Subject-Wise Attendance Breakdown**
For each enrolled subject:
- Subject code badge (e.g., MCS-101)
- Subject name
- Visual progress bar (emerald fill, proportional to percentage)
- Present / Total slots
- Required threshold reminder (75%)
- Numeric percentage

**Automatic Attendance via Face Login**
When a student logs in using face recognition, their attendance is automatically marked for the current active session — no additional action required. Each successful login in a class period results in a `PRESENT` record being created.

---

### 4.16 Faculty Staff Portal

**URL:** `/staff`
**Access:** FACULTY only
**Layout:** `StaffLayout`

Faculty users have a scoped portal with the following pages:

| Path | Page |
|------|------|
| `/staff` | Attendance Engine (Faculty home) |
| `/staff/capture` | Capture Attendance (Face Recognition) |
| `/staff/face-recognition` | Face Recognition Console |
| `/staff/manual` | Student List (Manual Attendance) |
| `/staff/reports` | Reports View (scoped to own classes) |
| `/staff/analytics` | Analytics Dashboard (scoped) |

Faculty can register students (if permitted by HOD), enroll student faces, take attendance, view and export reports for their own classes.

---

## 5. Face Recognition System — Deep Dive

The face recognition pipeline is implemented in `apps/face_recognition/services.py` using a combination of OpenCV, dlib, the `face_recognition` library, and DeepFace.

### Biometric Enrollment Flow

```
Student Photo → Base64 Decode → OpenCV BGR→RGB → 
face_recognition.face_encodings() → 128-D Vector → 
AES Encrypt → Store in DB (face_vector field)
```

### Attendance Recognition Flow (Live)

```
Webcam Frame → Base64 Encode → POST /api/face-recognition/detect/ →
face_recognition.face_locations() → Bounding Boxes →
face_recognition.face_encodings() → Probe Vectors →
Compare each probe vs. all enrolled vectors (Euclidean distance) →
Matches (distance ≤ 0.45) → Mark PRESENT → POST /api/attendance/automatic/
```

### Anti-Spoofing (Liveness Detection)

Every registration and verification call runs liveness analysis before accepting the image:

```python
liveness_checks = {
    "photo_attack_prevented":  laplacian_variance > threshold,
    "screen_attack_prevented": fft_high_freq_ratio < threshold,
    "eye_blink_passed":        ear_average > 0.2,
    "pose_validation_passed":  pose_ratio within acceptable range
}
liveness_score = weighted_average(checks)
accept_if: all checks pass AND liveness_score > minimum_threshold
```

### Biometric Data Security

- Face vectors are stored as `EncryptedJSONField` — AES-encrypted at rest using the `cryptography` library
- Photo paths are stored as `EncryptedCharField`
- The raw 128-D vector is never exposed in any API response
- Tolerance threshold: `0.45` (configurable). Lower = stricter matching.

### Failure Limit / Login Attempt Control

The system is designed to limit failed face recognition attempts. After **3–5 consecutive failed recognition attempts** within an hour, the system halts further recognition attempts for that session, preventing brute-force or persistent spoofing attempts. The faculty must intervene to manually record attendance in such cases.

---

## 6. Attendance Workflow — End to End

### Scenario A: Face Recognition Attendance

```
1. Faculty opens Capture Attendance page
2. Selects: Date, Period Hour (I–VII), Subject
3. Activates webcam → system scans the classroom frame
4. Backend identifies all enrolled students in frame
5. Recognized students auto-listed with confidence scores
6. Faculty clicks Submit → records batch-inserted
7. Students marked PRESENT (capture_method: FACE_RECOGNITION)
8. Session status set to OPEN
9. Faculty submits for HOD approval → status → SUBMITTED
10. HOD Approves → status → APPROVED (locked, immutable)
```

### Scenario B: Manual Attendance Entry

```
1. Faculty opens Attendance Engine
2. Selects session parameters
3. Full class roster shown with status selectors
4. Faculty marks each student (PRESENT / ABSENT / LATE / EXCUSED)
5. Submits → records saved (capture_method: MANUAL_ENTRY)
```

### Scenario C: Attendance Correction

```
1. Faculty or Admin finds an error in a submitted record
2. Opens the session in Attendance Engine
3. Edits the specific student's status
4. Enters correction notes (mandatory)
5. System saves: original_status, correction_notes, corrected_at, updated_by
6. Record marked (capture_method: CORRECTION)
```

### Scenario D: Student Face Login → Auto Mark Present

```
1. Student arrives at class
2. Face is captured by the classroom camera system
3. Backend matches face against enrolled vectors
4. Match confirmed → attendance record auto-created for current period
5. Student's portal immediately reflects PRESENT for that period
```

---

## 7. Session States & Approval Workflow

Each attendance session progresses through the following state machine:

```
OPEN ──────────────→ SUBMITTED ──────────────→ APPROVED
  ↑                      │                         │
  │                      ↓                         ↓
  └── (re-open) ─── REJECTED                    LOCKED
```

| State | Meaning | Editable |
|-------|---------|----------|
| `OPEN` | Actively accepting entries | ✅ Yes |
| `SUBMITTED` | Faculty submitted for HOD review | ❌ Locked |
| `APPROVED` | HOD approved — locked | ❌ Locked |
| `REJECTED` | HOD rejected — needs correction | ✅ Re-opened |
| `LOCKED` | Finalized by system | ❌ Locked |

The `is_locked` property returns `True` for states: SUBMITTED, APPROVED, LOCKED. Any attempt to modify a locked session returns an error.

---

## 8. Notification System

Notifications are dispatched automatically as attendance events occur:

### Absent Alert
**Trigger:** Any student marked `ABSENT` in a session
**Recipient:** Student (email) and/or guardian (SMS / WhatsApp)
**Template variables:** `{student_name}`, `{roll_no}`, `{date}`, `{hour}`, `{subject}`

### Low Attendance Alert
**Trigger:** Student's cumulative attendance drops below the configured threshold
**Recipient:** Student and Admin
**Template variables:** `{student_name}`, `{roll_no}`, `{percentage}`, `{required_percentage}`

### Admin Alert
**Trigger:** Security-significant events (new biometric enrollment, failed liveness checks, admin actions)
**Recipient:** Super Admin and HOD
**Channels:** Email (primary)

### Notification Delivery Logic
Notifications are dispatched outside the database transaction to prevent slow external API calls from locking the database. Failed deliveries are logged with error details in `NotificationLog` for manual retry.

---

## 9. Reports & Export System

### Report Generation Engine (`apps/reports/services.py`)

**Daily Report:** For a given date (optional subject filter), produces a period-by-period grid for all students. Defaults absent periods to PRESENT for compatibility with legacy daily sheets.

**Weekly Report:** For a 7-day window, produces day-wise aggregates (Mon–Sat) with present/total per day and an overall percentage per student. Includes a chart_data payload for frontend bar chart rendering.

**Monthly Report:** For a month/year, produces week-by-week breakdown (Week 1–4) with per-student summary totals.

**Semester Report:** Full aggregation from semester start to end, including promotion eligibility (≥75%).

**Subject Report:** Session-by-session breakdown for a single subject.

### Export Pipeline

| Export | Library | Output |
|--------|---------|--------|
| Excel | `openpyxl` | Multi-sheet `.xlsx` with styled headers |
| PDF | `ReportLab` | Formatted printable `.pdf` |
| CSV | `csv` (stdlib) | Plain `.csv` for data tools |

---

## 10. Security & Authentication

### JWT Authentication
- Access tokens issued by `djangorestframework-simplejwt`
- Tokens stored in browser `localStorage` (`ams_jwt_token`)
- Stateless logout — token is discarded client-side with an audit log entry

### Role-Based API Permissions
Custom permission classes (`apps/authentication/permissions.py`) enforce role checks at the API view level. Each endpoint checks `user.role` before serving any data.

### Biometric Data Protection
- Face vectors encrypted with AES (via `cryptography` library) as `EncryptedJSONField`
- Photo paths encrypted as `EncryptedCharField`
- Vectors never returned raw in API responses

### Password Security
- Django's default PBKDF2-SHA256 password hashing
- Password reset uses cryptographically signed one-time tokens
- Change password requires current password verification

### CORS
`django-cors-headers` middleware configured; in production, allowed origins should be restricted to the frontend domain.

### Audit Trail
Every model inherits from `AuditableModel` which auto-populates:
- `created_at` — creation timestamp
- `updated_at` — last modification timestamp
- `created_by` — user who created the record
- `updated_by` — user who last modified the record

---

## 11. Database Schema Overview

### Core Tables

```
users (authentication_user)
  ├── id, username, password, email, first_name, last_name
  ├── role: SUPER_ADMIN | ADMIN | FACULTY | STUDENT
  └── phone

staff_profiles (staff_staffprofile)
  ├── staff_code (PK), user_id (FK → users)
  ├── father_name, department, designation, salary
  └── audit fields

students (students_student)
  ├── roll_no (PK), name, department, year, semester
  ├── dob, phone, email, address, campus_status
  ├── face_enrolled, face_vector (encrypted), photo_path (encrypted)
  └── is_archived, audit fields

subjects (subjects_subject)
  ├── subject_code (PK), name, programme, semester, credits
  ├── department, assigned_staff (FK → staff_profiles)
  └── audit fields

timetable_entries (timetable_timetableentry)
  ├── id, day, programme, semester
  ├── period_1 … period_7 (FK → subjects, nullable)
  └── UNIQUE: (day, programme, semester)

attendance_sessions (attendance_attendancesession)
  ├── id, date, hour (I–VII), subject (FK)
  ├── session_status: OPEN | SUBMITTED | APPROVED | REJECTED | LOCKED
  ├── total_students
  └── UNIQUE: (date, hour, subject)

attendance_records (attendance_attendancerecord)
  ├── id, session (FK), student (FK)
  ├── status: PRESENT | ABSENT | LATE | EXCUSED
  ├── capture_method: FACE_RECOGNITION | MANUAL_ENTRY | CORRECTION
  ├── confidence_score (float, nullable)
  ├── correction_notes, corrected_at, original_status
  └── UNIQUE: (session, student)

notification_templates
  ├── trigger_type, channel, subject, body_template, is_active
  └── UNIQUE: (trigger_type, channel)

notification_logs
  ├── recipient, trigger_type, channel
  ├── status: SENT | FAILED | PENDING
  └── subject, message_body, error_message
```

---

## 12. Deployment Architecture

### Docker Compose Stack

```
docker-compose.yml
├── backend      Django app (Gunicorn/ASGI)
│                Port: 8000 (internal)
│                Depends: postgres
├── frontend     Vite-built static files (dist/)
│                Served by Nginx
├── nginx        Reverse proxy
│                Port: 80 (HTTP), 443 (HTTPS — SSL config included)
│                Proxies /api/* → backend:8000
│                Serves / → frontend dist/
└── postgres     PostgreSQL 15
                 Volume-mounted for persistence
```

### Nginx Configuration
- `default.conf` — HTTP proxy config
- `default.ssl.conf.example` — HTTPS config template (SSL certificate paths to be configured)

### CI/CD Pipeline
GitHub Actions workflow (`.github/workflows/deploy.yml`) handles:
- Automated testing (`pytest`)
- Docker image build
- Deployment to production server

### Environment Variables (`.env.prod.example`)
Key variables include:
- `DJANGO_SECRET_KEY` — Django secret key
- `DJANGO_DEBUG` — Debug mode toggle
- `DATABASE_URL` — PostgreSQL connection string
- `USE_SQLITE` — Switch to SQLite for quick development

---

## 13. API Endpoint Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/token/` | Obtain JWT access + refresh tokens |
| GET | `/api/auth/me/` | Get current user profile |
| POST | `/api/auth/logout/` | Logout (audit log) |
| POST | `/api/auth/forgot-password/` | Generate reset link |
| POST | `/api/auth/reset-password/` | Confirm reset with token |
| POST | `/api/auth/change-password/` | Change password (authenticated) |

### Students
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/students/` | List students (paginated, filterable) |
| POST | `/api/students/` | Create student |
| GET/PUT/PATCH | `/api/students/<roll_no>/` | Retrieve / update student |
| DELETE | `/api/students/<roll_no>/` | Archive student |

### Staff
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/staff/` | List staff profiles |
| POST | `/api/staff/` | Register new faculty |
| GET/PUT/PATCH | `/api/staff/<staff_code>/` | Retrieve / update staff |

### Subjects & Timetable
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/subjects/` | List / create subjects |
| GET/POST | `/api/timetable/` | List / create timetable entries |

### Face Recognition
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/face-recognition/register/` | Enroll student face |
| POST | `/api/face-recognition/verify/` | 1:1 face verify |
| POST | `/api/face-recognition/detect/` | Detect all faces in frame |
| POST | `/api/face-recognition/analyze/` | DeepFace demographic analysis |

### Attendance
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/attendance/automatic/` | Submit face-recognition batch |
| POST | `/api/attendance/manual/` | Submit manual entry |
| PATCH | `/api/attendance/correct/` | Apply correction to record |
| GET | `/api/attendance/sessions/` | List sessions |
| PATCH | `/api/attendance/sessions/<id>/submit/` | Submit for approval |
| PATCH | `/api/attendance/sessions/<id>/approve/` | HOD approve |
| PATCH | `/api/attendance/sessions/<id>/reject/` | HOD reject |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/daily/` | Daily attendance report |
| GET | `/api/reports/weekly/` | Weekly report |
| GET | `/api/reports/monthly/` | Monthly report |
| GET | `/api/reports/semester/` | Semester report |
| GET | `/api/reports/subject/` | Subject-wise report |
| GET | `/api/reports/export/excel/` | Export Excel |
| GET | `/api/reports/export/pdf/` | Export PDF |
| GET | `/api/reports/export/csv/` | Export CSV |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/notifications/templates/` | List / manage templates |
| GET | `/api/notifications/logs/` | View dispatch logs |

---

## 14. Super Admin Credentials

| Field | Value |
|-------|-------|
| **Username** | `super_admin_surag` |
| **Password** | `AthulTs@123!` |
| **Role** | `SUPER_ADMIN` |
| **Portal URL** | `/admin` |
| **Full Name** | Surag M S (HexaStack) |
| **Email** | superadmin@hexastack.com |

> **Security Notice:** Change this password immediately after the first production deployment. The Super Admin account has unrestricted access to all system data, configurations, and user records across all departments.

---

## Appendix — Attendance Status Definitions

| Status | Meaning |
|--------|---------|
| PRESENT | Student was present and attended the period |
| ABSENT | Student was not present |
| LATE | Student arrived after the period started |
| EXCUSED | Absence was officially excused (medical, event, etc.) |

For the purpose of the 75% attendance threshold calculation:
**PRESENT + LATE + EXCUSED** are all counted as attended periods.

---

## Appendix — Period Schedule

| Period | Time Slot |
|--------|-----------|
| Period I | 08:30 AM – 09:30 AM |
| Period II | 09:30 AM – 10:30 AM |
| Period III | 10:30 AM – 11:30 AM |
| Period IV | 11:30 AM – 12:30 PM |
| *(Break)* | 12:30 PM – 01:30 PM |
| Period V | 01:30 PM – 02:30 PM |
| Period VI | 02:30 PM – 03:30 PM |
| Period VII | 03:30 PM – 04:30 PM |

---

*Documentation prepared by **Surag | HexaStack Solutions***
*Website: [https://www.hexastacksolutions.com](https://www.hexastacksolutions.com)*
*HexaAttender v1.0 — Powered by Surag M S| Django + React | 2026*