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

## 🚀 Getting Started (Development Setup)

Follow these instructions to set up the project locally for development and testing.

### Prerequisites
* Python 3.11+
* Node.js 20+
* Git
* SQLite (default) or PostgreSQL

---

### 📥 1. Clone & Setup Repository

```bash
git clone https://github.com/suragms/Enterprise-Face-Attendance-Portal.git
cd Enterprise-Face-Attendance-Portal
```

---

### 🐍 2. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   # On Windows (PowerShell)
   python -m venv .venv
   .venv\Scripts\Activate.ps1

   # On Linux/macOS
   python3 -m venv .venv
   source .venv/bin/activate
   ```
3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy the environment template and configure secrets:
   ```bash
   copy ..\.env.example ..\.env  # Windows
   cp ../.env.example ../.env    # Linux/macOS
   ```
5. Apply database migrations:
   ```bash
   # Set USE_SQLITE environment variable if using SQLite locally
   $env:USE_SQLITE="True" # Windows PowerShell
   export USE_SQLITE=True # Linux/macOS

   python manage.py migrate
   ```
6. Bootstrap default seed accounts (includes superadmin):
   ```bash
   python manage.py bootstrap_super_admin
   ```
7. Start the backend development server:
   ```bash
   python manage.py runserver
   ```
   *The API will be running at:* `http://localhost:8000`

---

### 💻 3. Frontend Setup

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Run the frontend development server:
   ```bash
   npm run dev
   ```
   *The web interface will be accessible at:* `http://localhost:5173`

---

## 🧪 Running Automated Tests

A comprehensive pytest suite is available to verify the backend's integrity.

```bash
cd backend
$env:USE_SQLITE="True" # Windows PowerShell
export USE_SQLITE=True # Linux/macOS

# Run all tests
python -m pytest

# Run tests with coverage reports
pytest --cov=apps --cov-report=html
```

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
