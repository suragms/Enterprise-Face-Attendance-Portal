import React, { useEffect, useState } from "react"
import { BarChart3, History } from "lucide-react"
import { apiFetch } from "../../../lib/api"
import { useAuth } from "../../../context/AuthContext"
import { useStudentReport } from "../../../hooks/useStudentReport"
import { AttendanceProgressBar } from "./AttendanceProgressBar"
import { DefaulterAlert } from "./DefaulterAlert"
import { StudentPageHeader } from "./StudentPageHeader"
import type { AttendanceHistoryItem } from "../types"

export const StudentAttendance: React.FC = () => {
  const { user } = useAuth()
  const { subjects, overallPct, loading, error, promotionStatus, isDefaulter, threshold } = useStudentReport(
    !user?.enrollmentOverdue
  )
  const [history, setHistory] = useState<AttendanceHistoryItem[]>([])

  useEffect(() => {
    if (user?.enrollmentOverdue) return
    apiFetch<{ results?: AttendanceHistoryItem[] }>("/attendance/history/")
      .then((data) => setHistory(data.results ?? []))
      .catch(() => setHistory([]))
  }, [user?.enrollmentOverdue])

  if (user?.enrollmentOverdue) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
        Complete face enrollment to view attendance.
      </div>
    )
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading attendance...</p>
  }

  if (error) {
    return <p className="text-sm text-rose-600">{error}</p>
  }

  return (
    <div className="space-y-6">
      <StudentPageHeader
        title="Attendance"
        description="Overall percentage, subject-wise statistics, and session history"
      />

      <DefaulterAlert
        overallPercentage={overallPct}
        promotionStatus={promotionStatus}
        atRiskSubjects={subjects}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-emerald-600" />
          <h3 className="text-sm font-bold text-slate-800">Overall Attendance</h3>
        </div>
        <AttendanceProgressBar
          label="Combined across all subjects"
          percentage={overallPct}
          subtitle={`Minimum required: ${threshold}% • Status: ${promotionStatus}`}
          size="lg"
        />
        {isDefaulter ? (
          <p className="mt-3 text-xs font-medium text-rose-600">
            You are currently marked as a defaulter. Attend classes regularly to recover.
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-bold text-slate-800">Subject-wise attendance</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {subjects.length === 0 ? (
            <p className="text-xs text-slate-500 col-span-2">No subject attendance records yet.</p>
          ) : (
            subjects.map((subject) => (
              <div key={subject.code} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <AttendanceProgressBar
                  label={`${subject.code} — ${subject.name}`}
                  percentage={subject.percentage}
                  subtitle={`Present: ${subject.present}/${subject.total} • Absent: ${subject.absent}`}
                />
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm overflow-hidden">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800">
          <History className="h-4 w-4 text-emerald-600" />
          Recent history
        </h3>
        <div className="overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold uppercase text-slate-500">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Hour</th>
                <th className="py-2 pr-4">Subject</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {history.slice(0, 40).map((row) => (
                <tr key={row.id}>
                  <td className="py-2.5 pr-4 text-slate-700">{row.date}</td>
                  <td className="py-2.5 pr-4 text-slate-600">{row.hour}</td>
                  <td className="py-2.5 pr-4 font-medium text-slate-800">{row.subject}</td>
                  <td className="py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        ["PRESENT", "LATE", "EXCUSED"].includes(row.status)
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
