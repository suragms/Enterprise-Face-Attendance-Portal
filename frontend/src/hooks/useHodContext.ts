import { useEffect, useState } from "react"
import { apiFetch } from "../lib/api"
import { isHodRole } from "../lib/roles"
import type { UserRole } from "../context/AuthContext"

export interface HodPortalContext {
  department: { id: string; name: string; code: string } | null
  department_locked: boolean
  can_create_hod: boolean
  capabilities: Record<string, boolean>
}

export function useHodContext(role?: UserRole | string | null) {
  const enabled = isHodRole(role)
  const [context, setContext] = useState<HodPortalContext | null>(null)
  const [loading, setLoading] = useState(enabled)

  useEffect(() => {
    if (!enabled) {
      setContext(null)
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    apiFetch<HodPortalContext>("/auth/hod/portal-context/")
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
    departmentLocked: context?.department_locked ?? false,
  }
}
