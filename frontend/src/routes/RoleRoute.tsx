import React from "react"
import { Navigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { isHodRole, isSuperAdminRole } from "../lib/roles"

export const SuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  if (!isSuperAdminRole(user?.role)) {
    return <Navigate to="/admin/dashboard" replace />
  }
  return <>{children}</>
}

export const HodRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  if (!isHodRole(user?.role) && !isSuperAdminRole(user?.role)) {
    return <Navigate to="/admin/dashboard" replace />
  }
  return <>{children}</>
}
