import React, { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { apiFetch } from "../../../lib/api"
import { useAuth } from "../../../context/AuthContext"
import { isSuperAdminRole } from "../../../lib/roles"

interface Branch { id: string; name: string; code: string }
interface Hod { id: string; email: string; first_name: string; last_name: string }
interface Department {
  id: string
  name: string
  code: string
  description?: string
  status: "ACTIVE" | "INACTIVE"
  branch_name?: string
  branch?: string
  hod?: string | null
  hod_name?: string
}

export const DepartmentsManagement: React.FC = () => {
  const { user } = useAuth()
  const isSuperAdmin = isSuperAdminRole(user?.role)
  const [departments, setDepartments] = useState<Department[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [hods, setHods] = useState<Hod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState<Department | null>(null)
  const [form, setForm] = useState({ name: "", code: "", description: "", status: "ACTIVE", branch: "", hod: "" })

  const load = async () => {
    setLoading(true)
    try {
      const [deptData, branchData, hodData] = await Promise.all([
        apiFetch<any>("/departments/?page_size=100"),
        apiFetch<any>("/branches/?page_size=100"),
        apiFetch<any>("/auth/accounts/hod/"),
      ])
      setDepartments(deptData.results || deptData || [])
      const loadedBranches = branchData.results || branchData || []
      const loadedHods = hodData.results || []
      setBranches(loadedBranches)
      setHods(loadedHods)
      if (loadedBranches.length && !form.branch) {
        setForm((prev) => ({ ...prev, branch: loadedBranches[0].id }))
      }
      setError("")
    } catch (err: any) {
      setError(err.message || "Failed to load departments.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const validateForm = () => {
    if (!form.name.trim()) return "Department name is required."
    if (form.code.trim().length < 2) return "Department code must be at least 2 characters."
    if (!form.branch) return "Please select a branch (create one in Branches if none exist)."
    return ""
  }

  const submitDepartment = async (e: React.FormEvent) => {
    e.preventDefault()
    const validation = validateForm()
    if (validation) {
      setError(validation)
      return
    }
    try {
      const payload = {
        ...form,
        code: form.code.toUpperCase().trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        hod: form.hod || null,
      }
      if (editing) {
        await apiFetch(`/departments/${editing.id}/`, { method: "PUT", body: payload })
      } else {
        await apiFetch("/departments/", { method: "POST", body: payload })
      }
      setEditing(null)
      setForm((prev) => ({ ...prev, name: "", code: "", description: "", status: "ACTIVE", hod: "" }))
      load()
    } catch (err: any) {
      setError(err.message || "Failed to save department.")
    }
  }

  const editDepartment = (department: Department) => {
    setEditing(department)
    setForm({
      name: department.name,
      code: department.code,
      description: department.description || "",
      status: department.status || "ACTIVE",
      branch: department.branch || form.branch,
      hod: department.hod || "",
    })
  }

  const clearEdit = () => {
    setEditing(null)
    setForm((prev) => ({ ...prev, name: "", code: "", description: "", status: "ACTIVE", hod: "" }))
  }

  const deleteDepartment = async (id: string) => {
    if (!window.confirm("Delete this department?")) return
    try {
      await apiFetch(`/departments/${id}/`, { method: "DELETE" })
      load()
    } catch (err: any) {
      setError(err.message || "Failed to delete department.")
    }
  }

  return (
    <div className="space-y-6">
      {!isSuperAdmin ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          Only Super Admin can manage departments.
        </div>
      ) : null}
      <h2 className="text-xl font-bold text-slate-900">Departments</h2>
      {isSuperAdmin && branches.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          No branches found in this organization. You must create a branch under the{" "}
          <Link to="/admin/branches" className="underline text-amber-900 hover:text-amber-950 font-bold">
            Branches
          </Link>{" "}
          tab before creating a department.
        </div>
      )}
      <form onSubmit={submitDepartment} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4">
        <input disabled={!isSuperAdmin} className="rounded border px-3 py-2 text-sm disabled:bg-slate-100" placeholder="Department name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input disabled={!isSuperAdmin} className="rounded border px-3 py-2 text-sm disabled:bg-slate-100" placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
        <select
          disabled={!isSuperAdmin || branches.length === 0}
          className="rounded border px-3 py-2 text-sm disabled:bg-slate-100"
          value={form.branch}
          onChange={(e) => setForm({ ...form, branch: e.target.value })}
          required
        >
          {branches.length === 0 ? (
            <option value="" disabled>No branches available (Create a branch first)</option>
          ) : (
            <>
              <option value="" disabled>-- Assign Branch --</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </>
          )}
        </select>
        <select disabled={!isSuperAdmin} className="rounded border px-3 py-2 text-sm disabled:bg-slate-100" value={form.hod} onChange={(e) => setForm({ ...form, hod: e.target.value })}>
          <option value="">Assign HOD (Optional)</option>
          {hods.map((h) => <option key={h.id} value={h.id}>{`${h.first_name} ${h.last_name}`.trim() || h.email}</option>)}
        </select>
        <input disabled={!isSuperAdmin} className="rounded border px-3 py-2 text-sm md:col-span-2 disabled:bg-slate-100" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <select disabled={!isSuperAdmin} className="rounded border px-3 py-2 text-sm disabled:bg-slate-100" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "ACTIVE" | "INACTIVE" })}>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <button disabled={!isSuperAdmin} className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" type="submit">
          {editing ? "Update Department" : "Add Department"}
        </button>
        {editing ? (
          <button disabled={!isSuperAdmin} className="rounded border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50" type="button" onClick={clearEdit}>
            Cancel Edit
          </button>
        ) : null}
      </form>
      {loading ? <div className="text-sm text-slate-500">Loading departments...</div> : null}
      {error ? <div className="text-sm text-rose-600">{error}</div> : null}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Branch</th>
              <th className="px-4 py-3 text-left">HOD</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="px-4 py-3">{d.name}</td>
                <td className="px-4 py-3">{d.code}</td>
                <td className="px-4 py-3">{d.description || "-"}</td>
                <td className="px-4 py-3">{d.status}</td>
                <td className="px-4 py-3">{d.branch_name || d.branch || "-"}</td>
                <td className="px-4 py-3">{d.hod_name || "-"}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button disabled={!isSuperAdmin} className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50" onClick={() => editDepartment(d)}>Edit</button>
                  <button disabled={!isSuperAdmin} className="rounded bg-rose-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50" onClick={() => deleteDepartment(d.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
