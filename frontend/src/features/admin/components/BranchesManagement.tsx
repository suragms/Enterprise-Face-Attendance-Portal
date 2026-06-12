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
  latitude?: number
  longitude?: number
  geofence_radius?: number
  is_active: boolean
}

export const BranchesManagement: React.FC = () => {
  const { user } = useAuth()
  const canManage = isSuperAdminRole(user?.role)
  const [editing, setEditing] = useState<Branch | null>(null)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    name: "",
    code: "",
    address: "",
    timezone: "Asia/Kolkata",
    latitude: "",
    longitude: "",
    geofence_radius: "100",
    is_active: true
  })

  const resetForm = () => {
    setEditing(null)
    setError("")
    setForm({
      name: "",
      code: "",
      address: "",
      timezone: "Asia/Kolkata",
      latitude: "",
      longitude: "",
      geofence_radius: "100",
      is_active: true
    })
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError("")
    const payload = {
      ...form,
      code: form.code.toUpperCase().trim(),
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      geofence_radius: form.geofence_radius ? parseFloat(form.geofence_radius) : 100
    }
    try {
      if (editing) {
        await apiFetch(`/branches/${editing.id}/`, { method: "PUT", body: payload })
      } else {
        await apiFetch("/branches/", { method: "POST", body: payload })
      }
      resetForm()
      window.location.reload()
    } catch (err: any) {
      setError(err.message || "Failed to save branch.")
    }
  }

  return (
    <AdminCrudPage<Branch>
      title="Branches"
      description="Manage campus branches within the active organization."
      endpoint="/branches/"
      exportFilename="branches.csv"
      canManage={canManage}
      onEdit={(row) => {
        setError("")
        setEditing(row)
        setForm({
          name: row.name,
          code: row.code,
          address: row.address || "",
          timezone: row.timezone || "Asia/Kolkata",
          latitude: row.latitude !== undefined && row.latitude !== null ? String(row.latitude) : "",
          longitude: row.longitude !== undefined && row.longitude !== null ? String(row.longitude) : "",
          geofence_radius: row.geofence_radius !== undefined && row.geofence_radius !== null ? String(row.geofence_radius) : "100",
          is_active: row.is_active,
        })
      }}
      columns={[
        { key: "name", label: "Branch" },
        { key: "code", label: "Code" },
        { key: "address", label: "Address" },
        { key: "timezone", label: "Timezone" },
        {
          key: "geofence",
          label: "Geofence (Lat, Lng, Rad)",
          render: (row) =>
            row.latitude && row.longitude
              ? `${row.latitude}, ${row.longitude} (${row.geofence_radius}m)`
              : "None"
        },
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
            <input className="rounded border px-3 py-2 text-sm" placeholder="Branch name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input className="rounded border px-3 py-2 text-sm" placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            <input className="rounded border px-3 py-2 text-sm md:col-span-2" placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <input className="rounded border px-3 py-2 text-sm" type="number" step="any" placeholder="Latitude (e.g. 12.9716)" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
            <input className="rounded border px-3 py-2 text-sm" type="number" step="any" placeholder="Longitude (e.g. 77.5946)" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
            <input className="rounded border px-3 py-2 text-sm" type="number" step="any" placeholder="Geofence Radius (meters)" value={form.geofence_radius} onChange={(e) => setForm({ ...form, geofence_radius: e.target.value })} />
            <select className="rounded border px-3 py-2 text-sm" value={form.is_active ? "true" : "false"} onChange={(e) => setForm({ ...form, is_active: e.target.value === "true" })}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <button type="submit" className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white md:col-span-3">
              {editing ? "Update Branch" : "Create Branch"}
            </button>
          </form>
        </div>
      }
    />
  )
}
