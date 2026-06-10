import type { UserRole } from "../context/AuthContext"

const ADMIN_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "HOD",
  "PLATFORM_SUPER_ADMIN",
  "ORGANIZATION_ADMIN",
  "BRANCH_ADMIN",
]

const SUPER_ADMIN_ROLES: UserRole[] = ["SUPER_ADMIN", "PLATFORM_SUPER_ADMIN"]

export const isAdminRole = (role?: UserRole | string | null) =>
  Boolean(role && ADMIN_ROLES.includes(role as UserRole))

export const isSuperAdminRole = (role?: UserRole | string | null) =>
  Boolean(role && SUPER_ADMIN_ROLES.includes(role as UserRole))

export const isHodRole = (role?: UserRole | string | null) =>
  Boolean(role && ["HOD", "ORGANIZATION_ADMIN", "BRANCH_ADMIN"].includes(String(role)))

export const isFacultyRole = (role?: UserRole | string | null) =>
  Boolean(role && role === "FACULTY")

export const isStudentRole = (role?: UserRole | string | null) =>
  Boolean(role && role === "STUDENT")
