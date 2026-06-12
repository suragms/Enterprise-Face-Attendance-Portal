import React, { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { BookOpen, Plus } from "lucide-react"
import { apiFetch } from "../../../lib/api"
import type { Course } from "../types"

export const CourseManagement: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [form, setForm] = useState({ code: "", name: "", department: "", duration_semesters: 8 })

  const load = async () => {
    setLoading(true)
    try {
      const [courseData, deptData] = await Promise.all([
        apiFetch<Course[] | { results: Course[] }>("/courses/"),
        apiFetch<any>("/departments/"),
      ])
      setCourses(Array.isArray(courseData) ? courseData : courseData.results ?? [])
      setDepartments(deptData.results || deptData || [])
      if (!form.department && (deptData.results || deptData)?.length) {
        setForm((f) => ({ ...f, department: (deptData.results || deptData)[0].id }))
      }
      setError("")
    } catch (err: any) {
      setError(err.message || "Failed to load courses.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const createCourse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.department) {
      setError("Please select a department (create one in Departments if none exist).")
      return
    }
    try {
      await apiFetch("/courses/", { method: "POST", body: form })
      setForm({ code: "", name: "", department: form.department, duration_semesters: 8 })
      await load()
    } catch (err: any) {
      setError(err.message || "Failed to create course.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white">
        <div className="flex items-center gap-3">
          <BookOpen className="h-8 w-8 opacity-90" />
          <div>
            <h2 className="text-2xl font-bold">Course Management</h2>
            <p className="text-sm text-emerald-100">Define programmes linked to departments and semesters</p>
          </div>
        </div>
      </div>

      {departments.length === 0 && (
        <div className="rounded-xl border border-amber-250 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          No departments found in this organization. You must create a department under the{" "}
          <Link to="/admin/departments" className="underline text-amber-900 hover:text-amber-950 font-bold">
            Departments
          </Link>{" "}
          tab before creating a course.
        </div>
      )}

      <form onSubmit={createCourse} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <input
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder="Course code"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          required
        />
        <input
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder="Course name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <select
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
          value={form.department}
          onChange={(e) => setForm({ ...form, department: e.target.value })}
          required
          disabled={departments.length === 0}
        >
          {departments.length === 0 ? (
            <option value="" disabled>No departments available (Create a department first)</option>
          ) : (
            <>
              <option value="" disabled>-- Select Department --</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </>
          )}
        </select>
        <input
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          type="number"
          min={1}
          max={12}
          placeholder="Semesters"
          value={form.duration_semesters}
          onChange={(e) => setForm({ ...form, duration_semesters: Number(e.target.value) })}
          required
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 sm:col-span-2 lg:col-span-4"
        >
          <Plus className="h-4 w-4" />
          Create course
        </button>
      </form>

      {loading ? <p className="text-sm text-slate-500">Loading courses...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Code</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Department</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Duration</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => (
              <tr key={course.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-semibold text-slate-800">{course.code}</td>
                <td className="px-4 py-3">{course.name}</td>
                <td className="px-4 py-3">{course.department_name || course.department}</td>
                <td className="px-4 py-3">{course.duration_semesters} semesters</td>
              </tr>
            ))}
            {!loading && courses.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No courses yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
