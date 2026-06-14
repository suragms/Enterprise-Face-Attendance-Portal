import React, { useMemo, useState } from "react"
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import {
  LayoutDashboard,
  FileBarChart2,
  LogOut,
  Fingerprint,
  TrendingUp,
  FileText,
  Menu,
  X,
  ScanFace,
  ClipboardList,
  Calendar,
  CalendarCheck,
  Bell,
  Users,
} from "lucide-react"

export const StaffLayout: React.FC = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems = useMemo(
    () => [
      { name: "Dashboard", path: "/faculty/dashboard", icon: LayoutDashboard },
      { name: "Students", path: "/faculty/students", icon: Users },
      { name: "Take Attendance", path: "/faculty/attendance", icon: CalendarCheck },
      { name: "Face Recognition", path: "/faculty/face-recognition", icon: ScanFace },
      { name: "Face Scan Capture", path: "/faculty/capture", icon: Fingerprint },
      { name: "Timetable", path: "/faculty/timetable", icon: ClipboardList },
      { name: "Upload Materials", path: "/faculty/materials", icon: FileText },
      { name: "Exam Timetable", path: "/faculty/exams", icon: Calendar },
      { name: "Notifications", path: "/faculty/notifications", icon: Bell },
      { name: "Reports", path: "/faculty/reports", icon: FileBarChart2 },
      { name: "Analytics", path: "/faculty/analytics", icon: TrendingUp },
    ],
    []
  )

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 border-r border-slate-200 bg-white flex flex-col hidden md:flex">
        <div className="h-16 px-6 border-b border-slate-100 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold">F</div>
          <div>
            <h1 className="text-base font-bold text-slate-800 leading-none">HexaAttender</h1>
            <span className="text-[10px] text-emerald-600 font-semibold tracking-wider uppercase">Faculty Portal</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700 border-l-4 border-emerald-600 pl-2"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-emerald-700" : "text-slate-400"}`} />
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-700">
                F
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-slate-700 truncate">{user?.fullName}</p>
                <p className="text-[10px] text-slate-400 truncate">Faculty • {user?.scode || "Staff"}</p>
              </div>
            </div>
            <button type="button" onClick={handleLogout} className="p-1 hover:bg-slate-200 text-slate-400 rounded transition-all" aria-label="Log out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 bg-slate-900/40 z-30 md:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div className="w-64 h-full bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <nav className="space-y-1">
              {navItems.map((item) => (
                <Link key={item.name} to={item.path} onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-sm">
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      ) : null}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-slate-200 bg-white/75 backdrop-blur-md px-4 md:px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 md:hidden">
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <CalendarCheck className="w-3.5 h-3.5" />
              <span>FACULTY PORTAL</span>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold rounded-full">
            Faculty Session
          </span>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
