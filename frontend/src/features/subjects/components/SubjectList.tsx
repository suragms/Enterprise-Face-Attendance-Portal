import React, { useState, useEffect } from "react"
import { 
  Search, 
  Plus, 
  Building, 
  Tag, 
  BookOpen, 
  Award, 
  User, 
  AlertCircle, 
  Edit, 
  X
} from "lucide-react"
import { apiFetch } from "../../../lib/api"
import { useAuth } from "../../../context/AuthContext"
import { isAdminRole, isHodRole } from "../../../lib/roles"
import { useHodContext } from "../../../hooks/useHodContext"
import { HodDepartmentBanner } from "../../admin/components/HodDepartmentBanner"

interface Faculty {
  scode: string
  name: string
  dept: string
  role: string
}

interface Subject {
  id: string
  code: string
  name: string
  credits: number
  semester: number
  department: string
  facultyScode?: string // Linked lecturer staff code
}

export const SubjectList: React.FC = () => {
  const { user } = useAuth()
  const isAdmin = isAdminRole(user?.role)
  const isHod = isHodRole(user?.role)
  const { department, departmentLocked } = useHodContext(user?.role)
  const lockedDepartmentName = department?.name

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [availableFaculty, setAvailableFaculty] = useState<Faculty[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Modals and filter state
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDept, setSelectedDept] = useState("All")
  const [selectedSemester, setSelectedSemester] = useState("All")

  const [activeModal, setActiveModal] = useState<"none" | "add" | "edit" | "delete" | "assign">("none")
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null)

  // Form input states
  const [formCode, setFormCode] = useState("")
  const [formName, setFormName] = useState("")
  const [formCredits, setFormCredits] = useState<number>(3)
  const [formSemester, setFormSemester] = useState<number>(1)
  const [formDepartment, setFormDepartment] = useState("")
  const [formFacultyScode, setFormFacultyScode] = useState("")
  const [departments, setDepartments] = useState<any[]>([])

  // Load subjects & staff from API
  const loadData = async () => {
    setLoading(true)
    try {
      const [subjectsData, staffData, deptsData] = await Promise.all([
        apiFetch<any[]>("/subjects/"),
        apiFetch<any[]>("/staff/"),
        apiFetch<any>("/departments/").catch(() => ({ results: [] }))
      ])

      const mappedSubjects: Subject[] = subjectsData.map((s: any) => ({
        id: s.id,
        code: s.subject_code,
        name: s.name,
        credits: s.credits,
        semester: s.semester_number ?? s.semester,
        department: s.department_name ?? s.department,
        facultyScode: s.assigned_faculty_code || s.assigned_staff || undefined
      }))

      const mappedFaculty: Faculty[] = staffData.map((item: any) => ({
        scode: item.staff_code,
        name: item.name || (item.user_details ? `${item.user_details.first_name} ${item.user_details.last_name}`.trim() : "") || item.username,
        dept: item.department_name ?? item.department,
        role: item.designation
      }))

      const deptList = deptsData.results || deptsData || []
      setDepartments(deptList)
      setSubjects(mappedSubjects)
      setAvailableFaculty(mappedFaculty)
      
      if (!departmentLocked && deptList.length > 0 && !formDepartment) {
        setFormDepartment(deptList[0].name)
      }
      setError("")
    } catch (err: any) {
      console.error(err)
      setError(err.message || "Failed to load subjects or faculty loads.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (departmentLocked && lockedDepartmentName) {
      setSelectedDept(lockedDepartmentName)
      setFormDepartment(lockedDepartmentName)
    }
  }, [departmentLocked, lockedDepartmentName])

  // Filter handlers
  const filteredSubjects = subjects.filter(sub => {
    const matchesSearch = sub.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          sub.code.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDept = selectedDept === "All" || sub.department === selectedDept
    const matchesSem = selectedSemester === "All" || sub.semester === parseInt(selectedSemester)
    return matchesSearch && matchesDept && matchesSem
  })

  // Action triggers
  const handleOpenAdd = () => {
    setFormCode("")
    setFormName("")
    setFormCredits(3)
    setFormSemester(1)
    setFormDepartment(departmentLocked && lockedDepartmentName ? lockedDepartmentName : (departments[0]?.name || ""))
    setFormFacultyScode("")
    setActiveModal("add")
  }

  const handleOpenEdit = (sub: Subject) => {
    setSelectedSubject(sub)
    setFormCode(sub.code)
    setFormName(sub.name)
    setFormCredits(sub.credits)
    setFormSemester(sub.semester)
    setFormDepartment(sub.department)
    setFormFacultyScode(sub.facultyScode || "")
    setActiveModal("edit")
  }

  const handleOpenAssign = (sub: Subject) => {
    setSelectedSubject(sub)
    setFormFacultyScode(sub.facultyScode || "")
    setActiveModal("assign")
  }

  const handleOpenDelete = (sub: Subject) => {
    setSelectedSubject(sub)
    setActiveModal("delete")
  }

  // Database handlers
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) {
      alert("Unauthorized to perform this action.")
      return
    }
    try {
      const payload = {
        subject_code: formCode,
        name: formName,
        credits: formCredits,
        semester: formSemester,
        department: formDepartment,
        assigned_staff: formFacultyScode || null
      }
      await apiFetch("/subjects/", {
        method: "POST",
        body: payload
      })
      alert("Subject added successfully!")
      setActiveModal("none")
      loadData()
    } catch (err: any) {
      alert(err.message || "Failed to create subject configuration.")
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSubject) return
    if (!isAdmin) {
      alert("Unauthorized to perform this action.")
      return
    }
    try {
      const payload = {
        name: formName,
        credits: formCredits,
        semester: formSemester,
        department: formDepartment,
        assigned_staff: formFacultyScode || null
      }
      await apiFetch(`/subjects/${selectedSubject.id}/`, {
        method: "PUT",
        body: payload
      })
      alert("Subject updated successfully!")
      setActiveModal("none")
      loadData()
    } catch (err: any) {
      alert(err.message || "Failed to edit subject profile.")
    }
  }

  const handleAssignSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSubject) return
    if (!isAdmin) {
      alert("Unauthorized to perform this action.")
      return
    }
    try {
      const payload = {
        name: selectedSubject.name,
        credits: selectedSubject.credits,
        semester: selectedSubject.semester,
        department: selectedSubject.department,
        assigned_staff: formFacultyScode || null
      }
      await apiFetch(`/subjects/${selectedSubject.id}/`, {
        method: "PUT",
        body: payload
      })
      alert("Lecturer assigned to subject successfully!")
      setActiveModal("none")
      loadData()
    } catch (err: any) {
      alert(err.message || "Failed to update lecturer load mapping.")
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedSubject) return
    if (!isAdmin) {
      alert("Unauthorized to perform this action.")
      return
    }
    try {
      await apiFetch(`/subjects/${selectedSubject.id}/`, {
        method: "DELETE"
      })
      alert("Subject deleted successfully!")
      setActiveModal("none")
      loadData()
    } catch (err: any) {
      alert(err.message || "Failed to delete subject profile.")
    }
  }

  // Helper: Retrieve faculty details by scode
  const getFacultyDetails = (scode?: string) => {
    if (!scode) return null
    return availableFaculty.find(f => f.scode === scode) || null
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] w-full p-8 space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 font-medium text-sm animate-pulse">Loading subjects registry...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-250 text-red-800 rounded-xl p-5 flex flex-col items-center justify-center space-y-3">
        <AlertCircle className="w-8 h-8 text-red-650" />
        <h4 className="font-bold text-sm">Error Loading Subjects Catalog</h4>
        <p className="text-xs text-red-600">{error}</p>
        <button onClick={loadData} className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-all">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {isHod ? <HodDepartmentBanner /> : null}
      {/* Header View */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Academic Subjects</h2>
          <p className="text-xs text-slate-400">Configure academic subjects, credit allocations, and designate departments or faculty loads</p>
        </div>
        {isAdmin && (
          <button 
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Subject Configuration
          </button>
        )}
      </div>

      {/* Selective Filters */}
      <div className="flex flex-col md:flex-row gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by subject name or course code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <div className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50">
            <Building className="w-3.5 h-3.5 text-slate-400" />
            <select 
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              disabled={departmentLocked}
              className="bg-transparent text-xs text-slate-600 font-semibold focus:outline-none disabled:opacity-70"
            >
              {!departmentLocked ? <option value="All">All Departments</option> : null}
              {departmentLocked && lockedDepartmentName ? (
                <option value={lockedDepartmentName}>{lockedDepartmentName}</option>
              ) : (
                departments.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))
              )}
            </select>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50/50">
            <Tag className="w-3.5 h-3.5 text-slate-400" />
            <select 
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="bg-transparent text-xs text-slate-600 font-semibold focus:outline-none"
            >
              <option value="All">All Semesters</option>
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
              <option value="3">Semester 3</option>
              <option value="4">Semester 4</option>
              <option value="5">Semester 5</option>
              <option value="6">Semester 6</option>
              <option value="7">Semester 7</option>
              <option value="8">Semester 8</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid Registry */}
      <div className="grid gap-6 md:grid-cols-2">
        {filteredSubjects.map((sub) => {
          const fac = getFacultyDetails(sub.facultyScode)
          return (
            <div key={sub.code} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 hover:border-emerald-300 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded uppercase">
                      {sub.code}
                    </span>
                    <h3 className="text-base font-bold text-slate-800 mt-2">{sub.name}</h3>
                  </div>
                  <BookOpen className="w-5 h-5 text-slate-300 flex-shrink-0" />
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[9px] font-bold uppercase flex items-center gap-1">
                    <Award className="w-3 h-3 text-slate-400" />
                    {sub.credits} Credits
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[9px] font-bold uppercase flex items-center gap-1">
                    <Tag className="w-3 h-3 text-slate-400" />
                    Semester {sub.semester}
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[9px] font-bold uppercase flex items-center gap-1">
                    <Building className="w-3 h-3 text-slate-400" />
                    {sub.department}
                  </span>
                </div>
              </div>

              {/* Faculty assignment line & actions */}
              <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Lecturer</span>
                  {fac ? (
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-[9px]">
                        {fac.name.split(' ').filter(n=>!n.includes('.')).map(n=>n[0]).join('')}
                      </div>
                      <span className="text-xs font-bold text-slate-700">{fac.name}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-rose-600 font-semibold italic mt-1 block">Unassigned</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <>
                      <button 
                        onClick={() => handleOpenAssign(sub)}
                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[10px] font-semibold transition-all flex items-center gap-1"
                      >
                        <User className="w-3 h-3 text-emerald-600" />
                        Faculty
                      </button>
                      <button 
                        onClick={() => handleOpenEdit(sub)}
                        className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-semibold transition-all flex items-center gap-1"
                      >
                        <Edit className="w-3 h-3 text-slate-500" />
                        Edit
                      </button>
                      <button 
                        onClick={() => handleOpenDelete(sub)}
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-[10px] font-semibold transition-all flex items-center justify-center"
                      >
                        <X className="w-3.5 h-3.5 text-rose-600" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        {filteredSubjects.length === 0 && (
          <div className="col-span-2 text-center text-slate-400 italic py-8">
            No subjects matching search queries are currently registered.
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------------
          MODAL 1: ADD SUBJECT
          ---------------------------------------------------------------------- */}
      {activeModal === "add" && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Add Subject Configuration</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Scaffold a new academic subject course record in backend databases</p>
              </div>
              <button 
                onClick={() => setActiveModal("none")} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Subject Code</label>
                  <input 
                    type="text" 
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="MCS-104"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Subject Name</label>
                  <input 
                    type="text" 
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Operating Systems"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Credit Hours</label>
                  <input 
                    type="number" 
                    min={1} 
                    max={6}
                    value={formCredits}
                    onChange={(e) => setFormCredits(parseInt(e.target.value) || 3)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Target Semester</label>
                  <input 
                    type="number" 
                    min={1} 
                    max={10}
                    value={formSemester}
                    onChange={(e) => setFormSemester(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Department</label>
                  <select 
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-700"
                    disabled={departmentLocked || departments.length === 0}
                    required
                  >
                    {departmentLocked && lockedDepartmentName ? (
                      <option value={lockedDepartmentName}>{lockedDepartmentName}</option>
                    ) : departments.length === 0 ? (
                      <option value="" disabled>No departments available</option>
                    ) : (
                      <>
                        <option value="" disabled>-- Select Department --</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Assigned Faculty (Optional)</label>
                  <select 
                    value={formFacultyScode}
                    onChange={(e) => setFormFacultyScode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-700"
                  >
                    <option value="">-- Choose Lecturer --</option>
                    {availableFaculty.map(f => (
                      <option key={f.scode} value={f.scode}>{f.name} ({f.dept})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
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
                  Save Subject Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------
          MODAL 2: EDIT SUBJECT
          ---------------------------------------------------------------------- */}
      {activeModal === "edit" && selectedSubject && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Edit Subject Profile</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Modify database attributes for Course Code: {selectedSubject.code}</p>
              </div>
              <button 
                onClick={() => setActiveModal("none")} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Subject Name</label>
                  <input 
                    type="text" 
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Credit Hours</label>
                  <input 
                    type="number" 
                    min={1} 
                    max={6}
                    value={formCredits}
                    onChange={(e) => setFormCredits(parseInt(e.target.value) || 3)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Semester</label>
                  <input 
                    type="number" 
                    min={1} 
                    max={10}
                    value={formSemester}
                    onChange={(e) => setFormSemester(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Department</label>
                  <select 
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-700"
                    disabled={departmentLocked || departments.length === 0}
                    required
                  >
                    {departmentLocked && lockedDepartmentName ? (
                      <option value={lockedDepartmentName}>{lockedDepartmentName}</option>
                    ) : departments.length === 0 ? (
                      <option value="" disabled>No departments available</option>
                    ) : (
                      <>
                        <option value="" disabled>-- Select Department --</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Assigned Faculty (Optional)</label>
                  <select 
                    value={formFacultyScode}
                    onChange={(e) => setFormFacultyScode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-700"
                  >
                    <option value="">-- Choose Lecturer --</option>
                    {availableFaculty.map(f => (
                      <option key={f.scode} value={f.scode}>{f.name} ({f.dept})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
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
                  Update Subject Config
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------
          MODAL 3: ASSIGN FACULTY DIRECTLY
          ---------------------------------------------------------------------- */}
      {activeModal === "assign" && selectedSubject && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1">
                  <User className="w-5 h-5 text-emerald-600" />
                  Assign Lecturer Load
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Map a faculty member to teach: **{selectedSubject.name}**</p>
              </div>
              <button 
                onClick={() => setActiveModal("none")} 
                className="text-slate-400 hover:text-slate-655"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignSave} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Select Faculty Lecturer</label>
                <select 
                  value={formFacultyScode}
                  onChange={(e) => setFormFacultyScode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-700"
                >
                  <option value="">-- Keep Unassigned / Remove Load --</option>
                  {availableFaculty.map(f => (
                    <option key={f.scode} value={f.scode}>{f.name} ({f.dept} • {f.role})</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
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
                  Save Lecturer Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------
          MODAL 4: DELETE SUBJECT CONFIRMATION
          ---------------------------------------------------------------------- */}
      {activeModal === "delete" && selectedSubject && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 flex-shrink-0 flex items-center justify-center text-rose-600">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800">Confirm Subject Deletion?</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Are you sure you want to delete **{selectedSubject.name}** (Code: **{selectedSubject.code}**)? This action will remove the course curriculum setting and unassign all mapped timetables.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2.5">
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
                Delete Subject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
