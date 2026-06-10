import { useEffect, useState } from "react"
import { apiFetch } from "../lib/api"
import { isStudentRole } from "../lib/roles"
import type { UserRole } from "../context/AuthContext"

export interface StudentPortalContext {
  roll_no: string | null
  name: string | null
  email: string | null
  phone: string | null
  department: { id: string; name: string; code: string } | null
  semester: number | null
  course: string | null
  branch: string | null
  campus_status: string | null
  overall_attendance: number
  promotion_status: "ELIGIBLE" | "DETAINED"
  is_defaulter: boolean
  attendance_threshold: number
  capabilities: Record<string, boolean>
}

export function useStudentContext(role?: UserRole | string | null) {
  const enabled = isStudentRole(role)
  const [context, setContext] = useState<StudentPortalContext | null>(null)
  const [loading, setLoading] = useState(enabled)

  useEffect(() => {
    if (!enabled) {
      setContext(null)
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    apiFetch<StudentPortalContext>("/auth/student/portal-context/")
      .then((data) => {
        if (active) setContext(data)
      })
      .catch(() => {
        if (active) setContext(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [enabled, role])

  return {
    enabled,
    loading,
    context,
    rollNo: context?.roll_no ?? null,
    department: context?.department ?? null,
    isDefaulter: context?.is_defaulter ?? false,
    overallAttendance: context?.overall_attendance ?? 0,
    threshold: context?.attendance_threshold ?? 75,
  }
}
