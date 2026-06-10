import React, { useState } from "react"
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import {
  Award,
  Bell,
  BookOpen,
  Calendar,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  User,
  UserCheck,
  X,
} from "lucide-react"

export const StudentLayout: React.FC = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems = user?.enrollmentOverdue
    ? [{ name: "Profile", path: "/student/profile", icon: User }]
    : [
        { name: "Dashboard", path: "/student/dashboard", icon: LayoutDashboard },
        { name: "Learning Hub", path: "/student/learning", icon: BookOpen },
        { name: "Attendance", path: "/student/attendance", icon: Award },
        { name: "Timetable", path: "/student/timetable", icon: Calendar },
        { name: "Materials", path: "/student/materials", icon: BookOpen },
        { name: "Exam Timetable", path: "/student/exams", icon: FileText },
        { name: "Notifications", path: "/student/notifications", icon: Bell },
        { name: "Profile", path: "/student/profile", icon: User },
      ]

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive =
          location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isActive
                ? "bg-emerald-50 text-emerald-700 border-l-4 border-emerald-600 pl-2"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-emerald-700" : "text-slate-400"}`} />
            {item.name}
          </Link>
        )
      })}
    </>
  )

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="hidden md:flex w-64 border-r border-slate-200 bg-white flex-col shrink-0">
        <div className="h-16 px-6 border-b border-slate-100 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold">
            S
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800 leading-none">HexaAttender</h1>
            <span className="text-[10px] text-emerald-600 font-semibold tracking-wider uppercase">Student Portal</span>
          </div>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <NavLinks />
        </nav>
        <div className="p-4 border-t border-slate-100">
          {(user?.role === "PLATFORM_SUPER_ADMIN" ||
            user?.role === "ORGANIZATION_ADMIN" ||
            user?.role === "BRANCH_ADMIN") && (
            <button
              onClick={() => navigate("/admin")}
              className="mb-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Admin view
            </button>
          )}
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-800">
                {user?.fullName?.charAt(0) || "S"}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-slate-700 truncate">{user?.fullName}</p>
                <p className="text-[10px] text-slate-400 truncate">Roll: {user?.rollNo || "—"}</p>
              </div>
            </div>
            <button
              onClick={() => {
                logout()
                navigate("/login")
              }}
              className="p-1 hover:bg-slate-200 text-slate-400 rounded shrink-0"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative w-[min(100%,280px)] h-full bg-white border-r border-slate-200 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <span className="font-bold text-slate-800">Menu</span>
              <button type="button" onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              <NavLinks onNavigate={() => setMobileMenuOpen(false)} />
            </nav>
          </aside>
        </div>
      ) : null}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 sm:h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="md:hidden p-2 rounded-lg hover:bg-slate-100"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>STUDENT PORTAL</span>
            </div>
          </div>
          <span className="text-[10px] sm:text-xs px-2.5 py-1 bg-emerald-100 text-emerald-800 font-medium rounded-full">
            Active
          </span>
        </header>

        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
