import React, { createContext, useContext, useEffect, useState } from "react"
import { apiFetch, setCsrfToken } from "../lib/api"

export type UserRole =
  | "SUPER_ADMIN"
  | "HOD"
  | "FACULTY"
  | "STUDENT"
  | "PLATFORM_SUPER_ADMIN"
  | "ORGANIZATION_ADMIN"
  | "BRANCH_ADMIN"

export interface User {
  id: string
  username: string
  fullName: string
  email: string
  role: UserRole
  activeOrganization?: string | null
  activeBranch?: string | null
  scode?: string
  rollNo?: string
  enrollmentRequired?: boolean
  enrollmentDueAt?: string | null
  enrollmentOverdue?: boolean
  mustChangePassword?: boolean
}

interface AuthContextType {
  user: User | null
  sessionKey: string | null
  login: (email: string, password: string) => Promise<void>
  verifyFaceForChallenge: (challengeId: string, image: string) => Promise<void>
  completeLogin: (challengeId: string) => Promise<void>
  faceLogin: (organizationId: string, image: string) => Promise<void>
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>
  logout: () => Promise<void>
  isAuthenticated: boolean
  loading: boolean
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const mapBackendUser = (backendUser: any): User => {
  const firstName = backendUser.first_name || ""
  const lastName = backendUser.last_name || ""
  return {
    id: backendUser.id,
    username: backendUser.username,
    email: backendUser.email,
    role: (backendUser.role as UserRole) ?? "STUDENT",
    fullName: `${firstName} ${lastName}`.trim() || backendUser.username,
    activeOrganization: backendUser.active_organization,
    activeBranch: backendUser.active_branch,
    scode: backendUser.staff_code,
    rollNo: backendUser.roll_no,
    enrollmentRequired: backendUser.enrollment_required,
    enrollmentDueAt: backendUser.enrollment_due_at,
    enrollmentOverdue: backendUser.enrollment_overdue,
    mustChangePassword: backendUser.must_change_password,
  }
}

const getDeviceFingerprint = () => {
  const ua = navigator.userAgent || "unknown"
  const platform = navigator.platform || "unknown"
  const language = navigator.language || "unknown"
  return `${platform} | ${language} | ${ua}`.slice(0, 255)
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [sessionKey, setSessionKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const hydrate = async () => {
    try {
      const backendUser = await apiFetch<any>("/auth/me/")
      setUser(mapBackendUser(backendUser))
    } catch {
      setUser(null)
      setSessionKey(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    hydrate()
    const handleAuthExpired = () => {
      setUser(null)
      setSessionKey(null)
    }
    window.addEventListener("auth_expired", handleAuthExpired)
    return () => window.removeEventListener("auth_expired", handleAuthExpired)
  }, [])

  const login = async (email: string, password: string) => {
    const challenge = await apiFetch<{ challenge_id: string; face_required: boolean; attempts?: number; attempts_remaining?: number }>(
      "/auth/initiate-login/",
      {
        method: "POST",
        body: { mode: "password", email, password, device: getDeviceFingerprint() },
      }
    )
    if (!challenge.face_required) {
      await completeLogin(challenge.challenge_id)
      return
    }
    const error: any = new Error("Face verification required.")
    error.requiresFace = true
    error.challengeId = challenge.challenge_id
    error.attempts = challenge.attempts ?? 0
    error.attemptsRemaining = challenge.attempts_remaining ?? 5
    throw error
  }

  const verifyFaceForChallenge = async (challengeId: string, image: string) => {
    await apiFetch("/auth/verify-face/", {
      method: "POST",
      body: {
        challenge_id: challengeId,
        image,
        device: getDeviceFingerprint(),
      },
    })
  }

  const completeLogin = async (challengeId: string) => {
    const response = await apiFetch<{ user: any; csrfToken?: string; session_key?: string }>("/auth/complete-login/", {
      method: "POST",
      body: { challenge_id: challengeId, device: getDeviceFingerprint() },
    })
    setCsrfToken(response.csrfToken)
    setSessionKey(response.session_key || null)
    setUser(mapBackendUser(response.user))
  }

  const faceLogin = async (organizationId: string, image: string) => {
    const challenge = await apiFetch<{ challenge_id: string }>("/auth/initiate-login/", {
      method: "POST",
      body: { mode: "face", organization_id: organizationId, image, device: getDeviceFingerprint() },
    })
    await completeLogin(challenge.challenge_id)
  }

  const changePassword = async (oldPassword: string, newPassword: string) => {
    await apiFetch("/auth/change-password/", {
      method: "POST",
      body: { old_password: oldPassword, new_password: newPassword },
    })
    setUser(null)
    setSessionKey(null)
    setCsrfToken("")
  }

  const logout = async () => {
    try {
      await apiFetch("/auth/logout/", { method: "POST" })
    } finally {
      setUser(null)
      setSessionKey(null)
      setCsrfToken("")
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        sessionKey,
        login,
        verifyFaceForChallenge,
        completeLogin,
        faceLogin,
        changePassword,
        logout,
        isAuthenticated: !!user,
        loading,
        refreshUser: hydrate,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider")
  return context
}

export const roleDashboardPath = (role: UserRole) => {
  if (["SUPER_ADMIN", "HOD", "PLATFORM_SUPER_ADMIN", "ORGANIZATION_ADMIN", "BRANCH_ADMIN"].includes(role)) {
    return "/admin/dashboard"
  }
  if (role === "FACULTY") return "/faculty/dashboard"
  return "/student/dashboard"
}
