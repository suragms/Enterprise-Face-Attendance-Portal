import React, { useEffect, useState } from "react"
import {
  Users,
  Fingerprint,
  CalendarCheck,
  FileText,
  FileBarChart2,
  TrendingUp,
  ScanFace,
  ClipboardList,
  UserPlus,
} from "lucide-react"
import { Link } from "react-router-dom"
import { apiFetch } from "../../../lib/api"
import { useAuth } from "../../../context/AuthContext"
import { useFacultyContext } from "../../../hooks/useFacultyContext"
import { FacultyScopeBanner } from "../../staff/components/FacultyScopeBanner"

interface FacultySummary {
  department: string
  staff_code: string | null
  assigned_subjects: number
  registered_students: number
  face_enrolled_students: number
  attendance_percentage: number
  pending_materials: number
}

const quickLinks = [
  { label: "Register Students", path: "/faculty/students", icon: UserPlus },
  { label: "Take Attendance", path: "/faculty/attendance", icon: CalendarCheck },
  { label: "Face Recognition", path: "/faculty/face-recognition", icon: ScanFace },
  { label: "Manual Attendance", path: "/faculty/manual-attendance", icon: ClipboardList },
  { label: "Upload Materials", path: "/faculty/materials", icon: FileText },
  { label: "View Reports", path: "/faculty/reports", icon: FileBarChart2 },
  { label: "View Analytics", path: "/faculty/analytics", icon: TrendingUp },
]

export const FacultyDashboard: React.FC = () => {
  const { user } = useAuth()
  const { department, loading: contextLoading } = useFacultyContext(user?.role)
  const [summary, setSummary] = useState<FacultySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const data = await apiFetch<FacultySummary>("/auth/faculty/dashboard-summary/")
        setSummary(data)
        setError("")
      } catch (err: any) {
        setError(err.message || "Failed to load faculty dashboard.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const cards = [
    { title: "Registered Students", value: summary?.registered_students ?? 0, icon: Users },
    { title: "Face Enrolled", value: summary?.face_enrolled_students ?? 0, icon: Fingerprint },
    { title: "Today's Attendance", value: `${summary?.attendance_percentage ?? 0}%`, icon: CalendarCheck },
    { title: "Assigned Subjects", value: summary?.assigned_subjects ?? 0, icon: FileText },
  ]

  if (loading || contextLoading) return <div className="text-sm text-slate-500">Loading faculty dashboard...</div>
  if (error) return <div className="text-sm text-rose-600">{error}</div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Faculty Portal</h2>
        <p className="text-sm text-slate-500">
          {department?.name || summary?.department || "Department"} — class operations for assigned subjects only
        </p>
      </div>

      <FacultyScopeBanner />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{card.title}</span>
                <Icon className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="text-3xl font-black text-slate-900">{card.value}</div>
              {card.title === "Today's Attendance" && summary?.pending_materials ? (
                <p className="mt-2 text-xs text-slate-500">{summary.pending_materials} material(s) pending approval</p>
              ) : null}
            </div>
          )
        })}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Faculty Operations</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.path}
                to={link.path}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700"
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
