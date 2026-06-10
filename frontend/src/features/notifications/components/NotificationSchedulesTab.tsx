import React, { useEffect, useState } from "react"
import { CalendarClock, Loader2, Pause, Play } from "lucide-react"
import { CHANNEL_OPTIONS, RECIPIENT_SCOPES, REPEAT_OPTIONS, TRIGGER_OPTIONS } from "../constants"
import { fetchSchedules, pauseSchedule, runScheduleNow, saveSchedule } from "../api"
import type { NotificationChannel, NotificationSchedule, TriggerType } from "../types"

export const NotificationSchedulesTab: React.FC = () => {
  const [schedules, setSchedules] = useState<NotificationSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState("Weekly low attendance digest")
  const [triggerType, setTriggerType] = useState<TriggerType>("LOW_ATTENDANCE")
  const [channels, setChannels] = useState<NotificationChannel[]>(["EMAIL", "IN_APP"])
  const [recipientScope, setRecipientScope] = useState("LOW_ATTENDANCE")
  const [recipient, setRecipient] = useState("")
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() + 30)
    return d.toISOString().slice(0, 16)
  })
  const [repeatInterval, setRepeatInterval] = useState("WEEKLY")

  const load = async () => {
    setLoading(true)
    try {
      setSchedules(await fetchSchedules())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const toggleChannel = (ch: NotificationChannel) => {
    setChannels((prev) => (prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]))
  }

  const handleCreate = async () => {
    if (!channels.length) {
      alert("Select at least one channel.")
      return
    }
    setSaving(true)
    try {
      await saveSchedule({
        title,
        trigger_type: triggerType,
        channels,
        recipient_scope: recipientScope,
        recipient: recipientScope === "CUSTOM" ? recipient : "",
        scheduled_at: new Date(scheduledAt).toISOString(),
        repeat_interval: repeatInterval,
        is_active: true,
        parameters: recipientScope === "LOW_ATTENDANCE" ? { threshold: 75 } : {},
      })
      await load()
      alert("Schedule created.")
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to save schedule.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-emerald-600" />
            New Schedule
          </h4>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Schedule title"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as TriggerType)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
            >
              {TRIGGER_OPTIONS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              value={repeatInterval}
              onChange={(e) => setRepeatInterval(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
            >
              {REPEAT_OPTIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <select
            value={recipientScope}
            onChange={(e) => setRecipientScope(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
          >
            {RECIPIENT_SCOPES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          {recipientScope === "CUSTOM" && (
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Email or phone"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          )}
          <div className="flex flex-wrap gap-2">
            {CHANNEL_OPTIONS.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => toggleChannel(ch.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                  channels.includes(ch.id)
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-slate-500 border-slate-200"
                }`}
              >
                {ch.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            className="w-full py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
          >
            {saving ? "Saving..." : "Create Schedule"}
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2 bg-slate-50 border-b text-[10px] font-bold uppercase text-slate-500">
            Active Schedules
          </div>
          {loading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            </div>
          ) : schedules.length === 0 ? (
            <p className="p-6 text-center text-xs text-slate-400">No schedules yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {schedules.map((s) => (
                <li key={s.id} className="px-4 py-3 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="font-bold text-slate-800">{s.title}</span>
                    <span
                      className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        s.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {s.is_active ? "Active" : "Paused"}
                    </span>
                  </div>
                  <p className="text-slate-500 mt-1">
                    {s.trigger_type} · {s.channels.join(", ")} · {s.repeat_interval}
                  </p>
                  {s.next_run_at && (
                    <p className="text-slate-400 mt-0.5">Next: {new Date(s.next_run_at).toLocaleString()}</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await runScheduleNow(s.id)
                        load()
                      }}
                      className="flex items-center gap-1 text-emerald-700 font-bold"
                    >
                      <Play className="w-3 h-3" /> Run now
                    </button>
                    {s.is_active && (
                      <button
                        type="button"
                        onClick={async () => {
                          await pauseSchedule(s.id)
                          load()
                        }}
                        className="flex items-center gap-1 text-slate-500 font-bold"
                      >
                        <Pause className="w-3 h-3" /> Pause
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
