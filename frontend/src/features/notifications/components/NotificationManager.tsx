import React, { useState, useEffect } from "react"
import {
  Bell,
  Mail,
  MessageSquare,
  Sliders,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Search,
  Activity,
  Sparkles,
  BookOpen,
  Loader2,
  RefreshCw,
  CalendarClock,
  Smartphone,
} from "lucide-react"
import { apiFetch } from "../../../lib/api"
import { CHANNEL_OPTIONS } from "../constants"
import {
  bulkRetryFailed,
  defaultTriggerContext,
  fetchNotificationMeta,
  recipientForChannel,
  retryLog,
  triggerNotification,
} from "../api"
import { NotificationSchedulesTab } from "./NotificationSchedulesTab"
import type { NotificationChannel } from "../types"

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------
type NotificationTab = "templates" | "trigger" | "schedules" | "logs"

interface DbTemplate {
  id?: string
  trigger_type: string
  channel: NotificationChannel
  subject?: string
  body_template: string
  is_active: boolean
}

interface LogEntry {
  id: string
  recipient: string
  trigger_type: string
  channel: NotificationChannel
  status: "SENT" | "FAILED" | "PENDING" | "READ"
  subject?: string
  message_body: string
  created_at: string
  error_message?: string
  retry_count?: number
  last_attempt_at?: string
}

interface Student {
  roll_no: string
  name: string
  department: string
  email: string
  phone: string
  attendanceSummary?: {
    percentage: number
  }
}

// ===========================================================================
// MAIN COMPONENT
// ===========================================================================
export const NotificationManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NotificationTab>("templates")
  
  // Loaded state lists
  const [dbTemplates, setDbTemplates] = useState<DbTemplate[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [studentsList, setStudentsList] = useState<Student[]>([])
  
  // Loading states
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Template editor states
  const [selectedTrigger, setSelectedTrigger] = useState<string>("LOW_ATTENDANCE")
  const [selectedChannel, setSelectedChannel] = useState<NotificationChannel>("EMAIL")
  const [pendingCount, setPendingCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)
  
  const [editSubject, setEditSubject] = useState<string>("")
  const [editBody, setEditBody] = useState<string>("")
  const [editIsActive, setEditIsActive] = useState<boolean>(true)

  // Trigger test states
  const [selectedStudentRoll, setSelectedStudentRoll] = useState<string>("")
  const [selectedTriggerForTest, setSelectedTriggerForTest] = useState<string>("LOW_ATTENDANCE")
  const [activeChannelsForTest, setActiveChannelsForTest] = useState<Record<string, boolean>>({
    EMAIL: true,
    SMS: true,
    WHATSAPP: true,
    IN_APP: true,
  })
  const [isTriggering, setIsTriggering] = useState<boolean>(false)
  const [triggerStep, setTriggerStep] = useState<string>("")

  // Log filter states
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [channelFilter, setChannelFilter] = useState<string>("ALL")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [inspectingLog, setInspectingLog] = useState<LogEntry | null>(null)

  // Fetch Templates
  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const data = await apiFetch("/notifications/templates/")
      setDbTemplates(data.results || data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Fetch Logs
  const fetchLogs = async () => {
    try {
      const data = await apiFetch("/notifications/logs/")
      setLogs(data.results || data)
    } catch (e) {
      console.error("Failed to load logs:", e)
    }
  }

  // Fetch Students for dropdown selection
  const fetchStudents = async () => {
    try {
      const data = await apiFetch("/students/")
      const list = data.results || data
      setStudentsList(list)
      if (list.length > 0) {
        setSelectedStudentRoll(list[0].roll_no)
      }
    } catch (e) {
      console.error("Failed to load students:", e)
    }
  }

  // Load initial options & templates on mount
  useEffect(() => {
    fetchTemplates()
    fetchLogs()
    fetchStudents()
    fetchNotificationMeta()
      .then((meta) => {
        setPendingCount(meta.stats?.pending ?? 0)
        setFailedCount(meta.stats?.failed ?? 0)
      })
      .catch(() => {})
  }, [])

  // Synchronize editor inputs when trigger/channel selection changes
  useEffect(() => {
    const active = dbTemplates.find(t => t.trigger_type === selectedTrigger && t.channel === selectedChannel)
    if (active) {
      setEditSubject(active.subject || "")
      setEditBody(active.body_template || "")
      setEditIsActive(active.is_active)
    } else {
      setEditSubject("")
      setEditBody("")
      setEditIsActive(true)
    }
  }, [selectedTrigger, selectedChannel, dbTemplates])

  // Save template configuration
  const handleSaveTemplate = async () => {
    try {
      const active = dbTemplates.find(t => t.trigger_type === selectedTrigger && t.channel === selectedChannel)
      const payload = {
        trigger_type: selectedTrigger,
        channel: selectedChannel,
        subject: selectedChannel === "EMAIL" || selectedChannel === "IN_APP" ? editSubject : "",
        body_template: editBody,
        is_active: editIsActive
      }

      if (active && active.id) {
        await apiFetch(`/notifications/templates/${active.id}/`, {
          method: "PUT",
          body: payload
        })
      } else {
        await apiFetch("/notifications/templates/", {
          method: "POST",
          body: payload
        })
      }

      alert("Template configuration saved successfully!")
      fetchTemplates()
    } catch (e: any) {
      alert(`Failed to save template: ${e.message}`)
    }
  }

  // Variable Injection Handler
  const injectVariable = (variableName: string) => {
    const textarea = document.getElementById("template-textarea") as HTMLTextAreaElement
    if (!textarea) return

    const startPos = textarea.selectionStart
    const endPos = textarea.selectionEnd
    const currentText = editBody || ""
    const injection = `{${variableName}}`
    const newText = currentText.substring(0, startPos) + injection + currentText.substring(endPos)
    
    setEditBody(newText)
    
    setTimeout(() => {
      textarea.focus()
      textarea.selectionStart = startPos + injection.length
      textarea.selectionEnd = startPos + injection.length
    }, 50)
  }

  // Manual Trigger dispatch
  const handleTestTrigger = async () => {
    const student = studentsList.find(s => s.roll_no === selectedStudentRoll)
    if (!student) {
      alert("Please select a valid student first.")
      return
    }

    setIsTriggering(true)
    setTriggerStep("Loading student profile and compiling active variables...")
    await new Promise(r => setTimeout(r, 600))

    const activeSelectedChannels = Object.keys(activeChannelsForTest).filter(k => activeChannelsForTest[k])
    if (activeSelectedChannels.length === 0) {
      alert("Please select at least one active channel to dispatch test alert.")
      setIsTriggering(false)
      return
    }

    try {
      for (const channel of activeSelectedChannels) {
        setTriggerStep(`Submitting ${channel} notification request...`)

        const recipient = recipientForChannel(channel as NotificationChannel, {
          email: student.email,
          phone: student.phone,
          user: (student as { user?: string }).user,
        })
        if (!recipient) {
          throw new Error(`${channel} recipient is missing for ${student.name}.`)
        }
        const context = {
          ...defaultTriggerContext(selectedTriggerForTest as import("../types").TriggerType),
          student_name: student.name,
          roll_no: student.roll_no,
          attendance_percentage: student.attendanceSummary?.percentage || 72.5,
        }

        await triggerNotification({
          trigger_type: selectedTriggerForTest,
          channel,
          recipient,
          context,
          user_id: channel === "IN_APP" ? recipient : undefined,
        })
      }

      setTriggerStep("Transmission complete. Dispatches registered in system audit trails.")
      await new Promise(r => setTimeout(r, 1200))
      fetchLogs()
      setActiveTab("logs")
    } catch (e: any) {
      alert(`Manual dispatch failed: ${e.message}`)
    } finally {
      setIsTriggering(false)
    }
  }

  // Retry Notification Handler
  const [retryingLogId, setRetryingLogId] = useState<string | null>(null)

  const handleRetryNotification = async (logId: string) => {
    setRetryingLogId(logId)
    try {
      const response = await retryLog(logId)
      alert("Notification transmission retried successfully!")
      setInspectingLog(response)
      fetchLogs()
    } catch (e: any) {
      alert(`Retry failed: ${e.message}`)
    } finally {
      setRetryingLogId(null)
    }
  }

  // Filtered Logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.recipient.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          log.trigger_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          log.message_body.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesChannel = channelFilter === "ALL" || log.channel === channelFilter
    const matchesStatus = statusFilter === "ALL" || log.status === statusFilter
    return matchesSearch && matchesChannel && matchesStatus
  })

  // Summary Metrics calculations
  const totalSent = logs.filter(l => l.status === "SENT").length
  const failurePercent = logs.length > 0 ? Math.round((logs.filter(l => l.status === "FAILED").length / logs.length) * 100) : 0

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-800 p-6 md:p-8 text-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="absolute top-[-100px] right-[-100px] w-96 h-96 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-1 max-w-xl">
          <span className="text-[10px] bg-emerald-500/40 text-emerald-100 border border-emerald-400/30 font-bold tracking-widest uppercase px-2.5 py-0.5 rounded-full">
            Communication Gateways
          </span>
          <h2 className="text-xl md:text-2xl font-extrabold tracking-tight mt-1.5">HexaAttender Notification System</h2>
          <p className="text-emerald-100/90 text-xs leading-relaxed">
            Customize automated message templates, dispatch test triggers to student parent contacts, and audit system-wide delivery logs.
          </p>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Sent Alerts</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-extrabold text-slate-800">{totalSent}</p>
            <p className="text-[9px] text-slate-500 mt-0.5">Across all active channels</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Failure Rate</span>
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-extrabold text-rose-600">{failurePercent}%</p>
            <p className="text-[9px] text-slate-500 mt-0.5">Carrier routing timeouts</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Active Templates</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <Sliders className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-extrabold text-slate-800">{dbTemplates.filter(t => t.is_active).length}</p>
            <p className="text-[9px] text-slate-500 mt-0.5">Configured database templates</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Pending Queues</span>
            <div className="p-1.5 bg-slate-100 text-slate-500 rounded-lg">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-extrabold text-slate-800">{pendingCount}</p>
            <p className="text-[9px] text-slate-500 mt-0.5">{failedCount} failed in queue</p>
          </div>
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-100 overflow-x-auto bg-slate-50/50">
          <button
            onClick={() => setActiveTab("templates")}
            className={`flex items-center gap-2 py-3 px-5 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
              activeTab === "templates"
                ? "border-emerald-600 text-emerald-700 bg-white"
                : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/30"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Notification Templates
          </button>
          <button
            onClick={() => setActiveTab("trigger")}
            className={`flex items-center gap-2 py-3 px-5 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
              activeTab === "trigger"
                ? "border-emerald-600 text-emerald-700 bg-white"
                : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/30"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Test Manual Trigger
          </button>
          <button
            onClick={() => setActiveTab("schedules")}
            className={`flex items-center gap-2 py-3 px-5 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
              activeTab === "schedules"
                ? "border-emerald-600 text-emerald-700 bg-white"
                : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/30"
            }`}
          >
            <CalendarClock className="w-3.5 h-3.5" />
            Scheduling
          </button>
          <button
            onClick={() => {
              setActiveTab("logs")
              fetchLogs()
            }}
            className={`flex items-center gap-2 py-3 px-5 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
              activeTab === "logs"
                ? "border-emerald-600 text-emerald-700 bg-white"
                : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/30"
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            Dispatch Logs
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-bold">{error}</span>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
              <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
              <span className="text-xs font-semibold">Loading system settings...</span>
            </div>
          )}

          {/* =================================================================
              TAB 1: TEMPLATE EDITOR
              ================================================================= */}
          {!loading && activeTab === "templates" && (
            <div className="space-y-6">
              
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Configuration Panel */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Selector Header */}
                  <div className="flex gap-4 flex-wrap bg-slate-50 border border-slate-100 p-4 rounded-xl">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Select Trigger</label>
                      <select 
                        value={selectedTrigger}
                        onChange={(e) => setSelectedTrigger(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="LOW_ATTENDANCE">Low Attendance Warning</option>
                        <option value="ABSENT_ALERT">Absent Alert</option>
                        <option value="ATTENDANCE_SUMMARY">Consolidated Class Report</option>
                        <option value="ADMIN_ALERT">System Admin Broadcast</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Select Channel</label>
                      <select 
                        value={selectedChannel}
                        onChange={(e) => setSelectedChannel(e.target.value as any)}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        {CHANNEL_OPTIONS.map((ch) => (
                          <option key={ch.id} value={ch.id}>
                            {ch.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-end ml-auto">
                      <label className="flex items-center gap-2 cursor-pointer pb-2">
                        <input
                          type="checkbox"
                          checked={editIsActive}
                          onChange={(e) => setEditIsActive(e.target.checked)}
                          className="w-4 h-4 rounded text-emerald-600 border-slate-200 focus:ring-emerald-500"
                        />
                        <span className="text-xs font-bold text-slate-600">Template Active</span>
                      </label>
                    </div>
                  </div>

                  {/* Subject Line if Email */}
                  {(selectedChannel === "EMAIL" || selectedChannel === "IN_APP") && (
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Email Subject Line</label>
                      <input
                        type="text"
                        placeholder="Enter email subject template..."
                        value={editSubject}
                        onChange={(e) => setEditSubject(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  )}

                  {/* Body Text Editor */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Message Body Template</label>
                      <span className="text-[10px] text-slate-400 font-bold">Variable braces format: `{'{'}variable_name{'}'}`</span>
                    </div>
                    <textarea
                      id="template-textarea"
                      rows={10}
                      placeholder="Write message template body content..."
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed font-mono"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={handleSaveTemplate}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
                    >
                      <ShieldCheck className="w-4 h-4" /> Save Template Configuration
                    </button>
                  </div>
                </div>

                {/* Variable Injector Sidebar */}
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-1.5 border-b border-slate-200/60 pb-2">
                      <Activity className="w-4 h-4 text-emerald-600" />
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Dynamic Placeholders</h3>
                    </div>
                    <p className="text-[10px] leading-relaxed text-slate-400">
                      Click any tag variable badge below to automatically inject it at your current text editor cursor position:
                    </p>

                    <div className="space-y-2 pt-2">
                      <button
                        onClick={() => injectVariable("student_name")}
                        className="w-full flex items-center justify-between p-2 rounded-lg bg-white border border-slate-150 hover:border-emerald-300 hover:bg-emerald-50/10 text-left transition-all text-xs font-semibold text-slate-700"
                      >
                        <span>{`{`}student_name{`}`}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Student Name</span>
                      </button>

                      <button
                        onClick={() => injectVariable("roll_no")}
                        className="w-full flex items-center justify-between p-2 rounded-lg bg-white border border-slate-150 hover:border-emerald-300 hover:bg-emerald-50/10 text-left transition-all text-xs font-semibold text-slate-700"
                      >
                        <span>{`{`}roll_no{`}`}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Roll Number</span>
                      </button>

                      <button
                        onClick={() => injectVariable("attendance_percentage")}
                        className="w-full flex items-center justify-between p-2 rounded-lg bg-white border border-slate-150 hover:border-emerald-300 hover:bg-emerald-50/10 text-left transition-all text-xs font-semibold text-slate-700"
                      >
                        <span>{`{`}attendance_percentage{`}`}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Attendance Standing</span>
                      </button>

                      <button
                        onClick={() => injectVariable("subject_name")}
                        className="w-full flex items-center justify-between p-2 rounded-lg bg-white border border-slate-150 hover:border-emerald-300 hover:bg-emerald-50/10 text-left transition-all text-xs font-semibold text-slate-700"
                      >
                        <span>{`{`}subject_name{`}`}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Subject Name</span>
                      </button>

                      <button
                        onClick={() => injectVariable("date")}
                        className="w-full flex items-center justify-between p-2 rounded-lg bg-white border border-slate-150 hover:border-emerald-300 hover:bg-emerald-50/10 text-left transition-all text-xs font-semibold text-slate-700"
                      >
                        <span>{`{`}date{`}`}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Date</span>
                      </button>

                      <button
                        onClick={() => injectVariable("hour")}
                        className="w-full flex items-center justify-between p-2 rounded-lg bg-white border border-slate-150 hover:border-emerald-300 hover:bg-emerald-50/10 text-left transition-all text-xs font-semibold text-slate-700"
                      >
                        <span>{`{`}hour{`}`}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Period Hour</span>
                      </button>

                      <button
                        onClick={() => injectVariable("summary_date")}
                        className="w-full flex items-center justify-between p-2 rounded-lg bg-white border border-slate-150 hover:border-emerald-300 hover:bg-emerald-50/10 text-left transition-all text-xs font-semibold text-slate-700"
                      >
                        <span>{`{`}summary_date{`}`}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">System Date</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* =================================================================
              TAB 2: TEST TRIGGER
              ================================================================= */}
          {!loading && activeTab === "trigger" && (
            <div className="space-y-6">
              
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Form config */}
                <div className="lg:col-span-2 space-y-5 bg-slate-50 border border-slate-100 p-5 rounded-xl">
                  <div className="flex gap-1.5 items-center border-b border-slate-200/60 pb-2">
                    <Sparkles className="w-4.5 h-4.5 text-emerald-600" />
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Manual Diagnostic Test Trigger</h3>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Student selector */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Select Target Student</label>
                      <select
                        value={selectedStudentRoll}
                        onChange={(e) => setSelectedStudentRoll(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
                      >
                        {studentsList.map(student => (
                          <option key={student.roll_no} value={student.roll_no}>
                            {student.roll_no} — {student.name}
                          </option>
                        ))}
                        {studentsList.length === 0 && (
                          <option value="">No students in database</option>
                        )}
                      </select>
                    </div>

                    {/* Trigger Selector */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Choose Trigger Event</label>
                      <select
                        value={selectedTriggerForTest}
                        onChange={(e) => setSelectedTriggerForTest(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
                      >
                        <option value="LOW_ATTENDANCE">Low Attendance (&lt;75% warning)</option>
                        <option value="ABSENT_ALERT">Absent Alert</option>
                        <option value="ATTENDANCE_SUMMARY">Daily Academic Consolidation Report</option>
                        <option value="ADMIN_ALERT">System Biometric Enrollment Notice</option>
                      </select>
                    </div>
                  </div>

                  {/* Channel selectors toggles */}
                  <div className="space-y-2 pt-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Active Dispatch Channels</label>
                    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                      <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        activeChannelsForTest.EMAIL
                          ? "bg-emerald-50/50 border-emerald-300 text-emerald-900 shadow-sm" 
                          : "bg-white border-slate-200 text-slate-500"
                      }`}>
                        <input
                          type="checkbox"
                          checked={activeChannelsForTest.EMAIL}
                          onChange={(e) => setActiveChannelsForTest(p => ({ ...p, EMAIL: e.target.checked }))}
                          className="w-4 h-4 rounded text-emerald-600 border-slate-200 focus:ring-emerald-500"
                        />
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-4 h-4" />
                          <span className="text-xs font-bold">Email</span>
                        </div>
                      </label>

                      <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        activeChannelsForTest.SMS
                          ? "bg-emerald-50/50 border-emerald-300 text-emerald-900 shadow-sm"
                          : "bg-white border-slate-200 text-slate-500"
                      }`}>
                        <input
                          type="checkbox"
                          checked={activeChannelsForTest.SMS}
                          onChange={(e) => setActiveChannelsForTest((p) => ({ ...p, SMS: e.target.checked }))}
                          className="w-4 h-4 rounded text-emerald-600 border-slate-200 focus:ring-emerald-500"
                        />
                        <div className="flex items-center gap-1.5">
                          <Smartphone className="w-4 h-4" />
                          <span className="text-xs font-bold">SMS</span>
                        </div>
                      </label>

                      <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        activeChannelsForTest.WHATSAPP
                          ? "bg-emerald-50/50 border-emerald-300 text-emerald-900 shadow-sm"
                          : "bg-white border-slate-200 text-slate-500"
                      }`}>
                        <input
                          type="checkbox"
                          checked={activeChannelsForTest.WHATSAPP}
                          onChange={(e) => setActiveChannelsForTest((p) => ({ ...p, WHATSAPP: e.target.checked }))}
                          className="w-4 h-4 rounded text-emerald-600 border-slate-200 focus:ring-emerald-500"
                        />
                        <div className="flex items-center gap-1.5">
                          <MessageSquare className="w-4 h-4" />
                          <span className="text-xs font-bold">WhatsApp</span>
                        </div>
                      </label>

                      <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        activeChannelsForTest.IN_APP
                          ? "bg-emerald-50/50 border-emerald-300 text-emerald-900 shadow-sm"
                          : "bg-white border-slate-200 text-slate-500"
                      }`}>
                        <input
                          type="checkbox"
                          checked={activeChannelsForTest.IN_APP}
                          onChange={(e) => setActiveChannelsForTest((p) => ({ ...p, IN_APP: e.target.checked }))}
                          className="w-4 h-4 rounded text-emerald-600 border-slate-200 focus:ring-emerald-500"
                        />
                        <div className="flex items-center gap-1.5">
                          <Bell className="w-4 h-4" />
                          <span className="text-xs font-bold">In-App</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Dispatch trigger CTA */}
                  <div className="pt-4 border-t border-slate-200/60 flex justify-end">
                    <button
                      onClick={handleTestTrigger}
                      disabled={isTriggering}
                      className="px-5 py-2.5 bg-slate-900 hover:bg-slate-950 text-white rounded-lg text-xs font-bold shadow-md transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                    >
                      <Bell className="w-4 h-4" /> Dispatch Diagnostic Test Alert
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-slate-900 text-white rounded-xl p-5 shadow-lg space-y-4 min-h-[300px] flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-[-50px] right-[-50px] w-48 h-48 rounded-full bg-emerald-500/10 blur-xl pointer-events-none" />
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">Gateway Logs</h3>
                      <p className="text-[10px] text-slate-400">Notification delivery activity:</p>
                    </div>

                    <div className="flex-1 flex flex-col justify-center items-center py-6 text-center space-y-3">
                      {isTriggering ? (
                        <>
                          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                          <p className="text-xs font-semibold text-emerald-400 px-4 leading-relaxed animate-pulse">{triggerStep}</p>
                        </>
                      ) : (
                        <>
                          <BookOpen className="w-10 h-10 text-slate-700" />
                          <p className="text-xs font-bold text-slate-400 px-6 leading-relaxed">
                            Awaiting manual dispatch. Click the dispatch button on the left to fire a test trigger sequence.
                          </p>
                        </>
                      )}
                    </div>

                    <div className="text-[9px] text-slate-500 font-semibold border-t border-slate-800 pt-3">
                      Gateway Server Host: sandbox-routing.hexaattender.net
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {!loading && activeTab === "schedules" && <NotificationSchedulesTab />}

          {/* =================================================================
              TAB 4: DISPATCH LOGS
              ================================================================= */}
          {!loading && activeTab === "logs" && (
            <div className="space-y-6">
              
              {/* Filter controls */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="relative w-full md:w-72">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-3.5 w-3.5 text-slate-400" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search by recipient or message contents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
                  />
                </div>

                <div className="flex gap-3 flex-wrap">
                  <div>
                    <select
                      value={channelFilter}
                      onChange={(e) => setChannelFilter(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
                    >
                      <option value="ALL">All Channels</option>
                      {CHANNEL_OPTIONS.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {ch.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="PENDING">Pending</option>
                      <option value="SENT">Sent</option>
                      <option value="FAILED">Failed</option>
                      <option value="READ">Read</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      const res = await bulkRetryFailed()
                      alert(`Queued ${res.queued} failed notifications for retry.`)
                      fetchLogs()
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold"
                  >
                    Retry All Failed
                  </button>
                </div>
              </div>

              {/* Logs Table */}
              <div className="overflow-x-auto border border-slate-150 rounded-xl bg-white shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Log ID</th>
                      <th className="py-3 px-3">Timestamp</th>
                      <th className="py-3 px-3">Recipient</th>
                      <th className="py-3 px-3">Trigger / Event</th>
                      <th className="py-3 px-3 text-center">Channel</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 font-semibold">
                          No notification dispatches found matching filters.
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-all">
                          <td className="py-3.5 px-4 font-bold text-slate-900">LOG-{log.id}</td>
                          <td className="py-3.5 px-3 text-slate-400 font-semibold">
                            {log.created_at ? new Date(log.created_at).toLocaleString() : ""}
                          </td>
                          <td className="py-3.5 px-3 font-bold text-slate-800">{log.recipient}</td>
                          <td className="py-3.5 px-3 font-semibold text-slate-650">{log.trigger_type}</td>
                          <td className="py-3.5 px-3 text-center">
                            <span className="inline-flex items-center justify-center p-1.5 rounded-lg bg-slate-100 text-slate-500">
                              {log.channel === "EMAIL" && <Mail className="w-3.5 h-3.5 text-indigo-600" />}
                              {log.channel === "WHATSAPP" && <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border ${
                              log.status === "SENT"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}>
                              {log.status === "SENT" ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                              {log.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => setInspectingLog(log)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded text-[10px] font-bold transition-all active:scale-95"
                            >
                              Inspect
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

        </div>
      </div>

      {/* Inspecting Log Modal */}
      {inspectingLog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Message Inspector (LOG-{inspectingLog.id})</span>
                <h4 className="text-xs font-bold text-slate-800 mt-0.5">{inspectingLog.recipient}</h4>
              </div>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-bold border uppercase ${
                inspectingLog.status === "SENT"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}>
                {inspectingLog.status}
              </span>
            </div>

            {inspectingLog.subject && (
              <div className="space-y-1">
                <span className="block text-[8px] font-bold text-slate-400 uppercase">Email Subject</span>
                <p className="text-xs font-bold text-slate-800 leading-snug">{inspectingLog.subject}</p>
              </div>
            )}

            <div className="space-y-1 bg-slate-50 border border-slate-100 p-4 rounded-xl">
              <span className="block text-[8px] font-bold text-slate-400 uppercase mb-1">Final Rendered Content</span>
              <p className="text-xs font-medium text-slate-700 whitespace-pre-line leading-relaxed font-mono">{inspectingLog.message_body}</p>
            </div>

            {inspectingLog.error_message && (
              <div className="flex gap-2 p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-lg text-[10px] font-bold leading-normal">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>Error details: {inspectingLog.error_message}</span>
              </div>
            )}

            {/* Retry metrics and details */}
            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
              <div>
                <span className="block font-bold text-slate-400 uppercase text-[8px]">Retry Attempts</span>
                <span className="font-semibold text-slate-700">{inspectingLog.retry_count || 0} times</span>
              </div>
              {inspectingLog.last_attempt_at && (
                <div>
                  <span className="block font-bold text-slate-400 uppercase text-[8px]">Last Attempt At</span>
                  <span className="font-semibold text-slate-700">{new Date(inspectingLog.last_attempt_at).toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              {inspectingLog.status === "FAILED" && (
                <button
                  onClick={() => handleRetryNotification(inspectingLog.id)}
                  disabled={retryingLogId === inspectingLog.id}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50 mr-2 flex items-center gap-1.5"
                >
                  {retryingLogId === inspectingLog.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  Retry Transmission
                </button>
              )}
              <button
                onClick={() => setInspectingLog(null)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-950 text-white rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
