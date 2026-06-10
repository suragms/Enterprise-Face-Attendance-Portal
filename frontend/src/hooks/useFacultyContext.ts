import { useEffect, useState } from "react"
import { apiFetch } from "../lib/api"
import { isFacultyRole } from "../lib/roles"
import type { UserRole } from "../context/AuthContext"

export interface FacultyPortalContext {
  staff_code: string | null
  department: { id: string; name: string; code: string } | null
  department_locked: boolean
  assigned_subjects: Array<{ id: string; subject_code: string; name: string }>
  can_create_faculty: boolean
  can_create_hod: boolean
  can_manage_departments: boolean
  capabilities: Record<string, boolean>
}

export function useFacultyContext(role?: UserRole | string | null) {
  const enabled = isFacultyRole(role)
  const [context, setContext] = useState<FacultyPortalContext | null>(null)
  const [loading, setLoading] = useState(enabled)

  useEffect(() => {
    if (!enabled) {
      setContext(null)
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    apiFetch<FacultyPortalContext>("/auth/faculty/portal-context/")
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
    department: context?.department ?? null,
    staffCode: context?.staff_code ?? null,
    departmentLocked: context?.department_locked ?? false,
    assignedSubjects: context?.assigned_subjects ?? [],
  }
}
