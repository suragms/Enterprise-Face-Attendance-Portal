import React, { useState, useRef, useEffect } from "react"
import {
  Award,
  Bell,
  BookOpen,
  Calendar,
  CalendarDays,
  CheckCircle2,
  FileText,
  GraduationCap,
  LayoutDashboard,
  User,
  XCircle,
  MapPin,
  ScanFace,
  Camera,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { Link } from "react-router-dom"
import { useAuth } from "../../../context/AuthContext"
import { useStudentReport } from "../../../hooks/useStudentReport"
import { useStudentContext } from "../../../hooks/useStudentContext"
import { AttendanceProgressBar } from "../../student/components/AttendanceProgressBar"
import { DefaulterAlert } from "../../student/components/DefaulterAlert"
import { apiFetch } from "../../../lib/api"

const quickLinks = [
  { label: "Attendance", path: "/student/attendance", icon: Award },
  { label: "Timetable", path: "/student/timetable", icon: Calendar },
  { label: "Learning Hub", path: "/student/learning", icon: BookOpen },
  { label: "Exams", path: "/student/exams", icon: FileText },
  { label: "Notifications", path: "/student/notifications", icon: Bell },
  { label: "Profile", path: "/student/profile", icon: User },
]

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth()
  const { department, rollNo } = useStudentContext(user?.role)
  const { summary, subjects, overallPct, loading, error, promotionStatus, isDefaulter, report } = useStudentReport(
    !user?.enrollmentOverdue
  )

  // Geofenced Check-In States
  const [activeSession, setActiveSession] = useState<any>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [checkInOpen, setCheckInOpen] = useState(false)
  const [checkInStep, setCheckInStep] = useState<"init" | "location" | "camera" | "verifying" | "success" | "failed">("init")
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [checkInError, setCheckInError] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<any>(null)
  
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (user?.enrollmentOverdue) return
    const checkActiveSession = async () => {
      try {
        const todayStr = new Date().toISOString().split("T")[0]
        const sessions = await apiFetch<any>(`/attendance/sessions/?session_status=OPEN&date=${todayStr}`)
        if (sessions && sessions.results && sessions.results.length > 0) {
          setActiveSession(sessions.results[0])
        }
      } catch (err) {
        console.error("Failed to fetch active sessions", err)
      } finally {
        setCheckingSession(false)
      }
    }
    checkActiveSession()
  }, [user])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const startCamera = async () => {
    setCheckInError(null)
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch (err: any) {
      console.error(err)
      setCheckInError("Camera access denied. Please grant webcam permissions.")
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const handleStartCheckIn = () => {
    setCheckInOpen(true)
    setCheckInStep("location")
    setCheckInError(null)
    setCoords(null)

    if (!navigator.geolocation) {
      setCheckInError("Geolocation is not supported by your browser.")
      setCheckInStep("failed")
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        })
        setCheckInStep("camera")
        setTimeout(() => startCamera(), 100)
      },
      (err) => {
        console.error(err)
        setCheckInError("Failed to acquire your location. Please enable location services and retry.")
        setCheckInStep("failed")
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleCancelCheckIn = () => {
    stopCamera()
    setCheckInOpen(false)
    setCheckInStep("init")
    setCheckInError(null)
  }

  const handleCheckInSubmit = async () => {
    if (!videoRef.current || !canvasRef.current || !coords) return
    setCheckInError(null)
    setCheckInStep("verifying")

    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext("2d")
      if (context) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageBase64 = canvas.toDataURL("image/jpeg", 0.9)

        stopCamera()

        const response = await apiFetch<any>("/attendance/engine/self-checkin/", {
          method: "POST",
          body: {
            latitude: coords.lat,
            longitude: coords.lng,
            image: imageBase64
          }
        })

        if (response && response.success) {
          setSuccessInfo(response)
          setCheckInStep("success")
          setTimeout(() => {
            window.location.reload()
          }, 2000)
        } else {
          setCheckInError(response?.error || "Check-in verification failed.")
          setCheckInStep("failed")
        }
      }
    } catch (err: any) {
      console.error(err)
      stopCamera()
      // Extract backend validation detail if available
      let detail = "An unexpected error occurred during biometric check-in."
      if (err.data && err.data.error) {
        detail = err.data.error
      } else if (err.message) {
        detail = err.message
      }
      setCheckInError(detail)
      setCheckInStep("failed")
    }
  }

  if (user?.enrollmentOverdue) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          Face enrollment is overdue. Go to{" "}
          <Link to="/student/profile" className="font-bold underline">
            Profile
          </Link>{" "}
          to complete 5-pose enrollment.
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        <p className="text-sm text-slate-500">Loading dashboard...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">
        {error}
      </div>
    )
  }

  const cards = [
    { label: "Attendance %", value: `${overallPct}%`, icon: Award },
    { label: "Today", value: summary?.today_status ?? "—", icon: CalendarDays },
    { label: "Present", value: String(report?.summary?.total_present ?? 0), icon: CheckCircle2 },
    { label: "At-risk subjects", value: String(summary?.at_risk_subject_count ?? 0), icon: XCircle },
  ]

  const topSubjects = [...subjects].sort((a, b) => a.percentage - b.percentage).slice(0, 4)

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">Student Portal</p>
            <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">
              Welcome, {summary?.name?.split(" ")[0] || user?.fullName?.split(" ")[0] || "Student"}
            </h1>
            <p className="mt-2 text-sm text-emerald-100">
              {department?.name || summary?.department} • Roll {rollNo || summary?.roll_no}
              {summary?.semester != null ? ` • Semester ${summary.semester}` : ""}
            </p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <GraduationCap className="h-8 w-8" />
          </div>
        </div>
      </div>

      {/* Geofenced Self Check-In Card (Inspired by Qandle) */}
      {activeSession && !checkingSession && (
        <div className="rounded-2xl border-2 border-emerald-500 bg-white p-5 shadow-md relative overflow-hidden transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-8 -mt-8 -z-10 animate-pulse"></div>
          
          {!checkInOpen ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Active Class Session Open</span>
                </div>
                <h3 className="text-base font-extrabold text-slate-800">
                  {activeSession.subject?.name || activeSession.subject_code || "Class Attendance Session"} ({activeSession.hour})
                </h3>
                <p className="text-xs text-slate-500">
                  Mark your attendance instantly using Geolocation and front-camera Face Verification.
                </p>
              </div>
              <button
                onClick={handleStartCheckIn}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-500 text-white rounded-xl text-xs font-black shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-98 transition-all shrink-0"
              >
                <ScanFace className="w-4 h-4" />
                <span>Self Check-In (GPS + Face)</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <ScanFace className="w-4 h-4 text-emerald-600 animate-pulse" />
                  <span>Geofenced Biometric Check-In</span>
                </h3>
                <button
                  onClick={handleCancelCheckIn}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 transition"
                >
                  Cancel
                </button>
              </div>

              {checkInStep === "location" && (
                <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                  <div className="p-4 bg-emerald-50 rounded-full animate-bounce">
                    <MapPin className="w-8 h-8 text-emerald-600" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-extrabold text-slate-700">Checking Geolocation boundary...</p>
                    <p className="text-xxs text-slate-400 font-semibold uppercase tracking-wider">Acquiring high-accuracy GPS logs</p>
                  </div>
                </div>
              )}

              {checkInStep === "camera" && (
                <div className="flex flex-col items-center gap-4 py-2">
                  <div className="relative w-44 h-44 rounded-full border-4 border-emerald-500/30 overflow-hidden shadow-md bg-slate-900">
                    <video
                      ref={(el) => {
                        videoRef.current = el
                        if (el && streamRef.current && el.srcObject !== streamRef.current) {
                          el.srcObject = streamRef.current
                          el.play().catch(err => console.error("Error playing video in check-in:", err))
                        }
                      }}
                      className="w-full h-full object-cover rounded-full scale-x-[-1]"
                      muted
                      playsInline
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute inset-0 border-2 border-emerald-500/20 rounded-full pointer-events-none"></div>
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-500 to-transparent animate-scanline pointer-events-none"></div>
                  </div>

                  <div className="text-center space-y-1">
                    <p className="text-xs font-bold text-slate-700">Align your face in the circular ring</p>
                    <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                      <MapPin className="w-3 h-3" /> GPS Location verified
                    </p>
                  </div>

                  <button
                    onClick={handleCheckInSubmit}
                    className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow transition-all flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Verify Face & Submit</span>
                  </button>
                </div>
              )}

              {checkInStep === "verifying" && (
                <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-700">Comparing biometrics profile & verifying coordinates...</p>
                    <p className="text-xxs text-slate-400 font-semibold uppercase tracking-wider">Communicating with attendance engine</p>
                  </div>
                </div>
              )}

              {checkInStep === "success" && (
                <div className="flex flex-col items-center justify-center py-6 text-center space-y-3 animate-in zoom-in-95 duration-300">
                  <div className="p-4 bg-emerald-100 rounded-full text-emerald-600">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-extrabold text-emerald-800">Check-in Verified & Attendance Logged!</p>
                    <p className="text-xs text-slate-500">
                      Successfully marked PRESENT in <strong className="text-emerald-700">{successInfo?.subject}</strong>
                    </p>
                  </div>
                </div>
              )}

              {checkInStep === "failed" && (
                <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                  <div className="p-4 bg-rose-50 rounded-full text-rose-600 border border-rose-150">
                    <AlertCircle className="w-10 h-10" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-extrabold text-rose-800">Check-In Exception</p>
                    <p className="text-xs text-rose-600 leading-relaxed max-w-md font-medium text-center">{checkInError}</p>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleStartCheckIn}
                      className="px-4 py-2 bg-slate-800 text-white hover:bg-slate-900 rounded-lg text-xs font-bold transition"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={handleCancelCheckIn}
                      className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-lg text-xs font-bold transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <DefaulterAlert
        overallPercentage={overallPct}
        promotionStatus={promotionStatus}
        atRiskSubjects={subjects}
        compact
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-emerald-600" />
          <h2 className="text-sm font-bold text-slate-800">Overall attendance</h2>
        </div>
        <AttendanceProgressBar
          label="All subjects combined"
          percentage={overallPct}
          subtitle={`Promotion: ${promotionStatus}${isDefaulter ? " • Action required" : ""}`}
          size="lg"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{card.label}</span>
                <Icon className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-xl font-bold text-slate-800 sm:text-2xl">{card.value}</p>
            </div>
          )
        })}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold text-slate-800">Quick access</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {quickLinks.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.path}
                to={link.path}
                className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/50"
              >
                <Icon className="h-5 w-5 text-emerald-600" />
                <span className="text-[11px] font-semibold text-slate-700">{link.label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {topSubjects.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Subject statistics</h3>
            <Link to="/student/attendance" className="text-xs font-semibold text-emerald-700 hover:underline">
              View all
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {topSubjects.map((subject) => (
              <AttendanceProgressBar
                key={subject.code}
                label={`${subject.code}`}
                percentage={subject.percentage}
                subtitle={subject.name}
                size="sm"
              />
            ))}
          </div>
        </div>
      ) : null}

      {(summary?.unread_notifications ?? 0) > 0 ? (
        <Link
          to="/student/notifications"
          className="block rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 hover:bg-amber-100"
        >
          You have {summary?.unread_notifications} unread notification(s).
        </Link>
      ) : null}
    </div>
  )
}
