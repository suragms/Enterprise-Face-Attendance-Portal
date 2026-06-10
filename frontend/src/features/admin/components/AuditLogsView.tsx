import React, { useEffect, useState } from "react"
import { apiFetch } from "../../../lib/api"

interface AuditLog {
  id: string
  action: string
  entity_type: string
  created_at: string
  ip_address?: string
  user_agent?: string
  actor_name?: string
}

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const data = await apiFetch<any>("/audit-logs/?page_size=100")
        setLogs(data.results || data || [])
        setError("")
      } catch (err: any) {
        setError(err.message || "Failed to load audit logs.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900">Audit Logs</h2>
      {loading ? <div className="text-sm text-slate-500">Loading audit logs...</div> : null}
      {error ? <div className="text-sm text-rose-600">{error}</div> : null}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left">Timestamp</th>
              <th className="px-4 py-3 text-left">Action</th>
              <th className="px-4 py-3 text-left">Entity</th>
              <th className="px-4 py-3 text-left">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t">
                <td className="px-4 py-3">{new Date(log.created_at).toLocaleString()}</td>
                <td className="px-4 py-3">{log.action}</td>
                <td className="px-4 py-3">{log.entity_type || "-"}</td>
                <td className="px-4 py-3">{log.ip_address || "-"}</td>
              </tr>
            ))}
            {!loading && logs.length === 0 ? (
              <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={4}>No audit entries.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
