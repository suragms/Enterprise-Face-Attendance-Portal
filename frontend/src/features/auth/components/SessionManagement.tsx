import React, { useEffect, useState } from "react"
import { Monitor, ShieldOff } from "lucide-react"
import { apiFetch } from "../../../lib/api"

interface SessionItem {
  session_key: string
  ip_address: string
  device_fingerprint: string
  login_method: string
  is_current: boolean
  last_seen_at: string
  created_at: string
}

export const SessionManagement: React.FC = () => {
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiFetch<{ results: SessionItem[] }>("/auth/sessions/")
      setSessions(data.results || [])
      setError("")
    } catch (err: any) {
      setError(err.message || "Failed to load active sessions.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const revokeSession = async (sessionKey: string) => {
    await apiFetch(`/auth/sessions/${sessionKey}/revoke/`, { method: "POST" })
    await load()
  }

  const revokeAll = async () => {
    await apiFetch("/auth/sessions/revoke-all/", { method: "POST", body: {} })
    await load()
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Active Sessions</h3>
          <p className="text-xs text-slate-400">Devices and browsers currently signed in to your account.</p>
        </div>
        <button
          type="button"
          onClick={revokeAll}
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
        >
          Revoke Others
        </button>
      </div>

      {loading ? <p className="text-sm text-slate-500">Loading sessions...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="space-y-3">
        {sessions.map((session) => (
          <div key={session.session_key} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 p-4">
            <div className="flex gap-3">
              <div className="rounded-lg bg-slate-100 p-2">
                <Monitor className="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  {session.device_fingerprint || "Unknown device"}
                  {session.is_current ? " (Current)" : ""}
                </p>
                <p className="text-[11px] text-slate-500">IP: {session.ip_address || "Unknown"}</p>
                <p className="text-[11px] text-slate-500">Method: {session.login_method}</p>
                <p className="text-[11px] text-slate-400">Last seen: {new Date(session.last_seen_at).toLocaleString()}</p>
              </div>
            </div>
            {!session.is_current ? (
              <button
                type="button"
                onClick={() => revokeSession(session.session_key)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700"
              >
                <ShieldOff className="h-3.5 w-3.5" />
                Revoke
              </button>
            ) : null}
          </div>
        ))}
        {!loading && sessions.length === 0 ? (
          <p className="text-sm text-slate-500">No active sessions found.</p>
        ) : null}
      </div>
    </div>
  )
}
