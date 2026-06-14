import React, { useState, useEffect, useMemo } from "react"
import { 
  Plus, 
  Building, 
  Tag, 
  User, 
  AlertCircle, 
  Edit, 
  X, 
  Calendar, 
  Clock,
  Printer,
  ShieldCheck,
  ShieldAlert,
  Activity,
  CheckCircle2
} from "lucide-react"
import { API_BASE, apiFetch } from "../../../lib/api"
import { useAuth } from "../../../context/AuthContext"
import { isAdminRole, isFacultyRole, isHodRole } from "../../../lib/roles"
import { useHodContext } from "../../../hooks/useHodContext"
import { useFacultyContext } from "../../../hooks/useFacultyContext"
import { HodDepartmentBanner } from "../../admin/components/HodDepartmentBanner"

interface Faculty {
  scode: string
  name: string
  dept: string
}

interface Subject {
  code: string
  name: string
  credits: number
  semester: number
  department: string
  facultyScode?: string
}

interface DaySchedule {
  id?: string
  entryIds?: Record<number, string>
  day: string
  department: string
  semester: number
  period_1: string
  period_2: string
  period_3: string
  period_4: string
  period_5: string
  period_6: string
  period_7: string
}

interface TimetableConflict {
  type: "FACULTY_CLASH" | "WORKLOAD_OVERLOAD" | "UNASSIGNED_SUBJECT"
  day: string
  period: string
  message: string
  severity: "CRITICAL" | "WARNING"
}

const DAYS_OF_WEEK = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
const PERIODS = ["I", "II", "III", "IV", "V", "VI", "VII"]

export const Timetable: React.FC = () => {
  const { user } = useAuth()
  const isAdmin = isAdminRole(user?.role)
  const isHod = isHodRole(user?.role)
  const canManageTimetable = isAdmin || isFacultyRole(user?.role)
  const isFaculty = isFacultyRole(user?.role)
  const hodCtx = useHodContext(isHod ? user?.role : null)
  const facCtx = useFacultyContext(isFaculty ? user?.role : null)

  const department = isHod ? hodCtx.department : (isFaculty ? facCtx.department : null)
  const departmentLocked = isHod ? hodCtx.departmentLocked : (isFaculty ? facCtx.departmentLocked : false)
  const lockedDepartmentName = department?.name

  const [schedules, setSchedules] = useState<DaySchedule[]>([])
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([])
  const [availableFaculty, setAvailableFaculty] = useState<Faculty[]>([])
  const [activeConflicts, setActiveConflicts] = useState<TimetableConflict[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [rawDataCount, setRawDataCount] = useState(0)
  const [rawDetailsMap, setRawDetailsMap] = useState<Record<string, { code: string, name: string, faculty: string, facultyScode: string }>>({})

  // Roster display filter states
  const [filterDept, setFilterDept] = useState("")
  const [filterSemester, setFilterSemester] = useState(1)

  // Primary timetable tab: "weekly" vs "monthly"
  const [timetableTab, setTimetableTab] = useState<"weekly" | "monthly">("weekly")
  
  // Selected day for monthly detailed inspect
  const [selectedMonthDay, setSelectedMonthDay] = useState<number | null>(null)

  // Modals state
  const [activeModal, setActiveModal] = useState<"none" | "add" | "edit" | "delete" | "conflicts">("none")
  const [selectedSchedule, setSelectedSchedule] = useState<DaySchedule | null>(null)

  // Form input states
  const [formDay, setFormDay] = useState("MONDAY")
  const [formDept, setFormDept] = useState("")
  const [formSemester, setFormSemester] = useState(1)
  
  const [p1, setP1] = useState("FREE")
  const [p2, setP2] = useState("FREE")
  const [p3, setP3] = useState("FREE")
  const [p4, setP4] = useState("FREE")
  const [p5, setP5] = useState("FREE")
  const [p6, setP6] = useState("FREE")
  const [p7, setP7] = useState("FREE")

  // Load schedules, subjects, faculty and backend clashes
  const loadData = async () => {
    setLoading(true)
    try {
      const timetableData = await apiFetch<any[]>("/timetable/")
      setRawDataCount(timetableData.length)
      const subjectsData = await apiFetch<any[]>("/subjects/")
      const staffData = await apiFetch<any[]>("/staff/")
      const deptsData = await apiFetch<any>("/departments/?page_size=200").catch(() => [])

      const tempDetailsMap: Record<string, { code: string, name: string, faculty: string, facultyScode: string }> = {}
      const groupedSchedules = new Map<string, DaySchedule>()
      timetableData.forEach((item: any) => {
        const subCode = item.subject_code ?? item.subject?.subject_code
        if (subCode) {
          tempDetailsMap[subCode] = {
            code: subCode,
            name: item.subject_name ?? item.subject?.name ?? "Unknown",
            faculty: item.faculty_name ?? "Unassigned",
            facultyScode: item.faculty_code ?? ""
          }
        }

        const departmentName = item.department_name ?? item.department
        const semesterNumber = item.semester_number ?? item.semester
        const key = `${item.day}-${departmentName}-${semesterNumber}`
        const schedule = groupedSchedules.get(key) ?? {
          id: key,
          entryIds: {},
          day: item.day,
          department: departmentName,
          semester: semesterNumber,
          period_1: "FREE",
          period_2: "FREE",
          period_3: "FREE",
          period_4: "FREE",
          period_5: "FREE",
          period_6: "FREE",
          period_7: "FREE"
        }
        const periodNumber = Number(item.period)
        if (periodNumber >= 1 && periodNumber <= 7) {
          schedule[`period_${periodNumber}` as keyof DaySchedule] = item.subject_code ?? item.subject?.subject_code ?? "FREE"
          schedule.entryIds = { ...(schedule.entryIds ?? {}), [periodNumber]: item.id }
        }
        groupedSchedules.set(key, schedule)
      })
      const mappedSchedules = Array.from(groupedSchedules.values())

      const mappedSubjects: Subject[] = subjectsData.map((s: any) => ({
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
        dept: item.department_name ?? item.department
      }))

      const deptsList = deptsData.results || deptsData || []
      setDepartments(deptsList)

      setRawDetailsMap(tempDetailsMap)
      setSchedules(mappedSchedules)
      setAvailableSubjects(mappedSubjects)
      setAvailableFaculty(mappedFaculty)
      setError("")
      
      // Fetch backend conflicts
      await loadConflicts()
    } catch (err: any) {
      console.error(err)
      setError(err.message || "Failed to load timetable records.")
    } finally {
      setLoading(false)
    }
  }

  const loadConflicts = async () => {
    try {
      const res = await apiFetch<any>("/timetable/detect-clashes/")
      const list: TimetableConflict[] = []
      
      if (res.clashes) {
        if (res.clashes.faculty_clashes) {
          res.clashes.faculty_clashes.forEach((c: any) => {
            list.push({
              type: "FACULTY_CLASH",
              day: c.day,
              period: c.period,
              message: c.message,
              severity: "CRITICAL"
            })
          })
        }
        if (res.clashes.workload_warnings) {
          res.clashes.workload_warnings.forEach((c: any) => {
            list.push({
              type: "WORKLOAD_OVERLOAD",
              day: c.day,
              period: c.period || "All Day",
              message: c.message,
              severity: "WARNING"
            })
          })
        }
        if (res.clashes.unassigned_warnings) {
          res.clashes.unassigned_warnings.forEach((c: any) => {
            list.push({
              type: "UNASSIGNED_SUBJECT",
              day: c.day,
              period: c.period,
              message: c.message,
              severity: "WARNING"
            })
          })
        }
      }
      setActiveConflicts(list)
    } catch (err) {
      console.error("Failed to load conflicts from backend", err)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (departmentLocked && lockedDepartmentName) {
      setFilterDept(lockedDepartmentName)
      setFormDept(lockedDepartmentName)
    } else if (!departmentLocked && departments.length > 0) {
      setFilterDept(prev => prev || departments[0].name)
      setFormDept(prev => prev || departments[0].name)
    }
  }, [departmentLocked, lockedDepartmentName, departments])

  // Filter available subjects based on form values
  const formFilteredSubjects = useMemo(() => {
    return availableSubjects.filter(
      sub => sub.department === formDept && sub.semester === formSemester
    )
  }, [availableSubjects, formDept, formSemester])

  // Open actions
  const handleOpenAdd = () => {
    setFormDay("MONDAY")
    setFormDept(filterDept)
    setFormSemester(filterSemester)
    setP1("FREE")
    setP2("FREE")
    setP3("FREE")
    setP4("FREE")
    setP5("FREE")
    setP6("FREE")
    setP7("FREE")
    setActiveModal("add")
  }

  const handleOpenEdit = (sch: DaySchedule) => {
    setSelectedSchedule(sch)
    setFormDay(sch.day)
    setFormDept(sch.department)
    setFormSemester(sch.semester)
    setP1(sch.period_1)
    setP2(sch.period_2)
    setP3(sch.period_3)
    setP4(sch.period_4)
    setP5(sch.period_5)
    setP6(sch.period_6)
    setP7(sch.period_7)
    setActiveModal("edit")
  }

  const handleOpenDelete = (sch: DaySchedule) => {
    setSelectedSchedule(sch)
    setActiveModal("delete")
  }

  // Helper: Retrieve subject and designated faculty details
  const getSlotDetails = (code: string) => {
    if (code === "FREE") return null
    const sub = availableSubjects.find(s => s.code === code)
    if (sub) {
      const fac = availableFaculty.find(f => f.scode === sub.facultyScode)
      return {
        code: sub.code,
        name: sub.name,
        faculty: fac ? fac.name : "Unassigned",
        facultyScode: sub.facultyScode || ""
      }
    }
    // Fallback: look up in rawDetailsMap built from initial timetable fetch
    const rawDetail = rawDetailsMap[code]
    if (rawDetail) {
      return rawDetail
    }
    return { code, name: "Unknown", faculty: null, facultyScode: "" }
  }

  // Submit Handlers with auto validation checks
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canManageTimetable) {
      alert("Unauthorized to perform this action.")
      return
    }

    const payload = {
      day: formDay,
      programme: formDept,
      department: formDept,
      semester: formSemester,
      period_1: p1 === "FREE" ? null : p1,
      period_2: p2 === "FREE" ? null : p2,
      period_3: p3 === "FREE" ? null : p3,
      period_4: p4 === "FREE" ? null : p4,
      period_5: p5 === "FREE" ? null : p5,
      period_6: p6 === "FREE" ? null : p6,
      period_7: p7 === "FREE" ? null : p7
    }

    try {
      await apiFetch("/timetable/", {
        method: "POST",
        body: payload
      })
      alert("Timetable entry created successfully!")
      setActiveModal("none")
      loadData()
    } catch (err: any) {
      alert(err.message || "Failed to create timetable entry.")
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSchedule) return
    if (!canManageTimetable) {
      alert("Unauthorized to perform this action.")
      return
    }

    const payload = {
      day: selectedSchedule.day,
      programme: selectedSchedule.department,
      department: selectedSchedule.department,
      semester: selectedSchedule.semester,
      period_1: p1 === "FREE" ? null : p1,
      period_2: p2 === "FREE" ? null : p2,
      period_3: p3 === "FREE" ? null : p3,
      period_4: p4 === "FREE" ? null : p4,
      period_5: p5 === "FREE" ? null : p5,
      period_6: p6 === "FREE" ? null : p6,
      period_7: p7 === "FREE" ? null : p7
    }

    try {
      await apiFetch("/timetable/", {
        method: "POST",
        body: payload
      })
      alert("Timetable entry updated successfully!")
      setActiveModal("none")
      loadData()
    } catch (err: any) {
      alert(err.message || "Failed to update timetable entry.")
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedSchedule) return
    if (!canManageTimetable) {
      alert("Unauthorized to perform this action.")
      return
    }

    try {
      const ids = Object.values(selectedSchedule.entryIds ?? {})
      await Promise.all(ids.map(id => apiFetch(`/timetable/${id}/`, { method: "DELETE" })))
      alert("Timetable entry deleted successfully!")
      setActiveModal("none")
      loadData()
    } catch (err: any) {
      alert(err.message || "Failed to delete timetable entry.")
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownload = () => {
    window.open(`${API_BASE}/timetable/export-pdf/`, "_blank", "noopener,noreferrer")
  }

  // Monthly days mapper helper
  const getMonthDayClassCount = (dayNumber: number) => {
    const weekDays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
    const targetDay = weekDays[dayNumber % 6]
    return schedules.filter(s => s.day === targetDay && s.department === filterDept && s.semester === filterSemester).length
  }

  const getMonthDaySlotDetails = (dayNumber: number) => {
    const weekDays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
    const targetDay = weekDays[dayNumber % 6]
    return schedules.find(s => s.day === targetDay && s.department === filterDept && s.semester === filterSemester)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] w-full p-8 space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 font-medium text-sm animate-pulse">Loading timetable system...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-250 text-red-800 rounded-xl p-5 flex flex-col items-center justify-center space-y-3">
        <AlertCircle className="w-8 h-8 text-red-650" />
        <h4 className="font-bold text-sm">Error Loading Timetables</h4>
        <p className="text-xs text-red-600">{error}</p>
        <button onClick={loadData} className="px-4 py-2 bg-red-650 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-all">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 print:bg-white print:p-0">
      {isHod ? <HodDepartmentBanner /> : null}
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Timetable Configuration Engine</h2>
          <p className="text-xs text-slate-400">Map hourly classroom rosters, analyze faculty clashes in real-time, and format weekly grids.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveModal("conflicts")}
            className={`flex items-center justify-center gap-1.5 px-3.5 py-2 border rounded-lg text-xs font-bold shadow-sm transition-all ${
              activeConflicts.some(c=>c.severity==="CRITICAL") 
                ? "bg-rose-50 border-rose-250 text-rose-700 animate-pulse" 
                : activeConflicts.length > 0 
                ? "bg-amber-50 border-amber-250 text-amber-700"
                : "bg-emerald-50 border-emerald-250 text-emerald-700"
            }`}
          >
            {activeConflicts.some(c=>c.severity==="CRITICAL") ? (
              <ShieldAlert className="w-4 h-4 text-rose-600" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            )}
            Conflicts Status: {activeConflicts.length} Active
          </button>
          
          <button 
            onClick={handlePrint}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 border border-slate-205 bg-white hover:bg-slate-50 text-slate-705 rounded-lg text-xs font-bold shadow-sm transition-all"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            Print View
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 border border-slate-205 bg-white hover:bg-slate-50 text-slate-705 rounded-lg text-xs font-bold shadow-sm transition-all"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            Download PDF
          </button>
          
          {canManageTimetable && (
            <button 
              onClick={handleOpenAdd}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Day Schedule
            </button>
          )}
        </div>
      </div>

      <div className="hidden print:block print:mb-4">
        <h1 className="text-lg font-black text-slate-900">HexaAttender Course Calendar Timetable</h1>
        <p className="text-xs text-slate-505">Cohort: **{filterDept}** • Semester **{filterSemester}** • Updated: {new Date().toLocaleDateString()}</p>
      </div>

      <div className="flex border-b border-slate-200 gap-6 print:hidden">
        <button 
          onClick={() => setTimetableTab("weekly")}
          className={`pb-3 text-xs font-bold transition-all relative ${timetableTab === "weekly" ? "text-emerald-600" : "text-slate-400 hover:text-slate-650"}`}
        >
          Weekly Roster Grid
          {timetableTab === "weekly" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-600 rounded-full" />}
        </button>
        <button 
          onClick={() => setTimetableTab("monthly")}
          className={`pb-3 text-xs font-bold transition-all relative ${timetableTab === "monthly" ? "text-emerald-600" : "text-slate-400 hover:text-slate-655"}`}
        >
          Monthly Academic Calendar
          {timetableTab === "monthly" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-600 rounded-full" />}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm print:hidden">
        <div className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg bg-slate-50/50 flex-1 sm:flex-none">
          <Building className="w-4 h-4 text-slate-400" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden md:inline">Dept:</span>
          <select 
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            disabled={departmentLocked}
            className="bg-transparent text-xs text-slate-700 font-bold focus:outline-none w-full disabled:opacity-70"
          >
            {departmentLocked && lockedDepartmentName ? (
              <option value={lockedDepartmentName}>{lockedDepartmentName}</option>
            ) : (
              departments.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg bg-slate-50/50 flex-1 sm:flex-none">
          <Tag className="w-4 h-4 text-slate-400" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden md:inline">Semester:</span>
          <select 
            value={filterSemester}
            onChange={(e) => setFilterSemester(parseInt(e.target.value))}
            className="bg-transparent text-xs text-slate-700 font-bold focus:outline-none w-full"
          >
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

        <div className="flex-1 flex justify-end items-center text-[10px] text-slate-400 font-semibold px-2">
          Class: {filterDept} • Semester {filterSemester}
        </div>
      </div>

      {timetableTab === "weekly" && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden print:border-none print:shadow-none animate-in fade-in duration-200">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider print:bg-white">
                  <th className="px-6 py-4 w-28">Day of Week</th>
                  {PERIODS.map(p => (
                    <th key={p} className="px-4 py-4 text-center min-w-[125px]">Period {p}</th>
                  ))}
                  <th className="px-6 py-4 text-right w-24 print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {DAYS_OF_WEEK.map((day) => {
                  const sch = schedules.find(
                    s => s.day === day && 
                         s.department === filterDept && 
                         s.semester === filterSemester
                  )

                  return (
                    <tr key={day} className="hover:bg-slate-50/50 transition-all">
                      <td className="px-6 py-5 font-bold text-slate-900 border-r border-slate-100 bg-slate-50/20">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {day}
                        </div>
                      </td>
                      
                      {[1, 2, 3, 4, 5, 6, 7].map((num) => {
                        const key = `period_${num}` as keyof DaySchedule
                        const val = sch ? sch[key] as string : "FREE"
                        const details = getSlotDetails(val)

                        return (
                          <td key={num} className="px-3 py-4 text-center">
                            {details ? (
                              <div className="bg-emerald-50/60 border border-emerald-150 rounded-lg p-2.5 space-y-1.5 shadow-sm min-w-[115px] animate-in fade-in duration-150">
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9px] font-bold uppercase tracking-wider block mx-auto w-max">
                                  {details.code}
                                </span>
                                <span className="block font-bold text-slate-800 text-[10px] truncate max-w-[120px]" title={details.name}>
                                  {details.name}
                                </span>
                                <span className="text-[9px] text-slate-400 font-semibold flex items-center justify-center gap-1">
                                  <User className="w-2.5 h-2.5 text-slate-400" />
                                  {details.faculty}
                                </span>
                              </div>
                            ) : (
                              <div className="bg-slate-50/50 border border-dashed border-slate-200 rounded-lg py-3.5 text-slate-300 text-[10px] font-bold min-w-[115px]">
                                FREE SLOT
                              </div>
                            )}
                          </td>
                        )
                      })}

                      <td className="px-6 py-5 text-right font-semibold border-l border-slate-100 print:hidden whitespace-nowrap">
                        {sch ? (
                          <div className="flex justify-end gap-1.5">
                            {canManageTimetable && (
                              <>
                                <button 
                                  onClick={() => handleOpenEdit(sch)}
                                  className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md transition-all flex items-center justify-center"
                                  title="Edit Daily Slots"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => handleOpenDelete(sch)}
                                  className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md transition-all flex items-center justify-center"
                                  title="Remove Day Schedule"
                                >
                                  <X className="w-3.5 h-3.5 text-rose-600" />
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          canManageTimetable && (
                            <button 
                              onClick={() => {
                                handleOpenAdd()
                                setFormDay(day)
                              }}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-650 border border-slate-200 rounded text-[10px] font-bold transition-all"
                            >
                              Configure
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {timetableTab === "monthly" && (
        <div className="grid md:grid-cols-3 gap-6 animate-in fade-in duration-200 print:hidden">
          <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600" />
                Academic Month Roster
              </span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">May 2026</span>
            </div>

            <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-bold text-slate-400 uppercase mb-2">
              <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 30 }).map((_, index) => {
                const dayNum = index + 1
                const activeClassesCount = getMonthDayClassCount(dayNum)
                const isSelected = selectedMonthDay === dayNum

                return (
                  <button 
                    key={index}
                    onClick={() => setSelectedMonthDay(dayNum)}
                    className={`h-14 rounded-lg border p-1 text-left flex flex-col justify-between transition-all ${
                      isSelected 
                        ? "bg-emerald-50/50 border-emerald-400 ring-1 ring-emerald-400" 
                        : "bg-slate-50/50 border-slate-150 hover:border-slate-200"
                    }`}
                  >
                    <span className="text-[9px] font-black text-slate-400">{dayNum}</span>
                    {activeClassesCount > 0 && (
                      <span className="px-1 py-0.5 bg-emerald-600 text-white rounded-[3px] text-[8px] font-black w-max leading-none">
                        {activeClassesCount} Scheduled
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block border-b border-slate-100 pb-2">
                Selected Day Roster DETAILS
              </span>

              {selectedMonthDay ? (
                (() => {
                  const sch = getMonthDaySlotDetails(selectedMonthDay)
                  const weekDays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
                  const dayName = weekDays[selectedMonthDay % 6]

                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-800">Day: {dayName}</span>
                        <span className="text-slate-400">May {selectedMonthDay}, 2026</span>
                      </div>

                      {sch ? (
                        <div className="space-y-2">
                          <span className="text-[9px] text-slate-400 font-bold block uppercase">Marked Class Slots:</span>
                          
                          {PERIODS.map((p, idx) => {
                            const key = `period_${idx+1}` as keyof DaySchedule
                            const val = sch[key] as string
                            const details = getSlotDetails(val)

                            return (
                              <div key={p} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded text-[10px]">
                                <span className="font-extrabold text-slate-500">Period {p}</span>
                                {details ? (
                                  <div className="text-right">
                                    <span className="font-bold text-emerald-800">{details.code}</span>
                                    <span className="block text-[9px] text-slate-400 font-semibold">{details.faculty}</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-300 italic">FREE SLOT</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 font-semibold italic py-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                          No schedules configured for {dayName}.
                        </div>
                      )}
                    </div>
                  )
                })()
              ) : (
                <div className="text-xs text-slate-400 font-semibold italic py-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                  Select an active day from the calendar month to display hourly mappings.
                </div>
              )}
            </div>

            {canManageTimetable && selectedMonthDay && getMonthDaySlotDetails(selectedMonthDay) && (
              <button 
                onClick={() => {
                  const sch = getMonthDaySlotDetails(selectedMonthDay)
                  if (sch) handleOpenEdit(sch)
                }}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
              >
                Modify Selected Day Schedule
              </button>
            )}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------
          MODAL A: REAL-TIME TIMETABLE CONFLICT SWEEPER
          ---------------------------------------------------------------------- */}
      {activeModal === "conflicts" && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Activity className="w-5 h-5 text-emerald-600" />
                  Timetable Conflict Validator
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Scans all scheduled period slots automatically for overlaps and warnings.</p>
              </div>
              <button 
                onClick={() => setActiveModal("none")} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 max-h-[300px] overflow-y-auto space-y-3">
              {activeConflicts.length === 0 ? (
                <div className="p-6 bg-emerald-50 border border-emerald-250 text-emerald-800 rounded-xl text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">Timetable 100% Valid!</h4>
                  <p className="text-[10px] text-emerald-600 font-semibold leading-relaxed">
                    Zero faculty clashes, workload overflows, or unassigned periods detected. Timetable is completely safe.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Validation Anomalies</span>
                  {activeConflicts.map((c, index) => (
                    <div 
                      key={index} 
                      className={`p-3 border rounded-xl flex items-start gap-2.5 text-xs font-medium ${
                        c.severity === "CRITICAL" 
                          ? "bg-rose-50/50 border-rose-200 text-rose-900" 
                          : "bg-amber-50/50 border-amber-200 text-amber-900"
                      }`}
                    >
                      {c.severity === "CRITICAL" ? (
                        <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <span className="font-extrabold uppercase block text-[9px] tracking-wider mb-0.5">
                          {c.type.replace(/_/g, " ")} ({c.severity})
                        </span>
                        <p className="leading-relaxed text-slate-700">{c.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setActiveModal("none")}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-950 transition-all"
              >
                Close Validator
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------
          MODAL B: CREATE DAY SCHEDULE (ADD)
          ---------------------------------------------------------------------- */}
      {activeModal === "add" && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-5 h-5 text-emerald-600" />
                  Create Day Schedule
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Map curriculum slots for the target class cohort and department</p>
              </div>
              <button 
                onClick={() => setActiveModal("none")} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Day</label>
                  <select 
                    value={formDay}
                    onChange={(e) => setFormDay(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {DAYS_OF_WEEK.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Department</label>
                  <select 
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Semester</label>
                  <select 
                    value={formSemester}
                    onChange={(e) => setFormSemester(parseInt(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
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

              <div className="space-y-2.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Period Hourly Allocations</span>
                <div className="grid grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
                  {[
                    { label: "Period I (08:30 - 09:30)", state: p1, setter: setP1 },
                    { label: "Period II (09:30 - 10:30)", state: p2, setter: setP2 },
                    { label: "Period III (10:30 - 11:30)", state: p3, setter: setP3 },
                    { label: "Period IV (11:30 - 12:30)", state: p4, setter: setP4 },
                    { label: "Period V (13:30 - 14:30)", state: p5, setter: setP5 },
                    { label: "Period VI (14:30 - 15:30)", state: p6, setter: setP6 },
                    { label: "Period VII (15:30 - 16:30)", state: p7, setter: setP7 }
                  ].map((pInfo, index) => (
                    <div key={index} className="space-y-1">
                      <label className="block text-[9px] font-bold text-slate-400">{pInfo.label}</label>
                      <select 
                        value={pInfo.state}
                        onChange={(e) => pInfo.setter(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                      >
                        <option value="FREE">-- FREE SLOT --</option>
                        {formFilteredSubjects.map(sub => (
                          <option key={sub.code} value={sub.code}>{sub.code} - {sub.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
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
                  Create Day Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------
          MODAL C: EDIT DAY SCHEDULE (EDIT)
          ---------------------------------------------------------------------- */}
      {activeModal === "edit" && selectedSchedule && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-5 h-5 text-emerald-600" />
                  Edit Day Schedule
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Modify curriculum hourly slots for **{selectedSchedule.day}**</p>
              </div>
              <button 
                onClick={() => setActiveModal("none")} 
                className="text-slate-400 hover:text-slate-655"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 cursor-not-allowed">
                <div>
                  <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Target Day</span>
                  <span className="block px-2.5 py-1.5 bg-slate-200 rounded-lg text-slate-500">{formDay}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-slate-455 uppercase tracking-wider mb-1">Department</span>
                  <span className="block px-2.5 py-1.5 bg-slate-200 rounded-lg text-slate-500">{formDept}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-slate-455 uppercase tracking-wider mb-1">Semester</span>
                  <span className="block px-2.5 py-1.5 bg-slate-200 rounded-lg text-slate-500">Semester {formSemester}</span>
                </div>
              </div>

              <div className="space-y-2.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Period Hourly Allocations</span>
                <div className="grid grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
                  {[
                    { label: "Period I (08:30 - 09:30)", state: p1, setter: setP1 },
                    { label: "Period II (09:30 - 10:30)", state: p2, setter: setP2 },
                    { label: "Period III (10:30 - 11:30)", state: p3, setter: setP3 },
                    { label: "Period IV (11:30 - 12:30)", state: p4, setter: setP4 },
                    { label: "Period V (13:30 - 14:30)", state: p5, setter: setP5 },
                    { label: "Period VI (14:30 - 15:30)", state: p6, setter: setP6 },
                    { label: "Period VII (15:30 - 16:30)", state: p7, setter: setP7 }
                  ].map((pInfo, index) => (
                    <div key={index} className="space-y-1">
                      <label className="block text-[9px] font-bold text-slate-400">{pInfo.label}</label>
                      <select 
                        value={pInfo.state}
                        onChange={(e) => pInfo.setter(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                      >
                        <option value="FREE">-- FREE SLOT --</option>
                        {formFilteredSubjects.map(sub => (
                          <option key={sub.code} value={sub.code}>{sub.code} - {sub.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
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
                  Save Schedule Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------
          MODAL D: DELETE CONFIRMATION
          ---------------------------------------------------------------------- */}
      {activeModal === "delete" && selectedSchedule && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 flex-shrink-0 flex items-center justify-center text-rose-600">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800">Confirm Schedule Deletion?</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Are you sure you want to delete the **{selectedSchedule.day}** schedule configuration for **{selectedSchedule.department} Semester {selectedSchedule.semester}**? This will set all period slots to **FREE** and cannot be undone.
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
                Delete Timetable Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
