import React from "react"
import { useAuth } from "../../../context/AuthContext"
import { useFacultyContext } from "../../../hooks/useFacultyContext"

export const FacultyScopeBanner: React.FC = () => {
  const { user } = useAuth()
  const { enabled, loading, department, staffCode, assignedSubjects } = useFacultyContext(user?.role)

  if (!enabled || loading || !department) return null

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
      <span className="font-semibold">Faculty scope:</span> {department.name} ({department.code})
      {staffCode ? ` • Staff code ${staffCode}` : ""}
      {assignedSubjects.length ? ` • ${assignedSubjects.length} assigned subject(s)` : ""}
      . You cannot manage departments, create faculty, or create HOD accounts.
    </div>
  )
}
