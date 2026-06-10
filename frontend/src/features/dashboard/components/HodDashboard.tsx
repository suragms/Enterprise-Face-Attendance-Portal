import React, { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  Users,
  GraduationCap,
  CalendarCheck2,
  ChartPie,
  UserX,
  UserCheck,
  BookOpen,
  CalendarDays,
  FileText,
  ClipboardList,
  FileBarChart2,
  Bell,
  TrendingUp,
} from "lucide-react"
import { apiFetch } from "../../../lib/api"
import { useAuth } from "../../../context/AuthContext"
import { useHodContext } from "../../../hooks/useHodContext"

interface HodSummary {
  department: string
  department_id?: string | null
  department_code?: string | null
  faculty_count: number
  student_count: number
  attendance_percentage: number
  todays_attendance: number
}

interface FacultyRow {
  staff_code: string
  name: string
  email: string
  is_active: boolean
}

interface StudentRow {
  roll_no: string
  name: string
  department: string
  semester: number
}

const quickLinks = [
  { label: "Create Faculty", path: "/admin/faculty", icon: Users },
  { label: "Manage Students", path: "/admin/students", icon: GraduationCap },
  { label: "Manage Subjects", path: "/admin/subjects", icon: BookOpen },
  { label: "Manage Timetable", path: "/admin/timetable", icon: CalendarDays },
  { label: "Manage Courses", path: "/admin/courses", icon: BookOpen },
  { label: "Manage Materials", path: "/admin/materials", icon: FileText },
  { label: "Manage Exams", path: "/admin/exams", icon: ClipboardList },
  { label: "View Reports", path: "/admin/reports", icon: FileBarChart2 },
  { label: "View Analytics", path: "/admin/analytics", icon: TrendingUp },
  { label: "Manage Notifications", path: "/admin/notifications", icon: Bell },
]

export const HodDashboard: React.FC = () => {
  const { user } = useAuth()
  const { department, loading: contextLoading } = useHodContext(user?.role)
  const [summary, setSummary] = useState<HodSummary | null>(null)
  const [faculty, setFaculty] = useState<FacultyRow[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = async () => {
    setLoading(true)
    try {
      const [summaryData, facultyData, studentData] = await Promise.all([
        apiFetch<HodSummary>("/auth/hod/dashboard-summary/"),
        apiFetch<any>("/staff/?page_size=50"),
        apiFetch<any>("/students/?page_size=50"),
      ])
      setSummary(summaryData)
      setFaculty((facultyData.results || facultyData || []).map((f: any) => ({
        staff_code: f.staff_code,
        name: f.name,
        email: f.email || f.user_details?.email || "",
        is_active: !!f.is_active,
      })))
      setStudents((studentData.results || studentData || []).map((s: any) => ({
        roll_no: s.roll_no,
        name: s.name,
        department: s.department_name || s.department,
        semester: s.semester_number || s.semester,
      })))
      setError("")
    } catch (err: any) {
      setError(err.message || "Failed to load HOD dashboard.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const toggleFaculty = async (row: FacultyRow) => {
    const endpoint = row.is_active ? "disable" : "reactivate"
    await apiFetch(`/staff/${row.staff_code}/${endpoint}/`, { method: "POST" })
    load()
  }

  const cards = [
    { title: "Faculty Count", value: summary?.faculty_count ?? 0, icon: Users },
    { title: "Student Count", value: summary?.student_count ?? 0, icon: GraduationCap },
    { title: "Attendance %", value: `${summary?.attendance_percentage ?? 0}%`, icon: ChartPie },
    { title: "Today's Attendance", value: summary?.todays_attendance ?? 0, icon: CalendarCheck2 },
  ]

  if (loading || contextLoading) return <div className="text-sm text-slate-500">Loading HOD dashboard...</div>
  if (error) return <div className="text-sm text-rose-600">{error}</div>

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-slate-900">HOD Portal</h2>
        <p className="text-sm text-slate-500">
          {department?.name || summary?.department || "Department"} — department-scoped operations only
        </p>
      </div>

      {!department ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Your HOD account is not linked to a department. Contact the Super Admin to assign one before managing records.
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Scoped to <span className="font-semibold">{department.name}</span> ({department.code}). You cannot access other departments or create HOD accounts.
        </div>
      )}

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
            </div>
          )
        })}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Department Operations</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Faculty Management</h3>
            <Link className="text-xs font-semibold text-emerald-600" to="/admin/faculty">Create Faculty</Link>
          </div>
          <div className="space-y-2">
            {faculty.slice(0, 8).map((row) => (
              <div key={row.staff_code} className="flex items-center justify-between rounded-lg border border-slate-100 p-2.5">
                <div>
                  <div className="text-sm font-semibold text-slate-800">{row.name}</div>
                  <div className="text-xs text-slate-500">{row.email || row.staff_code}</div>
                </div>
                <button
                  onClick={() => toggleFaculty(row)}
                  className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold ${row.is_active ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"}`}
                >
                  {row.is_active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                  {row.is_active ? "Disable" : "Enable"}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Department Students</h3>
            <Link className="text-xs font-semibold text-emerald-600" to="/admin/students">Manage Students</Link>
          </div>
          <div className="space-y-2">
            {students.slice(0, 8).map((row) => (
              <div key={row.roll_no} className="rounded-lg border border-slate-100 p-2.5">
                <div className="text-sm font-semibold text-slate-800">{row.name}</div>
                <div className="text-xs text-slate-500">{row.roll_no} • Sem {row.semester}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
