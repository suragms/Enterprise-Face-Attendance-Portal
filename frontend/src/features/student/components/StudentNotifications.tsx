import React, { useEffect, useState } from "react"
import { Bell, Mail } from "lucide-react"
import { apiFetch } from "../../../lib/api"
import { StudentPageHeader } from "./StudentPageHeader"

interface NotificationItem {
  id: string
  trigger_type: string
  channel: string
  status: string
  subject: string
  message_body: string
  created_at: string
  read_at?: string | null
}

export const StudentNotifications: React.FC = () => {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = () => {
    setLoading(true)
    apiFetch<NotificationItem[] | { results: NotificationItem[] }>("/notifications/logs/")
      .then((data) => {
        setItems(Array.isArray(data) ? data : data.results ?? [])
        setError("")
      })
      .catch((err: any) => setError(err.message || "Failed to load notifications."))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const markRead = async (id: string) => {
    try {
      await apiFetch(`/notifications/logs/${id}/read/`, { method: "PATCH" })
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: "READ", read_at: new Date().toISOString() } : n))
      )
    } catch {
      /* ignore */
    }
  }

  const unread = items.filter((n) => n.status !== "READ").length

  return (
    <div className="space-y-6">
      <StudentPageHeader
        title="Notifications"
        description={unread > 0 ? `${unread} unread alert(s)` : "All caught up"}
      />

      {loading ? <p className="text-sm text-slate-500">Loading notifications...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="space-y-3">
        {items.map((item) => {
          const isUnread = item.status !== "READ"
          return (
            <div
              key={item.id}
              className={`rounded-xl border p-4 transition-colors ${
                isUnread ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isUnread ? "bg-emerald-100" : "bg-slate-100"}`}>
                  {item.channel === "EMAIL" ? (
                    <Mail className="h-4 w-4 text-slate-600" />
                  ) : (
                    <Bell className="h-4 w-4 text-slate-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      {item.subject || item.trigger_type.replace(/_/g, " ")}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      {item.channel}
                    </span>
                    {isUnread ? (
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        New
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-600 whitespace-pre-wrap">{item.message_body}</p>
                  <p className="mt-2 text-[10px] text-slate-400">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                  {isUnread ? (
                    <button
                      type="button"
                      onClick={() => markRead(item.id)}
                      className="mt-2 text-[11px] font-semibold text-emerald-700 hover:underline"
                    >
                      Mark as read
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {!loading && items.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-8">No notifications yet.</p>
      ) : null}
    </div>
  )
}
