import React, { useMemo, useState, useEffect } from "react"
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { isSuperAdminRole } from "../lib/roles"
import { apiFetch } from "../lib/api"
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  BookOpen, 
  CalendarDays, 
  CheckSquare, 
  FileBarChart2, 
  LogOut,
  UserCheck,
  Building,
  Fingerprint,
  TrendingUp,
  Bell,
  FileSearch,
  FileText,
  Menu,
  X,
  ClipboardList,
  Building2,
  GitBranch,
  Cpu,
} from "lucide-react"

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isSuperAdmin = isSuperAdminRole(user?.role)

  const [organizations, setOrganizations] = useState<any[]>([])
  useEffect(() => {
    if (isSuperAdmin) {
      apiFetch("/organizations/?page_size=200")
        .then(data => {
          setOrganizations(data.results || data || [])
        })
        .catch(err => console.error("Failed to load organizations for switcher:", err))
    }
  }, [isSuperAdmin])

  const navItems = useMemo(() => {
    if (isSuperAdmin) {
      return [
        { name: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
        { name: "Organizations", path: "/admin/organizations", icon: Building2 },
        { name: "Branches", path: "/admin/branches", icon: GitBranch },
        { name: "Departments", path: "/admin/departments", icon: Building },
        { name: "HOD Management", path: "/admin/hod-management", icon: UserCheck },
        { name: "Faculty Management", path: "/admin/faculty", icon: Users },
        { name: "Student Management", path: "/admin/students", icon: GraduationCap },
        { name: "Subjects", path: "/admin/subjects", icon: BookOpen },
        { name: "Courses", path: "/admin/courses", icon: BookOpen },
        { name: "Semesters", path: "/admin/semesters", icon: CalendarDays },
        { name: "Timetable", path: "/admin/timetable", icon: CalendarDays },
        { name: "Attendance", path: "/admin/attendance", icon: CheckSquare },
        { name: "Reports", path: "/admin/reports", icon: FileBarChart2 },
        { name: "Analytics", path: "/admin/analytics", icon: TrendingUp },
        { name: "Notifications", path: "/admin/notifications", icon: Bell },
        { name: "Audit Logs", path: "/admin/audit-logs", icon: FileSearch },
        { name: "Face Recognition", path: "/admin/face-recognition", icon: Fingerprint },
        { name: "Device Sync Simulator", path: "/admin/device-sync", icon: Cpu },
      ]
    }

    return [
      { name: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
      { name: "Faculty Management", path: "/admin/faculty", icon: Users },
      { name: "Student Management", path: "/admin/students", icon: GraduationCap },
      { name: "Subjects", path: "/admin/subjects", icon: BookOpen },
      { name: "Courses", path: "/admin/courses", icon: BookOpen },
      { name: "Timetable", path: "/admin/timetable", icon: CalendarDays },
      { name: "Materials Approval", path: "/admin/materials", icon: FileText },
      { name: "Exam Timetable", path: "/admin/exams", icon: ClipboardList },
      { name: "Attendance", path: "/admin/attendance", icon: CheckSquare },
      { name: "Reports", path: "/admin/reports", icon: FileBarChart2 },
      { name: "Analytics", path: "/admin/analytics", icon: TrendingUp },
      { name: "Notifications", path: "/admin/notifications", icon: Bell },
      { name: "Device Sync Simulator", path: "/admin/device-sync", icon: Cpu },
    ]
  }, [isSuperAdmin])

  const portalTitle = isSuperAdmin ? "Super Admin Portal" : "HOD Portal"
  const sessionLabel = isSuperAdmin ? "Super Admin Session" : "HOD Department Session"
  const roleLabel = isSuperAdmin ? "Super Admin" : "Head of Department"

  const handleRoleToggle = () => {
    navigate("/faculty/dashboard")
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200 bg-white flex flex-col hidden md:flex">
        {/* Logo Branding */}
        <div className="h-16 px-6 border-b border-slate-100 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold">
            H
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800 leading-none">HexaAttender</h1>
            <span className="text-[10px] text-emerald-600 font-semibold tracking-wider uppercase">v2 Enterprise</span>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-4 py-6 space-y-1">
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

        {/* Footer profile area */}
        <div className="p-4 border-t border-slate-100 space-y-3">
          <button 
            onClick={handleRoleToggle}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Switch to Staff View
          </button>
          
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-700">
                AD
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-slate-700 truncate">{user?.fullName}</p>
                <p className="text-[10px] text-slate-400 truncate">{roleLabel}</p>
              </div>
            </div>
            <button 
              type="button"
              onClick={() => { logout(); navigate("/login"); }}
              className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded transition-all"
              aria-label="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 md:hidden animate-in fade-in duration-200" 
          onClick={() => setMobileMenuOpen(false)}
        >
          <div 
            className="w-64 h-full bg-white border-r border-slate-200 flex flex-col p-4 space-y-4 animate-in slide-in-from-left duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Logo Branding */}
            <div className="h-12 border-b border-slate-100 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold">H</div>
              <div>
                <h1 className="text-sm font-bold text-slate-800 leading-none">HexaAttender</h1>
                <span className="text-[9px] text-emerald-600 font-semibold tracking-wider uppercase">v2 Enterprise</span>
              </div>
            </div>

            {/* Navigation links */}
            <nav className="flex-1 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive 
                        ? "bg-emerald-50 text-emerald-700 font-bold border-l-4 border-emerald-600 pl-2"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-emerald-700" : "text-slate-400"}`} />
                    {item.name}
                  </Link>
                )
              })}
            </nav>

            {/* Switch & Profile */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <button 
                onClick={() => { setMobileMenuOpen(false); handleRoleToggle(); }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
              >
                <UserCheck className="w-3.5 h-3.5" />
                Switch to Staff View
              </button>
              
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 flex-shrink-0">
                    AD
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[11px] font-semibold text-slate-700 truncate">{user?.fullName}</p>
                    <p className="text-[9px] text-slate-500 truncate">{roleLabel}</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => { setMobileMenuOpen(false); logout(); navigate("/login"); }}
                  className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded transition-all"
                  aria-label="Log out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header navbar */}
        <header className="h-16 border-b border-slate-200 bg-white/75 backdrop-blur-md px-4 md:px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 md:hidden transition-all active:scale-95"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2 text-slate-550 font-bold text-sm md:hidden">
              <div className="w-7 h-7 rounded bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">H</div>
              <span>HexaAttender</span>
            </div>
            <div className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <Building className="w-3.5 h-3.5" />
              <span>{portalTitle.toUpperCase()}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {isSuperAdmin && organizations.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Tenant:</span>
                <select
                  value={user?.activeOrganization || ""}
                  onChange={async (e) => {
                    const orgId = e.target.value
                    if (!orgId) return
                    try {
                      await apiFetch("/auth/switch-organization/", {
                        method: "POST",
                        body: { organization_id: orgId }
                      })
                      window.location.reload()
                    } catch (err) {
                      console.error("Failed to switch organization:", err)
                    }
                  }}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="" disabled>-- Select Organization --</option>
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>
            )}
            <span className="text-xs px-2.5 py-1 bg-emerald-50 border border-emerald-250 text-emerald-700 font-bold rounded-full">
              {sessionLabel}
            </span>
          </div>
        </header>

        {/* View content container */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
