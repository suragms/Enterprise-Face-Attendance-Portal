import React, { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { apiFetch } from "../../../lib/api"
import { AdminCrudPage } from "./AdminCrudPage"
import { isAdminRole } from "../../../lib/roles"
import { useAuth } from "../../../context/AuthContext"

interface Semester {
  id: string
  number: number
  starts_on: string
  ends_on: string
  is_active: boolean
  course?: string
}

interface Option {
  id: string
  label: string
}

export const SemestersManagement: React.FC = () => {
  const { user } = useAuth()
  const canManage = isAdminRole(user?.role)
  const [courses, setCourses] = useState<Option[]>([])
  const [years, setYears] = useState<Option[]>([])
  const [editing, setEditing] = useState<Semester | null>(null)
  const [form, setForm] = useState({
    course: "",
    academic_year: "",
    number: 1,
    starts_on: "",
    ends_on: "",
    is_active: true,
  })

  useEffect(() => {
    const loadOptions = async () => {
      const [courseData, yearData] = await Promise.all([
        apiFetch<any>("/courses/?page_size=100"),
        apiFetch<any>("/academic-years/?page_size=100"),
      ])
      const courseRows = courseData.results || courseData || []
      const yearRows = yearData.results || yearData || []
      setCourses(courseRows.map((item: any) => ({ id: item.id, label: `${item.code} - ${item.name}` })))
      setYears(yearRows.map((item: any) => ({ id: item.id, label: item.name })))
      if (courseRows[0]) setForm((prev) => ({ ...prev, course: courseRows[0].id }))
      if (yearRows[0]) setForm((prev) => ({ ...prev, academic_year: yearRows[0].id }))
    }
    loadOptions()
  }, [])

  const resetForm = () => {
    setEditing(null)
    setForm((prev) => ({
      course: prev.course,
      academic_year: prev.academic_year,
      number: 1,
      starts_on: "",
      ends_on: "",
      is_active: true,
    }))
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (editing) {
      await apiFetch(`/semesters/${editing.id}/`, { method: "PUT", body: form })
    } else {
      await apiFetch("/semesters/", { method: "POST", body: form })
    }
    resetForm()
    window.location.reload()
  }

  return (
    <AdminCrudPage<Semester>
      title="Semesters"
      description="Manage academic semesters mapped to courses and academic years."
      endpoint="/semesters/"
      exportFilename="semesters.csv"
      canManage={canManage}
      onEdit={(row) => {
        setEditing(row)
        setForm({
          course: row.course || form.course,
          academic_year: (row as any).academic_year || form.academic_year,
          number: row.number,
          starts_on: row.starts_on,
          ends_on: row.ends_on,
          is_active: row.is_active,
        })
      }}
      columns={[
        { key: "number", label: "Semester" },
        { key: "starts_on", label: "Starts" },
        { key: "ends_on", label: "Ends" },
        { key: "is_active", label: "Active", render: (row) => (row.is_active ? "Yes" : "No") },
      ]}
      formFields={
        <div className="space-y-3">
          {(courses.length === 0 || years.length === 0) && (
            <div className="p-4 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-sm font-semibold leading-normal">
              {courses.length === 0 && (
                <p>
                  No courses found in this organization. Please create a course in the{" "}
                  <Link to="/admin/courses" className="underline text-amber-900 hover:text-amber-950 font-bold">
                    Courses
                  </Link>{" "}
                  tab first.
                </p>
              )}
              {years.length === 0 && (
                <p>
                  No academic years found. Please ensure academic years are configured in the backend first.
                </p>
              )}
            </div>
          )}
          <form onSubmit={submit} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
            <select
              className="rounded border px-3 py-2 text-sm disabled:bg-slate-100"
              value={form.course}
              onChange={(e) => setForm({ ...form, course: e.target.value })}
              required
              disabled={courses.length === 0}
            >
              {courses.length === 0 ? (
                <option value="" disabled>No courses available (Create a course first)</option>
              ) : (
                <>
                  <option value="" disabled>-- Select Course --</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>{course.label}</option>
                  ))}
                </>
              )}
            </select>
            <select
              className="rounded border px-3 py-2 text-sm disabled:bg-slate-100"
              value={form.academic_year}
              onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
              required
              disabled={years.length === 0}
            >
              {years.length === 0 ? (
                <option value="" disabled>No academic years available (Configure academic years first)</option>
              ) : (
                <>
                  <option value="" disabled>-- Select Academic Year --</option>
                  {years.map((year) => (
                    <option key={year.id} value={year.id}>{year.label}</option>
                  ))}
                </>
              )}
            </select>
          <input type="number" min={1} className="rounded border px-3 py-2 text-sm" value={form.number} onChange={(e) => setForm({ ...form, number: Number(e.target.value) })} required />
          <input type="date" className="rounded border px-3 py-2 text-sm" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} required />
          <input type="date" className="rounded border px-3 py-2 text-sm" value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} required />
          <select className="rounded border px-3 py-2 text-sm" value={form.is_active ? "true" : "false"} onChange={(e) => setForm({ ...form, is_active: e.target.value === "true" })}>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <button type="submit" className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white md:col-span-3">
            {editing ? "Update Semester" : "Create Semester"}
          </button>
          </form>
        </div>
      }
    />
  )
}
