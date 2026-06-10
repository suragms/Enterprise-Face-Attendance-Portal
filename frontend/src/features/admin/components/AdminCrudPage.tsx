import React, { useEffect, useState } from "react"
import { Archive, Download, Pencil, RotateCcw, Trash2 } from "lucide-react"
import { apiFetch, API_BASE, getAuthHeaders } from "../../../lib/api"

export interface AdminColumn<T> {
  key: keyof T | string
  label: string
  render?: (row: T) => React.ReactNode
}

interface AdminCrudPageProps<T extends { id: string }> {
  title: string
  description?: string
  endpoint: string
  exportFilename?: string
  columns: AdminColumn<T>[]
  formFields: React.ReactNode
  canManage?: boolean
  showArchived?: boolean
  onEdit?: (row: T) => void
  emptyMessage?: string
}

export function AdminCrudPage<T extends { id: string; is_deleted?: boolean }>({
  title,
  description,
  endpoint,
  exportFilename = "export.csv",
  columns,
  formFields,
  canManage = true,
  showArchived = true,
  onEdit,
  emptyMessage = "No records found.",
}: AdminCrudPageProps<T>) {
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [archivedView, setArchivedView] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const suffix = archivedView ? "?is_archived=true&page_size=200" : "?page_size=200"
      const data = await apiFetch<any>(`${endpoint}${suffix}`)
      setRows(data.results || data || [])
      setError("")
    } catch (err: any) {
      setError(err.message || `Failed to load ${title.toLowerCase()}.`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [endpoint, archivedView])

  const archiveRow = async (id: string) => {
    if (!window.confirm("Archive this record?")) return
    await apiFetch(`${endpoint}${id}/archive/`, { method: "POST" })
    await load()
  }

  const restoreRow = async (id: string) => {
    await apiFetch(`${endpoint}${id}/restore/`, { method: "POST" })
    await load()
  }

  const deleteRow = async (id: string) => {
    if (!window.confirm("Permanently remove this record?")) return
    await apiFetch(`${endpoint}${id}/`, { method: "DELETE" })
    await load()
  }

  const exportRows = async () => {
    const response = await fetch(`${API_BASE}${endpoint}export/`, {
      credentials: "include",
      headers: getAuthHeaders(),
    })
    if (!response.ok) {
      setError("Export failed.")
      return
    }
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = exportFilename
    anchor.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          {description ? <p className="text-sm text-slate-500">{description}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {showArchived ? (
            <button
              type="button"
              onClick={() => setArchivedView((prev) => !prev)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
            >
              {archivedView ? "Show Active" : "Show Archived"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={exportRows}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {canManage && !archivedView ? formFields : null}
      {loading ? <div className="text-sm text-slate-500">Loading...</div> : null}
      {error ? <div className="text-sm text-rose-600">{error}</div> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th key={String(column.key)} className="px-4 py-3 text-left">
                  {column.label}
                </th>
              ))}
              {canManage ? <th className="px-4 py-3 text-right">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                {columns.map((column) => (
                  <td key={String(column.key)} className="px-4 py-3">
                    {column.render ? column.render(row) : String((row as any)[column.key] ?? "-")}
                  </td>
                ))}
                {canManage ? (
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    {!archivedView && onEdit ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700"
                        onClick={() => onEdit(row)}
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                    ) : null}
                    {!archivedView ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700"
                        onClick={() => archiveRow(row.id)}
                      >
                        <Archive className="h-3 w-3" />
                        Archive
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"
                        onClick={() => restoreRow(row.id)}
                      >
                        <RotateCcw className="h-3 w-3" />
                        Restore
                      </button>
                    )}
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded bg-rose-600 px-2 py-1 text-xs font-semibold text-white"
                      onClick={() => deleteRow(row.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (canManage ? 1 : 0)} className="px-4 py-8 text-center text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
