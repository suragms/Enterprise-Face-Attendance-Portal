import React, { useEffect, useState } from "react"
import { CalendarClock, Download } from "lucide-react"
import { API_BASE, apiFetch } from "../../../lib/api"
import { useAuth } from "../../../context/AuthContext"
import { isFacultyRole } from "../../../lib/roles"
import { FacultyScopeBanner } from "../../staff/components/FacultyScopeBanner"

interface ExamRow {
  id: string
  title: string
  exam_date: string
  starts_at: string
  ends_at: string
  room: string
  subject_code?: string
  subject_name?: string
  status: "DRAFT" | "PUBLISHED"
}

export const ExamTimetableManagement: React.FC = () => {
  const { user } = useAuth()
  const isFaculty = isFacultyRole(user?.role)
  const [rows, setRows] = useState<ExamRow[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    title: "",
    subject: "",
    course: "",
    semester: "",
    department: "",
    exam_date: "",
    starts_at: "09:30",
    ends_at: "11:30",
    room: "",
    notes: "",
  })

  const load = async () => {
    setLoading(true)
    try {
      const [examData, subjectData] = await Promise.all([
        apiFetch<ExamRow[] | { results: ExamRow[] }>("/exams/"),
        apiFetch<any>("/subjects/"),
      ])
      const subjectList = subjectData.results || subjectData || []
      setSubjects(subjectList)
      setRows(Array.isArray(examData) ? examData : examData.results ?? [])
      if (!form.subject && subjectList.length > 0) {
        const s = subjectList[0]
        setForm((prev) => ({
          ...prev,
          subject: s.id,
          course: s.course || "",
          semester: s.semester || "",
          department: s.department || "",
        }))
      }
      setError("")
    } catch (err: any) {
      setError(err.message || "Failed to load exam timetable.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const createExam = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiFetch("/exams/", { method: "POST", body: form })
      setForm({ ...form, title: "", room: "", notes: "", exam_date: "" })
      await load()
    } catch (err: any) {
      setError(err.message || "Failed to create exam schedule.")
    }
  }

  const publishExam = async (id: string) => {
    await apiFetch(`/exams/${id}/publish/`, { method: "POST" })
    await load()
  }

  return (
    <div className="space-y-6">
      {isFaculty ? <FacultyScopeBanner /> : null}
      <div className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-700 p-6 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CalendarClock className="h-8 w-8" />
            <div>
              <h2 className="text-2xl font-bold">Exam Timetable</h2>
              <p className="text-sm text-violet-100">Schedule and publish exams for students</p>
            </div>
          </div>
          <a
            className="inline-flex items-center gap-2 rounded-lg bg-white/20 px-4 py-2 text-xs font-semibold hover:bg-white/30"
            href={`${API_BASE}/exams/export-pdf/`}
          >
            <Download className="h-4 w-4" />
            Export PDF
          </a>
        </div>
      </div>

      <form onSubmit={createExam} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <input
          className="md:col-span-3 rounded-lg border px-3 py-2 text-sm"
          placeholder="Exam title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />
        <select
          className="rounded-lg border px-3 py-2 text-sm"
          value={form.subject}
          onChange={(e) => {
            const selected = subjects.find((s) => String(s.id) === e.target.value)
            setForm({
              ...form,
              subject: e.target.value,
              course: selected?.course || "",
              semester: selected?.semester || "",
              department: selected?.department || "",
            })
          }}
          required
        >
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.subject_code} — {subject.name}
            </option>
          ))}
        </select>
        <input
          className="rounded-lg border px-3 py-2 text-sm"
          type="date"
          value={form.exam_date}
          onChange={(e) => setForm({ ...form, exam_date: e.target.value })}
          required
        />
        <input
          className="rounded-lg border px-3 py-2 text-sm"
          placeholder="Room"
          value={form.room}
          onChange={(e) => setForm({ ...form, room: e.target.value })}
          required
        />
        <input
          className="rounded-lg border px-3 py-2 text-sm"
          type="time"
          value={form.starts_at}
          onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
          required
        />
        <input
          className="rounded-lg border px-3 py-2 text-sm"
          type="time"
          value={form.ends_at}
          onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
          required
        />
        <input
          className="md:col-span-3 rounded-lg border px-3 py-2 text-sm"
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <button
          type="submit"
          className="md:col-span-3 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
        >
          Create exam
        </button>
      </form>

      {loading ? <p className="text-sm text-slate-500">Loading...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Subject</th>
              <th className="px-4 py-3 text-left">Time</th>
              <th className="px-4 py-3 text-left">Room</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-4 py-3">{row.exam_date}</td>
                <td className="px-4 py-3">{row.subject_code || row.title}</td>
                <td className="px-4 py-3">
                  {String(row.starts_at).slice(0, 5)} – {String(row.ends_at).slice(0, 5)}
                </td>
                <td className="px-4 py-3">{row.room}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      row.status === "PUBLISHED" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {row.status === "DRAFT" ? (
                    <button
                      type="button"
                      className="rounded bg-indigo-600 px-2 py-1 text-xs text-white"
                      onClick={() => publishExam(row.id)}
                    >
                      Publish
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No exams scheduled.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
