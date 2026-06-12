import React, { useEffect, useRef, useState } from "react"
import { Camera, RefreshCw, ShieldCheck, User } from "lucide-react"
import { apiFetch } from "../../../lib/api"
import { useAuth } from "../../../context/AuthContext"
import { useStudentContext } from "../../../hooks/useStudentContext"
import { StudentPageHeader } from "./StudentPageHeader"

const REQUIRED_POSES = ["FRONT", "LEFT", "RIGHT", "UP", "DOWN"] as const

export const StudentProfile: React.FC = () => {
  const { user, refreshUser } = useAuth()
  const { context, loading } = useStudentContext(user?.role)

  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [faceMessage, setFaceMessage] = useState<string | null>(null)
  const [poseImages, setPoseImages] = useState<Record<string, string>>({})
  const [faceBusy, setFaceBusy] = useState<"enroll" | "verify" | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [stream])

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  const startCamera = async () => {
    setCameraError(null)
    try {
      stream?.getTracks().forEach((t) => t.stop())
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      })
      setStream(media)
      setCameraActive(true)
      if (videoRef.current) videoRef.current.srcObject = media
    } catch {
      setCameraError("Could not access camera. Allow webcam permissions.")
    }
  }

  const stopCamera = () => {
    stream?.getTracks().forEach((t) => t.stop())
    setStream(null)
    setCameraActive(false)
  }

  const captureFrame = () => {
    if (!videoRef.current) return null
    const canvas = document.createElement("canvas")
    canvas.width = videoRef.current.videoWidth || 640
    canvas.height = videoRef.current.videoHeight || 480
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL("image/jpeg", 0.9)
  }

  const handleCapturePose = (pose: string) => {
    const image = captureFrame()
    if (!image) {
      setFaceMessage("Start camera before capturing a pose.")
      return
    }
    setPoseImages((prev) => ({ ...prev, [pose]: image }))
    setFaceMessage(`${pose} pose captured.`)
  }

  const handleFaceEnrollment = async () => {
    const missing = REQUIRED_POSES.filter((p) => !poseImages[p])
    if (missing.length) {
      setFaceMessage(`Capture all poses: ${missing.join(", ")}`)
      return
    }
    setFaceBusy("enroll")
    try {
      await apiFetch("/face-recognition/enroll-multi/", {
        method: "POST",
        body: { pose_images: poseImages },
      })
      setFaceMessage("5-pose enrollment completed.")
      await refreshUser()
    } catch (err: any) {
      setFaceMessage(err.message || "Enrollment failed.")
    } finally {
      setFaceBusy(null)
    }
  }

  const handleFaceVerify = async () => {
    const image = captureFrame()
    if (!image) {
      setFaceMessage("Start camera to verify.")
      return
    }
    setFaceBusy("verify")
    try {
      const data = await apiFetch<{ match: boolean; confidence?: number }>("/face-recognition/verify/", {
        method: "POST",
        body: { image },
      })
      setFaceMessage(
        data.match
          ? `Face verified (${Math.round(data.confidence ?? 0)}% confidence).`
          : "Face verification failed."
      )
    } catch (err: any) {
      setFaceMessage(err.message || "Verification failed.")
    } finally {
      setFaceBusy(null)
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading profile...</p>

  return (
    <div className="space-y-6">
      <StudentPageHeader title="Profile" description="Your academic identity and face enrollment" />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800">
            <User className="h-4 w-4 text-emerald-600" />
            Academic profile
          </h3>
          <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            {[
              ["Name", context?.name || user?.fullName],
              ["Roll No", context?.roll_no || user?.rollNo],
              ["Email", context?.email || user?.email],
              ["Phone", context?.phone || "—"],
              ["Department", context?.department?.name],
              ["Semester", context?.semester != null ? `Sem ${context.semester}` : "—"],
              ["Course", context?.course],
              ["Branch", context?.branch],
              ["Campus", context?.campus_status],
              ["Attendance", context ? `${context.overall_attendance}%` : "—"],
              ["Promotion", context?.promotion_status],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-slate-400">{label}</dt>
                <dd className="font-semibold text-slate-700">{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-slate-800">Face enrollment</h3>
          {user?.enrollmentOverdue ? (
            <p className="mb-3 text-xs text-rose-600 font-medium">
              Enrollment deadline exceeded. Complete 5-pose capture to restore full portal access.
            </p>
          ) : null}
          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
            {cameraActive ? (
              <video ref={videoRef} autoPlay playsInline className="h-48 w-full object-cover scale-x-[-1] sm:h-56" />
            ) : (
              <div className="flex h-48 items-center justify-center text-slate-400 sm:h-56">
                <Camera className="h-10 w-10" />
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {!cameraActive ? (
              <button
                type="button"
                onClick={startCamera}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
              >
                Start camera
              </button>
            ) : (
              <button type="button" onClick={stopCamera} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                Stop
              </button>
            )}
            {REQUIRED_POSES.map((pose) => (
              <button
                key={pose}
                type="button"
                onClick={() => handleCapturePose(pose)}
                disabled={!cameraActive || faceBusy !== null}
                className={`rounded-lg border px-2.5 py-2 text-[10px] font-semibold disabled:opacity-50 ${
                  poseImages[pose] ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-700"
                }`}
              >
                {pose}
              </button>
            ))}
            <button
              type="button"
              onClick={handleFaceEnrollment}
              disabled={!cameraActive || faceBusy !== null}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
            >
              {faceBusy === "enroll" ? "Enrolling..." : "Enroll"}
            </button>
            <button
              type="button"
              onClick={handleFaceVerify}
              disabled={!cameraActive || faceBusy !== null}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
            >
              Verify
            </button>
          </div>
          {cameraError ? <p className="mt-2 text-xs text-rose-600">{cameraError}</p> : null}
          {faceMessage ? (
            <p className="mt-2 flex items-center gap-1 text-xs text-slate-600">
              {faceBusy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />}
              {faceMessage}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
