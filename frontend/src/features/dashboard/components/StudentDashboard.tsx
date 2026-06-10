import React from "react"
import {
  Award,
  Bell,
  BookOpen,
  Calendar,
  CalendarDays,
  CheckCircle2,
  FileText,
  GraduationCap,
  LayoutDashboard,
  User,
  XCircle,
} from "lucide-react"
import { Link } from "react-router-dom"
import { useAuth } from "../../../context/AuthContext"
import { useStudentReport } from "../../../hooks/useStudentReport"
import { useStudentContext } from "../../../hooks/useStudentContext"
import { AttendanceProgressBar } from "../../student/components/AttendanceProgressBar"
import { DefaulterAlert } from "../../student/components/DefaulterAlert"

const quickLinks = [
  { label: "Attendance", path: "/student/attendance", icon: Award },
  { label: "Timetable", path: "/student/timetable", icon: Calendar },
  { label: "Learning Hub", path: "/student/learning", icon: BookOpen },
  { label: "Exams", path: "/student/exams", icon: FileText },
  { label: "Notifications", path: "/student/notifications", icon: Bell },
  { label: "Profile", path: "/student/profile", icon: User },
]

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth()
  const { department, rollNo } = useStudentContext(user?.role)
  const { summary, subjects, overallPct, loading, error, promotionStatus, isDefaulter, report } = useStudentReport(
    !user?.enrollmentOverdue
  )

  if (user?.enrollmentOverdue) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          Face enrollment is overdue. Go to{" "}
          <Link to="/student/profile" className="font-bold underline">
            Profile
          </Link>{" "}
          to complete 5-pose enrollment.
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        <p className="text-sm text-slate-500">Loading dashboard...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">
        {error}
      </div>
    )
  }

  const cards = [
    { label: "Attendance %", value: `${overallPct}%`, icon: Award },
    { label: "Today", value: summary?.today_status ?? "—", icon: CalendarDays },
    { label: "Present", value: String(report?.summary?.total_present ?? 0), icon: CheckCircle2 },
    { label: "At-risk subjects", value: String(summary?.at_risk_subject_count ?? 0), icon: XCircle },
  ]

  const topSubjects = [...subjects].sort((a, b) => a.percentage - b.percentage).slice(0, 4)

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">Student Portal</p>
            <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">
              Welcome, {summary?.name?.split(" ")[0] || user?.fullName?.split(" ")[0] || "Student"}
            </h1>
            <p className="mt-2 text-sm text-emerald-100">
              {department?.name || summary?.department} • Roll {rollNo || summary?.roll_no}
              {summary?.semester != null ? ` • Semester ${summary.semester}` : ""}
            </p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <GraduationCap className="h-8 w-8" />
          </div>
        </div>
      </div>

      <DefaulterAlert
        overallPercentage={overallPct}
        promotionStatus={promotionStatus}
        atRiskSubjects={subjects}
        compact
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-emerald-600" />
          <h2 className="text-sm font-bold text-slate-800">Overall attendance</h2>
        </div>
        <AttendanceProgressBar
          label="All subjects combined"
          percentage={overallPct}
          subtitle={`Promotion: ${promotionStatus}${isDefaulter ? " • Action required" : ""}`}
          size="lg"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{card.label}</span>
                <Icon className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-xl font-bold text-slate-800 sm:text-2xl">{card.value}</p>
            </div>
          )
        })}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold text-slate-800">Quick access</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {quickLinks.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.path}
                to={link.path}
                className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/50"
              >
                <Icon className="h-5 w-5 text-emerald-600" />
                <span className="text-[11px] font-semibold text-slate-700">{link.label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {topSubjects.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Subject statistics</h3>
            <Link to="/student/attendance" className="text-xs font-semibold text-emerald-700 hover:underline">
              View all
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {topSubjects.map((subject) => (
              <AttendanceProgressBar
                key={subject.code}
                label={`${subject.code}`}
                percentage={subject.percentage}
                subtitle={subject.name}
                size="sm"
              />
            ))}
          </div>
        </div>
      ) : null}

      {(summary?.unread_notifications ?? 0) > 0 ? (
        <Link
          to="/student/notifications"
          className="block rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 hover:bg-amber-100"
        >
          You have {summary?.unread_notifications} unread notification(s).
        </Link>
      ) : null}
    </div>
  )
}
