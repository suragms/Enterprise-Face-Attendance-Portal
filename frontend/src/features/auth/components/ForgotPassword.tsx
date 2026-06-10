import React, { useState } from "react"
import { Link } from "react-router-dom"
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react"
import { apiFetch } from "../../../lib/api"

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await apiFetch("/auth/forgot-password/", {
        method: "POST",
        body: { email: email.trim() }
      })
      setSubmitted(true)
    } catch (err: any) {
      setError(err.message || "An error occurred while requesting reset link.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-2xl p-8 shadow-xl space-y-6">
      {/* Back link */}
      <Link to="/login" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-600 transition-all">
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Login
      </Link>

      {!submitted ? (
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Forgot Password?</h2>
            <p className="text-xs text-slate-400">Provide your registered email to acquire a secure reset link.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input 
                type="email" 
                placeholder="registered-email@hexastack.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-200 rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                required
                disabled={loading}
              />
            </div>

            {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Requesting..." : "Request Secure Link"}
            </button>
          </form>
        </div>
      ) : (
        <div className="text-center space-y-4 py-4 animate-in fade-in zoom-in duration-200">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-slate-800">Dispatch Successful!</h3>
            <p className="text-xs text-slate-400 px-4 leading-relaxed">
              If an account matches **{email}**, a secure link has been sent. Check your inbox to reset credentials.
            </p>
          </div>
          <p className="text-[10px] text-slate-400 font-mono italic">
            Local Dev Check: Reset link printed to Django console logs!
          </p>
        </div>
      )}
    </div>
  )
}
