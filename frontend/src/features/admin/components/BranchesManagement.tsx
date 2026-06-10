import React, { useState } from "react"
import { apiFetch } from "../../../lib/api"
import { AdminCrudPage } from "./AdminCrudPage"
import { isSuperAdminRole } from "../../../lib/roles"
import { useAuth } from "../../../context/AuthContext"

interface Branch {
  id: string
  name: string
  code: string
  address?: string
  timezone?: string
  is_active: boolean
}

export const BranchesManagement: React.FC = () => {
  const { user } = useAuth()
  const canManage = isSuperAdminRole(user?.role)
  const [editing, setEditing] = useState<Branch | null>(null)
  const [form, setForm] = useState({ name: "", code: "", address: "", timezone: "Asia/Kolkata", is_active: true })

  const resetForm = () => {
    setEditing(null)
    setForm({ name: "", code: "", address: "", timezone: "Asia/Kolkata", is_active: true })
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const payload = { ...form, code: form.code.toUpperCase().trim() }
    if (editing) {
      await apiFetch(`/branches/${editing.id}/`, { method: "PUT", body: payload })
    } else {
      await apiFetch("/branches/", { method: "POST", body: payload })
    }
    resetForm()
    window.location.reload()
  }

  return (
    <AdminCrudPage<Branch>
      title="Branches"
      description="Manage campus branches within the active organization."
      endpoint="/branches/"
      exportFilename="branches.csv"
      canManage={canManage}
      onEdit={(row) => {
        setEditing(row)
        setForm({
          name: row.name,
          code: row.code,
          address: row.address || "",
          timezone: row.timezone || "Asia/Kolkata",
          is_active: row.is_active,
        })
      }}
      columns={[
        { key: "name", label: "Branch" },
        { key: "code", label: "Code" },
        { key: "address", label: "Address" },
        { key: "timezone", label: "Timezone" },
        { key: "is_active", label: "Active", render: (row) => (row.is_active ? "Yes" : "No") },
      ]}
      formFields={
        <form onSubmit={submit} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
          <input className="rounded border px-3 py-2 text-sm" placeholder="Branch name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="rounded border px-3 py-2 text-sm" placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <input className="rounded border px-3 py-2 text-sm md:col-span-2" placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <select className="rounded border px-3 py-2 text-sm" value={form.is_active ? "true" : "false"} onChange={(e) => setForm({ ...form, is_active: e.target.value === "true" })}>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <button type="submit" className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white md:col-span-3">
            {editing ? "Update Branch" : "Create Branch"}
          </button>
        </form>
      }
    />
  )
}
