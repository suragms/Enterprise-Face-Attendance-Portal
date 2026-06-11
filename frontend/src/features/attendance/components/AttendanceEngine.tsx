import React, { useState, useEffect, useRef } from "react"
import {
  Camera,
  RefreshCw,
  CheckCircle,
  Activity,
  Play,
  ClipboardList,
  ShieldCheck,
  ShieldAlert,
  Edit3,
  Lock,
  Unlock,
  Clock,
  UserX,
  UserCheck,
  FileCheck,
  Save,
  Zap
} from "lucide-react"
import { apiFetch } from "../../../lib/api"
import { useAuth } from "../../../context/AuthContext"
import {
  createAttendanceSession,
  openAttendanceSession,
  postSystemAttendance,
  validateAttendanceSession,
} from "../api"
import type { SessionStatus } from "../types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CorrectionRecord {
  id: number
  original_status: string
  new_status: string
  correction_note: string
  user_email: string
  user_name: string
  timestamp: string
}

interface StudentRow {
  id?: number // Django record ID
  roll: string
  name: string
  department: string
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"
  method: "FACE_RECOGNITION" | "MANUAL" | "SYSTEM" | "CORRECTION"
  confidence?: number
  corrections?: CorrectionRecord[]
}

interface Subject {
  subject_code: string
  name: string
  department: string
  semester: number
}

interface SessionInfo {
  id: number // 0 if not created on backend yet
  date: string
  hour: string
  subject: string
  subjectName: string
  sessionStatus: SessionStatus
}

interface ValidationResultState {
  isValid: boolean
  totalStrength: number
  totalRecords: number
  present: number
  absent: number
  late: number
  excused: number
  missingCount: number
  missingStudents: string[]
  duplicateEntries: string[]
  crossSubjectConflicts: Array<{ roll_no: string; other_subject: string }>
  rosterInvalidStudents: string[]
  correctedRecords: number
  attendancePercentage: number
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles = {
    PRESENT: "bg-emerald-50 text-emerald-700 border-emerald-250",
    ABSENT: "bg-rose-50 text-rose-700 border-rose-250",
    LATE: "bg-amber-50 text-amber-700 border-amber-250",
    EXCUSED: "bg-indigo-50 text-indigo-700 border-indigo-250"
  }
  const icons = {
    PRESENT: <UserCheck className="w-3 h-3 text-emerald-600" />,
    ABSENT: <UserX className="w-3 h-3 text-rose-600" />,
    LATE: <Clock className="w-3 h-3 text-amber-600" />,
    EXCUSED: <FileCheck className="w-3 h-3 text-indigo-650" />
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 border rounded text-[10px] font-bold ${styles[status as keyof typeof styles] || ""}`}>
      {icons[status as keyof typeof icons]}
      {status}
    </span>
  )
}

const MethodBadge: React.FC<{ method: string }> = ({ method }) => {
  const label = {
    FACE_RECOGNITION: "FR Auto",
    MANUAL: "Manual",
    SYSTEM: "System",
    CORRECTION: "Audited Correction"
  }
  const styles = {
    FACE_RECOGNITION: "bg-indigo-50 text-indigo-600 border-indigo-200",
    MANUAL: "bg-slate-50 text-slate-600 border-slate-200",
    SYSTEM: "bg-violet-50 text-violet-600 border-violet-200",
    CORRECTION: "bg-orange-50 text-orange-650 border-orange-200"
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 border rounded text-[9px] font-bold ${styles[method as keyof typeof styles] || ""}`}>
      {label[method as keyof typeof label] || method}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const AttendanceEngine: React.FC = () => {
  const { user } = useAuth()
  const role = user?.role
  const isHOD = role === "HOD" || role === "ORGANIZATION_ADMIN" || role === "BRANCH_ADMIN"
  const isFaculty = role === "FACULTY"

  // Tab state
  const [activeTab, setActiveTab] = useState<"automatic" | "manual" | "system" | "correction" | "validation">("automatic")

  // Subjects lists
  const [subjects, setSubjects] = useState<Subject[]>([])
  
  // Shared session configuration
  const [sessionDate, setSessionDate] = useState(() => {
    const d = new Date()
    const offset = d.getTimezoneOffset()
    const localDate = new Date(d.getTime() - (offset * 60 * 1000))
    return localDate.toISOString().split('T')[0]
  })
  const [sessionHour, setSessionHour] = useState("I")
  const [sessionSubject, setSessionSubject] = useState("")

  // Loading States
  const [, setIsLoadingSubjects] = useState(false)
  const [isLoadingSession, setIsLoadingSession] = useState(false)

  // Current session details
  const [session, setSession] = useState<SessionInfo>({
    id: 0,
    date: sessionDate,
    hour: sessionHour,
    subject: "",
    subjectName: "",
    sessionStatus: "OPEN"
  })

  // Classroom roster entries
  const [roster, setRoster] = useState<StudentRow[]>([])

  // Submit / Transaction states
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)

  // Helper to determine if current session is locked for lecturer/staff writes
  const isLockedForLecturer = session.sessionStatus === "SUBMITTED" || session.sessionStatus === "APPROVED" || session.sessionStatus === "LOCKED"

  // Load subjects on mount
  useEffect(() => {
    const fetchSubjects = async () => {
      setIsLoadingSubjects(true)
      try {
        const data = await apiFetch("/subjects/")
        const list = data.results || data
        if (list && list.length > 0) {
          setSubjects(list)
          setSessionSubject(list[0].subject_code)
        }
      } catch (e) {
        console.error("Failed to load subjects:", e)
      } finally {
        setIsLoadingSubjects(false)
      }
    }
    fetchSubjects()
  }, [])

  // Find active subject metadata
  const activeSubject = subjects.find(s => s.subject_code === sessionSubject)

  // Fetch session details whenever date, hour, or subject changes
  const fetchSessionData = async () => {
    if (!sessionSubject) return
    setIsLoadingSession(true)
    setSubmitError(null)
    setSubmitSuccess(null)
    try {
      const data = await apiFetch(`/attendance/sessions/?date=${sessionDate}&hour=${sessionHour}&subject=${sessionSubject}`)
      const sessions = data.results || data
      
      if (sessions && sessions.length > 0) {
        // Session exists in DB
        const sess = sessions[0]
        setSession({
          id: sess.id,
          date: sess.date,
          hour: sess.hour,
          subject: sess.subject_code,
          subjectName: sess.subject_name,
          sessionStatus: sess.session_status
        })

        // Normalize DB records
        const normalized: StudentRow[] = (sess.records || []).map((r: any) => ({
          id: r.id,
          roll: r.student_roll,
          name: r.student_name,
          department: r.student_department,
          status: r.status,
          method: r.capture_method,
          confidence: r.confidence_score,
          corrections: r.corrections || []
        }))
        setRoster(normalized)
      } else {
        // Session doesn't exist yet
        setSession({
          id: 0,
          date: sessionDate,
          hour: sessionHour,
          subject: sessionSubject,
          subjectName: activeSubject?.name || "",
          sessionStatus: "OPEN"
        })

        // Fetch student cohort list
        if (activeSubject) {
          const sData = await apiFetch(`/students/?department=${activeSubject.department}&semester=${activeSubject.semester}&is_archived=false&page_size=100`)
          const studentsList = sData.results || sData
          const normalized: StudentRow[] = studentsList.map((s: any) => ({
            roll: s.roll_no,
            name: s.name,
            department: s.department,
            status: "ABSENT" as const,
            method: "MANUAL" as const,
            corrections: []
          }))
          setRoster(normalized)
        }
      }
    } catch (e: any) {
      console.error("Error loading session:", e)
      setSubmitError(e.message || "Failed to load session roster.")
    } finally {
      setIsLoadingSession(false)
    }
  }

  useEffect(() => {
    fetchSessionData()
  }, [sessionDate, sessionHour, sessionSubject, activeSubject])

  // ======================== TAB 1: AUTOMATIC ATTENDANCE ========================
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scanComplete, setScanComplete] = useState(false)
  
  // Liveness Detection HUD States
  const [livenessScore, setLivenessScore] = useState<number | null>(null)
  const [livenessChecks, setLivenessChecks] = useState<{
    photo_attack_prevented: boolean
    screen_attack_prevented: boolean
    eye_blink_passed: boolean
    pose_validation_passed: boolean
  } | null>(null)
  const [livenessDetails, setLivenessDetails] = useState<{
    laplacian_variance: number
    fft_ratio: number
    ear_average: number
    pose_ratio: number
  } | null>(null)

  const [autoResults, setAutoResults] = useState<StudentRow[]>([])
  // const [autoSubmitted, setAutoSubmitted] = useState(false)

  // Start Camera
  const startCamera = async () => {
    setLivenessScore(null)
    setLivenessChecks(null)
    setLivenessDetails(null)
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" }
      })
      setStream(mediaStream)
      setCameraActive(true)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (err) {
      console.error("Webcam startup failed:", err)
      alert("Unable to access camera hardware. Verify permissions.")
    }
  }

  // Stop Camera
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setCameraActive(false)
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext("2d")
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }

  // Cleanup camera stream on tab switch / unmount
  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop())
    }
  }, [stream])

  useEffect(() => {
    stopCamera()
    setScanComplete(false)
    setAutoResults([])
  }, [activeTab])

  // Capture JPG image base64
  const captureFrame = (): string | null => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas")
      canvas.width = videoRef.current.videoWidth || 640
      canvas.height = videoRef.current.videoHeight || 480
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
        return canvas.toDataURL("image/jpeg", 0.9)
      }
    }
    return null
  }

  // Run Biometric Scan
  const handleAutoScan = async () => {
    setIsScanning(true)
    setScanComplete(false)
    setAutoResults([])
    setSubmitError(null)
    setSubmitSuccess(null)

    if (!cameraActive) {
      await startCamera()
      await new Promise(resolve => setTimeout(resolve, 800))
    }

    const base64Image = captureFrame()
    if (!base64Image) {
      setSubmitError("Failed to extract frame from webcam.")
      setIsScanning(false)
      return
    }

    try {
      const data = await apiFetch("/face-recognition/detect/", {
        method: "POST",
        body: { image: base64Image }
      })

      const scanned: StudentRow[] = (data.identified || []).map((f: any) => ({
        roll: f.roll_no,
        name: f.name,
        department: activeSubject?.department || "",
        status: "PRESENT" as const,
        method: "FACE_RECOGNITION" as const,
        confidence: f.confidence
      }))

      setAutoResults(scanned)
      setLivenessScore(data.liveness_score ?? null)
      setLivenessChecks(data.liveness_checks ?? null)
      setLivenessDetails(data.liveness_details ?? null)
      setScanComplete(true)
    } catch (e: any) {
      setSubmitError(e.message || "Face recognition detection failed.")
      const data = e.data || {}
      if (data.liveness_score !== undefined) setLivenessScore(data.liveness_score)
      if (data.liveness_checks !== undefined) setLivenessChecks(data.liveness_checks)
      if (data.liveness_details !== undefined) setLivenessDetails(data.liveness_details)
    } finally {
      setIsScanning(false)
    }
  }

  // Save Face Recognition auto marking
  const handleAutoSubmit = async () => {
    if (autoResults.length === 0) return
    if (livenessScore !== null && livenessScore < 60) {
      setSubmitError("Transaction Blocked: Biometric liveness check failed. Spoofed source detected.")
      return
    }
    setIsLoadingSession(true)
    setSubmitSuccess(null)
    setSubmitError(null)

    const entries = autoResults.map(r => ({
      roll_no: r.roll,
      status: "PRESENT",
      confidence_score: r.confidence
    }))

    try {
      const res = await apiFetch("/attendance/engine/automatic/", {
        method: "POST",
        body: {
          date: sessionDate,
          hour: sessionHour,
          subject_id: sessionSubject,
          entries
        }
      })
      setSubmitSuccess(res.message || "Automatic recognition records posted successfully.")
      stopCamera()
      fetchSessionData()
    } catch (e: any) {
      setSubmitError(e.message || "Failed to submit automatic attendance.")
    } finally {
      setIsLoadingSession(false)
    }
  }

  // ======================== TAB 2: MANUAL ATTENDANCE ========================
  const [manualStudents, setManualStudents] = useState<StudentRow[]>([])
  const [manualProcessing, setManualProcessing] = useState(false)
  const [manualOverrideReason, setManualOverrideReason] = useState("")

  // Populate manual roster from loaded session roster
  useEffect(() => {
    setManualStudents(roster)
  }, [roster])

  const handleManualStatusChange = (roll: string, newStatus: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED") => {
    if (isLockedForLecturer) return
    setManualStudents(prev =>
      prev.map(s => s.roll === roll ? { ...s, status: newStatus, method: "MANUAL" } : s)
    )
  }

  const handleManualMarkAll = (newStatus: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED") => {
    if (isLockedForLecturer) return
    setManualStudents(prev =>
      prev.map(s => ({ ...s, status: newStatus, method: "MANUAL" }))
    )
  }

  const handleManualSubmit = async () => {
    if (!manualOverrideReason.trim()) {
      setSubmitError("Manual override reason is required for manual attendance verification.")
      return
    }
    setManualProcessing(true)
    setSubmitError(null)
    setSubmitSuccess(null)

    const entries = manualStudents.map(s => ({
      roll_no: s.roll,
      status: s.status
    }))

    try {
      const res = await apiFetch("/attendance/engine/manual/", {
        method: "POST",
        body: {
          date: sessionDate,
          hour: sessionHour,
          subject_id: sessionSubject,
          override_reason: manualOverrideReason.trim(),
          entries
        }
      })
      setSubmitSuccess(res.message || "Manual attendance sheet posted successfully.")
      fetchSessionData()
    } catch (e: any) {
      setSubmitError(e.message || "Failed to submit manual attendance.")
    } finally {
      setManualProcessing(false)
    }
  }

  const [systemProcessing, setSystemProcessing] = useState(false)

  const handleSystemMarkAbsent = () => {
    if (isLockedForLecturer) return
    setManualStudents(prev => prev.map(s => ({ ...s, status: "ABSENT" as const, method: "SYSTEM" as const })))
  }

  const handleSystemSubmit = async () => {
    setSystemProcessing(true)
    setSubmitError(null)
    setSubmitSuccess(null)
    const entries = manualStudents.map(s => ({ roll_no: s.roll, status: s.status }))
    try {
      const res = await postSystemAttendance({
        date: sessionDate,
        hour: sessionHour,
        subject_id: sessionSubject,
        session_id: session.id || undefined,
        entries,
      })
      setSubmitSuccess(res.message || "System attendance posted.")
      fetchSessionData()
    } catch (e: any) {
      setSubmitError(e.message || "Failed to post system attendance.")
    } finally {
      setSystemProcessing(false)
    }
  }

  // ======================== TAB 3: ATTENDANCE CORRECTION =====================
  const [editingRoll, setEditingRoll] = useState<string | null>(null)
  const [correctionNotesText, setCorrectionNotesText] = useState("")
  const [correctionNewStatus, setCorrectionNewStatus] = useState<"PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "">("")
  const [correctionProcessing, setCorrectionProcessing] = useState(false)

  const handleCorrection = async (rId: number, roll: string) => {
    if (!rId) {
      setSubmitError("Attendance record ID is missing. Create the session first by submitting attendance.")
      return
    }
    if (!correctionNewStatus) return
    if (!correctionNotesText.trim()) return

    setCorrectionProcessing(true)
    setSubmitError(null)
    setSubmitSuccess(null)

    try {
      await apiFetch("/attendance/engine/correct/", {
        method: "POST",
        body: {
          record_id: rId,
          new_status: correctionNewStatus,
          correction_notes: correctionNotesText
        }
      })
      setSubmitSuccess(`Correction submitted: Roll ${roll} set to ${correctionNewStatus}.`)
      setEditingRoll(null)
      setCorrectionNotesText("")
      setCorrectionNewStatus("")
      fetchSessionData()
    } catch (e: any) {
      setSubmitError(e.message || "Failed to commit audited correction.")
    } finally {
      setCorrectionProcessing(false)
    }
  }

  // ======================== TAB 4: ATTENDANCE VALIDATION & LOCK =====================
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResultState | null>(null)

  const handleValidate = async () => {
    if (session.id === 0) {
      alert("No database session exists yet. Please submit draft attendance first.")
      return
    }
    setIsValidating(true)
    setValidationResult(null)
    setSubmitError(null)
    setSubmitSuccess(null)
    try {
      const data = await validateAttendanceSession(session.id)
      setValidationResult(data)
    } catch (e: any) {
      setSubmitError(e.message || "Failed to run validation checks.")
    } finally {
      setIsValidating(false)
    }
  }

  const handleSubmitSession = async () => {
    setIsLoadingSession(true)
    setSubmitError(null)
    setSubmitSuccess(null)
    try {
      const data = await apiFetch(`/attendance/sessions/${session.id}/submit/`, {
        method: "POST"
      })
      setSubmitSuccess(data.message || "Roster submitted for HOD approval.")
      setValidationResult(null)
      fetchSessionData()
    } catch (e: any) {
      setSubmitError(e.message || "Failed to submit session roster.")
    } finally {
      setIsLoadingSession(false)
    }
  }

  const handleApproveSession = async () => {
    setIsLoadingSession(true)
    setSubmitError(null)
    setSubmitSuccess(null)
    try {
      const data = await apiFetch(`/attendance/sessions/${session.id}/approve/`, {
        method: "POST"
      })
      setSubmitSuccess(data.message || "Attendance session approved by HOD.")
      setValidationResult(null)
      fetchSessionData()
    } catch (e: any) {
      setSubmitError(e.message || "Failed to approve session.")
    } finally {
      setIsLoadingSession(false)
    }
  }

  const handleRejectSession = async () => {
    setIsLoadingSession(true)
    setSubmitError(null)
    setSubmitSuccess(null)
    try {
      const data = await apiFetch(`/attendance/sessions/${session.id}/reject/`, {
        method: "POST"
      })
      setSubmitSuccess(data.message || "Attendance session rejected. Faculty can reopen to edit.")
      setValidationResult(null)
      fetchSessionData()
    } catch (e: any) {
      setSubmitError(e.message || "Failed to reject session.")
    } finally {
      setIsLoadingSession(false)
    }
  }

  const handleLockSession = async () => {
    setIsLoadingSession(true)
    setSubmitError(null)
    setSubmitSuccess(null)
    try {
      const data = await apiFetch(`/attendance/sessions/${session.id}/lock/`, {
        method: "POST"
      })
      setSubmitSuccess(data.message || "Attendance session finalized and permanently locked.")
      setValidationResult(null)
      fetchSessionData()
    } catch (e: any) {
      setSubmitError(e.message || "Failed to lock session.")
    } finally {
      setIsLoadingSession(false)
    }
  }

  const handleUnlockSession = async () => {
    setIsLoadingSession(true)
    setSubmitError(null)
    setSubmitSuccess(null)
    try {
      const data = await apiFetch(`/attendance/sessions/${session.id}/unlock/`, {
        method: "POST"
      })
      setSubmitSuccess(data.message || "Attendance session unlocked back to APPROVED.")
      setValidationResult(null)
      fetchSessionData()
    } catch (e: any) {
      setSubmitError(e.message || "Failed to unlock session.")
    } finally {
      setIsLoadingSession(false)
    }
  }

  const handleOpenSession = async () => {
    if (!session.id) return
    setIsLoadingSession(true)
    setSubmitError(null)
    try {
      await openAttendanceSession(session.id)
      setSubmitSuccess("Session reopened for editing.")
      fetchSessionData()
    } catch (e: any) {
      setSubmitError(e.message || "Failed to open session.")
    } finally {
      setIsLoadingSession(false)
    }
  }

  const handleCreateSession = async () => {
    if (!sessionSubject) return
    setIsLoadingSession(true)
    setSubmitError(null)
    try {
      await createAttendanceSession({
        date: sessionDate,
        hour: sessionHour,
        subject_id: sessionSubject,
      })
      setSubmitSuccess("Attendance session created (OPEN).")
      fetchSessionData()
    } catch (e: any) {
      setSubmitError(e.message || "Failed to create session.")
    } finally {
      setIsLoadingSession(false)
    }
  }

  const tabs = [
    { key: "automatic" as const, label: "Face Recognition", icon: Zap },
    { key: "manual" as const, label: "Manual", icon: ClipboardList },
    { key: "system" as const, label: "System", icon: Activity },
    { key: "correction" as const, label: "Correction", icon: Edit3 },
    { key: "validation" as const, label: "Workflow", icon: FileCheck }
  ]

  const getStatusBadge = (status: SessionInfo["sessionStatus"]) => {
    switch (status) {
      case "OPEN":
        return <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-extrabold border bg-emerald-50 text-emerald-700 border-emerald-200"><Unlock className="w-3 h-3" /> OPEN</span>
      case "SUBMITTED":
        return <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-extrabold border bg-indigo-50 text-indigo-700 border-indigo-200"><Clock className="w-3 h-3 animate-spin text-indigo-650" /> SUBMITTED</span>
      case "APPROVED":
        return <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-extrabold border bg-emerald-50 text-emerald-700 border-emerald-200"><CheckCircle className="w-3 h-3 text-emerald-600" /> APPROVED</span>
      case "REJECTED":
        return <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-extrabold border bg-rose-50 text-rose-700 border-rose-200"><ShieldAlert className="w-3 h-3" /> REJECTED</span>
      case "LOCKED":
        return <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-extrabold border bg-slate-100 text-slate-600 border-slate-200"><Lock className="w-3 h-3 text-slate-500" /> LOCKED</span>
      default:
        return <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-extrabold border bg-slate-100 text-slate-600 border-slate-200">UNKNOWN</span>
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
        <div>
          <span className="text-[9px] font-extrabold tracking-widest text-emerald-600 uppercase bg-emerald-50 px-2 py-0.5 rounded-full mb-1 inline-block">Enterprise Attendance Engine</span>
          <h2 className="text-xl font-bold text-slate-800">Attendance Manager</h2>
          <p className="text-xs text-slate-400">Automatic & manual recording, timezone-aware audits, validation checks, and HOD approval lifecycle</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-full text-[10px] font-extrabold bg-slate-50 text-slate-600">
            Role: <span className="text-slate-800 uppercase">{isHOD ? "HOD / Admin" : "Lecturer / Staff"}</span>
          </div>
          {getStatusBadge(session.sessionStatus)}
        </div>
      </div>

      {/* Session Config Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date</label>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Period Hour</label>
            <select
              value={sessionHour}
              onChange={(e) => setSessionHour(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="I">Period I (08:30 AM)</option>
              <option value="II">Period II (09:30 AM)</option>
              <option value="III">Period III (10:30 AM)</option>
              <option value="IV">Period IV (11:30 AM)</option>
              <option value="V">Period V (01:30 PM)</option>
              <option value="VI">Period VI (02:30 PM)</option>
              <option value="VII">Period VII (03:30 PM)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Subject</label>
            <select
              value={sessionSubject}
              onChange={(e) => setSessionSubject(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {subjects.map(s => (
                <option key={s.subject_code} value={s.subject_code}>
                  {s.subject_code} — {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end sm:col-span-1">
            <div className="w-full grid grid-cols-4 gap-1 text-center">
              <div className="p-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                <span className="block text-[8px] font-bold text-slate-400 uppercase">Pres</span>
                <span className="block text-xs font-extrabold text-emerald-700">
                  {roster.filter(s => s.status === "PRESENT").length}
                </span>
              </div>
              <div className="p-1.5 bg-rose-50 rounded-lg border border-rose-100">
                <span className="block text-[8px] font-bold text-slate-400 uppercase">Abs</span>
                <span className="block text-xs font-extrabold text-rose-700">
                  {roster.filter(s => s.status === "ABSENT").length}
                </span>
              </div>
              <div className="p-1.5 bg-amber-50 rounded-lg border border-amber-100">
                <span className="block text-[8px] font-bold text-slate-400 uppercase">Late</span>
                <span className="block text-xs font-extrabold text-amber-700">
                  {roster.filter(s => s.status === "LATE").length}
                </span>
              </div>
              <div className="p-1.5 bg-indigo-50 rounded-lg border border-indigo-100">
                <span className="block text-[8px] font-bold text-slate-400 uppercase">Exc</span>
                <span className="block text-xs font-extrabold text-indigo-700">
                  {roster.filter(s => s.status === "EXCUSED").length}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {session.id === 0 ? (
            <button
              type="button"
              onClick={handleCreateSession}
              disabled={isLoadingSession || !sessionSubject}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Create Session
            </button>
          ) : null}
          {session.sessionStatus === "REJECTED" && (isFaculty || isHOD) ? (
            <button
              type="button"
              onClick={handleOpenSession}
              disabled={isLoadingSession}
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
            >
              Open Session
            </button>
          ) : null}
          <span className="text-[10px] text-slate-400 self-center">
            Lifecycle: Create → Open → Capture → Submit → Approve → Lock
          </span>
        </div>
      </div>

      {/* Submit Success / Error Display */}
      {submitSuccess && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold leading-normal flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{submitSuccess}</span>
        </div>
      )}
      {submitError && (
        <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs font-semibold leading-normal flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Tab Container */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 py-3.5 px-5 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
                  activeTab === tab.key
                    ? "border-emerald-600 text-emerald-700 bg-emerald-50/30"
                    : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* ================================================================
            TAB 1: AUTOMATIC ATTENDANCE (Face Recognition)
            ================================================================ */}
        {activeTab === "automatic" && (
          <div className="p-6 space-y-5">
            {isLoadingSession ? (
              <div className="py-20 text-center text-slate-400 text-xs font-semibold animate-pulse">Loading session data...</div>
            ) : (
              <div className="grid gap-5 lg:grid-cols-3">
                {/* Camera Viewport */}
                <div className="bg-slate-950 border border-slate-900 rounded-xl overflow-hidden relative min-h-[300px] flex items-center justify-center lg:col-span-2 group">
                  {cameraActive ? (
                    <div className="w-full h-full relative">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover scale-x-[-1]"
                      />
                      <canvas
                        ref={canvasRef}
                        className="absolute inset-0 w-full h-full pointer-events-none scale-x-[-1]"
                      />

                      {/* Liveness Telemetry HUD */}
                      {livenessScore !== null && (
                        <div className="absolute inset-0 z-20 flex flex-col justify-between p-4 pointer-events-none">
                          {/* Top Banner Alert */}
                          <div className="w-full flex justify-center pointer-events-auto">
                            {livenessScore >= 60 ? (
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600/90 text-white rounded-full text-[10px] font-bold shadow-lg backdrop-blur-md border border-emerald-500/30">
                                <ShieldCheck className="w-3.5 h-3.5 text-white" />
                                <span>LIVENESS VERIFIED: {livenessScore}%</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1 w-full max-w-xs px-4 py-2 bg-rose-600/95 text-white rounded-xl text-[10px] font-bold shadow-lg backdrop-blur-md border border-rose-500/30">
                                <div className="flex items-center gap-1.5">
                                  <ShieldAlert className="w-4 h-4 text-white animate-pulse" />
                                  <span className="uppercase tracking-wider">Spoofing Attack Blocked</span>
                                </div>
                                <span className="text-[9px] text-rose-100 font-medium text-center leading-tight">
                                  {!livenessChecks?.photo_attack_prevented && "• Low sharpness texture blur "}
                                  {!livenessChecks?.screen_attack_prevented && "• Screen moiré recapture pattern "}
                                  {!livenessChecks?.eye_blink_passed && "• Static EAR eye checks failed "}
                                  {!livenessChecks?.pose_validation_passed && "• Pose perspective clash "}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Bottom Metrics HUD */}
                          <div className="w-full flex gap-3 items-end justify-between mt-auto pointer-events-auto">
                            <div className="bg-slate-900/80 border border-white/10 p-2.5 rounded-2xl flex flex-col items-center justify-center text-center shadow-lg w-20 backdrop-blur-md">
                              <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Liveness</span>
                              <span className={`text-xs font-black mt-1 ${livenessScore >= 60 ? "text-emerald-400" : "text-rose-400"}`}>
                                {Math.round(livenessScore)}%
                              </span>
                            </div>

                            <div className="bg-slate-900/80 border border-white/10 p-2.5 rounded-2xl flex-1 shadow-lg max-w-[240px] backdrop-blur-md">
                              <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Anti-Spoof Telemetry</span>
                              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[8px] font-semibold text-slate-300">
                                <div className="flex items-center justify-between">
                                  <span>Sharpness (Lap):</span>
                                  <span className={livenessChecks?.photo_attack_prevented ? "text-emerald-400" : "text-rose-400"}>
                                    {livenessDetails?.laplacian_variance?.toFixed(1) || "0.0"}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>FFT Moiré:</span>
                                  <span className={livenessChecks?.screen_attack_prevented ? "text-emerald-400" : "text-rose-400"}>
                                    {livenessDetails?.fft_ratio?.toFixed(3) || "0.000"}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>EAR Blink:</span>
                                  <span className={livenessChecks?.eye_blink_passed ? "text-emerald-400" : "text-rose-400"}>
                                    {livenessDetails?.ear_average?.toFixed(3) || "0.000"}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>Pose Ratio:</span>
                                  <span className={livenessChecks?.pose_validation_passed ? "text-emerald-400" : "text-rose-400"}>
                                    {livenessDetails?.pose_ratio?.toFixed(2) || "0.00"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-slate-500 p-8 space-y-3 z-0">
                      <Camera className="w-12 h-12 mx-auto text-slate-700" />
                      <div>
                        <p className="text-sm font-semibold text-slate-400">CAMERA FEED STANDBY</p>
                        <p className="text-xs text-slate-600 mt-1">Activate camera feed to initialize automatic biometric check-ins</p>
                      </div>
                    </div>
                  )}

                  {/* Scanning Sweeper */}
                  {isScanning && (
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/25 to-transparent animate-pulse pointer-events-none z-10 border-t-2 border-emerald-500" />
                  )}

                  {/* Bottom Stats Overlay */}
                  <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center z-10">
                    <div className="flex items-center gap-1.5 text-[9px] font-bold bg-slate-950/80 text-emerald-400 px-2 py-1 rounded border border-slate-800 pointer-events-auto">
                      <Activity className={`w-3.5 h-3.5 text-emerald-500 ${isScanning ? "animate-pulse" : ""}`} />
                      <span>{isScanning ? "SCANNING_CLASSROOM" : (cameraActive ? "CAMERA_ACTIVE" : "STANDBY")}</span>
                    </div>
                    <div className="text-[9px] font-semibold text-slate-400 bg-slate-950/80 px-2 py-1 rounded border border-slate-800">
                      FPS: 30 | RES: 1280x720
                    </div>
                  </div>
                </div>

                {/* Controls & Roster Log */}
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Automatic Scanner Capture</h3>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Initialize RetinaFace detection & ArcFace embedding matcher directly over webcam frames.
                    </p>

                    {isLockedForLecturer ? (
                      <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 text-[10px] font-bold text-center">
                        🔒 LOCKED: READ ONLY FOR LECTURERS
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          {cameraActive ? (
                            <button
                              onClick={stopCamera}
                              className="py-2.5 bg-slate-200 hover:bg-slate-350 text-slate-700 rounded-lg text-xs font-bold transition-all"
                            >
                              Shutdown Camera
                            </button>
                          ) : (
                            <button
                              onClick={startCamera}
                              className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all"
                            >
                              Activate Camera
                            </button>
                          )}
                          <button
                            onClick={handleAutoScan}
                            disabled={isScanning}
                            className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1"
                          >
                            <Play className="w-3 h-3 fill-current" /> {isScanning ? "Scanning..." : "Capture Scan"}
                          </button>
                        </div>

                        {scanComplete && autoResults.length > 0 && (livenessScore === null || livenessScore >= 60) && (
                          <button
                            onClick={handleAutoSubmit}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
                          >
                            <Save className="w-3.5 h-3.5" /> Submit Detected Roster ({autoResults.length})
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Detected Log list */}
                  {scanComplete && (
                    <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Identified Logs</span>
                      {autoResults.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No faces matching active database registry profiles detected.</p>
                      ) : (
                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                          {autoResults.map(r => (
                            <div key={r.roll} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                              <div>
                                <span className="text-xs font-bold text-slate-800 block">{r.name}</span>
                                <span className="text-[10px] text-slate-400">{r.roll}</span>
                              </div>
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[9px] font-bold">
                                {Math.round(r.confidence || 0)}% MATCH
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================
            TAB 2: MANUAL ATTENDANCE
            ================================================================ */}
        {activeTab === "manual" && (
          <div className="p-6 space-y-5">
            {isLoadingSession ? (
              <div className="py-20 text-center text-slate-400 text-xs font-semibold animate-pulse">Loading session data...</div>
            ) : (
              <>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Student Roster — Mark Attendance Manually</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase mr-1">Mark All:</span>
                    <button
                      onClick={() => handleManualMarkAll("PRESENT")}
                      disabled={isLockedForLecturer}
                      className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-250 rounded text-[9px] font-bold transition-all disabled:opacity-50"
                    >
                      Present
                    </button>
                    <button
                      onClick={() => handleManualMarkAll("ABSENT")}
                      disabled={isLockedForLecturer}
                      className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-250 rounded text-[9px] font-bold transition-all disabled:opacity-50"
                    >
                      Absent
                    </button>
                    <button
                      onClick={() => handleManualMarkAll("LATE")}
                      disabled={isLockedForLecturer}
                      className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-250 rounded text-[9px] font-bold transition-all disabled:opacity-50"
                    >
                      Late
                    </button>
                    <button
                      onClick={() => handleManualMarkAll("EXCUSED")}
                      disabled={isLockedForLecturer}
                      className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-250 rounded text-[9px] font-bold transition-all disabled:opacity-50"
                    >
                      Excused
                    </button>
                  </div>
                </div>

                {/* Grid Roster Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-inner">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-55 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4">Roll Number</th>
                        <th className="py-3 px-4">Student Name</th>
                        <th className="py-3 px-4">Department</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-center">Roster Options</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {manualStudents.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-slate-400 italic">
                            No students registered for this department and semester.
                          </td>
                        </tr>
                      ) : (
                        manualStudents.map(s => (
                          <tr key={s.roll} className="hover:bg-slate-50/50 transition-all">
                            <td className="py-3.5 px-4 font-bold text-slate-900">{s.roll}</td>
                            <td className="py-3.5 px-4">{s.name}</td>
                            <td className="py-3.5 px-4 text-slate-500">{s.department}</td>
                            <td className="py-3.5 px-4 text-center">
                              <StatusBadge status={s.status} />
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {(["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const).map(st => {
                                  const config = {
                                    PRESENT: { bg: "bg-emerald-600", hover: "hover:bg-emerald-50 hover:text-emerald-600", text: "text-emerald-600" },
                                    ABSENT: { bg: "bg-rose-600", hover: "hover:bg-rose-50 hover:text-rose-600", text: "text-rose-600" },
                                    LATE: { bg: "bg-amber-500", hover: "hover:bg-amber-50 hover:text-amber-600", text: "text-amber-600" },
                                    EXCUSED: { bg: "bg-indigo-650", hover: "hover:bg-indigo-50 hover:text-indigo-650", text: "text-indigo-650" }
                                  }
                                  const icon = {
                                    PRESENT: <UserCheck className="w-3.5 h-3.5" />,
                                    ABSENT: <UserX className="w-3.5 h-3.5" />,
                                    LATE: <Clock className="w-3.5 h-3.5" />,
                                    EXCUSED: <FileCheck className="w-3.5 h-3.5" />
                                  }
                                  const isActive = s.status === st
                                  return (
                                    <button
                                      key={st}
                                      onClick={() => handleManualStatusChange(s.roll, st)}
                                      disabled={isLockedForLecturer}
                                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                        isActive ? `${config[st].bg} text-white shadow-sm` : `bg-slate-50 text-slate-400 ${config[st].hover}`
                                      } disabled:opacity-40`}
                                      title={st}
                                    >
                                      {icon[st]}
                                    </button>
                                  )
                                })}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Submissions */}
                <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
                  <div className="flex flex-col gap-2 text-xs text-slate-500 font-semibold min-w-[320px]">
                    <span>{manualStudents.length} Students roster strength</span>
                    <input
                      value={manualOverrideReason}
                      onChange={(e) => setManualOverrideReason(e.target.value)}
                      placeholder="Manual override reason (required)"
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700"
                      disabled={isLockedForLecturer || manualProcessing}
                    />
                  </div>
                  {!isLockedForLecturer && manualStudents.length > 0 && (
                    <button
                      onClick={handleManualSubmit}
                      disabled={manualProcessing}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
                    >
                      {manualProcessing ? (
                        <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Committing...</>
                      ) : (
                        <><Save className="w-4 h-4" /> Save manual attendance</>
                      )}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "system" && (
          <div className="p-6 space-y-5">
            <p className="text-xs text-slate-500">
              System capture marks bulk roster states (imports, integrations, or default absent roll call).
            </p>
            {isLoadingSession ? (
              <div className="py-12 text-center text-slate-400 text-xs">Loading roster...</div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSystemMarkAbsent}
                    disabled={isLockedForLecturer}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Mark all ABSENT
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">Roll</th>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {manualStudents.map((s) => (
                        <tr key={s.roll} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-semibold">{s.roll}</td>
                          <td className="px-3 py-2">{s.name}</td>
                          <td className="px-3 py-2">
                            <select
                              value={s.status}
                              disabled={isLockedForLecturer}
                              onChange={(e) =>
                                handleManualStatusChange(s.roll, e.target.value as StudentRow["status"])
                              }
                              className="rounded border border-slate-200 px-2 py-1 text-[10px]"
                            >
                              <option value="PRESENT">PRESENT</option>
                              <option value="ABSENT">ABSENT</option>
                              <option value="LATE">LATE</option>
                              <option value="EXCUSED">EXCUSED</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!isLockedForLecturer && manualStudents.length > 0 ? (
                  <button
                    type="button"
                    onClick={handleSystemSubmit}
                    disabled={systemProcessing}
                    className="rounded-lg bg-violet-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {systemProcessing ? "Posting..." : "Post system attendance"}
                  </button>
                ) : null}
              </>
            )}
          </div>
        )}

        {/* ================================================================
            TAB 3: ATTENDANCE CORRECTION (With Audit Trail Logs)
            ================================================================ */}
        {activeTab === "correction" && (
          <div className="p-6 space-y-5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Attendance Correction Registry (Audited Overrides)</h3>
            
            {isLoadingSession ? (
              <div className="py-20 text-center text-slate-400 text-xs font-semibold animate-pulse">Loading session data...</div>
            ) : session.id === 0 ? (
              <div className="p-8 border border-dashed border-slate-200 bg-slate-50 rounded-2xl text-center text-slate-400 text-xs font-semibold">
                No active session found. Submit automatic/manual attendance first to initialize logs before applying corrections.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Roll No</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Capture Method</th>
                      <th className="py-3 px-4 text-center">Audit Trail Logs</th>
                      <th className="py-3 px-4 text-center">Audited Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {roster.map(s => {
                      const isRowEditing = editingRoll === s.roll
                      const hasLogs = s.corrections && s.corrections.length > 0
                      const isLockedForRole = session.sessionStatus === "LOCKED" || 
                        ((session.sessionStatus === "APPROVED" || session.sessionStatus === "SUBMITTED") && !isHOD)

                      return (
                        <React.Fragment key={s.roll}>
                          <tr className={`hover:bg-slate-50/50 transition-all ${hasLogs ? "bg-orange-50/10" : ""}`}>
                            <td className="py-3.5 px-4 font-bold text-slate-900">{s.roll}</td>
                            <td className="py-3.5 px-4 font-semibold">{s.name}</td>
                            <td className="py-3.5 px-4 text-center">
                              <StatusBadge status={s.status} />
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <MethodBadge method={s.method} />
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {hasLogs ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-850 rounded text-[9px] font-bold border border-orange-200">
                                  {s.corrections?.length} Overrides
                                </span>
                              ) : (
                                <span className="text-slate-350 text-[10px]">—</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {isLockedForRole ? (
                                <span className="text-[10px] text-slate-400 font-semibold italic">Read-only (Locked)</span>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingRoll(isRowEditing ? null : s.roll)
                                    setCorrectionNotesText("")
                                    setCorrectionNewStatus(s.status)
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold border transition-all ${
                                    isRowEditing
                                      ? "bg-slate-800 text-white border-slate-900"
                                      : "bg-slate-100 text-slate-650 hover:bg-slate-200 border-slate-200"
                                  }`}
                                >
                                  {isRowEditing ? "Cancel" : "Apply Audit Override"}
                                </button>
                              )}
                            </td>
                          </tr>

                          {/* Nested Audit Log History Breakdown */}
                          {hasLogs && !isRowEditing && (
                            <tr className="bg-slate-50/30">
                              <td colSpan={6} className="px-6 py-2.5 border-t border-slate-100">
                                <div className="space-y-2 pl-4 border-l-2 border-orange-200 py-1">
                                  <span className="text-[9px] font-extrabold text-orange-650 uppercase tracking-widest block">Audit trail log records</span>
                                  {s.corrections?.map((log, idx) => (
                                    <div key={log.id || idx} className="text-[10px] text-slate-500 leading-relaxed font-medium">
                                      • <span className="font-bold text-slate-700">{new Date(log.timestamp).toLocaleString()}</span> —{" "}
                                      State transitioned from <span className="px-1.5 py-0.2 border bg-rose-50 text-rose-700 border-rose-200 rounded text-[8px] font-bold">{log.original_status}</span> to{" "}
                                      <span className="px-1.5 py-0.2 border bg-emerald-50 text-emerald-700 border-emerald-200 rounded text-[8px] font-bold">{log.new_status}</span> by{" "}
                                      <span className="text-slate-800 font-bold">{log.user_email || log.user_name || "system"}</span>.{" "}
                                      <span className="italic block text-[9.5px] mt-0.5 text-slate-400">Note: "{log.correction_note}"</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}

                          {/* Correction form */}
                          {isRowEditing && (
                            <tr className="bg-slate-50/70 border-t border-slate-200">
                              <td colSpan={6} className="p-4">
                                <div className="flex items-end gap-4 flex-wrap max-w-2xl bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                  <div>
                                    <label className="block text-[9px] font-extrabold text-slate-500 uppercase mb-1.5">New Status</label>
                                    <select
                                      value={correctionNewStatus}
                                      onChange={(e) => setCorrectionNewStatus(e.target.value as any)}
                                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                    >
                                      <option value="PRESENT">PRESENT</option>
                                      <option value="ABSENT">ABSENT</option>
                                      <option value="LATE">LATE</option>
                                      <option value="EXCUSED">EXCUSED</option>
                                    </select>
                                  </div>
                                  <div className="flex-1 min-w-[200px]">
                                    <label className="block text-[9px] font-extrabold text-slate-500 uppercase mb-1.5 font-bold">Correction Note (Required explanation)</label>
                                    <input
                                      type="text"
                                      value={correctionNotesText}
                                      onChange={(e) => setCorrectionNotesText(e.target.value)}
                                      placeholder="Explain the reason for this biometric change..."
                                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                                    />
                                  </div>
                                  <button
                                    onClick={() => handleCorrection(s.id!, s.roll)}
                                    disabled={correctionProcessing || !correctionNotesText.trim() || !correctionNewStatus}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all text-white ${
                                      correctionProcessing || !correctionNotesText.trim() || !correctionNewStatus
                                        ? "bg-slate-100 text-slate-400 cursor-not-allowed border"
                                        : "bg-emerald-600 hover:bg-emerald-700"
                                    }`}
                                  >
                                    {correctionProcessing ? "Saving..." : "Commit Override"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================================================================
            TAB 4: ATTENDANCE VALIDATION & WORKFLOW Lifecycle
            ================================================================ */}
        {activeTab === "validation" && (
          <div className="p-6 space-y-5">
            {session.id === 0 ? (
              <div className="p-8 border border-dashed border-slate-200 bg-slate-50 rounded-2xl text-center text-slate-400 text-xs font-semibold">
                No active session found. Submit attendance roster first to initialize validation checks.
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Validation and approval controls */}
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Roster Completeness Checker</h3>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                      Compares the captured roster entries against active registry lists, checks for omissions, and performs cross-session double checkins audits.
                    </p>
                    <button
                      onClick={handleValidate}
                      disabled={isValidating}
                      className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                    >
                      {isValidating ? (
                        <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying logs integrity...</>
                      ) : (
                        <><FileCheck className="w-4 h-4" /> Run Validation Checks</>
                      )}
                    </button>
                  </div>

                  {/* Workflow approvals control panel */}
                  <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3.5">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Approval workflow action center</h3>
                    
                    {!isHOD ? (
                      <div className="space-y-2">
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          {session.sessionStatus === "OPEN" || session.sessionStatus === "REJECTED"
                            ? "Roster is editable. Run validation, then submit for HOD approval."
                            : "Roster is locked for faculty edits."}
                        </p>
                        {(session.sessionStatus === "OPEN" || session.sessionStatus === "REJECTED") && isFaculty && (
                          <button
                            onClick={handleSubmitSession}
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                          >
                            Submit Session to HOD
                          </button>
                        )}
                        {session.sessionStatus === "REJECTED" && isFaculty && (
                          <button
                            onClick={handleOpenSession}
                            className="w-full py-2.5 border border-rose-200 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold"
                          >
                            Open Session (edit again)
                          </button>
                        )}
                        {(session.sessionStatus !== "OPEN" && session.sessionStatus !== "REJECTED" || !isFaculty) && (
                          <div className="p-3 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-400 text-center uppercase tracking-wider">
                            {!isFaculty ? "Faculty submission only" : "🔒 Locked for lecturer editing"}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          HOD Authorization Panel: Approve draft, reject to open for modifications, or permanently lock calculations.
                        </p>
                        
                        {session.sessionStatus === "SUBMITTED" && (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={handleApproveSession}
                              className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                            >
                              Approve Session
                            </button>
                            <button
                              onClick={handleRejectSession}
                              className="py-2.5 bg-rose-650 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                            >
                              Reject & Return
                            </button>
                          </div>
                        )}

                        {session.sessionStatus === "APPROVED" && (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={handleLockSession}
                              className="py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                            >
                              Finalize & Lock
                            </button>
                            <button
                              onClick={handleRejectSession}
                              className="py-2.5 bg-rose-650 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                            >
                              Reject & Return
                            </button>
                          </div>
                        )}

                        {session.sessionStatus === "LOCKED" && (
                          <button
                            onClick={handleUnlockSession}
                            className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                          >
                            Unlock back to Approved
                          </button>
                        )}

                        {session.sessionStatus === "REJECTED" && isHOD && (
                          <button
                            onClick={handleOpenSession}
                            className="w-full py-2.5 border border-rose-200 text-rose-700 rounded-lg text-xs font-bold"
                          >
                            Open for faculty edits
                          </button>
                        )}

                        {session.sessionStatus === "OPEN" && (
                          <div className="p-3 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-400 text-center uppercase tracking-wider">
                            Awaiting Lecturer Submission
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Validation results summary report */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Validation Report Overview</h3>
                  {validationResult ? (
                    <div className={`rounded-2xl border overflow-hidden shadow-sm animate-in fade-in zoom-in duration-200 ${
                      validationResult.isValid ? "border-emerald-200" : "border-amber-200"
                    }`}>
                      {/* Header banner */}
                      <div className={`p-5 text-center ${
                        validationResult.isValid ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"
                      }`}>
                        <h4 className="text-base font-extrabold">
                          {validationResult.isValid ? "INTEGRITY CHECK PASSED" : "OMISSIONS FOUND"}
                        </h4>
                        <p className="text-xs opacity-90 mt-1">
                          {validationResult.isValid
                            ? "All classroom student rosters are complete and fully aligned."
                            : `${validationResult.missingCount} registered students are missing attendance records.`
                          }
                        </p>
                      </div>

                      {/* Stat grid */}
                      <div className="p-5 bg-white space-y-4">
                        <div className="grid grid-cols-4 gap-2">
                          <div className="text-center p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                            <span className="block text-[8px] font-bold text-slate-400 uppercase">Present</span>
                            <span className="block text-base font-black text-emerald-700">{validationResult.present}</span>
                          </div>
                          <div className="text-center p-2.5 bg-rose-50 rounded-xl border border-rose-100">
                            <span className="block text-[8px] font-bold text-slate-400 uppercase">Absent</span>
                            <span className="block text-base font-black text-rose-700">{validationResult.absent}</span>
                          </div>
                          <div className="text-center p-2.5 bg-amber-50 rounded-xl border border-amber-100">
                            <span className="block text-[8px] font-bold text-slate-400 uppercase">Late</span>
                            <span className="block text-base font-black text-amber-700">{validationResult.late}</span>
                          </div>
                          <div className="text-center p-2.5 bg-indigo-50 rounded-xl border border-indigo-100">
                            <span className="block text-[8px] font-bold text-slate-400 uppercase">Excused</span>
                            <span className="block text-base font-black text-indigo-700">{validationResult.excused}</span>
                          </div>
                        </div>

                        {/* Breakdown list */}
                        <div className="space-y-2 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-700">
                          {[
                            { label: "Class Cohort Size", value: validationResult.totalStrength },
                            { label: "Roster entries logged", value: validationResult.totalRecords },
                            { label: "Omitted (Missing) profiles", value: validationResult.missingCount },
                            { label: "Override (corrected) records", value: validationResult.correctedRecords },
                            { label: "Attendance Yield", value: `${validationResult.attendancePercentage}%` }
                          ].map(item => (
                            <div key={item.label} className="flex items-center justify-between">
                              <span className="text-slate-400 font-bold">{item.label}</span>
                              <span className="text-slate-800 font-extrabold">{item.value}</span>
                            </div>
                          ))}
                        </div>

                        {validationResult.missingStudents.length > 0 && (
                          <div className="pt-3 border-t border-slate-100 space-y-1">
                            <span className="text-[9px] font-extrabold text-rose-700 uppercase tracking-wider block">Omitted Student Rolls</span>
                            <div className="flex gap-1.5 flex-wrap">
                              {validationResult.missingStudents.map(roll => (
                                <span key={roll} className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-100 rounded text-[9px] font-bold">
                                  {roll}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {validationResult.crossSubjectConflicts.length > 0 && (
                          <div className="pt-3 border-t border-slate-100 space-y-1">
                            <span className="text-[9px] font-extrabold text-amber-700 uppercase block">Cross-subject conflicts</span>
                            {validationResult.crossSubjectConflicts.map((c) => (
                              <p key={`${c.roll_no}-${c.other_subject}`} className="text-[10px] text-amber-800">
                                {c.roll_no} already marked in {c.other_subject}
                              </p>
                            ))}
                          </div>
                        )}

                        {validationResult.rosterInvalidStudents.length > 0 && (
                          <div className="pt-3 border-t border-slate-100">
                            <span className="text-[9px] font-extrabold text-rose-700 uppercase block">Roster invalid</span>
                            <p className="text-[10px] text-rose-600">{validationResult.rosterInvalidStudents.join(", ")}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-slate-400 text-xs font-semibold">
                      Click the validator button on the left to compile reports.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
