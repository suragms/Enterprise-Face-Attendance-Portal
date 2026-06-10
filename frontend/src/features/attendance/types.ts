export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"

export type CaptureMethod = "FACE_RECOGNITION" | "MANUAL" | "SYSTEM" | "CORRECTION"

export type SessionStatus = "OPEN" | "SUBMITTED" | "APPROVED" | "REJECTED" | "LOCKED"

export interface ValidationResult {
  isValid: boolean
  totalStrength: number
  totalRecords: number
  present: number
  absent: number
  late: number
  excused: number
  missingCount: number
  missingStudents: string[]
  duplicateEntries: string[]
  crossSubjectConflicts: Array<{ roll_no: string; other_subject: string }>
  rosterInvalidStudents: string[]
  correctedRecords: number
  attendancePercentage: number
}
