import React from "react"

interface PasswordStrengthProps {
  password: string
}

const checks = [
  { label: "8+ characters", test: (value: string) => value.length >= 8 },
  { label: "Uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "Lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { label: "Number", test: (value: string) => /\d/.test(value) },
  { label: "Special character", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
]

export const PasswordStrength: React.FC<PasswordStrengthProps> = ({ password }) => {
  if (!password) return null
  return (
    <ul className="space-y-1">
      {checks.map((check) => {
        const passed = check.test(password)
        return (
          <li key={check.label} className={`text-[10px] font-semibold ${passed ? "text-emerald-600" : "text-slate-400"}`}>
            {passed ? "✓" : "○"} {check.label}
          </li>
        )
      })}
    </ul>
  )
}
