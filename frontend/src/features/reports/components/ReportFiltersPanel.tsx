import React from "react"
import type { ReportFilters, ReportMeta, ReportType } from "../types"

interface Props {
  activeTab: ReportType
  filters: ReportFilters
  meta: ReportMeta | null
  onChange: (patch: Partial<ReportFilters>) => void
  isFaculty?: boolean
}

export const ReportFiltersPanel: React.FC<Props> = ({ activeTab, filters, meta, onChange, isFaculty }) => {
  if (!meta) {
    return <p className="text-xs text-slate-400">Loading filter options...</p>
  }

  const showDateRange = ["weekly", "semester"].includes(activeTab)
  const showSingleDate = activeTab === "daily"
  const showMonthYear = activeTab === "monthly"

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
      {showSingleDate && (
        <label className="text-xs font-semibold text-slate-600">
          Date
          <input
            type="date"
            value={filters.date || ""}
            onChange={(e) => onChange({ date: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
        </label>
      )}
      {showDateRange && (
        <>
          <label className="text-xs font-semibold text-slate-600">
            Start date
            <input
              type="date"
              value={filters.start_date || ""}
              onChange={(e) => onChange({ start_date: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            End date
            <input
              type="date"
              value={filters.end_date || ""}
              onChange={(e) => onChange({ end_date: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </label>
        </>
      )}
      {showMonthYear && (
        <>
          <label className="text-xs font-semibold text-slate-600">
            Month
            <select
              value={filters.month || "1"}
              onChange={(e) => onChange({ month: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={String(i + 1)}>
                  {new Date(2000, i).toLocaleString("default", { month: "long" })}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Year
            <input
              type="number"
              value={filters.year || "2026"}
              onChange={(e) => onChange({ year: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
          </label>
        </>
      )}

      {!isFaculty && (
        <label className="text-xs font-semibold text-slate-600">
          Department
          <select
            value={filters.department_id || ""}
            onChange={(e) => {
              const dept = meta.departments.find((d) => d.id === e.target.value)
              onChange({ department_id: e.target.value, department: dept?.name })
            }}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="">All departments</option>
            {meta.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="text-xs font-semibold text-slate-600">
        Course
        <select
          value={filters.course_id || ""}
          onChange={(e) => {
            const course = meta.courses.find((c) => c.id === e.target.value)
            onChange({ course_id: e.target.value, course: course?.name })
          }}
          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        >
          <option value="">All courses</option>
          {meta.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs font-semibold text-slate-600">
        Semester
        <select
          value={filters.semester_id || filters.semester || ""}
          onChange={(e) => {
            const sem = meta.semesters.find((s) => s.id === e.target.value)
            onChange({
              semester_id: e.target.value,
              semester: sem ? String(sem.number) : e.target.value,
            })
          }}
          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        >
          <option value="">All semesters</option>
          {meta.semesters.map((s) => (
            <option key={s.id} value={s.id}>
              Semester {s.number}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs font-semibold text-slate-600">
        Subject
        <select
          value={filters.subject_id || ""}
          onChange={(e) => {
            const sub = meta.subjects.find((s) => s.id === e.target.value)
            onChange({ subject_id: e.target.value, subject_code: sub?.subject_code })
          }}
          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        >
          <option value="">All subjects</option>
          {meta.subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.subject_code} — {s.name}
            </option>
          ))}
        </select>
      </label>

      {activeTab === "student" && (
        <label className="text-xs font-semibold text-slate-600">
          Roll No
          <input
            type="text"
            value={filters.roll_no || ""}
            onChange={(e) => onChange({ roll_no: e.target.value })}
            placeholder="Student roll number"
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
        </label>
      )}

      {!isFaculty && activeTab === "faculty" && (
        <label className="text-xs font-semibold text-slate-600">
          Faculty
          <select
            value={filters.faculty_id || ""}
            onChange={(e) => {
              const fac = meta.faculty.find((f) => f.id === e.target.value)
              onChange({ faculty_id: e.target.value, staff_code: fac?.staff_code })
            }}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="">Select faculty</option>
            {meta.faculty.map((f) => (
              <option key={f.id} value={f.id}>
                {f.staff_code} — {f.first_name} {f.last_name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}
