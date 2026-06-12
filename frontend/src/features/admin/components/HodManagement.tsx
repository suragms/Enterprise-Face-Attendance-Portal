import React, { useEffect, useState } from "react"
import { Navigate, Link } from "react-router-dom"
import { apiFetch } from "../../../lib/api"
import { isSuperAdminRole } from "../../../lib/roles"
import { useAuth } from "../../../context/AuthContext"

interface Hod {
  id: string
  email: string
  username: string
  first_name: string
  last_name: string
  role: string
}

interface DepartmentOption {
  id: string
  name: string
  code?: string
}

export const HodManagement: React.FC = () => {
  const { user } = useAuth()
  if (!isSuperAdminRole(user?.role)) {
    return <Navigate to="/admin/dashboard" replace />
  }

  const [hods, setHods] = useState<Hod[]>([])
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    email: "",
    username: "",
    first_name: "",
    last_name: "",
    phone: "",
    password: "",
    department_id: "",
  })

  const load = async () => {
    setLoading(true)
    try {
      const [hodData, departmentData] = await Promise.all([
        apiFetch<{ results: Hod[] }>("/auth/accounts/hod/"),
        apiFetch<any>("/departments/").catch(() => ({ results: [] })),
      ])
      const deptList = departmentData.results || departmentData || []
      setDepartments(deptList)
      setHods(hodData.results || [])
      setError("")
      if (!form.department_id && deptList.length > 0) {
        setForm((prev) => ({ ...prev, department_id: deptList[0].id }))
      }
    } catch (err: any) {
      setError(err.message || "Failed to load HOD accounts.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const createHod = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.department_id) {
      setError("Please select a department (create one in Departments if none exist).")
      return
    }
    try {
      await apiFetch("/auth/accounts/hod/", { method: "POST", body: form })
      setForm({
        email: "",
        username: "",
        first_name: "",
        last_name: "",
        phone: "",
        password: "",
        department_id: departments[0]?.id || "",
      })
      load()
    } catch (err: any) {
      setError(err.message || "Failed to create HOD.")
    }
  }

  const deactivateHod = async (id: string) => {
    try {
      await apiFetch("/auth/accounts/hod/", { method: "DELETE", body: { user_id: id } })
      await load()
    } catch (err: any) {
      setError(err.message || "Failed to deactivate HOD.")
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-900">HOD Management</h2>
      {departments.length === 0 && (
        <div className="rounded-xl border border-amber-250 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          No departments found in this organization. You must create a department under the{" "}
          <Link to="/admin/departments" className="underline text-amber-900 hover:text-amber-950 font-bold">
            Departments
          </Link>{" "}
          tab before creating an HOD account.
        </div>
      )}

      <form onSubmit={createHod} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <input className="rounded border px-3 py-2 text-sm" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className="rounded border px-3 py-2 text-sm" placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
        <input className="rounded border px-3 py-2 text-sm" placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <input className="rounded border px-3 py-2 text-sm" placeholder="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
        <input className="rounded border px-3 py-2 text-sm" placeholder="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
        <input className="rounded border px-3 py-2 text-sm" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <select
          className="rounded border px-3 py-2 text-sm md:col-span-2 disabled:bg-slate-100"
          value={form.department_id}
          onChange={(e) => setForm({ ...form, department_id: e.target.value })}
          required
          disabled={departments.length === 0}
        >
          {departments.length === 0 ? (
            <option value="" disabled>No departments available (Create a department first)</option>
          ) : (
            <>
              <option value="" disabled>-- Select Department --</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </>
          )}
        </select>
        <button type="submit" className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white md:col-span-3">Create HOD Account</button>
      </form>

      {loading ? <div className="text-sm text-slate-500">Loading HOD accounts...</div> : null}
      {error ? <div className="text-sm text-rose-600">{error}</div> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {hods.map((hod) => (
              <tr key={hod.id} className="border-t">
                <td className="px-4 py-3">{`${hod.first_name || ""} ${hod.last_name || ""}`.trim() || hod.username}</td>
                <td className="px-4 py-3">{hod.email}</td>
                <td className="px-4 py-3">{hod.role}</td>
                <td className="px-4 py-3 text-right">
                  <button className="rounded bg-rose-600 px-3 py-1 text-xs font-semibold text-white" onClick={() => deactivateHod(hod.id)}>
                    Deactivate
                  </button>
                </td>
              </tr>
            ))}
            {!loading && hods.length === 0 ? (
              <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={4}>No HOD accounts found.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
