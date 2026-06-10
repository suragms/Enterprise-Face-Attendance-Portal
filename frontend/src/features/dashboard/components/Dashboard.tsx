import React from "react"
import { useAuth } from "../../../context/AuthContext"
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  CalendarClock, 
  CheckCircle2, 
  History,
  Building,
  Activity
} from "lucide-react"

// Import Recharts components for premium hardware-accelerated graphs
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  AreaChart, 
  Area, 
  CartesianGrid 
} from "recharts"

export const Dashboard: React.FC = () => {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === "PLATFORM_SUPER_ADMIN"

  // --------------------------------------------------------------------------
  // SUPER ADMIN METRICS & DATA
  // --------------------------------------------------------------------------
  const superStats = [
    { name: "Total Students", value: "348", icon: GraduationCap, change: "+12 this semester", type: "positive" },
    { name: "Total Faculty Staff", value: "24", icon: Users, change: "Across all departments", type: "neutral" },
    { name: "Total Departments", value: "6", icon: Building, change: "2 new proposed FE", type: "neutral" },
    { name: "Total Subjects", value: "48", icon: BookOpen, change: "Across 4 programmes", type: "neutral" },
    { name: "Today's Attendance", value: "308", icon: CheckCircle2, change: "Logged by face recognition", type: "positive" },
    { name: "Attendance Percentage", value: "88.4%", icon: CalendarClock, change: "-1.2% from yesterday", type: "negative" }
  ]

  const weeklyData = [
    { name: "Mon", Attendance: 88 },
    { name: "Tue", Attendance: 92 },
    { name: "Wed", Attendance: 85 },
    { name: "Thu", Attendance: 90 },
    { name: "Fri", Attendance: 84 },
  ]

  const monthlyData = [
    { name: "Jan", Attendance: 82 },
    { name: "Feb", Attendance: 87 },
    { name: "Mar", Attendance: 85 },
    { name: "Apr", Attendance: 91 },
    { name: "May", Attendance: 88 },
  ]

  const deptData = [
    { name: "CS", Students: 120, Standing: 89 },
    { name: "SE", Students: 90, Standing: 86 },
    { name: "EE", Students: 60, Standing: 78 },
    { name: "ME", Students: 48, Standing: 82 },
    { name: "CE", Students: 30, Standing: 74 },
  ]

  // --------------------------------------------------------------------------
  // HOD ADMIN METRICS & DATA
  // --------------------------------------------------------------------------
  const hodStats = [
    { name: "Total Students Registered", value: "348", icon: GraduationCap, change: "+12 this semester" },
    { name: "Active Faculty Staff", value: "24", icon: Users, change: "All departments active" },
    { name: "Subjects Configured", value: "48", icon: BookOpen, change: "Across 4 programmes" },
    { name: "Today's Avg Attendance", value: "88.4%", icon: CalendarClock, change: "-1.2% from yesterday" }
  ]

  const recentLogs = [
    { id: 1, action: "Face enrolled successfully", subject: "Student roll no MCS-109 (Alan Turing)", user: "Admin (Surag M S)", time: "10 mins ago" },
    { id: 2, action: "Attendance manually corrected", subject: "Roll no MCS-042 (Ada Lovelace) - Period III", user: "Lecturer (Dr. Vance)", time: "45 mins ago" },
    { id: 3, action: "Timetable updated", subject: "MCS Semester III - Friday slots rearranged", user: "Admin (Surag M S)", time: "2 hours ago" },
    { id: 4, action: "New student registered", subject: "Roll no BSCS-204 (Grace Hopper)", user: "Admin (Surag M S)", time: "Yesterday" }
  ]

  // Custom tooltips styling for cohesive visual aesthetics matching emerald theme
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white border border-slate-800 p-2.5 rounded-lg text-xs font-semibold shadow-xl">
          <p className="text-slate-400 mb-1">{label}</p>
          {payload.map((pld: any) => (
            <p key={pld.name} style={{ color: pld.color || "#10B981" }} className="leading-relaxed">
              {pld.name}: {pld.value}%
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  const CustomDeptTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white border border-slate-800 p-2.5 rounded-lg text-xs font-semibold shadow-xl">
          <p className="text-slate-400 mb-1">Dept: {label}</p>
          <p className="text-emerald-400">Students: {payload[0]?.value}</p>
          <p className="text-emerald-500">Avg Standing: {payload[1]?.value}%</p>
        </div>
      )
    }
    return null
  }

  // ==========================================================================
  // RENDER 1: SUPER ADMIN DASHBOARD
  // ==========================================================================
  if (isSuperAdmin) {
    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        {/* Welcome Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-800 p-8 md:p-10 text-white shadow-md">
          <div className="absolute top-[-100px] right-[-100px] w-96 h-96 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
          <div className="relative z-10 space-y-2 max-w-xl">
            <span className="text-[10px] bg-emerald-500/40 text-emerald-100 border border-emerald-400/30 font-bold tracking-widest uppercase px-2.5 py-1 rounded-full">
              Super Admin Console
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-2">HexaAttender Analytics Hub</h2>
            <p className="text-emerald-100/90 text-sm leading-relaxed">
              Global administrator controls. View aggregated metrics across all departments, courses, schedules, and active student verification registries.
            </p>
          </div>
        </div>

        {/* 6 Metric Cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {superStats.map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.name} className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-4 hover:translate-y-[-2px] hover:shadow-md hover:border-emerald-300 transition-all duration-300 flex flex-col justify-between group">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.name}</span>
                  <div className="p-2 bg-emerald-50/50 text-emerald-600 rounded-xl group-hover:scale-105 transition-all duration-300">
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-black text-slate-900 tracking-tight">{stat.value}</p>
                  <p className="text-[10px] font-semibold text-slate-550 mt-1 flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-emerald-600" />
                    {stat.change}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Recharts Analytics Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Weekly Attendance BarChart */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-800">Weekly Attendance Averages</h3>
              <p className="text-xs text-slate-500">Day-by-day class attendance average standings</p>
            </div>
            
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Attendance" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Attendance AreaChart */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-800">Monthly Attendance Trends</h3>
              <p className="text-xs text-slate-500">Smooth check-in averages logged across the semester</p>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Attendance" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAttendance)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Department Analytics Dual-Axis BarChart */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 lg:col-span-2">
            <div>
              <h3 className="text-base font-bold text-slate-800">Department Size & Standing Analytics</h3>
              <p className="text-xs text-slate-500">Comparing student enrollment volumes with average standing per department</p>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis yAxisId="left" orientation="left" stroke="#10B981" fontSize={10} tickLine={false} label={{ value: 'Students', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 10, fill: '#10B981' } }} />
                  <YAxis yAxisId="right" orientation="right" stroke="#059669" fontSize={10} tickLine={false} label={{ value: 'Standing (%)', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fontSize: 10, fill: '#059669' } }} />
                  <Tooltip content={<CustomDeptTooltip />} />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="Students" fill="#10B981" radius={[4, 4, 0, 0]} name="Enrolled Students" />
                  <Bar yAxisId="right" dataKey="Standing" fill="#059669" radius={[4, 4, 0, 0]} name="Average Standing (%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================================================
  // RENDER 2: HOD ADMIN DASHBOARD
  // ==========================================================================
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-800 p-8 md:p-10 text-white shadow-md">
        <div className="absolute top-[-100px] right-[-100px] w-96 h-96 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-xl space-y-2">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">HexaAttender Dashboard</h2>
          <p className="text-emerald-100/90 text-sm md:text-base leading-relaxed">
            Welcome to the department coordinator portal. Track attendance sessions, register biometric records, and manage schedules seamlessly with facial recognition technology.
          </p>
        </div>
      </div>

      {/* Grid of Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {hodStats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.name} className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-4 hover:translate-y-[-2px] hover:shadow-md hover:border-emerald-300 transition-all duration-300 group">
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.name}</span>
                <div className="p-2 bg-emerald-50/50 text-emerald-600 rounded-xl group-hover:scale-105 transition-all duration-300">
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-black text-slate-900 tracking-tight">{stat.value}</p>
                <p className="text-xs font-semibold text-slate-500 mt-1">{stat.change}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Main dashboard panels */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-800">Weekly Attendance Overview</h3>
              <p className="text-xs text-slate-400">Aggregated student percentage from Monday through Friday</p>
            </div>
            <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 font-medium rounded-full">
              This Week
            </span>
          </div>
          
          {/* Custom beautiful CSS layout visualizer */}
          <div className="h-64 flex items-end justify-between gap-3 md:gap-4 pt-4 border-b border-slate-100 bg-slate-50/50 rounded-2xl p-4">
            {[88, 92, 85, 90, 84].map((pct, idx) => {
              const days = ["Mon", "Tue", "Wed", "Thu", "Fri"]
              return (
                <div key={days[idx]} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer h-full justify-end">
                  <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-250 transform translate-y-2 group-hover:translate-y-0">{pct}%</span>
                  <div 
                    className="w-full bg-slate-200/80 hover:bg-emerald-500 transition-all duration-300 rounded-t-lg relative overflow-hidden" 
                    style={{ height: `${pct * 1.8}px` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-emerald-600/10 to-transparent pointer-events-none" />
                  </div>
                  <span className="text-xs font-bold text-slate-500">{days[idx]}</span>
                </div>
              )
            })}
          </div>
          
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium pt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <span>Target Threshold (75%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Safe standing</span>
            </div>
          </div>
        </div>

        {/* Audit logs trail (FR-14) */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            <h3 className="text-base font-bold text-slate-800">System Audit Trail</h3>
          </div>
          
          <div className="flow-root">
            <ul className="-mb-8">
              {recentLogs.map((log, logIdx) => (
                <li key={log.id}>
                  <div className="relative pb-8">
                    {logIdx !== recentLogs.length - 1 ? (
                      <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-100" aria-hidden="true" />
                    ) : null}
                    <div className="relative flex space-x-3">
                      <div>
                        <span className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center ring-8 ring-white text-emerald-600 font-bold text-[10px]">
                          {log.id}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 pt-1.5">
                        <p className="text-xs font-semibold text-slate-700">{log.action}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{log.subject}</p>
                        <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400 font-medium">
                          <span>By: {log.user}</span>
                          <span>{log.time}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
