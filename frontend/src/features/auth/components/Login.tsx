import React, { useState, useRef, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuth } from "../../../context/AuthContext"
import { 
  KeyRound, 
  Mail, 
  Sparkles, 
  Shield, 
  UserCheck, 
  GraduationCap, 
  Camera,
  ScanFace,
  RefreshCw,
  AlertCircle, 
  Loader2 
} from "lucide-react"

export const Login: React.FC = () => {
  const { login, verifyFaceForChallenge, completeLogin } = useAuth()
  const navigate = useNavigate()
  
  // Sign-In States
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loginMethod, setLoginMethod] = useState<"credentials" | "face">("credentials")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeRole, setActiveRole] = useState<string | null>(null)

  // Face Verification 2FA States
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [cameraState, setCameraState] = useState<"off" | "starting" | "ready" | "scanning" | "success" | "failed">("off")
  const [livenessResult, setLivenessResult] = useState<{ score: number; checks: Record<string, boolean> } | null>(null)
  const [lockoutTime, setLockoutTime] = useState<number>(0)
  const [pendingChallengeId, setPendingChallengeId] = useState<string | null>(null)
  const [attemptsUsed, setAttemptsUsed] = useState<number>(0)
  
  const streamRef = useRef<MediaStream | null>(null)

  // 1. Role switcher credentials mapping
  const roles = [
    { id: "super", label: "Super Admin", icon: Sparkles, color: "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100", activeColor: "bg-amber-600 text-white border-amber-600", user: "athults@superadmin.com", pass: "Athul123!" },
    { id: "hod", label: "Admin HOD", icon: Shield, color: "bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100", activeColor: "bg-indigo-600 text-white border-indigo-600", user: "admin@hexastack.test", pass: "securepassword123" },
    { id: "faculty", label: "Faculty Staff", icon: UserCheck, color: "bg-sky-50 text-sky-600 border-sky-200 hover:bg-sky-100", activeColor: "bg-sky-600 text-white border-sky-600", user: "faculty@hexastack.test", pass: "securepassword123" },
    { id: "student", label: "Student View", icon: GraduationCap, color: "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100", activeColor: "bg-emerald-600 text-white border-emerald-600", user: "student@hexastack.test", pass: "securepassword123" }
  ]

  const handleRoleSelect = (roleId: string, user: string, pass: string) => {
    setActiveRole(roleId)
    setEmail(user)
    setPassword(pass)
    setError(null)
  }

  // Handle standard credentials login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await login(email.trim(), password)
      navigate("/", { replace: true })
    } catch (err: any) {
      if (err?.requiresFace && err?.challengeId) {
        setPendingChallengeId(err.challengeId)
        setAttemptsUsed(err.attempts ?? 0)
        setLoginMethod("face")
        setError("Credentials verified. Face verification is required to complete login.")
        return
      }
      const message = err.message || "Unable to sign in. Please verify your credentials."
      if (message.includes("Too many failed attempts") || err.status === 429) {
        setError("Account temporarily locked after 5 failed attempts. Try again in 15 minutes.")
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  // Camera Management for Face Verification
  const startCamera = async () => {
    setError(null)
    setCameraState("starting")
    setLivenessResult(null)
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
      setCameraState("ready")
    } catch (err: any) {
      setCameraState("off")
      setError("Webcam access denied or unavailable. Please check browser permissions.")
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
    setCameraState("off")
  }

  // Clean up camera stream on unmount or tab switch
  useEffect(() => {
    if (loginMethod !== "face") {
      stopCamera()
    } else {
      startCamera()
    }
    return () => stopCamera()
  }, [loginMethod])

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutTime > 0) {
      const timer = setInterval(() => {
        setLockoutTime(prev => prev - 1)
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [lockoutTime])

  // Capture frame and submit to FaceLogin API
  const handleFaceLogin = async () => {
    if (cameraState !== "ready" || !videoRef.current || !canvasRef.current) return
    setError(null)
    setCameraState("scanning")
    
    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext("2d")
      
      if (context) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        
        const imageData = canvas.toDataURL("image/jpeg", 0.9)
        
        if (pendingChallengeId) {
          await verifyFaceForChallenge(pendingChallengeId, imageData)
          await completeLogin(pendingChallengeId)
          setPendingChallengeId(null)
        } else {
          throw new Error("Use email/password first. Face scan is required to complete student login.")
        }
        setCameraState("success")
        
        // Wait briefly for success animation to wow the user, then navigate
        setTimeout(() => {
          stopCamera()
          navigate("/", { replace: true })
        }, 1200)
      }
    } catch (err: any) {
      setCameraState("failed")
      const backendPayload = err.data || (() => {
        try {
          return typeof err.message === "string" ? JSON.parse(err.message) : null
        } catch {
          return null
        }
      })()

      const detailMsg = backendPayload?.detail || backendPayload?.error || err.message || "Face verification failed."
      
      const attempts = backendPayload?.attempts ?? (err.attempts ?? attemptsUsed + 1)
      setAttemptsUsed(Math.min(5, attempts))
      
      const lockSeconds = backendPayload?.lock_seconds ?? err.lock_seconds
      const liveness = backendPayload?.liveness ?? err.liveness

      // Look for lockout response code or content
      if (detailMsg.includes("Too many failed attempts") || detailMsg.includes("temporarily disabled") || lockSeconds) {
        setLockoutTime(3600) // 1 hour lockout countdown
        setError("Attempt 5/5 reached. Face verification is locked for 1 hour.")
      } else if (liveness) {
        setError("Liveness check failed (anti-spoofing alert). Please ensure you are front-facing in a well-lit environment.")
        setLivenessResult(liveness)
      } else {
        setError(`${detailMsg} Attempt ${Math.min(5, attempts)}/5.`)
      }
    }
  }

  return (
    <div className="bg-white border border-slate-150 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-md w-full mx-auto relative overflow-hidden">
      
      {/* Decorative top gradient header line */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500"></div>

      {/* Brand & Logo Header */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-extrabold mx-auto text-2xl shadow-lg transform hover:scale-105 transition-all duration-300">
          H
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight bg-gradient-to-r from-slate-900 to-slate-800 bg-clip-text text-transparent">HexaAttender</h2>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Enterprise Face Attendance Portal</p>
      </div>

      {/* Attempts Counter during Face Verification */}
      {pendingChallengeId && (
        <div className="text-center text-[11px] text-slate-500 font-semibold bg-emerald-50/50 border border-emerald-100/60 rounded-lg py-1">
          Verification Step • Attempts: {attemptsUsed}/5
        </div>
      )}

      {/* ERROR DISPLAY */}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-150 rounded-xl flex gap-2.5 items-start animate-in fade-in slide-in-from-top-1">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-black text-rose-800">
              {loginMethod === "face" ? "Face Verification Required" : "Security Exception"}
            </h4>
            <p className="text-xxs text-rose-700 leading-relaxed font-semibold">{error}</p>
            {livenessResult && (
              <div className="mt-1.5 text-xxs text-rose-600/90 font-medium space-y-0.5">
                <div>Liveness Score: {livenessResult.score}%</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TRADITIONAL CREDENTIALS */}
      {loginMethod === "credentials" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Quick Demo Switcher - 2x2 grid */}
          <div className="space-y-2">
            <label className="text-xxs font-black text-slate-400 uppercase tracking-widest">Showcase Quick Role Switcher</label>
            <div className="grid grid-cols-2 gap-2">
              {roles.map((role) => {
                const IconComponent = role.icon
                const isActive = activeRole === role.id
                return (
                  <button
                    key={role.id}
                    onClick={() => handleRoleSelect(role.id, role.user, role.pass)}
                    className={`flex items-center gap-2 px-3 py-2 text-xxs border rounded-xl font-black transition-all transform active:scale-95 duration-200 ${
                      isActive ? role.activeColor : `bg-white text-slate-700 border-slate-200 hover:border-emerald-350 hover:bg-slate-50`
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5 shrink-0" />
                    <span>{role.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-3">
              <div className="relative">
                <label htmlFor="login-email" className="sr-only">Email address</label>
                <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" aria-hidden />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setActiveRole(null) // deselect role switcher
                  }}
                  className="w-full bg-slate-50/50 border border-slate-200 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:bg-white transition-all"
                  required
                />
              </div>

              <div className="relative">
                <label htmlFor="login-password" className="sr-only">Password</label>
                <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-400" aria-hidden />
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setActiveRole(null)
                  }}
                  className="w-full bg-slate-50/50 border border-slate-200 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:bg-white transition-all"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end text-xs">
              <Link to="/forgot-password" className="font-bold text-slate-400 hover:text-emerald-600 transition-all">
                Forgot Password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white rounded-xl text-xs font-black shadow-lg hover:shadow-xl transition-all duration-200 transform active:scale-98 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Sign In to Portal</span>
              )}
            </button>
          </form>
        </div>
      )}

      {/* FACE VERIFICATION SCANNING CONTAINER */}
      {loginMethod === "face" && (
        <div className="space-y-5 animate-in fade-in duration-300 flex flex-col items-center">
          
          {/* Biometric Scan Frame */}
          <div className="relative w-52 h-52 rounded-full border-4 border-slate-100 overflow-hidden shadow-inner flex items-center justify-center bg-slate-950 group">
            
            {/* Hidden Canvas used for capturing image */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Video Feed */}
            <video
              ref={(el) => {
                videoRef.current = el
                if (el && streamRef.current && el.srcObject !== streamRef.current) {
                  el.srcObject = streamRef.current
                  el.play().catch(err => console.error("Error playing video in login:", err))
                }
              }}
              className={`w-full h-full object-cover rounded-full scale-x-[-1] ${
                cameraState === "scanning" ? "brightness-50" : ""
              }`}
              muted
              playsInline
            />

            {/* Camera Overlay Indicators */}
            {cameraState === "starting" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-white gap-2 p-4 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                <span className="text-xxs font-bold text-slate-400">Initializing Face Verification...</span>
              </div>
            )}

            {cameraState === "off" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-white gap-2 p-4 text-center">
                <Camera className="w-8 h-8 text-slate-500 animate-pulse" />
                <span className="text-xxs font-bold text-slate-400">Camera Feed Offline</span>
              </div>
            )}

            {/* Premium Biometric Reticle & Scan Line */}
            {cameraState === "ready" && (
              <>
                <div className="absolute inset-0 border-2 border-emerald-500/30 rounded-full pointer-events-none animate-pulse"></div>
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-scanline pointer-events-none"></div>
                <div className="absolute inset-4 border border-dashed border-sky-400/20 rounded-full pointer-events-none"></div>
              </>
            )}

            {cameraState === "scanning" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/70 text-white gap-2">
                <ScanFace className="w-10 h-10 text-emerald-400 animate-bounce" />
                <span className="text-xxs font-black text-emerald-400 animate-pulse tracking-widest uppercase">Matching Biometrics...</span>
              </div>
            )}

            {cameraState === "success" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-600/90 text-white gap-2">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center scale-up">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-xxs font-black tracking-widest uppercase">Access Granted</span>
              </div>
            )}

            {cameraState === "failed" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-rose-600/90 text-white gap-2">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <span className="text-xxs font-black tracking-widest uppercase">Match Refused</span>
              </div>
            )}
          </div>

          {/* Action Buttons for Biometrics */}
          <div className="w-full space-y-3">
            {cameraState === "ready" ? (
              <button
                onClick={handleFaceLogin}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white rounded-xl text-xs font-black shadow-lg hover:shadow-xl transition-all duration-200 transform active:scale-98 flex items-center justify-center gap-2"
              >
                <ScanFace className="w-4 h-4" />
                <span>Verify Face & Log In</span>
              </button>
            ) : (
              <button
                onClick={startCamera}
                disabled={cameraState === "starting" || cameraState === "scanning"}
                className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${cameraState === "starting" ? "animate-spin" : ""}`} />
                <span>Reactivate Face Verification</span>
              </button>
            )}
            
            <button
              onClick={() => {
                stopCamera()
                setLoginMethod("credentials")
                setPendingChallengeId(null)
                setError(null)
              }}
              className="w-full py-2.5 border border-slate-200 text-slate-500 hover:text-slate-800 rounded-xl text-xs font-bold hover:bg-slate-55 transition-all text-center"
            >
              Cancel & Return
            </button>
            
            <p className="text-xxs font-medium text-slate-400 text-center leading-relaxed">
              Position your face in the camera indicator. Anti-spoofing checks (texture, FFT frequency ratio, eye aspect ratio) will run automatically.
            </p>
          </div>
        </div>
      )}

      {/* Institutional Branding Footer */}
      <div className="border-t border-slate-100 pt-4 flex justify-between items-center text-[10px] text-slate-400 font-bold">
        <span>HEXASTACK SOLUTIONS</span>
        <span>v1.0 (PROD)</span>
      </div>
    </div>
  )
}


