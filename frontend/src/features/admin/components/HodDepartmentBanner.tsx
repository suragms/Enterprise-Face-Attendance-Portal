import React from "react"
import { useHodContext } from "../../../hooks/useHodContext"
import { useAuth } from "../../../context/AuthContext"

export const HodDepartmentBanner: React.FC = () => {
  const { user } = useAuth()
  const { enabled, loading, department } = useHodContext(user?.role)

  if (!enabled || loading || !department) return null

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
      <span className="font-semibold">Department scope:</span> {department.name} ({department.code}) — data is limited to your assigned department.
    </div>
  )
}
