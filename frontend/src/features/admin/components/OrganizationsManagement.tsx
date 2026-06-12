import React, { useState } from "react"
import { apiFetch } from "../../../lib/api"
import { AdminCrudPage } from "./AdminCrudPage"
import { isSuperAdminRole } from "../../../lib/roles"
import { useAuth } from "../../../context/AuthContext"

interface Organization {
  id: string
  name: string
  slug: string
  email?: string
  phone?: string
  timezone?: string
  is_active: boolean
}

export const OrganizationsManagement: React.FC = () => {
  const { user } = useAuth()
  const canManage = isSuperAdminRole(user?.role)
  const [editing, setEditing] = useState<Organization | null>(null)
  const [form, setForm] = useState({ name: "", slug: "", email: "", phone: "", timezone: "Asia/Kolkata", is_active: true })
  const [error, setError] = useState("")

  const resetForm = () => {
    setEditing(null)
    setForm({ name: "", slug: "", email: "", phone: "", timezone: "Asia/Kolkata", is_active: true })
    setError("")
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError("")
    try {
      if (editing) {
        await apiFetch(`/organizations/${editing.id}/`, { method: "PUT", body: form })
      } else {
        const newOrg = await apiFetch("/organizations/", { method: "POST", body: form })
        if (newOrg && newOrg.id) {
          try {
            await apiFetch("/auth/switch-organization/", {
              method: "POST",
              body: { organization_id: newOrg.id }
            })
          } catch (err) {
            console.error("Auto-switch failed:", err)
          }
        }
      }
      resetForm()
      window.location.reload()
    } catch (err: any) {
      setError(err.message || "Failed to save organization.")
    }
  }

  return (
    <AdminCrudPage<Organization>
      title="Organizations"
      description="Manage tenant organizations for the HexaAttender platform."
      endpoint="/organizations/"
      exportFilename="organizations.csv"
      canManage={canManage}
      onEdit={(row) => {
        setEditing(row)
        setForm({
          name: row.name,
          slug: row.slug,
          email: row.email || "",
          phone: row.phone || "",
          timezone: row.timezone || "Asia/Kolkata",
          is_active: row.is_active,
        })
      }}
      columns={[
        { key: "name", label: "Name" },
        { key: "slug", label: "Slug" },
        { key: "email", label: "Email" },
        { key: "phone", label: "Phone" },
        { key: "timezone", label: "Timezone" },
        { key: "is_active", label: "Active", render: (row) => (row.is_active ? "Yes" : "No") },
      ]}
      formFields={
        <div className="space-y-3">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-800 border border-rose-250 rounded-xl text-xs font-bold leading-normal">
              {error}
            </div>
          )}
          <form onSubmit={submit} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
            <input className="rounded border px-3 py-2 text-sm" placeholder="Organization name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input className="rounded border px-3 py-2 text-sm" placeholder="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
            <input className="rounded border px-3 py-2 text-sm" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="rounded border px-3 py-2 text-sm" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className="rounded border px-3 py-2 text-sm" placeholder="Timezone" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
            <select className="rounded border px-3 py-2 text-sm" value={form.is_active ? "true" : "false"} onChange={(e) => setForm({ ...form, is_active: e.target.value === "true" })}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <button type="submit" className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white md:col-span-3">
              {editing ? "Update Organization" : "Create Organization"}
            </button>
          </form>
        </div>
      }
    />
  )
}
