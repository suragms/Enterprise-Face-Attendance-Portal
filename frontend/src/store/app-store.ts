import { create } from "zustand"

interface AppState {
  sidebarOpen: boolean
  activeOrganizationId: string | null
  setSidebarOpen: (open: boolean) => void
  setActiveOrganizationId: (organizationId: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  activeOrganizationId: null,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setActiveOrganizationId: (activeOrganizationId) => set({ activeOrganizationId })
}))
