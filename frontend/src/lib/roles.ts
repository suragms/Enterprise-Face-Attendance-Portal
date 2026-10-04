import type { UserRole } from "../context/AuthContext"

/**
 * Canonical role constants. Legacy values (PLATFORM_SUPER_ADMIN, ORGANIZATION_ADMIN,
 * BRANCH_ADMIN) have been retired on the backend and must not appear here.
 */
const ADMIN_ROLES: UserRole[] = ["SUPER_ADMIN", "HOD"]

const SUPER_ADMIN_ROLES: UserRole[] = ["SUPER_ADMIN"]

export const isAdminRole = (role?: UserRole | string | null) =>
  Boolean(role && ADMIN_ROLES.includes(role as UserRole))

export const isSuperAdminRole = (role?: UserRole | string | null) =>
  Boolean(role && SUPER_ADMIN_ROLES.includes(role as UserRole))

/** True only for exact HOD or SUPER_ADMIN — legacy aliases are intentionally excluded. */
export const isHodRole = (role?: UserRole | string | null) =>
  Boolean(role && (role === "HOD" || role === "SUPER_ADMIN"))

export const isFacultyRole = (role?: UserRole | string | null) =>
  Boolean(role && role === "FACULTY")

export const isStudentRole = (role?: UserRole | string | null) =>
  Boolean(role && role === "STUDENT")
