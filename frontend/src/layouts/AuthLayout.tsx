import React from "react"
import { Outlet } from "react-router-dom"

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-100 blur-[120px] opacity-70 pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-50 blur-[120px] opacity-70 pointer-events-none" />
      
      <div className="relative w-full max-w-md z-10">
        <Outlet />
      </div>
    </div>
  )
}
