import React, { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { KeyRound, CheckCircle2, ArrowLeft } from "lucide-react"
import { apiFetch } from "../../../lib/api"
import { PasswordStrength } from "./PasswordStrength"

export const ResetPassword: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const uid = searchParams.get("uid")
  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    if (!uid || !token) {
      setError("Invalid or missing reset token parameters in URL.")
      return
    }
    setError("")
    setLoading(true)

    try {
      await apiFetch("/auth/reset-password/", {
        method: "POST",
        body: {
          uidb64: uid,
          token: token,
          new_password: password
        }
      })
      setSubmitted(true)
      setTimeout(() => {
        navigate("/login")
      }, 3000)
    } catch (err: any) {
      setError(err.message || "Failed to reset password. The link may have expired.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-2xl p-8 shadow-xl space-y-6">
      <Link to="/login" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-600 transition-all">
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Login
      </Link>

      {!submitted ? (
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Configure New Password</h2>
            <p className="text-xs text-slate-400">Set a secure password key for your access portal account.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input 
                  type="password" 
                  placeholder="New Security Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                  disabled={loading}
                />
              </div>
              <PasswordStrength password={password} />

              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input 
                  type="password" 
                  placeholder="Confirm Security Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <p className="text-[10px] text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded">
                {error}
              </p>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Updating..." : "Reset Account Credentials"}
            </button>
          </form>
        </div>
      ) : (
        <div className="text-center space-y-4 py-4 animate-in fade-in zoom-in duration-200">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-slate-800">Credentials Updated!</h3>
            <p className="text-xs text-slate-400 px-4">
              Your security password was successfully configured. Redirecting you to sign-in portal...
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
