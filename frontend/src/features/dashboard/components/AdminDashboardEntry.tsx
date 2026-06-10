import React from "react"
import { useAuth } from "../../../context/AuthContext"
import { HodDashboard } from "./HodDashboard"
import { SuperAdminDashboard } from "./SuperAdminDashboard"

export const AdminDashboardEntry: React.FC = () => {
  const { user } = useAuth()
  if (user?.role === "HOD" || user?.role === "ORGANIZATION_ADMIN" || user?.role === "BRANCH_ADMIN") {
    return <HodDashboard />
  }
  return <SuperAdminDashboard />
}
