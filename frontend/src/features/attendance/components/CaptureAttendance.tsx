import React, { useState, useEffect, useRef } from "react"
import { Camera, RefreshCw, Users, Activity, Play, ShieldAlert, ShieldCheck } from "lucide-react"
import { apiFetch } from "../../../lib/api"

interface Subject {
  id?: string | number
  subject_code: string
  name: string
}

/**
 * Server-side automatic attendance result.
 * The backend performs liveness + face identification; the frontend only submits the image.
 */
interface AutoAttendanceResult {
  message: string
  session_id: string
  total_faces_detected: number
  identified: number
  upserted: number
  skipped: Array<{ roll_no: string; reason: string; similarity?: number }>
  errors: Array<{ roll_no: string; reason: string }>
}

export const CaptureAttendance: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([
    { subject_code: "MCS-101", name: "Computer Networks" },
    { subject_code: "MCS-102", name: "Database Systems" },
    { subject_code: "MCS-103", name: "Software Engineering" }
  ])
  const [selectedSubjectId, setSelectedSubjectId] = useState("MCS-101")
  const [period, setPeriod] = useState("I")
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date()
    const offset = d.getTimezoneOffset()
    const localDate = new Date(d.getTime() - (offset * 60 * 1000))
    return localDate.toISOString().split('T')[0]
  })

  // Camera state
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraActive, setCameraActive] = useState(false)

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<AutoAttendanceResult | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)

  // Load subjects on mount
  useEffect(() => {
    const fetchSubjectsOnMount = async () => {
      try {
        const data = await apiFetch("/subjects/")
        const list = data.results || data
        if (list && list.length > 0) {
          setSubjects(list)
          const first = list[0]
          setSelectedSubjectId(String(first.id ?? first.subject_code))
        }
      } catch (e) {
        console.error("Failed to load subjects:", e)
      }
    }
    fetchSubjectsOnMount()
  }, [])

  // Load schedule whenever date changes
  useEffect(() => {
    const loadSchedule = async () => {
      try {
        const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
        const dayName = days[new Date(selectedDate).getDay()]
        const schedule = await apiFetch<any>(`/timetable/current/?day=${dayName}`)
        if (schedule && schedule.scheduled) {
          const entry = schedule.entry || schedule
          const periodMap: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI", 7: "VII" }
          setPeriod(periodMap[Number(entry.period)] || entry.hour || "I")
          setSubjects(prev => {
            const exists = prev.some(s => s.subject_code === entry.subject_code)
            if (!exists) {
              return [...prev, { id: entry.subject, subject_code: entry.subject_code, name: entry.subject_name }]
            }
            return prev
          })
          setSelectedSubjectId(String(entry.subject ?? entry.subject_code))
        }
      } catch (e) {
        console.error("Failed to load schedule for date:", e)
      }
    }
    if (selectedDate) {
      loadSchedule()
    }
  }, [selectedDate])

  const startCamera = async () => {
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

  // Auto-release stream on unmount
  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop())
    }
  }, [stream])

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

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

  /**
   * Capture a frame and submit it to the backend for server-side liveness detection,
   * face identification, and attendance recording. The client never sends roll numbers
   * or confidence scores — the backend is the sole source of truth for biometric results.
   */
  const handleCapture = async () => {
    setIsProcessing(true)
    setResult(null)
    setScanError(null)

    if (!cameraActive) {
      await startCamera()
      await new Promise(resolve => setTimeout(resolve, 600))
    }

    const base64Image = captureFrame()
    if (!base64Image) {
      setScanError("Failed to extract frame from webcam.")
      setIsProcessing(false)
      return
    }

    try {
      // Single request: image + session context only.
      // All liveness checks, face recognition, threshold enforcement,
      // and attendance writing happen server-side.
      const data = await apiFetch<AutoAttendanceResult>("/attendance/engine/automatic/", {
        method: "POST",
        body: {
          image: base64Image,
          date: selectedDate,
          hour: period,
          subject_id: selectedSubjectId,
        }
      })
      setResult(data)
      stopCamera()
    } catch (e: any) {
      setScanError(e.message || "Attendance processing failed on server.")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRescan = () => {
    setResult(null)
    setScanError(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Biometric Face Recognition</h2>
        <p className="text-xs text-slate-400">Launch the local camera to scan faces and auto-record session attendance</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Control Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Session Configuration</h3>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Select Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => { setSelectedDate(e.target.value); setResult(null) }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 mb-3"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Select Subject</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => { setSelectedSubjectId(e.target.value); setResult(null) }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {subjects.map(sub => (
                  <option key={sub.id ?? sub.subject_code} value={String(sub.id ?? sub.subject_code)}>
                    {sub.subject_code} — {sub.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Select Period Hour</label>
              <select
                value={period}
                onChange={(e) => { setPeriod(e.target.value); setResult(null) }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-2.5">
            {cameraActive ? (
              <button
                onClick={stopCamera}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all"
              >
                Shutdown Camera Hardware
              </button>
            ) : (
              <button
                onClick={startCamera}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all"
              >
                Activate Camera Hardware
              </button>
            )}

            {result ? (
              <button
                onClick={handleRescan}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Rescan Session
              </button>
            ) : isProcessing ? (
              <button
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-500 cursor-not-allowed rounded-lg text-sm font-semibold"
                disabled
              >
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                Processing on server...
              </button>
            ) : (
              <button
                onClick={handleCapture}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-all"
              >
                <Play className="w-4 h-4 fill-current" />
                Capture &amp; Mark Attendance
              </button>
            )}

            {scanError && (
              <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg text-xs font-bold leading-normal">
                <ShieldAlert className="w-4 h-4 text-rose-600 inline mr-1" />
                {scanError}
              </div>
            )}

            {result && (
              <div className="p-3.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs space-y-1.5 shadow-sm animate-in fade-in duration-300">
                <div className="flex items-center gap-1.5 font-bold text-emerald-700">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>{result.message}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-600 pt-1">
                  <span>Faces detected: <strong>{result.total_faces_detected}</strong></span>
                  <span>Identified: <strong>{result.identified}</strong></span>
                  <span>Marked present: <strong>{result.upserted}</strong></span>
                  <span>Skipped: <strong>{result.skipped.length}</strong></span>
                  {result.errors.length > 0 && (
                    <span className="col-span-2 text-rose-600">Errors: {result.errors.length}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Camera Viewport Frame */}
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
            </div>
          ) : (
            <div className="text-center text-slate-500 p-8 space-y-3 z-0">
              <Camera className="w-12 h-12 mx-auto text-slate-700" />
              <div>
                <p className="text-sm font-semibold text-slate-400">CAMERA STREAM STANDBY</p>
                <p className="text-xs text-slate-600 mt-1">Activate camera feed to initialize real biometric check-ins</p>
              </div>
            </div>
          )}

          {/* Processing overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/20 to-transparent animate-pulse pointer-events-none z-10 border-t-2 border-emerald-500" />
          )}

          {/* Status bar */}
          <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center z-10">
            <div className="flex items-center gap-1.5 text-[10px] font-bold bg-slate-950/80 text-emerald-400 px-2 py-1 rounded border border-slate-800 pointer-events-auto">
              <Activity className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              <span>{isProcessing ? "SERVER_PROCESSING" : (cameraActive ? "LIVENESS_AUDIT" : "STANDBY")}</span>
            </div>
            <div className="text-[10px] font-semibold text-slate-400 bg-slate-950/80 px-2 py-1 rounded border border-slate-800">
              FPS: 30 | RES: 640x480
            </div>
          </div>
        </div>
      </div>

      {/* Result summary */}
      {result && (result.skipped.length > 0 || result.errors.length > 0) && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-800">Session Processing Detail</h3>
          </div>

          {result.skipped.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Skipped ({result.skipped.length})</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-slate-700">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase">
                      <th className="py-2 px-3">Roll Number</th>
                      <th className="py-2 px-3">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs font-medium">
                    {result.skipped.map((s, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-bold">{s.roll_no}</td>
                        <td className="py-2 px-3 text-slate-500">{s.reason}{s.similarity !== undefined ? ` (${(s.similarity * 100).toFixed(1)}%)` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.errors.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-rose-500 uppercase tracking-wide mb-2">Errors ({result.errors.length})</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-slate-700">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase">
                      <th className="py-2 px-3">Roll Number</th>
                      <th className="py-2 px-3">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs font-medium">
                    {result.errors.map((e, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-bold">{e.roll_no}</td>
                        <td className="py-2 px-3 text-rose-600">{e.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
