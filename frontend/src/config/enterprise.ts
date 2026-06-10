export const ENTERPRISE = {
  product: "HexaAttender",
  edition: "Enterprise",
  version: "2.0.0",
  fullName: "HexaAttender v2.0.0 Enterprise",
} as const

export const API_VERSION_PREFIX = "/api/v1"

export const ROLES = [
  "SUPER_ADMIN",
  "PLATFORM_SUPER_ADMIN",
  "ORGANIZATION_ADMIN",
  "BRANCH_ADMIN",
  "HOD",
  "FACULTY",
  "STUDENT",
] as const

export type EnterpriseRole = (typeof ROLES)[number]
