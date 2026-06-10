import React, { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  Building2,
  GraduationCap,
  UserCheck,
  Users,
  Percent,
  ScanFace,
  Building,
  GitBranch,
  BookOpen,
  CalendarDays,
} from "lucide-react"
import { apiFetch } from "../../../lib/api"

interface SummaryResponse {
  total_departments: number
  total_hod: number
  total_faculty: number
  total_students: number
  todays_attendance: number
  attendance_percentage: number
  face_recognition_success_rate: number
}

const quickLinks = [
  { label: "Organizations", path: "/admin/organizations", icon: Building2 },
  { label: "Branches", path: "/admin/branches", icon: GitBranch },
  { label: "Departments", path: "/admin/departments", icon: Building },
  { label: "HOD Management", path: "/admin/hod-management", icon: UserCheck },
  { label: "Faculty", path: "/admin/faculty", icon: Users },
  { label: "Students", path: "/admin/students", icon: GraduationCap },
  { label: "Courses", path: "/admin/courses", icon: BookOpen },
  { label: "Semesters", path: "/admin/semesters", icon: CalendarDays },
]

export const SuperAdminDashboard: React.FC = () => {
  const [summary, setSummary] = useState<SummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const data = await apiFetch<SummaryResponse>("/auth/super-admin/dashboard-summary/")
        setSummary(data)
        setError("")
      } catch (err: any) {
        setError(err.message || "Failed to load dashboard summary.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const cards = [
    { title: "Total Departments", value: summary?.total_departments ?? 0, icon: Building2 },
    { title: "Total HOD", value: summary?.total_hod ?? 0, icon: UserCheck },
    { title: "Total Faculty", value: summary?.total_faculty ?? 0, icon: Users },
    { title: "Total Students", value: summary?.total_students ?? 0, icon: GraduationCap },
    { title: "Attendance %", value: `${summary?.attendance_percentage ?? 0}%`, icon: Percent },
    { title: "Face Recognition Success", value: `${summary?.face_recognition_success_rate ?? 0}%`, icon: ScanFace },
  ]

  if (loading) return <div className="text-sm text-slate-500">Loading super admin dashboard...</div>
  if (error) return <div className="text-sm text-rose-600">{error}</div>

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Super Admin Portal</h2>
        <p className="text-sm text-slate-500">Platform-wide operations, governance, and analytics overview.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{card.title}</span>
                <Icon className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="text-3xl font-black text-slate-900">{card.value}</div>
              {card.title === "Attendance %" ? (
                <p className="mt-2 text-xs text-slate-500">Present/Late/Excused today: {summary?.todays_attendance ?? 0}</p>
              ) : null}
            </div>
          )
        })}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Quick Navigation</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.path}
                to={link.path}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700"
              >
                <Icon className="h-4 w-4 text-emerald-600" />
                {link.label}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
