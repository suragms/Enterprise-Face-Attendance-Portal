import React, { useMemo } from "react"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  Calendar,
  Fingerprint,
  Loader2,
  RefreshCw,
  ScanFace,
  TrendingUp,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useAuth } from "../../../context/AuthContext"
import { isFacultyRole } from "../../../lib/roles"
import { FacultyScopeBanner } from "../../staff/components/FacultyScopeBanner"
import { useAnalyticsDashboard } from "../hooks/useAnalyticsDashboard"
import { ChartCard } from "./ChartCard"

const CHART_COLORS = {
  present: "#10b981",
  absent: "#f43f5e",
  primary: "#6366f1",
  accent: "#06b6d4",
  warn: "#f59e0b",
}

const PIE_COLORS = ["#10b981", "#6366f1", "#f59e0b", "#06b6d4", "#8b5cf6"]

const tooltipStyle = {
  contentStyle: {
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    fontSize: "11px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
  },
}

const riskColor: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  watch: "#eab308",
}

export const AnalyticsDashboard: React.FC = () => {
  const { user } = useAuth()
  const isFaculty = isFacultyRole(user?.role)
  const { data, loading, error, threshold, setThreshold, refresh } = useAnalyticsDashboard(75)

  const facePie = useMemo(() => {
    if (!data?.face_recognition) return []
    const fr = data.face_recognition
    return [
      { name: "Successful", value: fr.successful },
      { name: "Failed", value: fr.failed },
    ].filter((x) => x.value > 0)
  }, [data])

  const capturePie = useMemo(() => {
    return (data?.face_recognition.capture_methods || []).map((row) => ({
      name: row.capture_method.replace(/_/g, " "),
      value: row.count,
    }))
  }, [data])

  const topRisk = useMemo(() => {
    return [...(data?.risk_students || [])]
      .sort((a, b) => a.attendance_percentage - b.attendance_percentage)
      .slice(0, 8)
      .map((s) => ({
        name: s.roll_no,
        attendance: s.attendance_percentage,
        fill: riskColor[s.risk_level] || riskColor.high,
      }))
  }, [data])

  return (
    <div className="space-y-6 pb-8">
      {isFaculty ? <FacultyScopeBanner /> : null}

      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-emerald-900 to-emerald-800 p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200/80">
              Advanced Analytics
            </p>
            <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">Insights Dashboard</h2>
            <p className="mt-2 max-w-xl text-xs text-emerald-100/90 sm:text-sm">
              Weekly and monthly attendance, department and subject performance, at-risk students,
              and face recognition success — responsive charts powered by live data.
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold backdrop-blur transition hover:bg-white/20 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-16">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <span className="text-sm font-medium text-slate-500">Loading analytics...</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              {
                label: "Overall Attendance",
                value: `${data.summary.overall_attendance}%`,
                icon: TrendingUp,
                color: "text-emerald-600",
              },
              {
                label: "At-Risk Students",
                value: String(data.summary.risk_count),
                icon: AlertTriangle,
                color: "text-rose-600",
              },
              {
                label: "Departments",
                value: String(data.summary.department_count),
                icon: Building2,
                color: "text-indigo-600",
              },
              {
                label: "Subjects Tracked",
                value: String(data.summary.subject_count),
                icon: BarChart3,
                color: "text-violet-600",
              },
              {
                label: "Face Success",
                value: `${data.summary.face_success_rate}%`,
                icon: ScanFace,
                color: "text-cyan-600",
              },
              {
                label: "Records",
                value: String(data.summary.total_records),
                icon: Activity,
                color: "text-slate-600",
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
              >
                <kpi.icon className={`mb-2 h-4 w-4 ${kpi.color}`} />
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400 sm:text-[10px]">
                  {kpi.label}
                </p>
                <p className="mt-1 text-lg font-extrabold text-slate-800 sm:text-xl">{kpi.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <ChartCard
              title="Weekly Attendance"
              subtitle="Present vs absent — last 7 days"
              icon={Calendar}
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.weekly_attendance} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                  <Tooltip contentStyle={tooltipStyle.contentStyle} />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                  <Bar yAxisId="left" dataKey="present" stackId="a" fill={CHART_COLORS.present} name="Present" radius={[0, 0, 0, 0]} />
                  <Bar yAxisId="left" dataKey="absent" stackId="a" fill={CHART_COLORS.absent} name="Absent" radius={[4, 4, 0, 0]} />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="percentage"
                    stroke={CHART_COLORS.primary}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Attendance %"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Monthly Attendance"
              subtitle="Attendance trend by month"
              icon={TrendingUp}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.monthly_attendance} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="monthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                  <Tooltip contentStyle={tooltipStyle.contentStyle} />
                  <Area
                    type="monotone"
                    dataKey="percentage"
                    stroke="#10b981"
                    fill="url(#monthGrad)"
                    strokeWidth={2}
                    name="Attendance %"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <ChartCard
              title="Department Comparison"
              subtitle="Average attendance by department"
              icon={Building2}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.department_comparison}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                  <YAxis
                    type="category"
                    dataKey="department"
                    width={90}
                    tick={{ fontSize: 9 }}
                  />
                  <Tooltip contentStyle={tooltipStyle.contentStyle} />
                  <Bar dataKey="attendance" fill={CHART_COLORS.present} radius={[0, 6, 6, 0]} name="Attendance %" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Subject Performance"
              subtitle="Top subjects by attendance"
              icon={BarChart3}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.subject_performance.slice(0, 10)} margin={{ top: 8, right: 8, left: -16, bottom: 32 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="subject_code"
                    tick={{ fontSize: 9 }}
                    angle={-35}
                    textAnchor="end"
                    height={48}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                  <Tooltip contentStyle={tooltipStyle.contentStyle} />
                  <Bar dataKey="attendance" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} name="Attendance %" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <ChartCard
              title="Risk Students"
              subtitle={`Below ${threshold}% attendance threshold`}
              icon={AlertTriangle}
              action={
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-500">Threshold</span>
                  <input
                    type="range"
                    min={50}
                    max={90}
                    step={5}
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-20 accent-rose-600"
                  />
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 font-bold text-rose-700">{threshold}%</span>
                </div>
              }
            >
              <div className="flex h-full flex-col gap-3">
                <div className="min-h-[140px] flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topRisk} layout="vertical" margin={{ left: 4, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 9 }} />
                      <Tooltip contentStyle={tooltipStyle.contentStyle} />
                      <Bar dataKey="attendance" radius={[0, 4, 4, 0]}>
                        {topRisk.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="max-h-28 overflow-y-auto rounded-lg border border-slate-100">
                  <table className="w-full text-left text-[10px] sm:text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-2 py-1.5 font-bold">Roll</th>
                        <th className="px-2 py-1.5 font-bold">Name</th>
                        <th className="px-2 py-1.5 text-right font-bold">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.risk_students.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-2 py-4 text-center text-slate-400">
                            No students below threshold
                          </td>
                        </tr>
                      ) : (
                        data.risk_students.slice(0, 6).map((row) => (
                          <tr key={row.student_id}>
                            <td className="px-2 py-1.5 font-bold text-slate-700">{row.roll_no}</td>
                            <td className="px-2 py-1.5 text-slate-600 truncate max-w-[120px]">{row.name}</td>
                            <td className="px-2 py-1.5 text-right font-bold text-rose-600">
                              {row.attendance_percentage}%
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </ChartCard>

            <ChartCard
              title="Face Recognition Success"
              subtitle="Verification outcomes and capture mix"
              icon={Fingerprint}
            >
              <div className="grid h-full gap-4 sm:grid-cols-2">
                <div className="flex flex-col items-center justify-center">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={facePie.length ? facePie : [{ name: "No data", value: 1 }]}
                        cx="50%"
                        cy="50%"
                        innerRadius={42}
                        outerRadius={64}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {(facePie.length ? facePie : [{ name: "No data", value: 1 }]).map((_, i) => (
                          <Cell key={i} fill={i === 0 ? CHART_COLORS.present : CHART_COLORS.absent} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle.contentStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <p className="text-center text-2xl font-extrabold text-emerald-700">
                    {data.face_recognition.success_rate}%
                  </p>
                  <p className="text-[10px] font-semibold text-slate-400">Success rate</p>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-emerald-50 p-2 border border-emerald-100">
                      <span className="text-[9px] font-bold uppercase text-emerald-600">Success</span>
                      <p className="text-lg font-extrabold text-emerald-800">{data.face_recognition.successful}</p>
                    </div>
                    <div className="rounded-lg bg-rose-50 p-2 border border-rose-100">
                      <span className="text-[9px] font-bold uppercase text-rose-600">Failed</span>
                      <p className="text-lg font-extrabold text-rose-800">{data.face_recognition.failed}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                      <span className="text-[9px] font-bold uppercase text-slate-500">Enrollments</span>
                      <p className="text-lg font-extrabold text-slate-800">{data.face_recognition.enrollments}</p>
                    </div>
                    <div className="rounded-lg bg-indigo-50 p-2 border border-indigo-100">
                      <span className="text-[9px] font-bold uppercase text-indigo-600">Face captures</span>
                      <p className="text-lg font-extrabold text-indigo-800">
                        {data.face_recognition.attendance_face_captures}
                      </p>
                    </div>
                  </div>
                  {data.face_recognition.daily_trend.length > 0 && (
                    <div className="h-24">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.face_recognition.daily_trend}>
                          <XAxis dataKey="date" hide />
                          <YAxis domain={[0, 100]} hide />
                          <Tooltip contentStyle={tooltipStyle.contentStyle} />
                          <Line
                            type="monotone"
                            dataKey="success_rate"
                            stroke={CHART_COLORS.accent}
                            strokeWidth={2}
                            dot={false}
                            name="Daily success %"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {capturePie.length > 0 && (
                    <div className="h-20">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={capturePie} dataKey="value" cx="50%" cy="50%" outerRadius={36}>
                            {capturePie.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle.contentStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  )
}
