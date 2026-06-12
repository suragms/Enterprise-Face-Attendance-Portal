import React, { useEffect, useMemo, useState } from "react"
import { Search, AlertCircle, SlidersHorizontal, Plus, Pencil, Archive, RotateCcw, X } from "lucide-react"
import { apiFetch, buildQueryString } from "../../../lib/api"
import { useAuth } from "../../../context/AuthContext"
import { isFacultyRole, isHodRole } from "../../../lib/roles"
import { useHodContext } from "../../../hooks/useHodContext"
import { useFacultyContext } from "../../../hooks/useFacultyContext"
import { HodDepartmentBanner } from "../../admin/components/HodDepartmentBanner"
import { FacultyScopeBanner } from "../../staff/components/FacultyScopeBanner"

interface Student {
  roll_no: string
  name: string
  department: string
  year: number
  semester: number
  dob: string
  email: string
  phone: string
  address?: string
  campus_status: "DAY_SCHOLAR" | "HOSTELLER"
  face_enrolled: boolean
  is_archived: boolean
}

interface ApiListResponse<T> {
  count?: number
  next?: string | null
  previous?: string | null
  results?: T[]
}

export const StudentList: React.FC = () => {
  const { user } = useAuth()
  const isHod = isHodRole(user?.role)
  const isFaculty = isFacultyRole(user?.role)
  const { department, departmentLocked } = useHodContext(user?.role)
  const facultyContext = useFacultyContext(user?.role)
  const lockedDepartmentName = department?.name || facultyContext.department?.name
  const isDepartmentLocked = isHod ? departmentLocked : isFaculty ? facultyContext.departmentLocked : false
  const canManageStudents =
    user?.role === "SUPER_ADMIN" ||
    user?.role === "HOD" ||
    user?.role === "FACULTY" ||
    user?.role === "PLATFORM_SUPER_ADMIN" ||
    user?.role === "ORGANIZATION_ADMIN" ||
    user?.role === "BRANCH_ADMIN"

  const [students, setStudents] = useState<Student[]>([])
  const [departments, setDepartments] = useState<{ id: string; name: string; code?: string }[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState("")
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [selectedDept, setSelectedDept] = useState("All")
  const [selectedSemester, setSelectedSemester] = useState("All")
  const [selectedStatus, setSelectedStatus] = useState("All")
  const [selectedBiometrics, setSelectedBiometrics] = useState("All")
  const [viewArchived, setViewArchived] = useState(false)

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    roll_no: "",
    name: "",
    department: "Computer Science",
    year: 1,
    semester: 1,
    dob: "",
    email: "",
    phone: "",
    address: "",
    campus_status: "DAY_SCHOLAR" as "DAY_SCHOLAR" | "HOSTELLER",
    face_enrolled: false,
    login_password: "",
  })

  const loadStudents = async () => {
    setIsLoading(true)
    setError(null)

    const faceEnrolled = selectedBiometrics === "Enrolled" ? "true" : selectedBiometrics === "Missing" ? "false" : undefined
    const campusStatus = selectedStatus === "All" ? undefined : selectedStatus === "Hosteller" ? "HOSTELLER" : "DAY_SCHOLAR"
    const query = buildQueryString({
      page,
      page_size: pageSize,
      search: searchTerm || undefined,
      department: selectedDept !== "All" ? selectedDept : undefined,
      semester: selectedSemester !== "All" ? selectedSemester : undefined,
      campus_status: campusStatus,
      face_enrolled: faceEnrolled,
      is_archived: viewArchived ? "true" : "false"
    })

    try {
      const data = await apiFetch<ApiListResponse<Student>>(`/students/?${query}`)
      const results = data.results ?? data
      setStudents(Array.isArray(results) ? results : [])
      setTotalCount(data.count ?? (Array.isArray(results) ? results.length : 0))
    } catch (err: any) {
      setError(err.message || "Unable to load student data.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setPage(1)
  }, [searchTerm, selectedDept, selectedSemester, selectedStatus, selectedBiometrics, viewArchived])

  useEffect(() => {
    loadStudents()
  }, [page, pageSize, selectedDept, selectedSemester, selectedStatus, selectedBiometrics, searchTerm, viewArchived])

  useEffect(() => {
    if (isDepartmentLocked && lockedDepartmentName) {
      setSelectedDept(lockedDepartmentName)
      setFormData((prev) => ({ ...prev, department: lockedDepartmentName }))
    }
  }, [isDepartmentLocked, lockedDepartmentName])

  useEffect(() => {
    if (!isDepartmentLocked) {
      apiFetch<any>("/departments/")
        .then((data) => {
          const list = Array.isArray(data) ? data : data.results ?? []
          setDepartments(list)
        })
        .catch((err) => {
          console.error("Failed to fetch departments", err)
        })
    }
  }, [isDepartmentLocked])

  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize))
  const displayedStudents = useMemo(() => students, [students])

  // CRUD actions handlers
  const handleOpenAddModal = () => {
    setEditingStudent(null)
    const defaultDept = isDepartmentLocked && lockedDepartmentName
      ? lockedDepartmentName
      : (departments.length > 0 ? departments[0].name : "Computer Science")
    setFormData({
      roll_no: "",
      name: "",
      department: defaultDept,
      year: 1,
      semester: 1,
      dob: "",
      email: "",
      phone: "",
      address: "",
      campus_status: "DAY_SCHOLAR",
      face_enrolled: false,
      login_password: "",
    })
    setFormError(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (student: Student) => {
    setEditingStudent(student)
    setFormData({
      roll_no: student.roll_no,
      name: student.name,
      department: student.department,
      year: student.year ?? 1,
      semester: student.semester,
      dob: student.dob ? student.dob.substring(0, 10) : "",
      email: student.email || "",
      phone: student.phone || "",
      address: student.address || "",
      campus_status: student.campus_status,
      face_enrolled: student.face_enrolled,
      login_password: "",
    })
    setFormError(null)
    setIsModalOpen(true)
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setIsSaving(true)

    try {
      if (editingStudent) {
        const payload = { ...formData }
        if (!payload.login_password) {
          delete payload.login_password
        }
        await apiFetch(`/students/${editingStudent.roll_no}/`, {
          method: "PUT",
          body: payload
        })
      } else {
        const { login_password, ...rest } = formData
        const payload = {
          ...rest,
          login_email: formData.email,
          login_password: login_password,
        }
        await apiFetch("/students/", {
          method: "POST",
          body: payload
        })
      }
      setIsModalOpen(false)
      loadStudents()
    } catch (err: any) {
      setFormError(err.message || "An error occurred while saving student.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleArchiveStudent = async (rollNo: string) => {
    if (!window.confirm("Are you sure you want to archive this student profile?")) return
    try {
      await apiFetch(`/students/${rollNo}/archive/`, {
        method: "POST"
      })
      loadStudents()
    } catch (err: any) {
      alert(err.message || "Failed to archive student.")
    }
  }

  const handleRestoreStudent = async (rollNo: string) => {
    if (!window.confirm("Are you sure you want to restore this student profile?")) return
    try {
      await apiFetch(`/students/${rollNo}/restore/`, {
        method: "POST"
      })
      loadStudents()
    } catch (err: any) {
      alert(err.message || "Failed to restore student.")
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {isHod ? <HodDepartmentBanner /> : null}
      {isFaculty ? <FacultyScopeBanner /> : null}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Student Management</h2>
          <p className="text-xs text-slate-400">Live student registry linked to backend API. Search, filter, and manage real data.</p>
        </div>
        {canManageStudents && (
          <button
            onClick={handleOpenAddModal}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-md transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Add Student
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, roll number, email or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <button
            onClick={() => setShowAdvancedFilters((prev) => !prev)}
            className="flex items-center justify-center gap-2 px-3.5 py-2 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-770 rounded-lg text-xs font-bold"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
          </button>
        </div>

        {showAdvancedFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Department</label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                disabled={isDepartmentLocked}
                className="border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 disabled:opacity-70"
              >
                {!isDepartmentLocked ? <option value="All">All</option> : null}
                {isDepartmentLocked && lockedDepartmentName ? (
                  <option value={lockedDepartmentName}>{lockedDepartmentName}</option>
                ) : departments.length > 0 ? (
                  departments.map((dept) => (
                    <option key={dept.id} value={dept.name}>
                      {dept.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Computer Science">Computer Science</option>
                    <option value="Software Engineering">Software Engineering</option>
                    <option value="Electrical Engineering">Electrical Engineering</option>
                  </>
                )}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Semester</label>
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700"
              >
                <option value="All">All</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                  <option key={sem} value={sem}>{`Semester ${sem}`}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Campus Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700"
              >
                <option value="All">All</option>
                <option value="Day Scholar">Day Scholar</option>
                <option value="Hosteller">Hosteller</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Face Biometrics</label>
              <select
                value={selectedBiometrics}
                onChange={(e) => setSelectedBiometrics(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700"
              >
                <option value="All">All</option>
                <option value="Enrolled">Enrolled</option>
                <option value="Missing">Missing</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>{viewArchived ? "Viewing archived students" : "Viewing active students"}</span>
          <button
            type="button"
            className="font-bold text-emerald-600"
            onClick={() => setViewArchived((prev) => !prev)}
          >
            {viewArchived ? "Switch to active" : "Switch to archived"}
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>{totalCount} records</span>
          <span>| Page {page} of {pageCount}</span>
        </div>
      </div>

      <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-sm">
        <table className="min-w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide text-[10px] font-bold">
            <tr>
              <th className="px-4 py-3">Roll</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Semester</th>
              <th className="px-4 py-3">Campus Status</th>
              <th className="px-4 py-3">Face Enrolled</th>
              <th className="px-4 py-3">Contact</th>
              {canManageStudents && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {isLoading ? (
              <tr>
                <td colSpan={canManageStudents ? 8 : 7} className="px-4 py-10 text-center text-slate-400">
                  Loading student records...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={canManageStudents ? 8 : 7} className="px-4 py-10 text-center text-rose-600">
                  {error}
                </td>
              </tr>
            ) : displayedStudents.length === 0 ? (
              <tr>
                <td colSpan={canManageStudents ? 8 : 7} className="px-4 py-10 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="w-8 h-8 text-slate-300" />
                    <span>No students matched the current search and filters.</span>
                  </div>
                </td>
              </tr>
            ) : (
              displayedStudents.map((student) => (
                <tr key={student.roll_no} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-800">{student.roll_no}</td>
                  <td className="px-4 py-3">{student.name}</td>
                  <td className="px-4 py-3">{student.department}</td>
                  <td className="px-4 py-3">Sem {student.semester}</td>
                  <td className="px-4 py-3">{student.campus_status === "DAY_SCHOLAR" ? "Day Scholar" : "Hosteller"}</td>
                  <td className="px-4 py-3">
                    {student.face_enrolled ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">Enrolled</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">Missing</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{student.email || student.phone || "—"}</td>
                  {canManageStudents && (
                    <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                      {!student.is_archived ? (
                        <>
                          <button
                            onClick={() => handleOpenEditModal(student)}
                            className="p-1 hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 rounded transition-all"
                            title="Edit Student"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleArchiveStudent(student.roll_no)}
                            className="p-1 hover:bg-rose-50 text-slate-500 hover:text-rose-700 rounded transition-all"
                            title="Archive Student"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleRestoreStudent(student.roll_no)}
                          className="p-1 hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 rounded transition-all"
                          title="Restore Student"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            Previous
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100"
            disabled={page >= pageCount || isLoading}
            onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
          >
            Next
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span>Page size</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-2 py-2 text-xs"
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">
                {editingStudent ? "Edit Student Profile" : "Add New Student"}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Student ID</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingStudent || isSaving}
                    value={formData.roll_no}
                    onChange={(e) => setFormData(prev => ({ ...prev, roll_no: e.target.value }))}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Full Name</label>
                  <input
                    type="text"
                    required
                    disabled={isSaving}
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Department</label>
                  <select
                    disabled={isSaving || isDepartmentLocked}
                    value={formData.department}
                    onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700"
                  >
                    {isDepartmentLocked && lockedDepartmentName ? (
                      <option value={lockedDepartmentName}>{lockedDepartmentName}</option>
                    ) : departments.length > 0 ? (
                      departments.map((dept) => (
                        <option key={dept.id} value={dept.name}>
                          {dept.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Computer Science">Computer Science</option>
                        <option value="Software Engineering">Software Engineering</option>
                        <option value="Electrical Engineering">Electrical Engineering</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Campus Status</label>
                  <select
                    disabled={isSaving}
                    value={formData.campus_status}
                    onChange={(e) => setFormData(prev => ({ ...prev, campus_status: e.target.value as any }))}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700"
                  >
                    <option value="DAY_SCHOLAR">Day Scholar</option>
                    <option value="HOSTELLER">Hosteller</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Academic Year</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    required
                    disabled={isSaving}
                    value={formData.year}
                    onChange={(e) => setFormData(prev => ({ ...prev, year: Number(e.target.value) }))}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Semester</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    required
                    disabled={isSaving}
                    value={formData.semester}
                    onChange={(e) => setFormData(prev => ({ ...prev, semester: Number(e.target.value) }))}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Date of Birth</label>
                  <input
                    type="date"
                    required
                    disabled={isSaving}
                    value={formData.dob}
                    onChange={(e) => setFormData(prev => ({ ...prev, dob: e.target.value }))}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Phone Number</label>
                  <input
                    type="text"
                    required
                    placeholder="+91 9999999999"
                    disabled={isSaving}
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Email Address</label>
                <input
                  type="email"
                  disabled={isSaving}
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Login Password {editingStudent && <span className="text-[9px] text-slate-400 font-medium normal-case">(leave blank to keep unchanged)</span>}
                </label>
                <input
                  type="password"
                  required={!editingStudent}
                  disabled={isSaving}
                  value={formData.login_password}
                  placeholder={editingStudent ? "••••••••" : ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, login_password: e.target.value }))}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Address</label>
                <textarea
                  disabled={isSaving}
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  rows={2}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="face_enrolled"
                  disabled={isSaving}
                  checked={formData.face_enrolled}
                  onChange={(e) => setFormData(prev => ({ ...prev, face_enrolled: e.target.checked }))}
                  className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                />
                <label htmlFor="face_enrolled" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Face Biometrics Enrolled
                </label>
              </div>

              {formError && (
                <p className="text-xs text-rose-600 font-semibold bg-rose-50 px-3 py-2 rounded-lg">
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-md transition-all"
                >
                  {isSaving ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
