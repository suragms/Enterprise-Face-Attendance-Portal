import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import { KeyRound, ShieldCheck, LogOut } from "lucide-react"
import { useAuth } from "../../../context/AuthContext"
import { PasswordStrength } from "./PasswordStrength"

interface ChangePasswordProps {
  forced?: boolean
}

export const ChangePassword: React.FC<ChangePasswordProps> = ({ forced = false }) => {
  const { changePassword, logout, user } = useAuth()
  const navigate = useNavigate()
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.")
      return
    }
    setError("")
    setSubmitting(true)
    try {
      await changePassword(oldPassword, newPassword)
      setSuccess(true)
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setTimeout(() => navigate("/login", { replace: true }), 1500)
    } catch (err: any) {
      setError(err.message || "Unable to update password.")
      setSuccess(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm max-w-md w-full space-y-4 mx-auto">
      <div className="flex items-center justify-between pb-1 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Account Security</h3>
          <p className="text-xs text-slate-400">
            {forced
              ? "You must set a new password before continuing."
              : "Modify your login password credentials."}
          </p>
        </div>
        {user?.email && (
          <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
            {user.email}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Current Password</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="password"
                placeholder="Current Secure Password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">New Password</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="password"
                placeholder="New Secure Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>
            <div className="mt-2">
              <PasswordStrength password={newPassword} />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Confirm New Password</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="password"
                placeholder="Confirm New Secure Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>
          </div>
        </div>

        {error ? (
          <p className="text-[10px] text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded">{error}</p>
        ) : null}

        {success ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 text-emerald-800 rounded text-[10px] font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Password changed successfully. Redirecting to login...
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
        >
          {submitting ? "Updating..." : "Update Security Key"}
        </button>

        <button
          type="button"
          onClick={async () => {
            await logout()
            navigate("/login", { replace: true })
          }}
          className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out / Switch Account
        </button>
      </form>
    </div>
  )
}
