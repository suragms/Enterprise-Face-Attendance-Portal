import { useEffect, useState } from "react"
import { apiFetch } from "../lib/api"
import type { StudentDashboardSummary, StudentReport } from "../features/student/types"

export function useStudentReport(enabled = true) {
  const [report, setReport] = useState<StudentReport | null>(null)
  const [summary, setSummary] = useState<StudentDashboardSummary | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    let active = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [reportData, summaryData] = await Promise.all([
          apiFetch<StudentReport>("/reports/student/"),
          apiFetch<StudentDashboardSummary>("/auth/student/dashboard-summary/"),
        ])
        if (active) {
          setReport(reportData)
          setSummary(summaryData)
        }
      } catch (err: any) {
        if (active) setError(err.message || "Failed to load attendance data.")
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [enabled])

  const subjects =
    summary?.subjects?.length
      ? summary.subjects
      : (report?.subjects ?? []).map((s) => ({
          ...s,
          is_at_risk: s.percentage < (summary?.attendance_threshold ?? 75),
        }))

  const overallPct =
    summary?.overall_attendance ??
    report?.student?.overall_attendance ??
    report?.summary?.overall_percentage ??
    0

  return {
    report,
    summary,
    subjects,
    overallPct,
    loading,
    error,
    promotionStatus: summary?.promotion_status ?? report?.student?.promotion_status ?? "DETAINED",
    isDefaulter: summary?.is_defaulter ?? overallPct < (summary?.attendance_threshold ?? 75),
    threshold: summary?.attendance_threshold ?? 75,
  }
}
