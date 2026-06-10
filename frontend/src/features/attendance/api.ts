import { apiFetch } from "../../lib/api"
import type { ValidationResult } from "./types"

export async function createAttendanceSession(body: {
  date: string
  hour: string
  subject_id: string
}) {
  return apiFetch("/attendance/sessions/create-session/", { method: "POST", body })
}

export async function openAttendanceSession(sessionId: string | number) {
  return apiFetch(`/attendance/sessions/${sessionId}/open/`, { method: "POST" })
}

export async function submitAttendanceSession(sessionId: string | number) {
  return apiFetch(`/attendance/sessions/${sessionId}/submit/`, { method: "POST" })
}

export async function approveAttendanceSession(sessionId: string | number) {
  return apiFetch(`/attendance/sessions/${sessionId}/approve/`, { method: "POST" })
}

export async function rejectAttendanceSession(sessionId: string | number) {
  return apiFetch(`/attendance/sessions/${sessionId}/reject/`, { method: "POST" })
}

export async function lockAttendanceSession(sessionId: string | number) {
  return apiFetch(`/attendance/sessions/${sessionId}/lock/`, { method: "POST" })
}

export async function unlockAttendanceSession(sessionId: string | number) {
  return apiFetch(`/attendance/sessions/${sessionId}/unlock/`, { method: "POST" })
}

export async function validateAttendanceSession(sessionId: string | number): Promise<ValidationResult> {
  const data = await apiFetch<{ validation: Record<string, unknown> }>("/attendance/engine/validate/", {
    method: "POST",
    body: { session_id: sessionId },
  })
  const v = data.validation
  return {
    isValid: Boolean(v.is_valid),
    totalStrength: Number(v.total_class_strength ?? 0),
    totalRecords: Number(v.total_records ?? 0),
    present: Number(v.present ?? 0),
    absent: Number(v.absent ?? 0),
    late: Number(v.late ?? 0),
    excused: Number(v.excused ?? 0),
    missingCount: Number(v.missing_count ?? 0),
    missingStudents: (v.missing_students as string[]) ?? [],
    duplicateEntries: (v.duplicate_entries as string[]) ?? [],
    crossSubjectConflicts: (v.cross_subject_conflicts as ValidationResult["crossSubjectConflicts"]) ?? [],
    rosterInvalidStudents: (v.roster_invalid_students as string[]) ?? [],
    correctedRecords: Number(v.corrected_records ?? 0),
    attendancePercentage: Number(v.attendance_percentage ?? 0),
  }
}

export async function postSystemAttendance(body: {
  date: string
  hour: string
  subject_id: string
  session_id?: string | number
  entries: Array<{ roll_no: string; status: string }>
}) {
  return apiFetch("/attendance/engine/system/", { method: "POST", body })
}
