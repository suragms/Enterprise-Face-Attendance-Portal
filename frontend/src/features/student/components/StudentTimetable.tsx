import React, { useEffect, useMemo, useState } from "react"
import { Calendar, Download } from "lucide-react"
import { API_BASE, apiFetch } from "../../../lib/api"
import { StudentPageHeader } from "./StudentPageHeader"

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const
const DAY_LABELS: Record<string, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
}

interface TimetableEntry {
  id: string
  day: string
  period: number
  starts_at: string
  ends_at: string
  subject_code: string
  subject_name: string
  faculty_name: string
  room: string
}

export const StudentTimetable: React.FC = () => {
  const [entries, setEntries] = useState<TimetableEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    apiFetch<TimetableEntry[] | { results: TimetableEntry[] }>("/timetable/?is_active=true")
      .then((data) => {
        const rows = Array.isArray(data) ? data : data.results ?? []
        setEntries(rows)
        setError("")
      })
      .catch((err: any) => setError(err.message || "Failed to load timetable."))
      .finally(() => setLoading(false))
  }, [])

  const periods = useMemo(() => {
    const set = new Set(entries.map((e) => e.period))
    return Array.from(set).sort((a, b) => a - b)
  }, [entries])

  const grid = useMemo(() => {
    const map: Record<string, Record<number, TimetableEntry>> = {}
    for (const entry of entries) {
      if (!map[entry.day]) map[entry.day] = {}
      map[entry.day][entry.period] = entry
    }
    return map
  }, [entries])

  const activeDays = DAYS.filter((day) => entries.some((e) => e.day === day))

  return (
    <div className="space-y-6">
      <StudentPageHeader title="Timetable" description="Your weekly class schedule">
        <a
          href={`${API_BASE}/timetable/export-pdf/`}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
        >
          <Download className="h-3.5 w-3.5" />
          PDF
        </a>
      </StudentPageHeader>

      {loading ? <p className="text-sm text-slate-500">Loading timetable...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {!loading && entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
          <Calendar className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          No timetable entries for your semester yet.
        </div>
      ) : null}

      {entries.length > 0 ? (
        <>
          <div className="hidden lg:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-3 py-3 text-left font-bold text-slate-500">Period</th>
                  {activeDays.map((day) => (
                    <th key={day} className="px-3 py-3 text-left font-bold text-slate-600">
                      {DAY_LABELS[day]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => (
                  <tr key={period} className="border-t border-slate-50">
                    <td className="px-3 py-3 font-semibold text-slate-500">P{period}</td>
                    {activeDays.map((day) => {
                      const cell = grid[day]?.[period]
                      return (
                        <td key={day} className="px-3 py-3 align-top">
                          {cell ? (
                            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-2">
                              <p className="font-bold text-slate-800">{cell.subject_code}</p>
                              <p className="text-[10px] text-slate-600 truncate">{cell.subject_name}</p>
                              <p className="text-[10px] text-slate-500 mt-1">
                                {cell.starts_at?.slice(0, 5)}–{cell.ends_at?.slice(0, 5)}
                              </p>
                              {cell.room ? <p className="text-[10px] text-emerald-700">Room {cell.room}</p> : null}
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden space-y-4">
            {activeDays.map((day) => (
              <div key={day} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h4 className="mb-3 text-sm font-bold text-slate-800">{DAY_LABELS[day]}</h4>
                <div className="space-y-2">
                  {periods
                    .filter((p) => grid[day]?.[p])
                    .map((period) => {
                      const cell = grid[day][period]
                      return (
                        <div key={period} className="flex gap-3 rounded-lg border border-slate-100 p-3">
                          <span className="text-[10px] font-bold text-slate-400 w-8">P{period}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-800">{cell.subject_code}</p>
                            <p className="text-[10px] text-slate-600">{cell.subject_name}</p>
                            <p className="text-[10px] text-slate-500">
                              {cell.starts_at?.slice(0, 5)}–{cell.ends_at?.slice(0, 5)}
                              {cell.room ? ` • ${cell.room}` : ""}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
