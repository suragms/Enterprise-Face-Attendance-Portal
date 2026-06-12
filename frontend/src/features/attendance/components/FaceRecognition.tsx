import React, { useState, useEffect, useRef } from "react"
import {
  Camera,
  RefreshCw,
  CheckCircle,
  Users,
  Activity,
  Play,
  Scan,
  ShieldCheck,
  ShieldAlert,
  User,
  Smile,
  Fingerprint
} from "lucide-react"
import { apiFetch } from "../../../lib/api"

interface EnrolledStudent {
  roll_no: string
  name: string
  face_enrolled: boolean
  department: string
}

interface DetectedFace {
  roll_no: string
  name: string
  confidence: number
  location: { top: number; right: number; bottom: number; left: number }
}

interface AnalysisResult {
  age: number | null
  gender: string | null
  dominant_emotion: string | null
  emotion_scores: Record<string, number> | null
  dominant_race: string | null
}

export const FaceRecognition: React.FC = () => {
  // Active Tab
  const [activeTab, setActiveTab] = useState<"register" | "verify" | "detect" | "analyze">("register")

  // Students list from DB
  const [dbStudents, setDbStudents] = useState<EnrolledStudent[]>([])
  const [isLoadingStudents, setIsLoadingStudents] = useState(false)

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

  // Camera Refs and State
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraActive, setCameraActive] = useState(false)

  // Fetch all students from SQLite/PostgreSQL
  const fetchStudents = async () => {
    setIsLoadingStudents(true)
    try {
      const data = await apiFetch("/students/?is_archived=false&page_size=100")
      const list = data.results || data
      setDbStudents(
        list.map((s: any) => ({
          roll_no: s.roll_no,
          name: s.name,
          face_enrolled: s.face_enrolled,
          department: s.department
        }))
      )
    } catch (e) {
      console.error("Failed to load students roster:", e)
    } finally {
      setIsLoadingStudents(false)
    }
  }

  useEffect(() => {
    fetchStudents()
  }, [])

  // Start Webcam Stream
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
      console.error("Failed to acquire webcam stream:", err)
      alert("Could not access camera. Please verify device permissions.")
    }
  }

  // Stop Webcam Stream
  const stopCamera = () => {
    resetLivenessState()
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setCameraActive(false)
    // Clear canvas
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext("2d")
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }

  // Auto clean camera when switching tabs
  useEffect(() => {
    stopCamera()
    resetLivenessState()
  }, [activeTab])

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  // Capture Frame Base64 JPEG
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

  // Bounding Boxes Overlay Drawer
  const drawBoundingBoxes = (faces: DetectedFace[]) => {
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

    ctx.strokeStyle = "#10b981" // Emerald green border
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

  // ======================== TAB 1: FACE REGISTRATION ========================
  const [regSelectedRoll, setRegSelectedRoll] = useState("")
  const [regIsProcessing, setRegIsProcessing] = useState(false)
  const [regSuccess, setRegSuccess] = useState(false)
  const [regError, setRegError] = useState<string | null>(null)

  const handleRegister = async () => {
    if (!regSelectedRoll) return
    setRegIsProcessing(true)
    setRegSuccess(false)
    setRegError(null)
    resetLivenessState()

    const base64Image = captureFrame()
    if (!base64Image) {
      setRegError("Please turn on the camera and stand clearly in front of the lens.")
      setRegIsProcessing(false)
      return
    }

    try {
      const data = await apiFetch("/face-recognition/register/", {
        method: "POST",
        body: {
          roll_no: regSelectedRoll,
          image: base64Image
        }
      })

      setRegSuccess(true)
      setLivenessScore(data.liveness_score ?? null)
      setLivenessChecks(data.liveness_checks ?? null)
      setLivenessDetails(data.liveness_details ?? null)
      fetchStudents() // Reload roster
    } catch (e: any) {
      setRegError(e.message || "Face registration failed.")
      const data = e.data || {}
      if (data.liveness_score !== undefined) setLivenessScore(data.liveness_score)
      if (data.liveness_checks !== undefined) setLivenessChecks(data.liveness_checks)
      if (data.liveness_details !== undefined) setLivenessDetails(data.liveness_details)
    } finally {
      setRegIsProcessing(false)
    }
  }

  // Handle local file upload enrollment.
  const handleFileUploadRegister = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!regSelectedRoll || !e.target.files?.[0]) return
    setRegIsProcessing(true)
    setRegSuccess(false)
    setRegError(null)
    resetLivenessState()

    const file = e.target.files[0]
    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64Image = reader.result as string
      try {
        const data = await apiFetch("/face-recognition/register/", {
          method: "POST",
          body: {
            roll_no: regSelectedRoll,
            image: base64Image
          }
        })
        setRegSuccess(true)
        setLivenessScore(data.liveness_score ?? null)
        setLivenessChecks(data.liveness_checks ?? null)
        setLivenessDetails(data.liveness_details ?? null)
        fetchStudents()
      } catch (err: any) {
        setRegError(err.message || "Connection failed.")
        const data = err.data || {}
        if (data.liveness_score !== undefined) setLivenessScore(data.liveness_score)
        if (data.liveness_checks !== undefined) setLivenessChecks(data.liveness_checks)
        if (data.liveness_details !== undefined) setLivenessDetails(data.liveness_details)
      } finally {
        setRegIsProcessing(false)
      }
    }
    reader.readAsDataURL(file)
  }

  // ======================== TAB 2: FACE VERIFICATION ========================
  const [verifyRoll, setVerifyRoll] = useState("")
  const [verifyIsProcessing, setVerifyIsProcessing] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [verifyResult, setVerifyResult] = useState<{
    match: boolean
    confidence: number
    distance: number
    student_name: string
  } | null>(null)

  const handleVerify = async () => {
    if (!verifyRoll) return
    setVerifyIsProcessing(true)
    setVerifyResult(null)
    setVerifyError(null)
    resetLivenessState()

    const base64Image = captureFrame()
    if (!base64Image) {
      setVerifyError("Webcam frame capture failed. Check camera feed.")
      setVerifyIsProcessing(false)
      return
    }

    try {
      const data = await apiFetch("/face-recognition/verify/", {
        method: "POST",
        body: {
          roll_no: verifyRoll,
          image: base64Image
        }
      })

      setVerifyResult({
        match: data.match,
        confidence: data.confidence,
        distance: data.distance,
        student_name: data.student_name
      })
      setLivenessScore(data.liveness_score ?? null)
      setLivenessChecks(data.liveness_checks ?? null)
      setLivenessDetails(data.liveness_details ?? null)
    } catch (e: any) {
      setVerifyError(e.message || "Verification failed.")
      const data = e.data || {}
      if (data.liveness_score !== undefined) setLivenessScore(data.liveness_score)
      if (data.liveness_checks !== undefined) setLivenessChecks(data.liveness_checks)
      if (data.liveness_details !== undefined) setLivenessDetails(data.liveness_details)
    } finally {
      setVerifyIsProcessing(false)
    }
  }

  // Handle local file verification.
  const handleFileUploadVerify = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!verifyRoll || !e.target.files?.[0]) return
    setVerifyIsProcessing(true)
    setVerifyResult(null)
    setVerifyError(null)
    resetLivenessState()

    const file = e.target.files[0]
    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64Image = reader.result as string
      try {
        const data = await apiFetch("/face-recognition/verify/", {
          method: "POST",
          body: {
            roll_no: verifyRoll,
            image: base64Image
          }
        })
        setVerifyResult({
          match: data.match,
          confidence: data.confidence,
          distance: data.distance,
          student_name: data.student_name
        })
        setLivenessScore(data.liveness_score ?? null)
        setLivenessChecks(data.liveness_checks ?? null)
        setLivenessDetails(data.liveness_details ?? null)
      } catch (err: any) {
        setVerifyError(err.message || "Verification connection failed.")
        const data = err.data || {}
        if (data.liveness_score !== undefined) setLivenessScore(data.liveness_score)
        if (data.liveness_checks !== undefined) setLivenessChecks(data.liveness_checks)
        if (data.liveness_details !== undefined) setLivenessDetails(data.liveness_details)
      } finally {
        setVerifyIsProcessing(false)
      }
    }
    reader.readAsDataURL(file)
  }

  // ======================== TAB 3: LIVE CAMERA DETECTION =====================
  const [isScanning, setIsScanning] = useState(false)
  const [scanComplete, setScanComplete] = useState(false)
  const [detectedFaces, setDetectedFaces] = useState<DetectedFace[]>([])
  const [scanError, setScanError] = useState<string | null>(null)

  const handleStartScan = async () => {
    setIsScanning(true)
    setScanComplete(false)
    setDetectedFaces([])
    setScanError(null)
    resetLivenessState()

    if (!cameraActive) {
      await startCamera()
      // Give camera half a second to initialize viewport
      await new Promise(resolve => setTimeout(resolve, 600))
    }

    const base64Image = captureFrame()
    if (!base64Image) {
      setScanError("Failed to capture image feed frame.")
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
      setDetectedFaces(facesList)
      drawBoundingBoxes(facesList)
      setScanComplete(true)
      setLivenessScore(data.liveness_score ?? null)
      setLivenessChecks(data.liveness_checks ?? null)
      setLivenessDetails(data.liveness_details ?? null)
    } catch (e: any) {
      setScanError(e.message || "Detection failed.")
      const data = e.data || {}
      if (data.liveness_score !== undefined) setLivenessScore(data.liveness_score)
      if (data.liveness_checks !== undefined) setLivenessChecks(data.liveness_checks)
      if (data.liveness_details !== undefined) setLivenessDetails(data.liveness_details)
    } finally {
      setIsScanning(false)
    }
  }

  // ======================== TAB 4: DEEPFACE ANALYSIS ========================
  const [analyzeIsProcessing, setAnalyzeIsProcessing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  const handleAnalyze = async () => {
    setAnalyzeIsProcessing(true)
    setAnalysisResult(null)
    setAnalyzeError(null)
    resetLivenessState()

    const base64Image = captureFrame()
    if (!base64Image) {
      setAnalyzeError("Camera snapshot failed.")
      setAnalyzeIsProcessing(false)
      return
    }

    try {
      const data = await apiFetch("/face-recognition/analyze/", {
        method: "POST",
        body: { image: base64Image }
      })

      setAnalysisResult({
        age: data.age,
        gender: data.gender,
        dominant_emotion: data.dominant_emotion,
        emotion_scores: data.emotion_scores,
        dominant_race: data.dominant_race
      })
      setLivenessScore(data.liveness_score ?? null)
      setLivenessChecks(data.liveness_checks ?? null)
      setLivenessDetails(data.liveness_details ?? null)
    } catch (e: any) {
      setAnalyzeError(e.message || "Face analysis failed.")
      const data = e.data || {}
      if (data.liveness_score !== undefined) setLivenessScore(data.liveness_score)
      if (data.liveness_checks !== undefined) setLivenessChecks(data.liveness_checks)
      if (data.liveness_details !== undefined) setLivenessDetails(data.liveness_details)
    } finally {
      setAnalyzeIsProcessing(false)
    }
  }

  // Handle local file analysis.
  const handleFileUploadAnalyze = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return
    setAnalyzeIsProcessing(true)
    setAnalysisResult(null)
    setAnalyzeError(null)
    resetLivenessState()

    const file = e.target.files[0]
    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64Image = reader.result as string
      try {
        const data = await apiFetch("/face-recognition/analyze/", {
          method: "POST",
          body: { image: base64Image }
        })
        setAnalysisResult({
          age: data.age,
          gender: data.gender,
          dominant_emotion: data.dominant_emotion,
          emotion_scores: data.emotion_scores,
          dominant_race: data.dominant_race
        })
        setLivenessScore(data.liveness_score ?? null)
        setLivenessChecks(data.liveness_checks ?? null)
        setLivenessDetails(data.liveness_details ?? null)
      } catch (err: any) {
        setAnalyzeError(err.message || "Connection failed.")
        const data = err.data || {}
        if (data.liveness_score !== undefined) setLivenessScore(data.liveness_score)
        if (data.liveness_checks !== undefined) setLivenessChecks(data.liveness_checks)
        if (data.liveness_details !== undefined) setLivenessDetails(data.liveness_details)
      } finally {
        setAnalyzeIsProcessing(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const tabs = [
    { key: "register" as const, label: "Face Registration", icon: Fingerprint },
    { key: "verify" as const, label: "Face Matching", icon: ShieldCheck },
    { key: "detect" as const, label: "Live Detection", icon: Camera },
    { key: "analyze" as const, label: "DeepFace Analysis", icon: Smile }
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Face Recognition Engine</h2>
        <p className="text-xs text-slate-400">Register biometric embeddings, verify identity, detect classroom faces, and analyze facial attributes</p>
      </div>

      {/* Tab Navigation Bar */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
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

        {/* Camera Control Panel (Shared layout for tabs) */}
        {activeTab !== "register" || regSelectedRoll ? (
          <div className="px-6 pt-6 grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Real-time Webcam Capture</span>
              <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden relative min-h-[300px] flex items-center justify-center">
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
                  <div className="text-center text-slate-500 p-8 space-y-3">
                    <Camera className="w-12 h-12 mx-auto text-slate-700" />
                    <div>
                      <p className="text-xs font-semibold text-slate-400">Webcam Interface Ready</p>
                      <p className="text-[10px] text-slate-600 mt-1">Start camera hardware stream to run biometrics operations</p>
                    </div>
                  </div>
                )}

                {/* Radar scanner visual overlay */}
                {isScanning && (
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/20 to-transparent animate-pulse pointer-events-none z-10 border-t-2 border-emerald-500" />
                )}

                {/* Status Bar Indicators */}
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center z-10">
                  {cameraActive ? (
                    <button
                      onClick={stopCamera}
                      className="flex items-center gap-1.5 text-[9px] font-bold bg-rose-600/90 hover:bg-rose-700 text-white px-2.5 py-1 rounded-lg transition-all pointer-events-auto"
                    >
                      <Activity className="w-3 h-3 text-white animate-pulse" />
                      <span>STOP FEED</span>
                    </button>
                  ) : (
                    <button
                      onClick={startCamera}
                      className="flex items-center gap-1.5 text-[9px] font-bold bg-emerald-600/95 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg transition-all pointer-events-auto"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>START CAMERA</span>
                    </button>
                  )}
                  <div className="text-[9px] font-semibold text-slate-400 bg-slate-900/80 px-2 py-1 rounded border border-slate-800">
                    {cameraActive 
                      ? (livenessScore !== null 
                        ? (livenessScore >= 60 ? "LIVENESS_PASSED" : "LIVENESS_BLOCKED") 
                        : "LIVENESS_AUDIT") 
                      : "STANDBY"}
                  </div>
                </div>
              </div>
            </div>

            {/* Tab Specific Right-Hand Side Operations */}
            <div className="space-y-4">
              {/* Registration Tab LHS */}
              {activeTab === "register" && (
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Enroll Selected Student</h3>
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">Choose an enrollment image:</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUploadRegister}
                      className="block w-full text-[10px] text-slate-500 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-350 cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={handleRegister}
                    disabled={regIsProcessing || !cameraActive}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold shadow-sm transition-all ${
                      regIsProcessing || !cameraActive
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                    }`}
                  >
                    {regIsProcessing ? (
                      <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Transmitting Biometrics...</>
                    ) : (
                      <><Fingerprint className="w-4 h-4" /> Snapshot & Enroll Face</>
                    )}
                  </button>

                  {regSuccess && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[10px] font-bold animate-in fade-in duration-300">
                      <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      Biometric Face registration successfully persistent in SQLite database.
                    </div>
                  )}

                  {regError && (
                    <div className="p-3 bg-rose-50 text-rose-800 border border-rose-150 rounded-lg text-[10px] font-medium leading-relaxed">
                      {regError}
                    </div>
                  )}
                </div>
              )}

              {/* Verification Tab LHS */}
              {activeTab === "verify" && (
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Identity Matcher</h3>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Select Enrolled Student</label>
                    <select
                      value={verifyRoll}
                      onChange={(e) => { setVerifyRoll(e.target.value); setVerifyResult(null); setVerifyError(null) }}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="">-- Choose Student to Verify --</option>
                      {dbStudents.filter(s => s.face_enrolled).map(s => (
                        <option key={s.roll_no} value={s.roll_no}>{s.roll_no} — {s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <p className="text-[10px] text-slate-500">File verification:</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUploadVerify}
                      disabled={!verifyRoll}
                      className="block w-full text-[10px] text-slate-500 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-350 cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={handleVerify}
                    disabled={!verifyRoll || verifyIsProcessing || !cameraActive}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold shadow-sm transition-all ${
                      !verifyRoll || verifyIsProcessing || !cameraActive
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                    }`}
                  >
                    {verifyIsProcessing ? (
                      <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying embeddings...</>
                    ) : (
                      <><ShieldCheck className="w-4 h-4" /> Snapshot & Match Face</>
                    )}
                  </button>

                  {verifyError && (
                    <div className="p-3 bg-rose-50 text-rose-800 border border-rose-150 rounded-lg text-[10px] font-medium leading-relaxed">
                      {verifyError}
                    </div>
                  )}

                  {verifyResult && (
                    <div className={`rounded-xl border overflow-hidden shadow-sm animate-in fade-in duration-200 ${
                      verifyResult.match ? "border-emerald-200 bg-emerald-50/20" : "border-rose-200 bg-rose-50/20"
                    }`}>
                      <div className="p-4 text-center">
                        <h4 className={`text-xs font-extrabold flex items-center justify-center gap-1.5 ${
                          verifyResult.match ? "text-emerald-700" : "text-rose-700"
                        }`}>
                          {verifyResult.match ? (
                            <><ShieldCheck className="w-4 h-4" /> MATCH CONFIRMED</>
                          ) : (
                            <><ShieldAlert className="w-4 h-4" /> NO MATCH FOUND</>
                          )}
                        </h4>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-slate-700">
                          <div className="bg-white p-2 rounded-lg border border-slate-100">
                            <span className="block text-[8px] text-slate-500 uppercase">Confidence</span>
                            <span className="text-sm text-emerald-600">{verifyResult.confidence}%</span>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-slate-100">
                            <span className="block text-[8px] text-slate-500 uppercase">L2 Distance</span>
                            <span className="text-sm text-slate-600">{verifyResult.distance}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Live Classroom Detection LHS */}
              {activeTab === "detect" && (
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Multi-Face Classroom scan</h3>
                  <p className="text-[10px] text-slate-400">Position the camera to capture a group frame. The backend will detect all faces and verify against your database roster.</p>
                  
                  <button
                    onClick={handleStartScan}
                    disabled={isScanning}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                  >
                    {isScanning ? (
                      <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Batch Matching Encodings...</>
                    ) : (
                      <><Scan className="w-4 h-4" /> Trigger Multi-Face Scan</>
                    )}
                  </button>

                  {scanError && (
                    <div className="p-3 bg-rose-50 text-rose-800 border border-rose-150 rounded-lg text-[10px] font-medium leading-relaxed">
                      {scanError}
                    </div>
                  )}

                  {scanComplete && detectedFaces.length > 0 && (
                    <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-150 rounded-lg text-[10px] font-bold animate-in fade-in duration-300">
                      Detected {detectedFaces.length} student(s) matching enrolled records. Bounding boxes painted on viewport.
                    </div>
                  )}
                </div>
              )}

              {/* DeepFace LHS */}
              {activeTab === "analyze" && (
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">DeepFace Demographic Pipeline</h3>
                  
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-slate-500">File analyzer:</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUploadAnalyze}
                      className="block w-full text-[10px] text-slate-500 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-350 cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={handleAnalyze}
                    disabled={analyzeIsProcessing || !cameraActive}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold shadow-sm transition-all ${
                      analyzeIsProcessing || !cameraActive
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                    }`}
                  >
                    {analyzeIsProcessing ? (
                      <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Extracting neural dimensions...</>
                    ) : (
                      <><Smile className="w-4 h-4" /> Snapshot & Analyze Attributes</>
                    )}
                  </button>

                  {analyzeError && (
                    <div className="p-3 bg-rose-50 text-rose-800 border border-rose-150 rounded-lg text-[10px] font-medium leading-relaxed">
                      {analyzeError}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Tab-specific subpanels at bottom */}
        <div className="p-6 border-t border-slate-100">
          {/* TAB 1: Face Registration student selector and roster */}
          {activeTab === "register" && (
            <div className="space-y-6">
              {!regSelectedRoll && (
                <div className="max-w-md mx-auto p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-center">
                  <Fingerprint className="w-10 h-10 mx-auto text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-800">Choose Student to Enroll</h3>
                  <p className="text-xs text-slate-500">Please select an student from your course roster below to activate the biometric camera capture.</p>
                  
                  <select
                    value={regSelectedRoll}
                    onChange={(e) => { setRegSelectedRoll(e.target.value); setRegSuccess(false); setRegError(null) }}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">-- Choose Student --</option>
                    {dbStudents.map(s => (
                      <option key={s.roll_no} value={s.roll_no}>
                        {s.roll_no} — {s.name} {s.face_enrolled ? "✓" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Roster database table */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Database Biometrics Roster</h3>
                {isLoadingStudents ? (
                  <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" /> Loading database student vectors...
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-[300px] overflow-y-auto pr-1">
                    {dbStudents.map(s => (
                      <div
                        key={s.roll_no}
                        onClick={() => { setRegSelectedRoll(s.roll_no); startCamera() }}
                        className={`p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer hover:border-emerald-350 hover:bg-slate-50/50 ${
                          s.face_enrolled
                            ? "bg-emerald-50/20 border-emerald-150"
                            : "bg-slate-50/50 border-slate-100"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            s.face_enrolled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                          }`}>
                            {s.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <span className="block text-xs font-bold text-slate-800">{s.name}</span>
                            <span className="text-[10px] text-slate-400 font-semibold">{s.roll_no}</span>
                          </div>
                        </div>

                        {s.face_enrolled ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-[9px] font-bold flex items-center gap-0.5">
                            <ShieldCheck className="w-3 h-3" /> ENROLLED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[9px] font-bold flex items-center gap-0.5">
                            <ShieldAlert className="w-3 h-3" /> PENDING
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Batch Detection Results Table */}
          {activeTab === "detect" && detectedFaces.length > 0 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Detected Students Batch Log</h3>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold">Automatic biometric validation matching</span>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Roll Number</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Biometric Confidence</th>
                      <th className="py-3 px-4 text-right">Verification Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs font-medium text-slate-700 bg-white">
                    {detectedFaces.map(st => (
                      <tr key={st.roll_no} className="hover:bg-slate-50/50 transition-all">
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
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500" style={{ width: `${st.confidence}%` }} />
                            </div>
                            <span className="text-[10px] font-bold text-emerald-600">{st.confidence}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-150 rounded text-[9px] font-bold">
                            VERIFIED MATCH
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: DeepFace Demographic Attributes Breakdown charts */}
          {activeTab === "analyze" && analysisResult && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-in fade-in duration-300 space-y-5">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Biometrics Demographic Breakdown</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3.5 bg-emerald-50/30 border border-emerald-100 rounded-xl">
                  <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Age (Est.)</span>
                  <span className="block text-2xl font-extrabold text-emerald-700 mt-1">{analysisResult.age || "N/A"}</span>
                  <span className="text-[9px] text-slate-400 font-semibold">years</span>
                </div>
                <div className="text-center p-3.5 bg-slate-50/50 border border-slate-100 rounded-xl">
                  <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Gender</span>
                  <User className="w-5 h-5 mx-auto text-slate-500 mt-1.5" />
                  <span className="block text-[11px] font-bold text-slate-700 mt-1.5 capitalize">{analysisResult.gender || "N/A"}</span>
                </div>
                <div className="text-center p-3.5 bg-amber-50/30 border border-amber-100 rounded-xl">
                  <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Emotion</span>
                  <Smile className="w-5 h-5 mx-auto text-amber-600 mt-1.5" />
                  <span className="block text-[11px] font-bold text-amber-800 mt-1.5 capitalize">{analysisResult.dominant_emotion || "N/A"}</span>
                </div>
                <div className="text-center p-3.5 bg-indigo-50/30 border border-indigo-100 rounded-xl">
                  <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Dominant Race</span>
                  <span className="block text-sm font-extrabold text-indigo-800 mt-2.5 capitalize">{analysisResult.dominant_race || "N/A"}</span>
                </div>
              </div>

              {/* Emotion scores list */}
              {analysisResult.emotion_scores && (
                <div className="pt-4 border-t border-slate-100 space-y-2.5">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Neural Network Emotion Probability</span>
                  <div className="grid gap-2 max-w-lg">
                    {Object.entries(analysisResult.emotion_scores)
                      .sort(([, a], [, b]) => b - a)
                      .map(([emotion, score]) => (
                        <div key={emotion} className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-600 capitalize w-16">{emotion}</span>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                score > 50 ? "bg-emerald-500" : score > 10 ? "bg-amber-400" : "bg-slate-350"
                              }`}
                              style={{ width: `${Math.min(score, 100)}%` }}
                            />
                          </div>
                          <span className="text-[9px] font-bold text-slate-500 w-10 text-right">{score.toFixed(1)}%</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
