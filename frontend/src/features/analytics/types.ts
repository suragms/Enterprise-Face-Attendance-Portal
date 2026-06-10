export interface WeeklyAttendancePoint {
  date: string
  day: string
  present: number
  absent: number
  total: number
  percentage: number
}

export interface MonthlyAttendancePoint {
  month: string
  present: number
  absent: number
  total: number
  percentage: number
}

export interface DepartmentComparisonRow {
  department: string
  code: string
  attendance: number
  students: number
}

export interface SubjectPerformanceRow {
  subject_code: string
  subject_name: string
  attendance: number
  present: number
  absent: number
  total: number
}

export interface RiskStudentRow {
  student_id: string
  roll_no: string
  name: string
  department: string
  semester: number
  attendance_percentage: number
  classes_missed: number
  classes_total: number
  risk_level: "critical" | "high" | "watch"
}

export interface FaceRecognitionAnalytics {
  success_rate: number
  total_attempts: number
  successful: number
  failed: number
  enrollments: number
  attendance_face_captures: number
  daily_trend: { date: string; attempts: number; successful: number; success_rate: number }[]
  capture_methods: { capture_method: string; count: number }[]
}

export interface AnalyticsDashboardData {
  generated_at: string
  threshold: number
  summary: {
    overall_attendance: number
    total_records: number
    risk_count: number
    department_count: number
    subject_count: number
    face_success_rate: number
  }
  weekly_attendance: WeeklyAttendancePoint[]
  monthly_attendance: MonthlyAttendancePoint[]
  department_comparison: DepartmentComparisonRow[]
  subject_performance: SubjectPerformanceRow[]
  risk_students: RiskStudentRow[]
  face_recognition: FaceRecognitionAnalytics
}
