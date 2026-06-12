import React, { useState, useEffect, useMemo } from "react"
import { 
  Search, 
  UserPlus, 
  ShieldAlert, 
  Building, 
  AlertCircle, 
  Activity,
  ShieldCheck,
  FileText,
  Lock,
  Unlock
} from "lucide-react"
import { apiFetch } from "../../../lib/api"
import { useAuth } from "../../../context/AuthContext"

// Interface definitions aligning with data abstractions
interface Subject {
  code: string
  name: string
  programme: string
  semester: number
  credits: number // Add credits for workload calculations (e.g. 3 credits)
}

interface ClassCohort {
  programme: string
  semester: number
}

// Attendance session marked by this lecturer
interface FacultyMarkedSession {
  id: string
  date: string
  hour: string
  subjectCode: string
  classCohort: string
  totalStudents: number
  present: number
  absent: number
  status: "LOCKED" | "OPEN"
}

interface Faculty {
  scode: string
  name: string
  fatherName: string // ssname
  dept: string
  role: string // Designation
  salary: number
  email: string
  phone: string
  username: string
  subjects: Subject[]
  assignedClasses: ClassCohort[]
  maxLoadCredits: number // Workload parameter
  markedSessions: FacultyMarkedSession[] // Attendance History parameter
  isActive: boolean
}

export const StaffList: React.FC = () => {
  const { user } = useAuth()
  
  // Roster states
  const [staffList, setStaffList] = useState<Faculty[]>([])
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([])
  const [departments, setDepartments] = useState<{ id: string; name: string; code?: string }[]>([])
  const [departmentLocked, setDepartmentLocked] = useState(false)
  const [canCreateFaculty, setCanCreateFaculty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Role check
  const isAdmin = ["SUPER_ADMIN", "HOD", "PLATFORM_SUPER_ADMIN", "ORGANIZATION_ADMIN", "BRANCH_ADMIN"].includes(user?.role || "")

  // Filters & Toggles View configurations
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDept, setSelectedDept] = useState("All")
  
  // Dashboard view toggle: "list" vs "dashboard"
  const [activeView, setActiveView] = useState<"list" | "dashboard">("list")
  const [selectedFaculty, setSelectedFaculty] = useState<Faculty | null>(null)
  
  // Faculty Dashboard internal sub-tabs ("analytics" | "attendance" | "load" | "profile")
  const [dashboardTab, setDashboardTab] = useState<"analytics" | "attendance" | "load" | "profile">("analytics")

  // Modals state
  const [activeModal, setActiveModal] = useState<"none" | "add" | "delete">("none")

  // Add Form input states
  const [formScode, setFormScode] = useState("")
  const [formName, setFormName] = useState("")
  const [formFatherName, setFormFatherName] = useState("")
  const [formDept, setFormDept] = useState("")
  const [formRole, setFormRole] = useState("Lecturer / Staff")
  const [formSalary, setFormSalary] = useState<number>(60000)
  const [formEmail, setFormEmail] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formUsername, setFormUsername] = useState("")
  const [formPassword, setFormPassword] = useState("")
  
  // Profile Editor Form states
  const [editName, setEditName] = useState("")
  const [editFatherName, setEditFatherName] = useState("")
  const [editDept, setEditDept] = useState("")
  const [editRole, setEditRole] = useState("")
  const [editSalary, setEditSalary] = useState<number>(0)
  const [editPhone, setEditPhone] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editMaxLoad, setEditMaxLoad] = useState<number>(12)

  // Assignments Mapping States
  const [tempSubjects, setTempSubjects] = useState<Subject[]>([])
  const [tempClasses, setTempClasses] = useState<ClassCohort[]>([])

  // Load backend data
  const loadData = async () => {
    setLoading(true)
    try {
      const [staffDataRaw, subjectsDataRaw, registrationContext] = await Promise.all([
        apiFetch<any>("/staff/"),
        apiFetch<any>("/subjects/"),
        apiFetch<any>("/staff/registration-context/").catch(() => null),
      ])
      const staffData = staffDataRaw.results || staffDataRaw || []
      const subjectsData = subjectsDataRaw.results || subjectsDataRaw || []
      
      let sessionsList: any[] = []
      try {
        const sessionsData = await apiFetch<any>("/attendance/sessions/?page_size=100")
        sessionsList = sessionsData.results || sessionsData || []
      } catch (err) {
        console.error("Failed to load attendance sessions", err)
      }
      
      const mappedSubjects: Subject[] = subjectsData.map((s: any) => ({
        code: s.subject_code,
        name: s.name,
        programme: s.course_code ?? s.department_name ?? s.department,
        semester: s.semester_number ?? s.semester,
        credits: s.credits ?? 3
      }))
      
      setAvailableSubjects(mappedSubjects)

      if (registrationContext && registrationContext.departments) {
        setDepartments(registrationContext.departments)
        setDepartmentLocked(Boolean(registrationContext.department_locked))
        setCanCreateFaculty(Boolean(registrationContext.can_create))
        const defaultDept =
          registrationContext.default_department_id || registrationContext.departments[0]?.id || ""
        if (defaultDept) {
          setFormDept(defaultDept)
        }
      } else {
        const deptNameSet = new Set<string>()
        subjectsData.forEach((s: any) => {
          const name = s.department_name || s.department
          if (name) deptNameSet.add(String(name))
        })
        staffData.forEach((f: any) => {
          const name = f.department_name || f.department
          if (name) deptNameSet.add(String(name))
        })
        const mappedDepartments = Array.from(deptNameSet).sort().map((name) => ({ id: name, name }))
        setDepartments(mappedDepartments)
        setDepartmentLocked(false)
        setCanCreateFaculty(isAdmin)
        if (!formDept && mappedDepartments.length > 0) {
          setFormDept(mappedDepartments[0].id)
        }
      }
      
      const mappedStaff: Faculty[] = staffData.map((item: any) => {
        const facultySubs = (item.subjects || []).map((sub: any) => ({
          code: sub.subject_code,
          name: sub.name,
          programme: sub.course_code ?? sub.department_name ?? sub.department,
          semester: sub.semester_number ?? sub.semester,
          credits: sub.credits ?? 3
        }))
        
        const facultyClasses = (item.assigned_classes || []).map((cls: any) => ({
          programme: cls.course_code ?? cls.course_name ?? cls.programme,
          semester: cls.semester_number ?? cls.semester
        }))
        
        const facultySessions: FacultyMarkedSession[] = sessionsList
          .filter((session: any) => facultySubs.some((sub: any) => sub.code === session.subject_code))
          .map((session: any) => {
            const matchingSub = mappedSubjects.find(s => s.code === session.subject_code)
            return {
              id: String(session.id),
              date: session.date,
              hour: session.hour,
              subjectCode: session.subject_code,
              classCohort: matchingSub ? `${matchingSub.programme} - Sem ${matchingSub.semester}` : "Class Cohort",
              totalStudents: session.total_students,
              present: session.present_count,
              absent: session.absent_count,
              status: session.session_status === "LOCKED" ? "LOCKED" : "OPEN"
            }
          })

        return {
          scode: item.staff_code,
          name: item.name || (item.user_details ? `${item.user_details.first_name} ${item.user_details.last_name}`.trim() : "") || item.username,
          fatherName: item.father_name || "",
          dept: item.department_name || item.department,
          role: item.designation,
          salary: parseFloat(item.salary) || 0,
          email: item.email || item.user_details?.email || "",
          phone: item.phone || item.user_details?.phone || "",
          username: item.username || item.user_details?.username || "",
          maxLoadCredits: item.max_load_credits ?? 12,
          isActive: item.is_active !== false,
          subjects: facultySubs,
          assignedClasses: facultyClasses,
          markedSessions: facultySessions
        }
      })
      
      setStaffList(mappedStaff)
      setError("")
    } catch (err: any) {
      console.error(err)
      setError(err.message || "Failed to load faculty information.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Sync selectedFaculty when staffList updates
  useEffect(() => {
    if (selectedFaculty) {
      const updated = staffList.find(f => f.scode === selectedFaculty.scode)
      if (updated) {
        setSelectedFaculty(updated)
        setTempSubjects([...updated.subjects])
        setTempClasses([...updated.assignedClasses])
      }
    }
  }, [staffList])

  // Compute class cohorts dynamically from fetched subjects
  const availableClasses = useMemo(() => {
    const map = new Map<string, ClassCohort>()
    availableSubjects.forEach(s => {
      const key = `${s.programme}-${s.semester}`
      if (!map.has(key)) {
        map.set(key, { programme: s.programme, semester: s.semester })
      }
    })
    return Array.from(map.values()).sort((a, b) => 
      a.programme.localeCompare(b.programme) || a.semester - b.semester
    )
  }, [availableSubjects])

  // Filtering faculty list
  const filteredFaculty = staffList.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          f.scode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          f.username.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDept = selectedDept === "All" || f.dept === selectedDept
    return matchesSearch && matchesDept
  })

  // Open Actions
  const handleOpenAdd = () => {
    setFormScode("")
    setFormName("")
    setFormFatherName("")
    setFormDept(departments[0]?.id || "")
    setFormRole("Lecturer / Staff")
    setFormSalary(60000)
    setFormEmail("")
    setFormPhone("")
    setFormUsername("")
    setFormPassword("")
    setActiveModal("add")
  }

  // Open Dashboard view
  const handleOpenDashboard = (fac: Faculty) => {
    setSelectedFaculty(fac)
    setEditName(fac.name)
    setEditFatherName(fac.fatherName)
    setEditDept(fac.dept)
    setEditRole(fac.role)
    setEditSalary(fac.salary)
    setEditPhone(fac.phone)
    setEditEmail(fac.email)
    setEditMaxLoad(fac.maxLoadCredits)
    setTempSubjects([...fac.subjects])
    setTempClasses([...fac.assignedClasses])
    setDashboardTab("analytics")
    setActiveView("dashboard")
  }

  // Submit Operations
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) {
      alert("Unauthorized to perform this action.")
      return
    }
    try {
      const payload = {
          staff_code: formScode,
          name: formName,
          father_name: formFatherName,
          department: formDept,
        designation: formRole,
        salary: formSalary,
        email: formEmail,
        phone: formPhone,
        username: formUsername,
        login_username: formUsername,
        password: formPassword,
        max_load_credits: 12
      }
      await apiFetch("/faculty/create/", {
        method: "POST",
        body: payload
      })
      alert("Faculty registered successfully!")
      setActiveModal("none")
      loadData()
    } catch (err: any) {
      alert(err.message || "Failed to register faculty member.")
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedFaculty) return
    if (!isAdmin) {
      alert("Unauthorized to perform this action.")
      return
    }
    try {
      await apiFetch(`/staff/${selectedFaculty.scode}/disable/`, { method: "POST" })
      alert("Faculty member deactivated successfully!")
      setActiveModal("none")
      setActiveView("list")
      loadData()
    } catch (err: any) {
      alert(err.message || "Failed to delete faculty member.")
    }
  }

  const handleResetPassword = async (fac: Faculty) => {
    const password = window.prompt(`Enter new temporary password for ${fac.name}`)
    if (!password) return
    try {
      await apiFetch(`/staff/${fac.scode}/reset-password/`, {
        method: "POST",
        body: { password }
      })
      alert("Password reset successfully.")
    } catch (err: any) {
      alert(err.message || "Failed to reset password.")
    }
  }

  const handleToggleActive = async (fac: Faculty) => {
    try {
      await apiFetch(`/staff/${fac.scode}/${fac.isActive ? "disable" : "reactivate"}/`, { method: "POST" })
      await loadData()
    } catch (err: any) {
      alert(err.message || "Failed to update faculty status.")
    }
  }

  const handleAssignCourses = (fac: Faculty) => {
    handleOpenDashboard(fac)
    setDashboardTab("load")
  }

  // Toggle checks for subjects inside dashboard assignments tab
  const handleToggleSubject = (sub: Subject) => {
    if (!isAdmin) return
    if (tempSubjects.some(s => s.code === sub.code)) {
      setTempSubjects(tempSubjects.filter(s => s.code !== sub.code))
    } else {
      setTempSubjects([...tempSubjects, sub])
    }
  }

  // Toggle checks for classes inside dashboard assignments tab
  const handleToggleClass = (cls: ClassCohort) => {
    if (!isAdmin) return
    const exists = tempClasses.some(c => c.programme === cls.programme && c.semester === cls.semester)
    if (exists) {
      setTempClasses(tempClasses.filter(c => !(c.programme === cls.programme && c.semester === cls.semester)))
    } else {
      setTempClasses([...tempClasses, cls])
      // Auto pre-check subjects mapping this class for UX efficiency
      const matching = availableSubjects.filter(s => s.programme === cls.programme && s.semester === cls.semester)
      const toAdd = matching.filter(s => !tempSubjects.some(ts => ts.code === s.code))
      if (toAdd.length > 0) {
        setTempSubjects(prev => [...prev, ...toAdd])
      }
    }
  }

  // Save Dashboard Allocations Mappings
  const handleSaveAllocations = async () => {
    if (!selectedFaculty) return
    if (!isAdmin) {
      alert("Unauthorized to perform this action.")
      return
    }
    try {
      // 1. Save Subjects
      const subjectCodes = tempSubjects.map(s => s.code)
      await apiFetch(`/staff/${selectedFaculty.scode}/assign-subjects/`, {
        method: "POST",
        body: { subject_codes: subjectCodes }
      })
      
      // 2. Save Classes
      const classesPayload = tempClasses.map(c => ({
        programme: c.programme,
        semester: c.semester
      }))
      await apiFetch(`/staff/${selectedFaculty.scode}/assign-classes/`, {
        method: "POST",
        body: { classes: classesPayload }
      })
      
      alert("Allocations saved successfully!")
      loadData()
    } catch (err: any) {
      alert(err.message || "Failed to save allocations.")
    }
  }

  // Update Core Profile inside Faculty Dashboard
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFaculty) return
    if (!isAdmin) {
      alert("Unauthorized to perform this action.")
      return
    }
    try {
      const payload = {
        name: editName,
        father_name: editFatherName,
        department: editDept,
        designation: editRole,
        salary: editSalary,
        phone: editPhone,
        email: editEmail,
        max_load_credits: editMaxLoad
      }
      await apiFetch(`/staff/${selectedFaculty.scode}/`, {
        method: "PUT",
        body: payload
      })
      alert("Profile configurations saved successfully!")
      loadData()
    } catch (err: any) {
      alert(err.message || "Failed to update profile.")
    }
  }

  // Toggle marked session lock status inside history
  const handleToggleLockSession = async (sessionId: string) => {
    if (!selectedFaculty) return
    try {
      const session = selectedFaculty.markedSessions.find(s => s.id === sessionId)
      if (!session) return
      
      const endpoint = `/attendance/sessions/${sessionId}/${session.status === "LOCKED" ? "unlock" : "lock"}/`
      await apiFetch(endpoint, {
        method: "POST"
      })
      
      alert(`Session ${session.status === "LOCKED" ? "unlocked" : "locked"} successfully!`)
      loadData()
    } catch (err: any) {
      alert(err.message || "Failed to update session status.")
    }
  }

  // Calculate live credit hours load for selected faculty
  const currentCreditsLoad = selectedFaculty ? selectedFaculty.subjects.reduce((sum, s) => sum + s.credits, 0) : 0
  const workloadPercentage = selectedFaculty ? Math.min(Math.round((currentCreditsLoad / selectedFaculty.maxLoadCredits) * 100), 100) : 0

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] w-full p-8 space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 font-medium text-sm animate-pulse">Loading faculty records...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-250 text-red-800 rounded-xl p-5 flex flex-col items-center justify-center space-y-3">
        <AlertCircle className="w-8 h-8 text-red-600" />
        <h4 className="font-bold text-sm">Error Loading Faculty Data</h4>
        <p className="text-xs text-red-500">{error}</p>
        <button onClick={loadData} className="px-4 py-2 bg-red-650 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-all">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* ----------------------------------------------------------------------
          SCREEN 1: FACULTY DIRECTORY LIST VIEW
          ---------------------------------------------------------------------- */}
      {activeView === "list" && (
        <>
          {/* Header Panel */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Faculty Management Center</h2>
              <p className="text-xs text-slate-400">Manage academic lecturers, profiles, designations, salary config, and workloads.</p>
            </div>
            {isAdmin && canCreateFaculty && (
              <button 
                onClick={handleOpenAdd}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
              >
                <UserPlus className="w-4 h-4" />
                Add Faculty
              </button>
            )}
          </div>

          {/* Filters Search Bar */}
          <div className="flex flex-col md:flex-row gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search by faculty name, username or staff code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
              />
            </div>
            <div className="flex">
              <div className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                <select 
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="bg-transparent text-xs text-slate-600 font-semibold focus:outline-none w-full"
                >
                  <option value="All">All Departments</option>
                    {departments.map((d) => (
                      <option key={d.name} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Roster Directory Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-6 py-4">Staff Code</th>
                    <th className="px-6 py-4">Faculty Name</th>
                    <th className="px-6 py-4">Department</th>
                    <th className="px-6 py-4">Designation</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Phone</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {filteredFaculty.map((fac) => {
                    return (
                      <tr key={fac.scode} className="hover:bg-slate-50/50 transition-all">
                        <td className="px-6 py-4 font-bold text-slate-900">{fac.scode}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                              {fac.name.split(' ').filter(n => !n.includes('.')).map(n => n[0]).join('')}
                            </div>
                            <div>
                              <span className="block font-bold text-slate-800">{fac.name}</span>
                              <span className="text-[10px] text-slate-400">{fac.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600">{fac.dept}</td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[9px] font-bold uppercase">
                            {fac.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600">{fac.email || "-"}</td>
                        <td className="px-6 py-4 text-slate-600">{fac.phone || "-"}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold uppercase ${fac.isActive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
                            {fac.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                          <button 
                            onClick={() => handleOpenDashboard(fac)}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[10px] font-semibold transition-all inline-flex items-center gap-1"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleResetPassword(fac)}
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded text-[10px] font-semibold transition-all"
                          >
                            Reset Password
                          </button>
                          <button 
                            onClick={() => handleToggleActive(fac)}
                            className={`px-2.5 py-1.5 border rounded text-[10px] font-semibold transition-all ${fac.isActive ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200" : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"}`}
                          >
                            {fac.isActive ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            onClick={() => handleAssignCourses(fac)}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-semibold transition-all"
                          >
                            Assign Courses
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredFaculty.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-slate-400 italic">
                        <div className="flex flex-col items-center gap-3">
                          <p>No Faculty Registered Yet</p>
                          {isAdmin && canCreateFaculty && (
                            <button
                              onClick={handleOpenAdd}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                            >
                              <UserPlus className="w-4 h-4" />
                              Create Faculty
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ----------------------------------------------------------------------
          SCREEN 2: INTERACTIVE FACULTY DASHBOARD VIEW
          ---------------------------------------------------------------------- */}
      {activeView === "dashboard" && selectedFaculty && (
        <div className="space-y-6 animate-in slide-in-from-right duration-300">
          {/* Dashboard Header Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center font-extrabold text-base shadow-inner">
                {selectedFaculty.name.split(' ').filter(n=>!n.includes('.')).map(n=>n[0]).join('')}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-extrabold text-slate-800">{selectedFaculty.name}</h2>
                  <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-[9px] font-bold uppercase">
                    {selectedFaculty.role}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Staff Code: **{selectedFaculty.scode}** • Dept: **{selectedFaculty.dept}**</p>
              </div>
            </div>

            <button 
              onClick={() => setActiveView("list")}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 bg-white rounded-lg text-xs font-bold shadow-sm transition-all"
            >
              ← Back to Directory
            </button>
          </div>

          {/* Sub-tabs Selection bar inside the Dashboard */}
          <div className="flex border-b border-slate-200 gap-6">
            <button 
              onClick={() => setDashboardTab("analytics")}
              className={`pb-3 text-xs font-bold transition-all relative ${dashboardTab === "analytics" ? "text-emerald-600" : "text-slate-400 hover:text-slate-600"}`}
            >
              Workload Analytics
              {dashboardTab === "analytics" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-600 rounded-full" />}
            </button>
            <button 
              onClick={() => setDashboardTab("attendance")}
              className={`pb-3 text-xs font-bold transition-all relative ${dashboardTab === "attendance" ? "text-emerald-600" : "text-slate-400 hover:text-slate-600"}`}
            >
              Attendance Marked History ({selectedFaculty.markedSessions.length})
              {dashboardTab === "attendance" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-600 rounded-full" />}
            </button>
            <button 
              onClick={() => setDashboardTab("load")}
              className={`pb-3 text-xs font-bold transition-all relative ${dashboardTab === "load" ? "text-emerald-600" : "text-slate-400 hover:text-slate-600"}`}
            >
              Subject & Class Assignments
              {dashboardTab === "load" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-600 rounded-full" />}
            </button>
            <button 
              onClick={() => setDashboardTab("profile")}
              className={`pb-3 text-xs font-bold transition-all relative ${dashboardTab === "profile" ? "text-emerald-600" : "text-slate-400 hover:text-slate-600"}`}
            >
              Profile Management
              {dashboardTab === "profile" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-600 rounded-full" />}
            </button>
          </div>

          {/* Tab 1: Workload Analytics details */}
          {dashboardTab === "analytics" && (
            <div className="grid md:grid-cols-3 gap-6 animate-in fade-in duration-200">
              {/* Load summary cards */}
              <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  Workload Standing Telemetry
                </h3>
                
                {/* Credit loading gauge bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600">Credit Hours Loading Scale</span>
                    <span className="font-bold text-emerald-600">{currentCreditsLoad} / {selectedFaculty.maxLoadCredits} Credits ({workloadPercentage}%)</span>
                  </div>
                  <div className="w-full h-3.5 bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        workloadPercentage >= 85.0 ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${workloadPercentage}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
                    * Recommended credit loading is 9-12 credits per semester. Loading exceeding 15 credits requires HOD dean authorization overrides.
                  </p>
                </div>

                {/* Comparative Analytics cards */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                    <span className="text-[9px] text-slate-400 font-bold block uppercase">Assigned Subjects</span>
                    <span className="text-lg font-black text-slate-800">{selectedFaculty.subjects.length}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                    <span className="text-[9px] text-slate-400 font-bold block uppercase">Assigned Classes</span>
                    <span className="text-lg font-black text-slate-800">{selectedFaculty.assignedClasses.length}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                    <span className="text-[9px] text-slate-400 font-bold block uppercase">Weekly Hours (Est.)</span>
                    <span className="text-lg font-black text-slate-800">{currentCreditsLoad * 3} hrs</span>
                  </div>
                </div>
              </div>

              {/* Sidebar status card */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Workload Audit Status</span>
                  
                  {workloadPercentage === 0 ? (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-bold flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                      <span>UNDERLOADED: No subjects are allocated to this lecturer. Assign subjects immediately.</span>
                    </div>
                  ) : workloadPercentage > 90 ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-bold flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <span>HIGH WORKLOAD: Lecturer is reaching maximum load. Avoid allocating additional sessions.</span>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>STANDARD: Credit hours are perfectly balanced. Audit status holds clear approvals.</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-150 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase">Salary Scale</span>
                    <span className="font-extrabold text-slate-800">${selectedFaculty.salary.toLocaleString()}/yr</span>
                  </div>
                  <span className="px-2.5 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold">
                    PAID ACTIVE
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Attendance marked history table */}
          {dashboardTab === "attendance" && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden animate-in fade-in duration-200">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  Roster Marking Logs
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                  Total sessions logged: {selectedFaculty.markedSessions.length}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <th className="px-6 py-3.5">Session ID</th>
                      <th className="px-6 py-3.5">Date</th>
                      <th className="px-6 py-3.5">Period Hour</th>
                      <th className="px-6 py-3.5">Class / Subject</th>
                      <th className="px-6 py-3.5 text-center">Strength (Pres / Abs)</th>
                      <th className="px-6 py-3.5 text-center">Marking Status</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                    {selectedFaculty.markedSessions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-slate-400 italic">
                          No marked attendance logs exist for this lecturer.
                        </td>
                      </tr>
                    ) : (
                      selectedFaculty.markedSessions.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/50 transition-all">
                          <td className="px-6 py-4 font-bold text-slate-900">{s.id}</td>
                          <td className="px-6 py-4 text-slate-600">{s.date}</td>
                          <td className="px-6 py-4">Period {s.hour}</td>
                          <td className="px-6 py-4">
                            <span className="block font-bold text-slate-800">{s.subjectCode}</span>
                            <span className="text-[10px] text-slate-400 font-semibold">{s.classCohort}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="font-bold text-slate-800">{s.totalStudents}</span> students
                            <span className="block text-[10px] font-semibold text-emerald-600 mt-0.5">
                              {s.present} Present / {s.absent} Absent
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {s.status === "LOCKED" ? (
                              <span className="px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-[4px] text-[9px] font-bold inline-flex items-center gap-0.5">
                                <Lock className="w-2.5 h-2.5" />
                                FINALIZED
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-[4px] text-[9px] font-bold inline-flex items-center gap-0.5">
                                <Unlock className="w-2.5 h-2.5" />
                                EDITABLE
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleToggleLockSession(s.id)}
                              className={`px-2 py-1.5 rounded text-[10px] font-bold border transition-all ${
                                s.status === "LOCKED" 
                                  ? "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700"
                                  : "bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700"
                              }`}
                            >
                              {s.status === "LOCKED" ? "Unlock Session" : "Finalize & Lock"}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: Assignments Mapping controls */}
          {dashboardTab === "load" && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Assign Load Allocations Mappings</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Allocate taught subjects and sections. Mappings automatically update active directories.</p>
                </div>
                {isAdmin ? (
                  <button 
                    onClick={handleSaveAllocations}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                  >
                    Save allocations
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 italic font-semibold">Read-only Allocations</span>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Subjects check blocks */}
                <div className="space-y-3.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">1. Available Courses</span>
                  <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-1">
                    {availableSubjects.map((sub) => {
                      const isChecked = tempSubjects.some(s => s.code === sub.code)
                      return (
                        <label 
                          key={sub.code} 
                          className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                            isChecked 
                              ? "bg-emerald-50/40 border-emerald-300 text-emerald-950" 
                              : "bg-slate-50/50 border-slate-150 hover:border-slate-200 text-slate-700"
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={() => handleToggleSubject(sub)}
                            disabled={!isAdmin}
                            className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 disabled:opacity-55"
                          />
                          <div>
                            <span className="block font-bold text-slate-900">{sub.code} — {sub.name}</span>
                            <span className="text-[10px] text-slate-400 mt-0.5 block">
                              Course credit load: **{sub.credits} Credits** • Semester {sub.semester}
                            </span>
                          </div>
                        </label>
                      )
                    })}
                    {availableSubjects.length === 0 && (
                      <p className="text-xs text-slate-500 italic">No courses registered in catalog.</p>
                    )}
                  </div>
                </div>

                {/* Class Cohort check blocks */}
                <div className="space-y-3.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">2. Academic Class Cohorts</span>
                  <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-1">
                    {availableClasses.map((cls, index) => {
                      const isChecked = tempClasses.some(c => c.programme === cls.programme && c.semester === cls.semester)
                      return (
                        <label 
                          key={index} 
                          className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                            isChecked 
                              ? "bg-emerald-50/40 border-emerald-300 text-emerald-950" 
                              : "bg-slate-50/50 border-slate-150 hover:border-slate-200 text-slate-700"
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={() => handleToggleClass(cls)}
                            disabled={!isAdmin}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 disabled:opacity-55"
                          />
                          <div>
                            <span className="block font-bold text-slate-900">{cls.programme} - Semester {cls.semester}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">Section Rosters: Class A / B</span>
                          </div>
                        </label>
                      )
                    })}
                    {availableClasses.length === 0 && (
                      <p className="text-xs text-slate-500 italic">No academic cohorts found matching courses.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Profile Management form editor */}
          {dashboardTab === "profile" && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Faculty Profile settings</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Update Designation, Department, Contact info, and load parameters directly.</p>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-xl">
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Full Name</label>
                    <input 
                      type="text" 
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      disabled={!isAdmin}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white disabled:opacity-70"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Father's Name (ssname)</label>
                    <input 
                      type="text" 
                      value={editFatherName}
                      onChange={(e) => setEditFatherName(e.target.value)}
                      disabled={!isAdmin}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white disabled:opacity-70"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Academic Department</label>
                    <select 
                      value={editDept}
                      onChange={(e) => setEditDept(e.target.value)}
                      disabled={!isAdmin}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white disabled:opacity-70"
                    >
                      {departments.length === 0 ? (
                        <option value="" disabled>No departments available</option>
                      ) : (
                        departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Designation Role</label>
                    <select 
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      disabled={!isAdmin}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white disabled:opacity-70"
                    >
                      <option value="Lecturer / Staff">Lecturer / Staff</option>
                      <option value="Senior Lecturer">Senior Lecturer</option>
                      <option value="HOD Coordinator">HOD Coordinator</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Annual Salary ($)</label>
                    <input 
                      type="number" 
                      value={editSalary}
                      onChange={(e) => setEditSalary(parseInt(e.target.value) || 0)}
                      disabled={!isAdmin}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white disabled:opacity-70"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Max Credit Load Guideline</label>
                    <input 
                      type="number" 
                      min={6}
                      max={20}
                      value={editMaxLoad}
                      onChange={(e) => setEditMaxLoad(parseInt(e.target.value) || 12)}
                      disabled={!isAdmin}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white disabled:opacity-70"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                    <input 
                      type="text" 
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      disabled={!isAdmin}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white disabled:opacity-70"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email Address</label>
                    <input 
                      type="email" 
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      disabled={!isAdmin}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white disabled:opacity-70"
                      required
                    />
                  </div>
                </div>

                {isAdmin && canCreateFaculty && (
                  <div className="pt-2 flex justify-end gap-2.5">
                    <button 
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                    >
                      Save Profile Settings
                    </button>
                  </div>
                )}
              </form>
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------------
          MODAL A: REGISTER NEW FACULTY (ADD)
          ---------------------------------------------------------------------- */}
      {activeModal === "add" && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in duration-200">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Register Faculty Profile</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Create a new academic lecturer registry entry with linked user credentials</p>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Staff Code</label>
                  <input 
                    type="text" 
                    value={formScode}
                    onChange={(e) => setFormScode(e.target.value)}
                    placeholder="STF-2026-906"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Full Name</label>
                  <input 
                    type="text" 
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Dr. Marie Curie"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Father's Name (ssname)</label>
                  <input 
                    type="text" 
                    value={formFatherName}
                    onChange={(e) => setFormFatherName(e.target.value)}
                    placeholder="Wladyslaw Sklodowski"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Department</label>
                  <select 
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value)}
                    disabled={departmentLocked}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white disabled:opacity-70"
                  >
                    {departments.length === 0 ? (
                      <option value="" disabled>No departments available</option>
                    ) : (
                      departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Designation</label>
                  <select 
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                  >
                    <option value="Lecturer / Staff">Lecturer / Staff</option>
                    <option value="Senior Lecturer">Senior Lecturer</option>
                    <option value="HOD Coordinator">HOD Coordinator</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Annual Salary ($)</label>
                  <input 
                    type="number" 
                    value={formSalary}
                    onChange={(e) => setFormSalary(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mobile Number</label>
                  <input 
                    type="text" 
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+1 (555) 011-2233"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email Address</label>
                  <input 
                    type="email" 
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="curie@hexaattender.edu"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                    required
                  />
                </div>
              </div>

              {/* Portal Login Credentials Section */}
              <div className="pt-2.5 border-t border-slate-100 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Portal User Account Settings</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Login Username</label>
                    <input 
                      type="text" 
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value)}
                      placeholder="mariecurie"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Login Password</label>
                    <input 
                      type="password" 
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button 
                  type="button"
                  onClick={() => setActiveModal("none")}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                >
                  Create Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------
          MODAL B: DELETE FACULTY CONFIRMATION
          ---------------------------------------------------------------------- */}
      {activeModal === "delete" && selectedFaculty && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 flex-shrink-0 flex items-center justify-center text-rose-600">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800">Confirm Faculty Deletion?</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Are you sure you want to delete **{selectedFaculty.name}** (Staff Code: **{selectedFaculty.scode}**)? This action will remove their profile, salary configs, and unassign them from all subjects and courses.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button 
                onClick={() => setActiveModal("none")}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
              >
                Delete Faculty
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
