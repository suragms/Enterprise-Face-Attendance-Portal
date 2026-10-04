# Enterprise Face Attendance Portal (HexaAttender)

An advanced, enterprise-grade multi-tenant face biometrics attendance portal designed for universities, colleges, and organizations. The portal features multi-tenant organization scoping, department level access control (HOD/Faculty/Student), real-time face verification (2FA login step for students), LMS courses, exams, analytical dashboards, and automatic liveness detection.

> **Academic Project Notice**: This is an academic project submitted for the **Master of Computer Applications (MCA) at Indira Gandhi National Open University (IGNOU)**.
> **Commercial Status**: This is a **Paid Project** developed exclusively by **Surag**. All rights reserved. Do not use, copy, modify, or distribute this codebase without explicit written permission.

---

## 🛠️ Technology Stack

| Layer | Technologies / Libraries |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS, Lucide Icons |
| **Backend** | Python 3.11+, Django 4.2+, Django REST Framework (DRF) |
| **AI / Biometrics** | OpenCV, DeepFace, ArcFace, RetinaFace |
| **Database & Caching** | PostgreSQL 15+ (Production) / SQLite3 (Development), Redis 7+ |
| **Task Queue** | Celery, Celery Beat |
| **Deployment** | Docker, Docker Compose, Nginx, GitHub Actions (CI/CD) |
| **Security** | JWT via HTTP-only Cookies, RBAC, AES-encrypted Face Embeddings, Face Liveness anti-spoofing checks (texture, eye aspect ratio, FFT frequency ratio), Login Lockout limits |

---

## 👥 Role Hierarchy & Access Control

* **Super Admin**: Platform-wide monitoring, creating organizations, branches, and managing global system configuration.
* **Organization / Branch Admin**: Tenant administration, HOD, faculty, and student list management.
* **HOD (Head of Department)**: Department-scoped administration, timetable scheduling, faculty assignments, and reporting.
* **Faculty Staff**: Class scheduling, teaching materials distribution, manual attendance override, and subject management.
* **Student**: Accessing study materials, timetable schedule, automated attendance scanning, notifications, and profile biometrics enrollment.

---

# Installation and Setup Guide

This guide walks you through setting up HexaAttender on a fresh machine for local development. Commands are written for **Windows** first; Linux/macOS alternatives are included wherever they differ.

---

## Prerequisites

### Required Software

| Software | Recommended Version | Purpose |
|---|---|---|
| Python | **3.11 or newer** | Django backend |
| pip | bundled with Python | Python package manager |
| Node.js | **20 or newer (LTS)** | React frontend |
| npm | bundled with Node.js | Frontend package manager |
| PostgreSQL | **15 or newer** | Primary database (production & default dev) |
| Redis | **7 or newer** | Celery task queue & cache |
| Git | latest | Clone the repository |
| Webcam / camera | — | Face ID enrollment and verification |

> **SQLite shortcut (development only):** If you want to skip PostgreSQL and Redis during initial exploration you can set `USE_SQLITE=True` in your `.env` file. All feature development still targets PostgreSQL + Redis, so install those before going further.

### Windows-specific: Visual Studio Build Tools

Several Python biometric libraries (`face_recognition`, `insightface`) contain compiled C/C++ extensions. On **Windows** you may need **Microsoft C++ Build Tools** before `pip install` succeeds.

1. Download the **Visual Studio Build Tools** from: <https://visualstudio.microsoft.com/visual-cpp-build-tools/>
2. In the installer select **Desktop development with C++**.
3. Reboot, then continue with the steps below.

---

## Project Structure

```text
Enterprise-Face-Attendance-Portal/
│
├── backend/                   # Django REST Framework API
│   ├── manage.py
│   ├── requirements.txt
│   ├── pytest.ini
│   ├── conftest.py
│   ├── config/                # Django settings, URLs, WSGI/ASGI
│   └── apps/                  # Django applications
│       ├── attendance/
│       ├── authentication/
│       ├── core/
│       ├── exams/
│       ├── face_recognition/
│       ├── materials/
│       ├── notifications/
│       ├── organizations/
│       ├── reports/
│       ├── staff/
│       ├── students/
│       ├── subjects/
│       └── timetable/
│
├── frontend/                  # React 18 + TypeScript + Vite
│   ├── src/
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── nginx/                     # Nginx reverse-proxy config (production)
├── docker-compose.yml         # Full production stack
├── .env.example               # Environment variable template
├── AUDIT_REPORT.md
├── SECURITY.md
└── README.md
```

---

## Clone the Repository

```bash
git clone https://github.com/suragms/Enterprise-Face-Attendance-Portal.git
cd Enterprise-Face-Attendance-Portal
```

---

# Backend Setup

All backend commands are run from inside the `backend/` directory with the virtual environment **activated**.

### Step 1 — Open the backend directory

```bash
cd backend
```

### Step 2 — Create a Python virtual environment

```bash
python -m venv .venv
```

### Step 3 — Activate the virtual environment

**Windows PowerShell:**
```powershell
.\.venv\Scripts\Activate.ps1
```

> If PowerShell blocks script execution run this first (one-time, current session only):
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
> ```

**Windows CMD:**
```cmd
.venv\Scripts\activate.bat
```

**Linux / macOS:**
```bash
source .venv/bin/activate
```

You should see `(.venv)` at the start of your prompt.

### Step 4 — Upgrade pip

```bash
python -m pip install --upgrade pip
```

### Step 5 — Install Python dependencies

```bash
pip install -r requirements.txt
```

> This installs all backend, testing, and biometric libraries in one step. See the **Face Recognition Dependencies** section below for notes on first-run model downloads.

---

## Face Recognition Dependencies

The biometric engine uses the following libraries — all listed in `requirements.txt`:

| Library | Purpose |
|---|---|
| `opencv-python-headless` | Image decoding and liveness preprocessing |
| `numpy` | Numerical array operations |
| `face_recognition` | dlib-based face encoding and comparison |
| `deepface` | High-level biometric verification (ArcFace, VGG-Face backends) |
| `insightface` | ArcFace face embedding extraction |
| `retina-face` | RetinaFace face detection |
| `Pillow` | Image loading and format conversion |

> **Important — first-run model downloads:** On the first face verification or enrollment request, `deepface` and `insightface` will automatically download their pre-trained model weights (typically 100–500 MB). This only happens once; subsequent runs use the cached models.  
> Ensure you have a working internet connection the first time you run a biometric operation.

> **Windows note:** `face_recognition` depends on `dlib`. If `pip install` fails at the `dlib` build step, install the **Visual Studio C++ Build Tools** described in the Prerequisites section, then retry `pip install -r requirements.txt`.

---

## Environment Configuration

Copy the provided example file to create your own `.env`:

**Windows:**
```powershell
copy .env.example .env
```

**Linux / macOS:**
```bash
cp .env.example .env
```

> The `.env` file lives in the **repository root** (one level up from `backend/`), not inside `backend/`.

Open `.env` in any text editor and configure the variables below. Never commit this file to Git.

```env
# Django core
DJANGO_SECRET_KEY=replace-this-with-a-long-random-string
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

# ── Database ──────────────────────────────────────────────
# Option A: SQLite (no PostgreSQL install needed for quick dev)
USE_SQLITE=True

# Option B: PostgreSQL (recommended, matches production)
# USE_SQLITE=False
# DB_NAME=hexaattender
# DB_USER=postgres
# DB_PASSWORD=your_db_password
# DB_HOST=localhost
# DB_PORT=5432

# ── Redis / Celery (required when USE_SQLITE=False) ───────
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
USE_REDIS_CACHE=True

# ── Frontend / CORS ───────────────────────────────────────
FRONTEND_URL=http://localhost:5173
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# ── Auth / Security ───────────────────────────────────────
JWT_COOKIE_SECURE=False
AUTH_MAX_FAILED_ATTEMPTS=5
AUTH_LOCKOUT_SECONDS=900

# ── Email (console backend is fine for development) ───────
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
DEFAULT_FROM_EMAIL=HexaAttender Dev <dev@hexaattender.local>
```

---

# Database Setup

## Option A — SQLite (quickest for development)

Set `USE_SQLITE=True` in your `.env`. No database installation or account creation is required. Django creates the `backend/db.sqlite3` file automatically when you run migrations.

## Option B — PostgreSQL (recommended)

1. **Install PostgreSQL 15+** from <https://www.postgresql.org/download/>. Accept the default port `5432`.
2. **Open pgAdmin** (installed with PostgreSQL) or `psql` and create the database and user:

```sql
CREATE DATABASE hexaattender;
CREATE USER hexaattender_user WITH PASSWORD 'choose_a_strong_password';
GRANT ALL PRIVILEGES ON DATABASE hexaattender TO hexaattender_user;
```

3. Update `.env`:

```env
USE_SQLITE=False
DB_NAME=hexaattender
DB_USER=hexaattender_user
DB_PASSWORD=choose_a_strong_password
DB_HOST=localhost
DB_PORT=5432
```

4. **Install and start Redis** (required when `USE_SQLITE=False`):
   - Windows: download the Windows port from <https://github.com/tporadowski/redis/releases> and run `redis-server.exe`.
   - Linux: `sudo apt install redis-server && sudo systemctl start redis`
   - macOS: `brew install redis && brew services start redis`

---

## Apply Database Migrations

With the virtual environment active and `.env` configured:

```bash
python manage.py migrate
```

> On a fresh checkout you only need `migrate`, not `makemigrations`. Run `makemigrations` only when you add or change Django models during development.

---

## Create the Super Admin Account

This project provides a dedicated management command that bootstraps the initial Super Admin user:

```bash
python manage.py bootstrap_super_admin
```

The command will prompt you to enter a username, email, and password interactively. **Do not hardcode credentials** in any file or script.

> Standard `python manage.py createsuperuser` also works and creates a Django admin user.

---

## Collect Static Files (Production only)

This step is only required when deploying to production (`DEBUG=False`):

```bash
python manage.py collectstatic
```

You do **not** need to run this for local development.

---

# Run Backend Server

With the virtual environment active, from inside `backend/`:

```bash
python manage.py runserver
```

Expected output:

```
Django version 4.2.x, using settings 'config.settings'
Starting development server at http://127.0.0.1:8000/
```

**Backend URLs:**
- API root: `http://127.0.0.1:8000/api/v1/`
- Django admin: `http://127.0.0.1:8000/admin/`

To verify the project is configured correctly before starting:

```bash
python manage.py check
```

---

# Frontend Setup

Open a **second terminal** and leave the backend running in the first one.

### Step 1 — Open the frontend directory

```bash
cd frontend
```

### Step 2 — Install npm dependencies

```bash
npm install
```

### Step 3 — Configure the API URL (optional)

The frontend automatically points to `http://localhost:8000/api/v1` in development mode — no extra configuration is needed if the backend is running on the default port.

If you need to override the API URL, create a `frontend/.env.local` file:

```env
VITE_API_BASE=http://localhost:8000/api/v1
```

---

# Run Frontend Development Server

```bash
npm run dev
```

Expected output:

```
  VITE v6.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Open `http://localhost:5173/` in your browser.

Press `Ctrl + C` in the terminal to stop the server.

---

# Running the Full Application

Two terminals must be open simultaneously.

### Terminal 1 — Backend

```powershell
cd Enterprise-Face-Attendance-Portal\backend
.\.venv\Scripts\Activate.ps1
python manage.py runserver
```

### Terminal 2 — Frontend

```powershell
cd Enterprise-Face-Attendance-Portal\frontend
npm run dev
```

Then:
1. Open `http://localhost:5173/` in your browser.
2. Log in with the Super Admin account you created.
3. The frontend calls the backend at `http://localhost:8000/api/v1/` automatically.
4. Keep **both** terminals open while using the application.

---

# First-Time Setup Workflow

After both servers are running, follow this sequence to configure the portal for the first time:

1. Log in as **Super Admin**.
2. Create an **Organization** (e.g., your university name).
3. Create a **Branch** under the organization.
4. Create one or more **Departments** under the branch.
5. Create an **Academic Year** and **Courses** for each department.
6. Create **Semesters** for each course.
7. Create an **HOD** account and assign them to a department.
8. Create **Faculty** accounts and assign them to departments.
9. Create **Student** accounts and assign them to a course and semester.
10. Create **Subjects** for each semester and assign faculty.
11. Configure the **Timetable** for each department/semester.
12. Have each student **enroll their face** via their profile page (webcam required).
13. Faculty **opens an Attendance Session** for a scheduled class.
14. Students present their face to the camera — attendance is marked automatically.
15. Faculty **submits** the session; HOD **approves** it.
16. View **Attendance Reports** and analytics dashboards.
17. Faculty **uploads Study Materials** for their subjects.
18. Send **Notifications** to students or department members.

---

## User Roles

| Role | Main Capabilities |
|---|---|
| **Super Admin** | Create and manage organizations, branches, global configuration |
| **Organization / Branch Admin** | Manage HODs, faculty, students within the organization |
| **HOD** | Department-scoped: faculty management, timetable, attendance approval, reports |
| **Faculty** | Attendance sessions, timetable management for assigned subjects, study materials, notifications to their cohort |
| **Student** | View timetable, receive face-verified attendance, access approved study materials, view notifications |

---

# Face ID Setup

The portal supports automatic biometric attendance via a webcam.

1. **Allow camera access** — when the browser asks for webcam permission, click **Allow**. Without this the face enrollment and attendance pages will not function.
2. **Student face enrollment** — each student opens their profile and clicks **Enroll Face**. The enrollment wizard captures multiple poses (front, left, right, up, down). Ensure:
   - Your face is clearly visible, centered in the frame.
   - Lighting is even — avoid strong back-lighting.
   - Remove hats, heavy glasses, or face coverings.
3. **Liveness verification** — the system performs a liveness check on each frame to prevent photo/video spoofing. Real-time texture, eye aspect ratio, and frequency analysis are applied.
4. **Taking attendance** — faculty opens a session and activates the camera. The system compares the live image against enrolled students on the session roster only. A confidence threshold of 0.65 is enforced; a match below this value is rejected.
5. **HTTPS on non-localhost** — browsers restrict camera access to secure origins. On any domain other than `localhost` / `127.0.0.1`, the application **must** be served over HTTPS for the camera API to work.
6. **First-time model download** — on the first biometric operation `deepface` and `insightface` download their model weights automatically (~100–500 MB). This is normal; subsequent requests use cached models.

---

# Running Backend Tests

The backend uses **pytest** with `pytest-django`.

```bash
cd backend
.\.venv\Scripts\Activate.ps1   # Windows — skip if already activated
```

Run all tests:

```bash
python -m pytest
```

Run with verbose output:

```bash
python -m pytest -v
```

Run with coverage report (generates `htmlcov/index.html`):

```bash
python -m pytest --cov=apps --cov-report=html
```

Verify Django configuration without running tests:

```bash
python manage.py check
```

> The test suite uses `config.test_settings` and `--reuse-db` (defined in `pytest.ini`). SQLite is used automatically for tests — no extra configuration needed.

---

# Frontend Verification

Type-check and build the frontend:

```bash
cd frontend
npm run build
```

A successful build writes output to `frontend/dist/`.

Lint the TypeScript/React source:

```bash
npm run lint
```

Preview the production build locally:

```bash
npm run preview
```

> There is no `npm test` script in this project. Backend tests cover the API logic; use the backend pytest suite instead.

---

# Production Build Notes

### Frontend

```bash
cd frontend
npm run build
```

Output is in `frontend/dist/`. Serve it via Nginx or any static file host.

### Backend

For production deployments set the following in your environment:

```
DJANGO_DEBUG=False
DJANGO_SECRET_KEY=<long-random-string>
DJANGO_ALLOWED_HOSTS=your-domain.com
USE_SQLITE=False
JWT_COOKIE_SECURE=True
```

Additional production requirements:
- Run behind a **production WSGI server** (Gunicorn is already in `requirements.txt`).
- Use **Nginx** as a reverse proxy (config included in `nginx/`).
- Set `CORS_ALLOWED_ORIGINS` to your actual frontend domain.
- Handle `media/` and `staticfiles/` via Nginx or object storage.
- Use **Docker Compose** for the full production stack: `docker compose up -d --build`.

---

# Windows Quick Start

Copy and run these commands in **PowerShell** for a fast first-time setup.

### Backend

```powershell
git clone https://github.com/suragms/Enterprise-Face-Attendance-Portal.git
cd Enterprise-Face-Attendance-Portal\backend

python -m venv .venv
.\.venv\Scripts\Activate.ps1

python -m pip install --upgrade pip
pip install -r requirements.txt

copy .env.example .env
# Edit .env: set USE_SQLITE=True for the quickest start

python manage.py migrate
python manage.py bootstrap_super_admin
python manage.py runserver
```

### Frontend (open a second PowerShell window)

```powershell
cd Enterprise-Face-Attendance-Portal\frontend

npm install
npm run dev
```

Open `http://localhost:5173/` in your browser.

---

# Linux / macOS Quick Start

### Backend

```bash
git clone https://github.com/suragms/Enterprise-Face-Attendance-Portal.git
cd Enterprise-Face-Attendance-Portal/backend

python3 -m venv .venv
source .venv/bin/activate

python -m pip install --upgrade pip
pip install -r requirements.txt

cp ../.env.example ../.env
# Edit .env: set USE_SQLITE=True for the quickest start

python manage.py migrate
python manage.py bootstrap_super_admin
python manage.py runserver
```

### Frontend (second terminal)

```bash
cd Enterprise-Face-Attendance-Portal/frontend
npm install
npm run dev
```

---

# Starting the Project After Initial Installation

Once installed you **do not** need to repeat the full setup. Each day just:

### Backend

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python manage.py runserver
```

### Frontend (second terminal)

```powershell
cd frontend
npm run dev
```

**Only re-run these commands when dependencies or schema change:**

| Command | When to run again |
|---|---|
| `pip install -r requirements.txt` | After pulling changes that add/update Python packages |
| `npm install` | After pulling changes that add/update npm packages |
| `python manage.py migrate` | After pulling changes that include new Django migrations |

---

# Troubleshooting

### `python` is not recognized

Python is not on your PATH. Re-install Python from <https://www.python.org/> and check **"Add Python to PATH"** during installation, then restart your terminal.

### PowerShell blocks virtual environment activation

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

### `pip install` fails at `dlib` or `face_recognition`

Install **Visual Studio C++ Build Tools** (Desktop development with C++ workload) from <https://visualstudio.microsoft.com/visual-cpp-build-tools/>, then retry `pip install -r requirements.txt`.

### `ModuleNotFoundError` after activating the environment

Your virtual environment is not activated, or you ran `pip install` outside it. Check that your prompt shows `(.venv)`, then:

```bash
pip install -r requirements.txt
```

### `npm` is not recognized

Install **Node.js LTS** (v20+) from <https://nodejs.org/>. npm is bundled with it. Restart your terminal after installation.

### `vite: not found` or `eslint: not found`

You skipped `npm install`, or the `node_modules/` folder is missing:

```bash
npm install
npm run dev
```

### Database connection error

Verify:
- PostgreSQL service is running (`services.msc` on Windows, `systemctl status postgresql` on Linux).
- The database and user exist (re-run the `CREATE DATABASE` SQL commands above).
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` in `.env` are correct.
- Port 5432 is not blocked by a firewall.

### Migration errors / `OperationalError: no such table`

```bash
python manage.py showmigrations
python manage.py migrate
```

### CORS error in browser console

The backend `CORS_ALLOWED_ORIGINS` setting must include your frontend origin. In development (`DEBUG=True`) all origins are automatically allowed. In production set:

```env
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com
```

### Camera / webcam permission denied

Click the camera icon in the browser address bar and select **Allow**. If the browser denied it permanently, go to **Site Settings → Camera → Allow** for `localhost`.

### Face recognition model download fails or is very slow on first use

On the first biometric request `deepface` and `insightface` download model weights from the internet (~100–500 MB). Ensure you have a stable internet connection. The download happens once and is cached; subsequent requests are fast.

### `redis.exceptions.ConnectionError`

Redis is not running. Start it:
- **Windows:** run `redis-server.exe` from the Redis installation folder.
- **Linux:** `sudo systemctl start redis`
- **macOS:** `brew services start redis`

Or switch to SQLite (no Redis needed) by setting `USE_SQLITE=True` and `USE_REDIS_CACHE=False` in `.env`.

---

## 📦 Production Deployment (Docker Compose)

To launch the full production environment including database, redis, celery, reverse proxies, and servers:

1. Copy the production environment configurations:
   ```bash
   cp .env.prod.example .env.prod
   ```
2. Launch the services:
   ```bash
   docker compose up -d --build
   ```

---

## 🔒 Copyright & License Notice

**Copyright © 2026 Surag. All Rights Reserved.**

This codebase is **Proprietary**. You may **not** use, copy, modify, distribute, or host this project without explicit written authorization from the developer.

---

## 📬 Contact & Enquiries

I am available for freelance projects, custom software development, architectural consultations, and full-stack collaborations.

* **🌐 Portfolio**: [surag-portfolio.web.app](https://surag-portfolio.web.app)
* **🌳 Linktree**: [linktr.ee/suragdevstudio](https://linktr.ee/suragdevstudio)
* **📧 Email**: officialsurag@gmail.com
* **📱 Phone**: [+91 7012714150](tel:+917012714150)
* **💼 LinkedIn**: [linkedin.com/in/suragsunil](https://linkedin.com/in/suragsunil)
* **📸 Instagram**: [instagram.com/surag_sunil](https://instagram.com/surag_sunil)
* **💻 GitHub**: [github.com/suragms](https://github.com/suragms)
* **📺 YouTube**: [youtube.com/@suragdevstudio](https://youtube.com/@suragdevstudio)
