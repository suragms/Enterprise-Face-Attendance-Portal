export const TRIGGER_OPTIONS = [
  { id: "LOW_ATTENDANCE", label: "Low Attendance" },
  { id: "ABSENT_ALERT", label: "Absent Alert" },
  { id: "ATTENDANCE_SUMMARY", label: "Attendance Summary" },
  { id: "ADMIN_ALERT", label: "Admin Alert" },
] as const

export const CHANNEL_OPTIONS = [
  { id: "EMAIL", label: "Email", icon: "mail" },
  { id: "SMS", label: "SMS", icon: "phone" },
  { id: "WHATSAPP", label: "WhatsApp", icon: "message" },
  { id: "IN_APP", label: "In-App", icon: "bell" },
] as const

export const STATUS_OPTIONS = ["ALL", "PENDING", "SENT", "FAILED", "READ"] as const

export const RECIPIENT_SCOPES = [
  { id: "CUSTOM", label: "Custom Recipient" },
  { id: "ALL_STUDENTS", label: "All Students" },
  { id: "LOW_ATTENDANCE", label: "Low Attendance Students" },
  { id: "ADMIN", label: "Admin Email" },
] as const

export const REPEAT_OPTIONS = [
  { id: "ONCE", label: "Once" },
  { id: "DAILY", label: "Daily" },
  { id: "WEEKLY", label: "Weekly" },
] as const

export const TEMPLATE_VARIABLES: Record<string, string[]> = {
  LOW_ATTENDANCE: ["student_name", "roll_no", "attendance_percentage"],
  ABSENT_ALERT: ["student_name", "roll_no", "subject_name", "date", "hour"],
  ATTENDANCE_SUMMARY: ["subject_name", "summary_date", "attendance_percentage"],
  ADMIN_ALERT: ["alert_title", "alert_message"],
}
