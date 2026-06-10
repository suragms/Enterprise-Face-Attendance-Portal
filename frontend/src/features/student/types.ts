export interface StudentSubjectAttendance {
  code: string
  name: string
  total: number
  present: number
  absent: number
  late: number
  excused: number
  percentage: number
  is_at_risk?: boolean
}

export interface StudentReport {
  student: {
    roll_no: string
    name: string
    department: string
    semester: string | number
    overall_attendance: number
    promotion_status: "ELIGIBLE" | "DETAINED"
  }
  subjects: StudentSubjectAttendance[]
  summary: {
    total_sessions: number
    total_present: number
    overall_percentage: number
    percentage?: number
  }
  monthly_trend?: { month: number; percentage: number }[]
}

export interface StudentDashboardSummary {
  roll_no: string | null
  name: string | null
  department: string | null
  semester: number | null
  overall_attendance: number
  promotion_status: "ELIGIBLE" | "DETAINED"
  is_defaulter: boolean
  at_risk_subject_count: number
  attendance_threshold: number
  today_status: string
  unread_notifications: number
  upcoming_exams: number
  approved_materials: number
  face_enrolled: boolean
  subjects: StudentSubjectAttendance[]
}

export interface AttendanceHistoryItem {
  id: string
  date: string
  hour: string
  subject: string
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"
  capture_method: string
}

export const ATTENDANCE_THRESHOLD = 75
