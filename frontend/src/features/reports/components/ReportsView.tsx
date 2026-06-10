import React from "react"
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  FileText,
  Calendar,
  Building,
  User,
  TrendingUp,
  BarChart3,
  Loader2,
  Briefcase
} from "lucide-react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  Cell,
  Legend,
  PieChart as RechartsPie,
  Pie
} from "recharts"
import { useAuth } from "../../../context/AuthContext"
import { isFacultyRole } from "../../../lib/roles"
import { useFacultyContext } from "../../../hooks/useFacultyContext"
import { FacultyScopeBanner } from "../../staff/components/FacultyScopeBanner"
import { useEnterpriseReports } from "../hooks/useEnterpriseReports"
import { ReportFiltersPanel } from "./ReportFiltersPanel"
import { ExportJobPanel } from "./ExportJobPanel"
import type { ReportTab } from "../types"

// ---------------------------------------------------------------------------
// Config & Types
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Badge Components
// ---------------------------------------------------------------------------

const StatusCell: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    PRESENT: "bg-emerald-500 text-white",
    ABSENT: "bg-rose-500 text-white",
    LATE: "bg-amber-500 text-white",
    EXCUSED: "bg-indigo-500 text-white"
  }
  const display = status ? status[0] : "P"
  return (
    <span className={`inline-block w-6 h-5 rounded text-center text-[10px] font-extrabold leading-5 transition-all shadow-sm hover:scale-105 ${map[status] || "bg-emerald-500 text-white"}`}>
      {display}
    </span>
  )
}

const PercentBadge: React.FC<{ value: number }> = ({ value }) => (
  <span className={`font-extrabold text-xs px-2 py-0.5 rounded-full ${
    value >= 85 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : 
    value >= 75 ? "bg-amber-50 text-amber-700 border border-amber-200" : 
    "bg-rose-50 text-rose-700 border border-rose-200"
  }`}>
    {value}%
  </span>
)

const CHART_COLORS = ["#10B981", "#EF4444", "#F59E0B", "#6366F1", "#EC4899", "#8B5CF6", "#06B6D4"]

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const ReportsView: React.FC = () => {
  const { user } = useAuth()
  const isFaculty = isFacultyRole(user?.role)
  useFacultyContext(user?.role)

  const {
    activeTab,
    setActiveTab,
    filters,
    updateFilter,
    meta,
    reportData,
    history,
    loading,
    error,
    exportStatus,
    exportingFormat,
    runExport,
  } = useEnterpriseReports("daily")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dailyReport: any = activeTab === "daily" ? reportData : null
  const weeklyReport: any = activeTab === "weekly" ? reportData : null
  const monthlyReport: any = activeTab === "monthly" ? reportData : null
  const semesterReport: any = activeTab === "semester" ? reportData : null
  const departmentReport: any = activeTab === "department" ? reportData : null
  const facultyReport: any = activeTab === "faculty" ? reportData : null
  const studentReport: any = activeTab === "student" ? reportData : null
  const subjectReport: any = activeTab === "subject" ? reportData : null

  const handleExport = async (format: "pdf" | "excel" | "csv") => {
    try {
      await runExport(format)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Export failed."
      alert(message)
    }
  }

  const tabs: { key: ReportTab; label: string; icon: React.ElementType }[] = [
    { key: "daily", label: "Daily Report", icon: Calendar },
    { key: "weekly", label: "Weekly Report", icon: BarChart3 },
    { key: "monthly", label: "Monthly Report", icon: TrendingUp },
    { key: "semester", label: "Semester Report", icon: ShieldCheck },
    ...(isFaculty ? [] : [{ key: "department" as ReportTab, label: "Department Wise", icon: Building }]),
    { key: "faculty", label: isFaculty ? "My Workload" : "Faculty Workload", icon: Briefcase },
    { key: "student", label: "Student Wise", icon: User },
    { key: "subject", label: "Subject Wise", icon: FileText },
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {isFaculty ? <FacultyScopeBanner /> : null}
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Academic Reports</h2>
          <p className="text-xs text-slate-400">Generate, visualize, and export attendance analytics across all dimensions</p>
        </div>
        <ExportJobPanel
          history={history}
          exportStatus={exportStatus}
          exportingFormat={exportingFormat}
          onExport={handleExport}
          disabled={loading}
        />
      </div>

      <ReportFiltersPanel
        activeTab={activeTab}
        filters={filters}
        meta={meta}
        onChange={updateFilter}
        isFaculty={isFaculty}
      />

      {/* Tab Container */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {/* Tab Nav */}
        <div className="flex border-b border-slate-100 overflow-x-auto scrollbar-none">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 py-3.5 px-4 text-[11px] font-bold border-b-2 whitespace-nowrap transition-all ${
                  activeTab === tab.key
                    ? "border-emerald-600 text-emerald-700 bg-emerald-50/30"
                    : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Global Loading Spinner / Error Panel */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            <span className="text-xs font-semibold">Compiling database aggregations...</span>
          </div>
        )}

        {!loading && error && (
          <div className="p-6 m-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div>
              <h4 className="text-xs font-bold uppercase">Database Query Failed</h4>
              <p className="text-[11px] opacity-90 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* ================================================================
            TAB 1: DAILY REPORT
            ================================================================ */}
        {!loading && !error && activeTab === "daily" && dailyReport && (
          <div className="p-6 space-y-5 animate-in fade-in duration-300">
            {/* Config */}
            <div className="flex items-center gap-3 flex-wrap bg-slate-50/50 p-4 border border-slate-100 rounded-xl">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Date</label>
                <input 
                  type="date" 
                  value={filters.date || ""} 
                  onChange={(e) => updateFilter({ date: e.target.value })}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm" 
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Subject</label>
                <select 
                  value={filters.subject_id || ""}
                  onChange={(e) => {
                    const sub = meta?.subjects.find((s) => s.id === e.target.value)
                    updateFilter({ subject_id: e.target.value, subject_code: sub?.subject_code })
                  }}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
                >
                  <option value="">All Assigned Subjects</option>
                  {(meta?.subjects || []).map((sub) => (
                    <option key={sub.id} value={sub.id}>{sub.subject_code} — {sub.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-1.5 ml-auto">
                <div className="px-4 py-2 bg-emerald-50/60 rounded-xl border border-emerald-100 text-center shadow-sm">
                  <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">Overall Attendance</span>
                  <span className="block text-base font-extrabold text-emerald-700">{dailyReport.summary?.overall_percentage || 0}%</span>
                </div>
                <div className="px-4 py-2 bg-slate-100/80 rounded-xl border border-slate-200 text-center shadow-sm">
                  <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">Total Headcount</span>
                  <span className="block text-base font-extrabold text-slate-700">{dailyReport.summary?.total_students || 0}</span>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-100 rounded-xl shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Roll No</th>
                    <th className="py-3 px-3">Name</th>
                    <th className="py-3 px-3">Department</th>
                    {["I", "II", "III", "IV", "V", "VI", "VII"].map(p => (
                      <th key={p} className="py-3 px-1.5 text-center">{p}</th>
                    ))}
                    <th className="py-3 px-4 text-right">Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs font-medium text-slate-700">
                  {dailyReport.data?.map((row: any) => (
                    <tr key={row.roll_no} className="hover:bg-slate-50/50 transition-all">
                      <td className="py-2.5 px-4 font-bold text-slate-950">{row.roll_no}</td>
                      <td className="py-2.5 px-3">{row.name}</td>
                      <td className="py-2.5 px-3 text-[10px] text-slate-400 font-bold uppercase">{row.department}</td>
                      {["I", "II", "III", "IV", "V", "VI", "VII"].map(p => (
                        <td key={p} className="py-2.5 px-1.5 text-center">
                          <StatusCell status={row.periods?.[p] || ""} />
                        </td>
                      ))}
                      <td className="py-2.5 px-4 text-right">
                        <PercentBadge value={row.attendance_percentage} />
                      </td>
                    </tr>
                  ))}
                  {(!dailyReport.data || dailyReport.data.length === 0) && (
                    <tr>
                      <td colSpan={12} className="py-10 text-center text-slate-400 font-semibold">No attendance entries recorded for this date.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================================
            TAB 2: WEEKLY REPORT
            ================================================================ */}
        {!loading && !error && activeTab === "weekly" && weeklyReport && (
          <div className="p-6 space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-3 flex-wrap bg-slate-50/50 p-4 border border-slate-100 rounded-xl">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Start Date</label>
                <input 
                  type="date" 
                  value={filters.start_date || ""} 
                  onChange={(e) => updateFilter({ start_date: e.target.value })}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm" 
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">End Date</label>
                <input 
                  type="date" 
                  value={filters.end_date || ""} 
                  onChange={(e) => updateFilter({ end_date: e.target.value })}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm" 
                />
              </div>
            </div>

            {/* Weekly Bar Chart */}
            <div className="bg-slate-50/40 border border-slate-200/60 rounded-2xl p-5 shadow-sm">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-500" /> Weekly Attendance Distribution
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={weeklyReport.chart_data || []} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", fontSize: "11px", fontWeight: 600, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "10px", fontWeight: 700, paddingTop: 10 }} />
                  <Bar dataKey="present" fill="#10B981" radius={[4, 4, 0, 0]} name="Credits Present/Late/Excused" />
                  <Bar dataKey="absent" fill="#EF4444" radius={[4, 4, 0, 0]} name="Absent count" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Students Summary Table */}
            <div className="overflow-x-auto border border-slate-100 rounded-xl shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Roll No</th>
                    <th className="py-3 px-3">Student Name</th>
                    <th className="py-3 px-3 text-center">Total Sessions</th>
                    <th className="py-3 px-3 text-center">Present</th>
                    <th className="py-3 px-3 text-center">Absent</th>
                    <th className="py-3 px-4 text-right">Attendance %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs font-medium text-slate-700">
                  {weeklyReport.data?.map((row: any) => (
                    <tr key={row.roll_no} className="hover:bg-slate-50/50 transition-all">
                      <td className="py-2.5 px-4 font-bold text-slate-950">{row.roll_no}</td>
                      <td className="py-2.5 px-3">{row.name}</td>
                      <td className="py-2.5 px-3 text-center">{row.summary?.total_periods}</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">{row.summary?.present_count}</td>
                      <td className="py-2.5 px-3 text-center text-rose-500">{row.summary?.absent_count}</td>
                      <td className="py-2.5 px-4 text-right">
                        <PercentBadge value={row.summary?.attendance_percentage} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================================
            TAB 3: MONTHLY REPORT
            ================================================================ */}
        {!loading && !error && activeTab === "monthly" && monthlyReport && (
          <div className="p-6 space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-3 flex-wrap bg-slate-50/50 p-4 border border-slate-100 rounded-xl">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Month</label>
                <select 
                  value={filters.month || ""}
                  onChange={(e) => updateFilter({ month: e.target.value })}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
                >
                  <option value="1">January</option>
                  <option value="2">February</option>
                  <option value="3">March</option>
                  <option value="4">April</option>
                  <option value="5">May</option>
                  <option value="6">June</option>
                  <option value="7">July</option>
                  <option value="8">August</option>
                  <option value="9">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Year</label>
                <select 
                  value={filters.year || ""}
                  onChange={(e) => updateFilter({ year: e.target.value })}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
                >
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                </select>
              </div>
            </div>

            {/* Monthly Area Chart */}
            <div className="bg-slate-50/40 border border-slate-200/60 rounded-2xl p-5 shadow-sm">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" /> Monthly Attendance Trend
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={monthlyReport.chart_data || []}>
                  <defs>
                    <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", fontSize: "11px", fontWeight: 600 }} />
                  <Legend wrapperStyle={{ fontSize: "10px", fontWeight: 700 }} />
                  <Area type="monotone" dataKey="percentage" stroke="#10B981" fill="url(#colorPresent)" strokeWidth={2.5} name="Attendance Rate %" />
                  <Area type="monotone" dataKey="present" stroke="#6366F1" fill="none" strokeWidth={1.5} name="Total Present Slots" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {monthlyReport.chart_data?.map((w: any) => (
                <div key={w.week} className="p-4 bg-white border border-slate-100 rounded-xl text-center shadow-sm hover:shadow transition-all border-l-4 border-l-emerald-500">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">{w.week}</span>
                  <span className={`block text-xl font-black mt-1 ${w.percentage >= 85 ? "text-emerald-600" : "text-amber-600"}`}>
                    {w.percentage}%
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">{w.present} Present slots</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================
            TAB 4: SEMESTER REPORT
            ================================================================ */}
        {!loading && !error && activeTab === "semester" && semesterReport && (
          <div className="p-6 space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-50/50 p-4 border border-slate-100 rounded-xl">
              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Department</label>
                  <select 
                    value={filters.department || ""}
                    onChange={(e) => updateFilter({ department: e.target.value })}
                    className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
                  >
                    <option value="Computer Science">Computer Science</option>
                    <option value="Computer Applications">Computer Applications</option>
                    <option value="Electrical Engineering">Electrical Engineering</option>
                    <option value="Software Engineering">Software Engineering</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Semester</label>
                  <select 
                    value={filters.semester || ""}
                    onChange={(e) => updateFilter({ semester: e.target.value })}
                    className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                      <option key={s} value={s}>Semester {s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <span className="text-xs font-extrabold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 shadow-sm">
                Academic Threshold: 75.0%
              </span>
            </div>

            {/* Pie Chart + Table Grid */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Pie */}
              <div className="bg-slate-50/30 border border-slate-150 rounded-2xl p-5 flex flex-col items-center justify-center shadow-sm">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Promotion Eligibility Split</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <RechartsPie>
                    <Pie
                      data={[
                        { name: "Eligible (>= 75%)", value: semesterReport.summary?.eligible || 0 },
                        { name: "Detained (< 75%)", value: semesterReport.summary?.detained || 0 }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      <Cell fill="#10B981" />
                      <Cell fill="#EF4444" />
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: "11px", borderRadius: "10px" }} />
                    <Legend wrapperStyle={{ fontSize: "10px", fontWeight: 700 }} />
                  </RechartsPie>
                </ResponsiveContainer>
                <div className="flex gap-6 mt-3">
                  <div className="text-center">
                    <span className="block text-xl font-black text-emerald-600">{semesterReport.summary?.eligible || 0}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Eligible</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-xl font-black text-rose-600">{semesterReport.summary?.detained || 0}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Detained</span>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="lg:col-span-2 overflow-x-auto border border-slate-100 rounded-xl shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-3">Roll No</th>
                      <th className="py-3 px-3">Student Name</th>
                      <th className="py-3 px-3 text-center">Attendance</th>
                      <th className="py-3 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs font-medium text-slate-700">
                    {semesterReport.data?.map((row: any) => (
                      <tr key={row.roll_no} className="hover:bg-slate-50/50 transition-all">
                        <td className="py-2.5 px-3 font-bold text-slate-950">{row.roll_no}</td>
                        <td className="py-2.5 px-3">{row.name}</td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                              <div className={`h-full rounded-full ${row.attendance_percentage >= 75 ? "bg-emerald-500" : "bg-rose-500"}`} style={{ width: `${row.attendance_percentage}%` }} />
                            </div>
                            <PercentBadge value={row.attendance_percentage} />
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                            row.promotion_status === "ELIGIBLE"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}>
                            {row.promotion_status === "ELIGIBLE" ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                            {row.promotion_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            TAB 5: DEPARTMENT-WISE REPORT
            ================================================================ */}
        {!loading && !error && activeTab === "department" && departmentReport && (
          <div className="p-6 space-y-6 animate-in fade-in duration-300">
            {/* Department Bar Chart */}
            <div className="bg-slate-50/40 border border-slate-200/60 rounded-2xl p-5 shadow-sm">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Building className="w-4 h-4 text-emerald-500" /> Department Attendance Comparison
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={departmentReport.chart_data || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="department" tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", fontSize: "11px", fontWeight: 600 }} />
                  <Bar dataKey="attendance" radius={[6, 6, 0, 0]} name="Avg Attendance %">
                    {(departmentReport.chart_data || []).map((_: any, i: number) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Department Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {departmentReport.data?.map((dept: any) => (
                <div key={dept.code} className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4 hover:shadow-md hover:scale-[1.01] transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded">{dept.code}</span>
                      <span className="block text-[10px] text-slate-400 font-semibold mt-1">{dept.name}</span>
                    </div>
                    <span className={`text-xl font-black ${dept.avg_attendance >= 80 ? "text-emerald-600" : "text-amber-600"}`}>
                      {dept.avg_attendance}%
                    </span>
                  </div>

                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                    <div
                      className={`h-full rounded-full ${dept.avg_attendance >= 80 ? "bg-emerald-500" : "bg-amber-400"}`}
                      style={{ width: `${dept.avg_attendance}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold">
                    <span>{dept.students} Active Students</span>
                    <span>{dept.subjects?.length || 0} Catalog Subjects</span>
                  </div>

                  {dept.subjects && dept.subjects.length > 0 && (
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Subject Standings</h4>
                      {dept.subjects.map((sub: any) => (
                        <div key={sub.code} className="flex items-center justify-between text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <span className="text-slate-600 font-bold">{sub.code}</span>
                          <span className="text-slate-700 font-medium truncate max-w-[120px]">{sub.name}</span>
                          <span className={`font-black ${sub.avg >= 80 ? "text-emerald-600" : "text-amber-600"}`}>{sub.avg}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================
            TAB 6: FACULTY WORKLOAD
            ================================================================ */}
        {!loading && !error && activeTab === "faculty" && facultyReport && (
          <div className="p-6 space-y-6 animate-in fade-in duration-300">
            {/* Faculty Selector */}
            <div className="flex items-center gap-3 flex-wrap bg-slate-50/50 p-4 border border-slate-100 rounded-xl">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Select Faculty Member</label>
                <select
                  value={filters.staff_code || ""}
                  onChange={(e) => {
                    const fac = meta?.faculty.find((f) => f.staff_code === e.target.value)
                    updateFilter({ staff_code: e.target.value, faculty_id: fac?.id })
                  }}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
                >
                  {(meta?.faculty || []).map(s => (
                    <option key={s.staff_code} value={s.staff_code}>
                      {s.staff_code} — {s.first_name} {s.last_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Metrics cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-5 bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl text-white space-y-2 shadow">
                <span className="block text-[9px] font-extrabold uppercase tracking-wider opacity-75">Workload Attendance Average</span>
                <span className="block text-3xl font-black">{facultyReport.overall_attendance}%</span>
                <p className="text-[10px] opacity-90">Consolidated attendance across all sessions delivered.</p>
              </div>
              <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-sm">
                <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Subjects Delivered</span>
                <span className="block text-3xl font-black text-slate-800">
                  {facultyReport.subjects?.length || 0}
                </span>
                <p className="text-[10px] text-slate-500">Total assigned subject catalogs taught this term.</p>
              </div>
              <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-sm">
                <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Total Class Hours Held</span>
                <span className="block text-3xl font-black text-slate-800">
                  {facultyReport.subjects?.reduce((acc: number, cur: any) => acc + cur.sessions_held, 0) || 0}
                </span>
                <p className="text-[10px] text-slate-500">Sum of academic sessions generated in timetable.</p>
              </div>
            </div>

            {/* Subject details table */}
            <div className="overflow-x-auto border border-slate-100 rounded-xl shadow-sm bg-white">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Subject Code</th>
                    <th className="py-3 px-3">Subject Name</th>
                    <th className="py-3 px-3 text-center">Sessions Held</th>
                    <th className="py-3 px-3 text-center">Present</th>
                    <th className="py-3 px-3 text-center">Absent</th>
                    <th className="py-3 px-3 text-center">Late</th>
                    <th className="py-3 px-3 text-center">Excused</th>
                    <th className="py-3 px-4 text-right">Avg Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs font-medium text-slate-700">
                  {facultyReport.subjects?.map((sub: any) => (
                    <tr key={sub.code} className="hover:bg-slate-50/50 transition-all">
                      <td className="py-3 px-4 font-bold text-slate-950">{sub.code}</td>
                      <td className="py-3 px-3 font-semibold text-slate-700">{sub.name}</td>
                      <td className="py-3 px-3 text-center font-bold text-slate-900">{sub.sessions_held}</td>
                      <td className="py-3 px-3 text-center text-emerald-600 font-bold">{sub.present}</td>
                      <td className="py-3 px-3 text-center text-rose-500">{sub.absent}</td>
                      <td className="py-3 px-3 text-center text-amber-500">{sub.late}</td>
                      <td className="py-3 px-3 text-center text-indigo-500">{sub.excused}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-12 h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${sub.avg_attendance}%` }} />
                          </div>
                          <PercentBadge value={sub.avg_attendance} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!facultyReport.subjects || facultyReport.subjects.length === 0) && (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400 font-semibold">No subjects are assigned to this faculty member yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================================
            TAB 7: STUDENT-WISE REPORT
            ================================================================ */}
        {!loading && !error && activeTab === "student" && studentReport && (
          <div className="p-6 space-y-6 animate-in fade-in duration-300">
            {/* Student Selector */}
            <div className="flex items-center gap-3 flex-wrap bg-slate-50/50 p-4 border border-slate-100 rounded-xl">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Select Student</label>
                <input
                  type="text"
                  value={filters.roll_no || ""}
                  onChange={(e) => updateFilter({ roll_no: e.target.value })}
                  placeholder="Enter roll number"
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
                />
              </div>
            </div>

            {/* Student Profile Card */}
            <div className="grid gap-5 lg:grid-cols-3">
              <div className="p-5 bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl text-white space-y-4 shadow-lg relative overflow-hidden">
                <div className="absolute right-0 top-0 w-24 h-24 bg-white/5 rounded-full -mr-5 -mt-5" />
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-sm font-black border border-white/10 shadow-sm">
                    {studentReport.student?.name ? studentReport.student.name.split(' ').map((n: string) => n[0]).join('') : "SD"}
                  </div>
                  <div>
                    <span className="block text-sm font-bold">{studentReport.student?.name}</span>
                    <span className="text-[10px] opacity-80 font-semibold">{studentReport.student?.roll_no} • {studentReport.student?.department} • Sem {studentReport.student?.semester}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div className="text-center p-2.5 bg-white/10 rounded-xl border border-white/5 shadow-inner">
                    <span className="block text-[9px] font-extrabold opacity-75 uppercase">Overall</span>
                    <span className="block text-lg font-black">{studentReport.student?.overall_attendance}%</span>
                  </div>
                  <div className="text-center p-2.5 bg-white/10 rounded-xl border border-white/5 shadow-inner flex flex-col justify-center items-center">
                    <span className="block text-[8px] font-extrabold opacity-75 uppercase">Status</span>
                    <span className={`block text-[9px] font-bold mt-1 px-1 py-0.5 rounded ${studentReport.student?.promotion_status === "ELIGIBLE" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}>{studentReport.student?.promotion_status}</span>
                  </div>
                  <div className="text-center p-2.5 bg-white/10 rounded-xl border border-white/5 shadow-inner">
                    <span className="block text-[9px] font-extrabold opacity-75 uppercase">Hours</span>
                    <span className="block text-lg font-black">{studentReport.summary?.total_present} / {studentReport.summary?.total_sessions}</span>
                  </div>
                </div>
              </div>

              {/* Monthly Trend Chart */}
              <div className="lg:col-span-2 bg-slate-50/40 border border-slate-200/60 rounded-2xl p-5 shadow-sm">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Consolidated Monthly Progress</h3>
                <ResponsiveContainer width="100%" height={170}>
                  <AreaChart data={studentReport.monthly_trend || []}>
                    <defs>
                      <linearGradient id="studentGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#64748b", fontWeight: 600 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#64748b" }} />
                    <Tooltip contentStyle={{ fontSize: "11px", borderRadius: "10px" }} />
                    <Area type="monotone" dataKey="percentage" stroke="#10B981" fill="url(#studentGrad)" strokeWidth={2.5} name="Attendance Rate %" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Subject-wise Table */}
            <div className="overflow-x-auto border border-slate-100 rounded-xl shadow-sm bg-white">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-3">Subject Name</th>
                    <th className="py-3 px-3 text-center">Total Sessions</th>
                    <th className="py-3 px-3 text-center font-bold">Present (Credits)</th>
                    <th className="py-3 px-3 text-center text-rose-600 font-bold">Absent</th>
                    <th className="py-3 px-4 text-right">Attendance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs font-medium text-slate-700">
                  {studentReport.subjects?.map((sub: any) => (
                    <tr key={sub.code} className="hover:bg-slate-50/50 transition-all">
                      <td className="py-2.5 px-4 font-bold text-slate-950">{sub.code}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-600">{sub.name}</td>
                      <td className="py-2.5 px-3 text-center">{sub.total}</td>
                      <td className="py-2.5 px-3 text-center text-emerald-600 font-black">{sub.present + sub.late + sub.excused}</td>
                      <td className="py-2.5 px-3 text-center text-rose-500">{sub.absent}</td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                            <div className={`h-full rounded-full ${sub.percentage >= 75 ? "bg-emerald-500" : "bg-rose-500"}`} style={{ width: `${sub.percentage}%` }} />
                          </div>
                          <PercentBadge value={sub.percentage} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!studentReport.subjects || studentReport.subjects.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400 font-semibold">No attendance sessions recorded for this student.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================================
            TAB 8: SUBJECT-WISE REPORT
            ================================================================ */}
        {!loading && !error && activeTab === "subject" && subjectReport && (
          <div className="p-6 space-y-6 animate-in fade-in duration-300">
            {/* Subject Selector */}
            <div className="flex items-center gap-3 flex-wrap bg-slate-50/50 p-4 border border-slate-100 rounded-xl">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Select Subject</label>
                <select
                  value={filters.subject_code || ""}
                  onChange={(e) => {
                    const sub = meta?.subjects.find((s) => s.subject_code === e.target.value)
                    updateFilter({ subject_code: e.target.value, subject_id: sub?.id })
                  }}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
                >
                  {(meta?.subjects || []).map((s) => (
                    <option key={s.subject_code} value={s.subject_code}>{s.subject_code} — {s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Subject Profile Card */}
            <div className="grid gap-5 lg:grid-cols-3">
              <div className="p-5 bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl text-white space-y-4 shadow-lg relative overflow-hidden">
                <div className="absolute right-0 top-0 w-24 h-24 bg-white/5 rounded-full -mr-5 -mt-5" />
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-sm font-black border border-white/10 shadow-sm">
                    {subjectReport.subject?.name ? subjectReport.subject.name.split(' ').map((n: string) => n[0]).join('') : "SB"}
                  </div>
                  <div>
                    <span className="block text-sm font-bold truncate max-w-[170px]">{subjectReport.subject?.name}</span>
                    <span className="text-[10px] opacity-80 font-semibold">{subjectReport.subject?.code} • {subjectReport.subject?.department} • Sem {subjectReport.subject?.semester}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div className="text-center p-2.5 bg-white/10 rounded-xl border border-white/5 shadow-inner">
                    <span className="block text-[8px] font-extrabold opacity-75 uppercase">Credits</span>
                    <span className="block text-lg font-black">{subjectReport.subject?.credits}</span>
                  </div>
                  <div className="text-center p-2.5 bg-white/10 rounded-xl border border-white/5 shadow-inner flex flex-col justify-center items-center">
                    <span className="block text-[8px] font-extrabold opacity-75 uppercase">Faculty</span>
                    <span className="block text-[9px] font-bold mt-1 text-white truncate max-w-[65px]">{subjectReport.subject?.faculty}</span>
                  </div>
                  <div className="text-center p-2.5 bg-white/10 rounded-xl border border-white/5 shadow-inner">
                    <span className="block text-[8px] font-extrabold opacity-75 uppercase">Sessions</span>
                    <span className="block text-lg font-black">{subjectReport.total_sessions}</span>
                  </div>
                </div>
              </div>

              {/* Eligibility Stats Split */}
              <div className="bg-slate-50/40 border border-slate-200/60 rounded-2xl p-5 shadow-sm flex flex-col lg:flex-row items-center justify-around gap-4 lg:col-span-2">
                <div className="w-full max-w-[160px] h-[140px] flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie
                        data={[
                          { name: "Eligible (>= 75%)", value: subjectReport.students?.filter((s: any) => s.promotion_status === "ELIGIBLE").length || 0 },
                          { name: "Detained (< 75%)", value: subjectReport.students?.filter((s: any) => s.promotion_status === "DETAINED").length || 0 }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={50}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        <Cell fill="#10B981" />
                        <Cell fill="#EF4444" />
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: "10px", borderRadius: "8px" }} />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col justify-center space-y-3">
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-800">Subject Eligibility Standing</h4>
                    <p className="text-[10px] text-slate-400">Roster breakdown based on course guidelines.</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="px-3 py-1.5 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                      <span className="block text-base font-black text-emerald-600">
                        {subjectReport.students?.filter((s: any) => s.promotion_status === "ELIGIBLE").length || 0}
                      </span>
                      <span className="text-[8px] font-bold text-emerald-700 uppercase">Eligible</span>
                    </div>
                    <div className="px-3 py-1.5 bg-rose-50 rounded-xl border border-rose-100 text-center">
                      <span className="block text-base font-black text-rose-600">
                        {subjectReport.students?.filter((s: any) => s.promotion_status === "DETAINED").length || 0}
                      </span>
                      <span className="text-[8px] font-bold text-rose-700 uppercase">Detained</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Students Table */}
            <div className="overflow-x-auto border border-slate-100 rounded-xl shadow-sm bg-white">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Roll No</th>
                    <th className="py-3 px-3">Student Name</th>
                    <th className="py-3 px-3 text-center">Semester</th>
                    <th className="py-3 px-3 text-center">Sessions Conducted</th>
                    <th className="py-3 px-3 text-center">Present Sessions</th>
                    <th className="py-3 px-3 text-center text-rose-600">Absent Sessions</th>
                    <th className="py-3 px-4 text-right">Attendance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs font-medium text-slate-700">
                  {subjectReport.students?.map((row: any) => (
                    <tr key={row.roll_no} className="hover:bg-slate-50/50 transition-all">
                      <td className="py-3 px-4 font-bold text-slate-950">{row.roll_no}</td>
                      <td className="py-3 px-3 font-semibold text-slate-600">{row.name}</td>
                      <td className="py-3 px-3 text-center text-slate-400 font-bold">Sem {row.semester}</td>
                      <td className="py-3 px-3 text-center text-slate-900 font-bold">{row.total_classes}</td>
                      <td className="py-3 px-3 text-center text-emerald-600 font-black">{row.present_count}</td>
                      <td className="py-3 px-3 text-center text-rose-500">{row.absent_count}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                            <div className={`h-full rounded-full ${row.attendance_percentage >= 75 ? "bg-emerald-500" : "bg-rose-500"}`} style={{ width: `${row.attendance_percentage}%` }} />
                          </div>
                          <PercentBadge value={row.attendance_percentage} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!subjectReport.students || subjectReport.students.length === 0) && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400 font-semibold">No students enrolled in the department/semester of this subject.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
