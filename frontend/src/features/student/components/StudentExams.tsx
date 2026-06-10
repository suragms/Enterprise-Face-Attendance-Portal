import React, { useEffect, useState } from "react"
import { CalendarClock, Download } from "lucide-react"
import { API_BASE, apiFetch } from "../../../lib/api"
import { StudentPageHeader } from "./StudentPageHeader"

interface Exam {
  id: string
  title?: string
  exam_date: string
  starts_at: string
  ends_at: string
  subject_code?: string
  subject_name?: string
  room?: string
}

export const StudentExams: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    apiFetch<Exam[] | { results: Exam[] }>("/exams/?status=PUBLISHED")
      .then((data) => {
        const rows = Array.isArray(data) ? data : data.results ?? []
        setExams(rows.sort((a, b) => String(a.exam_date).localeCompare(String(b.exam_date))))
        setError("")
      })
      .catch((err: any) => setError(err.message || "Failed to load exams."))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <StudentPageHeader title="Exam Timetable" description="Upcoming published exams for your semester">
        <a
          href={`${API_BASE}/exams/export-pdf/`}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5" />
          PDF
        </a>
      </StudentPageHeader>

      {loading ? <p className="text-sm text-slate-500">Loading exam schedule...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="space-y-3">
        {exams.map((exam) => (
          <div
            key={exam.id}
            className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50">
                <CalendarClock className="h-6 w-6 text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {exam.subject_code || exam.title} — {exam.subject_name || exam.title}
                </p>
                <p className="text-xs text-slate-500">
                  {exam.exam_date} • {exam.starts_at?.slice?.(0, 5) ?? exam.starts_at}–
                  {exam.ends_at?.slice?.(0, 5) ?? exam.ends_at}
                </p>
                {exam.room ? <p className="text-xs text-emerald-700 font-medium">Room: {exam.room}</p> : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      {!loading && exams.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-8">No published exams scheduled.</p>
      ) : null}
    </div>
  )
}
