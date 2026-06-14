import React, { useState, useEffect, useRef } from "react"
import { Camera, RefreshCw, CheckCircle, Users, Activity, Play, ShieldAlert, ShieldCheck } from "lucide-react"
import { apiFetch } from "../../../lib/api"

interface Subject {
  id?: string | number
  subject_code: string
  name: string
}

interface DetectedStudent {
  roll_no: string
  name: string
  confidence: number
  location: { top: number; right: number; bottom: number; left: number }
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
  
  // Camera State
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraActive, setCameraActive] = useState(false)

  // Liveness Detection States
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

  const resetLivenessState = () => {
    setLivenessScore(null)
    setLivenessChecks(null)
    setLivenessDetails(null)
  }

  // Scanning & Marking States
  const [isScanning, setIsScanning] = useState(false)
  const [scanComplete, setScanComplete] = useState(false)
  const [detectedStudents, setDetectedStudents] = useState<DetectedStudent[]>([])
  const [scanError, setScanError] = useState<string | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

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

  // Start Camera
  const startCamera = async () => {
    resetLivenessState()
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
    resetLivenessState()
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

  // Capture Base64 JPG
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

  // Paint Bounding Boxes
  const drawBoundingBoxes = (faces: DetectedStudent[]) => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const displayWidth = video.clientWidth
    const displayHeight = video.clientHeight
    canvas.width = displayWidth
    canvas.height = displayHeight

    const naturalWidth = video.videoWidth || 640
    const naturalHeight = video.videoHeight || 480

    const scaleX = displayWidth / naturalWidth
    const scaleY = displayHeight / naturalHeight

    ctx.strokeStyle = "#10b981"
    ctx.lineWidth = 3
    ctx.font = "bold 11px sans-serif"
    ctx.fillStyle = "#10b981"

    faces.forEach(face => {
      const loc = face.location
      const x = loc.left * scaleX
      const y = loc.top * scaleY
      const width = (loc.right - loc.left) * scaleX
      const height = (loc.bottom - loc.top) * scaleY

      ctx.strokeRect(x, y, width, height)

      const label = `${face.name || "Unknown"} (${Math.round(face.confidence || 100)}%)`
      const textWidth = ctx.measureText(label).width
      ctx.fillRect(x, y - 18, textWidth + 10, 18)

      ctx.fillStyle = "#ffffff"
      ctx.fillText(label, x + 5, y - 5)
      ctx.fillStyle = "#10b981"
    })
  }

  // Trigger Biometric Scan
  const handleStartScan = async () => {
    setIsScanning(true)
    setScanComplete(false)
    setDetectedStudents([])
    setScanError(null)
    setSubmitSuccess(null)
    setSubmitError(null)
    resetLivenessState()

    if (!cameraActive) {
      await startCamera()
      await new Promise(resolve => setTimeout(resolve, 600))
    }

    const base64Image = captureFrame()
    if (!base64Image) {
      setScanError("Failed to extract frame from webcam.")
      setIsScanning(false)
      return
    }

    try {
      const data = await apiFetch("/face-recognition/detect/", {
        method: "POST",
        body: { image: base64Image }
      })

      const facesList = data.identified.map((f: any) => ({
        roll_no: f.roll_no,
        name: f.name,
        confidence: f.confidence,
        location: f.location
      }))
      setDetectedStudents(facesList)
      drawBoundingBoxes(facesList)
      setScanComplete(true)
      setLivenessScore(data.liveness_score ?? null)
      setLivenessChecks(data.liveness_checks ?? null)
      setLivenessDetails(data.liveness_details ?? null)
    } catch (e: any) {
      setScanError(e.message || "Webcam detection processing failed.")
      const data = e.data || {}
      if (data.liveness_score !== undefined) setLivenessScore(data.liveness_score)
      if (data.liveness_checks !== undefined) setLivenessChecks(data.liveness_checks)
      if (data.liveness_details !== undefined) setLivenessDetails(data.liveness_details)
    } finally {
      setIsScanning(false)
    }
  }

  // Submit Automatic Attendance to DB
  const handleSubmitAttendance = async () => {
    if (detectedStudents.length === 0) return
    if (livenessScore !== null && livenessScore < 60) {
      setSubmitError("Transaction Blocked: Biometric liveness check failed. Spoofed source detected.")
      return
    }
    setIsSubmitting(true)
    setSubmitSuccess(null)
    setSubmitError(null)

    // Map entries to AutoAttendanceSerializer payload
    const entries = detectedStudents.map(s => ({
      roll_no: s.roll_no,
      status: "PRESENT",
      confidence_score: s.confidence
    }))

    try {
      const data = await apiFetch("/attendance/engine/automatic/", {
        method: "POST",
        body: {
          date: selectedDate,
          hour: period,
          subject_id: selectedSubjectId,
          entries
        }
      })

      setSubmitSuccess(data.message || "Attendance marked successfully in database.")
      stopCamera()
    } catch (e: any) {
      setSubmitError(e.message || "Failed to commit automated attendance.")
    } finally {
      setIsSubmitting(false)
    }
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
                onChange={(e) => { setSelectedDate(e.target.value); setSubmitSuccess(null) }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 mb-3"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Select Subject</label>
              <select 
                value={selectedSubjectId} 
                onChange={(e) => { setSelectedSubjectId(e.target.value); setSubmitSuccess(null) }}
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
                onChange={(e) => { setPeriod(e.target.value); setSubmitSuccess(null) }}
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

            {!isScanning && !scanComplete ? (
              <button 
                onClick={handleStartScan}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-all"
              >
                <Play className="w-4 h-4 fill-current" />
                Initialize Scanner
              </button>
            ) : isScanning ? (
              <button 
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-500 cursor-not-allowed rounded-lg text-sm font-semibold transition-all"
                disabled
              >
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                Scanning camera feed...
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  Scan Complete: {detectedStudents.length} Students Identified
                </div>
                <button 
                  onClick={handleStartScan}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Rescan Session
                </button>
              </div>
            )}

            {scanComplete && detectedStudents.length > 0 && (livenessScore === null || livenessScore >= 60) && (
              <button
                onClick={handleSubmitAttendance}
                disabled={isSubmitting}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-md transition-all flex items-center justify-center gap-1.5 animate-in fade-in duration-200"
              >
                {isSubmitting ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Submitting Attendance...</>
                ) : (
                  <>Submit attendance roster ({detectedStudents.length})</>
                )}
              </button>
            )}

            {livenessScore !== null && livenessScore < 60 && (
              <div className="p-3.5 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs space-y-2.5 shadow-sm animate-in fade-in duration-300">
                <div className="flex items-center gap-1.5 font-bold text-rose-700">
                  <ShieldAlert className="w-4 h-4 text-rose-600 animate-pulse" />
                  <span>SPOOF ATTACK PREVENTED ({livenessScore}%)</span>
                </div>
                <p className="text-[10px] text-rose-650 leading-relaxed font-semibold">
                  The automated classroom attendance run was rejected due to failed biometric liveness. Diagnostic audit breakdown:
                </p>
                <div className="grid grid-cols-2 gap-2 text-[10px] bg-white/70 p-2 rounded-lg border border-rose-100 font-semibold text-slate-700">
                  <div>
                    <span className="block text-slate-400 text-[8px] uppercase tracking-wider mb-0.5">Printed Photo</span>
                    <span className={livenessChecks?.photo_attack_prevented ? "text-emerald-600" : "text-rose-600"}>
                      {livenessChecks?.photo_attack_prevented ? "PASS (Sharp Texture)" : "FAIL (Low Focus Blur)"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-slate-400 text-[8px] uppercase tracking-wider mb-0.5">Screen Recapture</span>
                    <span className={livenessChecks?.screen_attack_prevented ? "text-emerald-600" : "text-rose-600"}>
                      {livenessChecks?.screen_attack_prevented ? "PASS (No Moiré)" : "FAIL (Moiré Detected)"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-slate-400 text-[8px] uppercase tracking-wider mb-0.5">Blink Test</span>
                    <span className={livenessChecks?.eye_blink_passed ? "text-emerald-600" : "text-rose-600"}>
                      {livenessChecks?.eye_blink_passed ? "PASS (Open/Blink Eye)" : "FAIL (Static Eye Shape)"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-slate-400 text-[8px] uppercase tracking-wider mb-0.5">Pose Symmetry</span>
                    <span className={livenessChecks?.pose_validation_passed ? "text-emerald-600" : "text-rose-600"}>
                      {livenessChecks?.pose_validation_passed ? "PASS (3D Geometry)" : "FAIL (Perspective Clash)"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {scanError && (
              <div className="p-3 bg-rose-50 text-rose-800 border border-rose-250 rounded-lg text-xs font-bold leading-normal">
                <ShieldAlert className="w-4 h-4 text-rose-600 inline mr-1" />
                {scanError}
              </div>
            )}

            {submitSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-250 rounded-lg text-xs font-bold leading-normal">
                <CheckCircle className="w-4 h-4 text-emerald-600 inline mr-1" />
                {submitSuccess}
              </div>
            )}

            {submitError && (
              <div className="p-3 bg-rose-50 text-rose-800 border border-rose-250 rounded-lg text-xs font-bold leading-normal">
                <ShieldAlert className="w-4 h-4 text-rose-600 inline mr-1" />
                {submitError}
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

              {/* Liveness Telemetry Overlay */}
              {livenessScore !== null && (
                <div className="absolute inset-0 z-20 flex flex-col justify-between p-4 pointer-events-none">
                  {/* Top Banner Alert */}
                  <div className="w-full flex justify-center pointer-events-auto">
                    {livenessScore >= 60 ? (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600/90 text-white rounded-full text-[10px] font-bold shadow-lg backdrop-blur-md border border-emerald-500/30 animate-in slide-in-from-top duration-300">
                        <ShieldCheck className="w-3.5 h-3.5 text-white" />
                        <span>LIVENESS VERIFIED: {livenessScore}%</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 w-full max-w-xs px-4 py-2 bg-rose-600/95 text-white rounded-xl text-[10px] font-bold shadow-lg backdrop-blur-md border border-rose-500/30 animate-in slide-in-from-top duration-300">
                        <div className="flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4 text-white animate-pulse" />
                          <span className="uppercase tracking-wider">Spoofing Attack Blocked</span>
                        </div>
                        <span className="text-[9px] text-rose-100 font-medium text-center leading-tight">
                          {!livenessChecks?.photo_attack_prevented && "• Printed Photo Attack Prevented "}
                          {!livenessChecks?.screen_attack_prevented && "• Digital Screen Attack Prevented "}
                          {!livenessChecks?.eye_blink_passed && "• Static Eye Detection (Blink check failed) "}
                          {!livenessChecks?.pose_validation_passed && "• 3D Head Symmetry Check Failed "}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Bottom Score & Metrics HUD */}
                  <div className="w-full flex gap-3 items-end justify-between mt-auto pointer-events-auto">
                    {/* Circular Liveness Score Meter */}
                    <div className="glass-effect p-2.5 rounded-2xl border border-white/10 flex flex-col items-center justify-center text-center shadow-lg w-20 backdrop-blur-md">
                      <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Liveness</span>
                      <div className="relative flex items-center justify-center my-1">
                        <svg className="w-10 h-10 transform -rotate-90">
                          <circle cx="20" cy="20" r="17" stroke="rgba(255,255,255,0.05)" strokeWidth="3.5" fill="transparent" />
                          <circle cx="20" cy="20" r="17" 
                            stroke={livenessScore >= 60 ? "#10b981" : "#ef4444"} 
                            strokeWidth="3.5" fill="transparent" 
                            strokeDasharray={2 * Math.PI * 17}
                            strokeDashoffset={2 * Math.PI * 17 * (1 - livenessScore / 100)} 
                            className="transition-all duration-500"
                          />
                        </svg>
                        <span className={`absolute text-[9px] font-extrabold ${livenessScore >= 60 ? "text-emerald-400" : "text-rose-400"}`}>
                          {Math.round(livenessScore)}%
                        </span>
                      </div>
                    </div>

                    {/* Anti-spoofing Metrics Table */}
                    <div className="glass-effect p-2.5 rounded-2xl border border-white/10 flex-1 shadow-lg max-w-[240px] backdrop-blur-md">
                      <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Anti-Spoof Telemetry</span>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[8px] font-semibold text-slate-350">
                        <div className="flex items-center justify-between">
                          <span>Sharpness (Lap):</span>
                          <span className={livenessChecks?.photo_attack_prevented ? "text-emerald-400" : "text-rose-400"}>
                            {livenessDetails?.laplacian_variance?.toFixed(1) || "0.0"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>FFT Moiré Ratio:</span>
                          <span className={livenessChecks?.screen_attack_prevented ? "text-emerald-400" : "text-rose-400"}>
                            {livenessDetails?.fft_ratio?.toFixed(3) || "0.000"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Blink (EAR):</span>
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
                <p className="text-sm font-semibold text-slate-400">CAMERA STREAM STANDBY</p>
                <p className="text-xs text-slate-600 mt-1">Activate camera feed to initialize real biometric check-ins</p>
              </div>
            </div>
          )}

          {/* Scanning sweep visual overlay */}
          {isScanning && (
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/20 to-transparent animate-pulse pointer-events-none z-10 border-t-2 border-emerald-500" />
          )}

          {/* Indicators Bar */}
          <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center z-10">
            <div className="flex items-center gap-1.5 text-[10px] font-bold bg-slate-950/80 text-emerald-400 px-2 py-1 rounded border border-slate-800 pointer-events-auto">
              <Activity className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              <span>{isScanning ? "SCANNING_CLASSROOM" : (cameraActive ? (livenessScore !== null ? (livenessScore >= 60 ? "LIVENESS_PASSED" : "LIVENESS_BLOCKED") : "LIVENESS_AUDIT") : "STANDBY")}</span>
            </div>
            <div className="text-[10px] font-semibold text-slate-400 bg-slate-950/80 px-2 py-1 rounded border border-slate-800">
              FPS: 30 | RES: 1280x720
            </div>
          </div>
        </div>
      </div>

      {/* Identified Students Log */}
      {scanComplete && detectedStudents.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-800">Identified Students Batch</h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">Automatic recognition logs</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-slate-700">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase">
                  <th className="py-2.5 px-4">Roll Number</th>
                  <th className="py-2.5 px-4">Student Name</th>
                  <th className="py-2.5 px-4">Recognition Confidence</th>
                  <th className="py-2.5 px-4 text-right">Biometric Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs font-medium bg-white">
                {detectedStudents.map((st) => (
                  <tr key={st.roll_no} className="hover:bg-slate-50 transition-all">
                    <td className="py-3 px-4 font-bold text-slate-900">{st.roll_no}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-[9px]">
                          {st.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        {st.name}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${st.confidence}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-emerald-600">{st.confidence}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-250 rounded text-[10px] font-bold">
                        VERIFIED PRESENT
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
