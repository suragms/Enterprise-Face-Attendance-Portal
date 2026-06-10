-- ============================================================================
-- HEXAATTENDER - COMPLETE PostgreSQL DATABASE SCHEMA
-- ============================================================================
-- Architecture: Clean Database Layer, Normalized Schema, Performance Indexed
-- Preparation Date: May 2026
-- HSL Color Themes Applied in Logic: Emerald Branding Accents Configured
-- ============================================================================

-- Enable pgcrypto extension for secure gen_random_uuid() UUID generator
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ROLES TABLE
-- ============================================================================
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE roles IS 'Stores system privilege groups for RBAC verification.';

-- ============================================================================
-- 2. USERS TABLE
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(150) UNIQUE NOT NULL,
    email VARCHAR(254) UNIQUE NOT NULL,
    password_hash VARCHAR(128) NOT NULL,
    first_name VARCHAR(150),
    last_name VARCHAR(150),
    phone VARCHAR(20),
    role_id INT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role_id ON users(role_id);
COMMENT ON TABLE users IS 'User credentials and primary account tags for access control.';

-- ============================================================================
-- 3. DEPARTMENTS TABLE
-- ============================================================================
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(10) UNIQUE NOT NULL, -- e.g. CS, SE, EE
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE departments IS 'Academic department categories.';

-- ============================================================================
-- 4. COURSES TABLE
-- ============================================================================
CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL, -- e.g. MCS, BSCS
    department_id INT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    duration_years INT NOT NULL CHECK (duration_years > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_courses_department ON courses(department_id);
COMMENT ON TABLE courses IS 'Degree programs offered by departments.';

-- ============================================================================
-- 5. CLASSES TABLE
-- ============================================================================
CREATE TABLE classes (
    id SERIAL PRIMARY KEY,
    course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    semester INT NOT NULL CHECK (semester BETWEEN 1 AND 8),
    section VARCHAR(5) NOT NULL DEFAULT 'A',
    academic_year INT NOT NULL CHECK (academic_year >= 2026),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_class_cohort UNIQUE (course_id, semester, section, academic_year)
);

CREATE INDEX idx_classes_cohort ON classes(course_id, semester);
COMMENT ON TABLE classes IS 'Class divisions representing a unique student cohort session.';

-- ============================================================================
-- 6. STUDENTS TABLE
-- ============================================================================
CREATE TABLE students (
    roll_no VARCHAR(15) PRIMARY KEY,
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_id INT REFERENCES classes(id) ON DELETE RESTRICT,
    dob DATE NOT NULL,
    address TEXT,
    campus_status VARCHAR(20) DEFAULT 'DAY_SCHOLAR' CHECK (campus_status IN ('DAY_SCHOLAR', 'HOSTELLER')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_students_class ON students(class_id);
COMMENT ON TABLE students IS 'Student registration metadata profiles from PRD.';

-- ============================================================================
-- 7. FACULTY TABLE
-- ============================================================================
CREATE TABLE faculty (
    staff_code VARCHAR(20) PRIMARY KEY, -- e.g. STF-2026-904
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    department_id INT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    father_name VARCHAR(150) NULL, -- Maps ssname from PRD
    designation VARCHAR(100) NOT NULL,
    salary DECIMAL(12,2) CHECK (salary >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_faculty_department ON faculty(department_id);
COMMENT ON TABLE faculty IS 'Faculty details with department links and salary designations.';

-- ============================================================================
-- 8. SUBJECTS TABLE
-- ============================================================================
CREATE TABLE subjects (
    subject_code VARCHAR(20) PRIMARY KEY, -- e.g. MCS-101
    name VARCHAR(150) NOT NULL,
    course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    semester INT NOT NULL CHECK (semester BETWEEN 1 AND 8),
    faculty_id VARCHAR(20) REFERENCES faculty(staff_code) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subjects_course ON subjects(course_id);
CREATE INDEX idx_subjects_faculty ON subjects(faculty_id);
COMMENT ON TABLE subjects IS 'Academic subject configurations linked to courses and faculty.';

-- ============================================================================
-- 9. TIMETABLES TABLE
-- ============================================================================
CREATE TABLE timetables (
    id SERIAL PRIMARY KEY,
    class_id INT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    day_of_week VARCHAR(15) NOT NULL CHECK (day_of_week IN ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY')),
    period_hour VARCHAR(5) NOT NULL CHECK (period_hour IN ('I', 'II', 'III', 'IV', 'V', 'VI', 'VII')),
    subject_code VARCHAR(20) NOT NULL REFERENCES subjects(subject_code) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_timetable_slot UNIQUE (class_id, day_of_week, period_hour)
);

CREATE INDEX idx_timetable_lookup ON timetables(class_id, day_of_week);
COMMENT ON TABLE timetables IS 'Hourly slots (Periods I-VII) configurations from the PRD.';

-- ============================================================================
-- 10. ATTENDANCE TABLE
-- ============================================================================
CREATE TABLE attendance (
    id BIGSERIAL PRIMARY KEY,
    student_roll VARCHAR(15) NOT NULL REFERENCES students(roll_no) ON DELETE CASCADE,
    timetable_id INT NOT NULL REFERENCES timetables(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(10) NOT NULL CHECK (status IN ('PRESENT', 'ABSENT')),
    capture_method VARCHAR(25) NOT NULL CHECK (capture_method IN ('FACE_RECOGNITION', 'MANUAL_OVERRIDE')),
    correction_notes TEXT,
    modified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_attendance_session UNIQUE (student_roll, timetable_id, date)
);

CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_student ON attendance(student_roll);
CREATE INDEX idx_attendance_lookup ON attendance(student_roll, date);
COMMENT ON TABLE attendance IS 'Attendance log sessions documenting student standing profiles.';

-- ============================================================================
-- 11. FACE ENCODINGS TABLE
-- ============================================================================
CREATE TABLE face_encodings (
    id SERIAL PRIMARY KEY,
    student_roll VARCHAR(15) UNIQUE NOT NULL REFERENCES students(roll_no) ON DELETE CASCADE,
    encoding DOUBLE PRECISION[] NOT NULL CONSTRAINT chk_vector_length CHECK (array_length(encoding, 1) = 128),
    photo_path VARCHAR(255),
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE face_encodings IS '128-dimensional biometric face descriptor vectors from OpenCV/TensorFlow pipelines.';

-- ============================================================================
-- 12. REPORTS TABLE
-- ============================================================================
CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    report_type VARCHAR(25) NOT NULL CHECK (report_type IN ('DAILY', 'WEEKLY', 'CONSOLIDATED')),
    student_roll VARCHAR(15) NOT NULL REFERENCES students(roll_no) ON DELETE CASCADE,
    start_date DATE,
    end_date DATE,
    attendance_percentage DECIMAL(5,2) NOT NULL CHECK (attendance_percentage BETWEEN 0 AND 100),
    promotion_status VARCHAR(15) NOT NULL CHECK (promotion_status IN ('ELIGIBLE', 'DETAINED')),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reports_student ON reports(student_roll);
COMMENT ON TABLE reports IS 'Aggregated semester attendance standings cached for prompt dashboard queries.';

-- ============================================================================
-- 13. AUDIT LOGS TABLE (LEDGER)
-- ============================================================================
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(10) NOT NULL CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE')),
    table_name VARCHAR(50) NOT NULL,
    record_id VARCHAR(100) NOT NULL,
    old_state JSONB,
    new_state JSONB
);

CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_table ON audit_logs(table_name);
COMMENT ON TABLE audit_logs IS 'System audit trail ledger tracking modification actors and data diff states.';


-- ============================================================================
-- DATABASE PL/pgSQL TRIGGERS FOR AUTO-AUDITING
-- ============================================================================

-- Function that dynamically captures changes and logs row details into audit_logs
CREATE OR REPLACE FUNCTION fn_audit_row_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id UUID := NULL;
    v_record_id VARCHAR(100);
    v_old_state JSONB := NULL;
    v_new_state JSONB := NULL;
BEGIN
    -- Try to capture the session actor ID if present in active transaction parameters
    BEGIN
        v_actor_id := CAST(current_setting('ams.current_actor_id', true) AS UUID);
    EXCEPTION WHEN OTHERS THEN
        v_actor_id := NULL;
    END;

    IF (TG_OP = 'INSERT') THEN
        -- Primary Key extraction helper
        v_record_id := CAST(NEW.id AS VARCHAR);
        v_new_state := to_jsonb(NEW);
        
        INSERT INTO audit_logs (actor_id, action_type, table_name, record_id, old_state, new_state)
        VALUES (v_actor_id, 'INSERT', TG_TABLE_NAME, v_record_id, NULL, v_new_state);
        
    ELSIF (TG_OP = 'UPDATE') THEN
        v_record_id := CAST(NEW.id AS VARCHAR);
        v_old_state := to_jsonb(OLD);
        v_new_state := to_jsonb(NEW);
        
        INSERT INTO audit_logs (actor_id, action_type, table_name, record_id, old_state, new_state)
        VALUES (v_actor_id, 'UPDATE', TG_TABLE_NAME, v_record_id, v_old_state, v_new_state);
        
    ELSIF (TG_OP = 'DELETE') THEN
        v_record_id := CAST(OLD.id AS VARCHAR);
        v_old_state := to_jsonb(OLD);
        
        INSERT INTO audit_logs (actor_id, action_type, table_name, record_id, old_state, new_state)
        VALUES (v_actor_id, 'DELETE', TG_TABLE_NAME, v_record_id, v_old_state, NULL);
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Register Auditing triggers on key transaction logs
CREATE TRIGGER trg_audit_attendance
AFTER INSERT OR UPDATE OR DELETE ON attendance
FOR EACH ROW EXECUTE FUNCTION fn_audit_row_changes();

CREATE TRIGGER trg_audit_timetables
AFTER INSERT OR UPDATE OR DELETE ON timetables
FOR EACH ROW EXECUTE FUNCTION fn_audit_row_changes();
