import React, { useState } from "react"
import { 
  Type, 
  Palette, 
  Ruler, 
  Layers, 
  Menu,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  Copy,
  Info,
  Maximize2
} from "lucide-react"

export const DesignSystem: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"colors" | "typography" | "components" | "layout">("colors")
  const [copiedColor, setCopiedColor] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  const handleCopy = (colorName: string, value: string) => {
    navigator.clipboard.writeText(value)
    setCopiedColor(colorName)
    setTimeout(() => setCopiedColor(null), 2000)
  }

  const colors = [
    { name: "Primary", hex: "#10B981", hsl: "160 84% 39%", role: "Action buttons, active elements, brand recognition", class: "bg-primary" },
    { name: "Secondary", hex: "#059669", hsl: "160 93% 30%", role: "Hover states, highlights, secondary buttons", class: "bg-secondary" },
    { name: "Background", hex: "#FFFFFF", hsl: "0 0% 100%", role: "Page canvas, default container fills", class: "bg-white border border-slate-200" },
    { name: "Text", hex: "#111827", hsl: "221 39% 11%", role: "Body Copy, titles, descriptive headers", class: "bg-slate-900" },
    { name: "Success", hex: "#22C55E", hsl: "142 70% 45%", role: "Successful biometric verification status tags", class: "bg-emerald-500" },
    { name: "Warning", hex: "#F59E0B", hsl: "38 93% 50%", role: "Low attendance standing metrics under 75%", class: "bg-amber-500" },
    { name: "Error", hex: "#EF4444", hsl: "0 84% 60%", role: "Detention statuses, missing credentials", class: "bg-rose-500" },
  ]

  const spacingScale = [
    { size: "2xs", tailwind: "px-1 (4px)", width: "w-1" },
    { size: "xs", tailwind: "px-2 (8px)", width: "w-2" },
    { size: "sm", tailwind: "px-3 (12px)", width: "w-3" },
    { size: "md", tailwind: "px-4 (16px)", width: "w-4" },
    { size: "lg", tailwind: "px-6 (24px)", width: "w-6" },
    { size: "xl", tailwind: "px-8 (32px)", width: "w-8" },
    { size: "2xl", tailwind: "px-12 (48px)", width: "w-12" },
  ]

  return (
    <div className="space-y-8 pb-12">
      {/* Design System Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-8 relative overflow-hidden shadow-md">
        <div className="absolute top-[-150px] right-[-100px] w-96 h-96 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-3 max-w-2xl">
          <span className="text-[10px] bg-emerald-500 text-white font-bold tracking-widest uppercase px-2.5 py-1 rounded-full">
            SYSTEM CORE UTILITIES
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">HexaAttender Design System</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            The canonical styling interface for HexaAttender. Incorporates Tailwind CSS layouts and ShadCN HSL design tokens, customized around an Antigravity theme using emerald green branding accents.
          </p>
        </div>
      </div>

      {/* Primary Categories Navigation */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl max-w-lg border border-slate-200">
        {[
          { id: "colors", name: "Colors & Palettes", icon: Palette },
          { id: "typography", name: "Typography & Grids", icon: Type },
          { id: "components", name: "UI Components Library", icon: Layers },
          { id: "layout", name: "Navigation Layouts", icon: Menu },
        ].map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? "bg-white text-slate-800 shadow-sm border border-slate-200/50"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.name}
            </button>
          )
        })}
      </div>

      {/* Tab Area 1: Colors & Palettes */}
      {activeTab === "colors" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-800">Custom Brand Tokens</h3>
            <p className="text-xs text-slate-400">Harmonious SaaS colors matching the exact specification requirements</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {colors.map((color) => (
              <div key={color.name} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col hover:border-emerald-300 transition-all">
                {/* Color swatch */}
                <div className={`h-24 ${color.class} relative flex items-end p-3`}>
                  <button 
                    onClick={() => handleCopy(color.name, color.hex)}
                    className="absolute top-2 right-2 p-1.5 bg-white/80 hover:bg-white text-slate-600 hover:text-emerald-600 rounded-md transition-all shadow"
                  >
                    {copiedColor === color.name ? (
                      <span className="text-[10px] font-bold text-emerald-600 px-1">Copied!</span>
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                {/* Details */}
                <div className="p-4 flex-1 flex flex-col justify-between bg-slate-50/50 space-y-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">{color.name}</h4>
                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{color.role}</p>
                  </div>
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>Hex: {color.hex}</span>
                    <span>HSL: {color.hsl}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Area 2: Typography & Grids */}
      {activeTab === "typography" && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Typography Scale */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 lg:col-span-2">
            <div>
              <h3 className="text-base font-bold text-slate-800">Typography Scale</h3>
              <p className="text-xs text-slate-400">Scalable Inter/System sans font weights and sizes</p>
            </div>

            <div className="space-y-6 divide-y divide-slate-100">
              <div className="pt-2">
                <span className="text-[9px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold">h1 (text-3xl / text-4xl)</span>
                <h1 className="text-3xl font-extrabold text-slate-900 mt-2">HexaAttender Smart Portal</h1>
              </div>
              <div className="pt-4">
                <span className="text-[9px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold">h2 (text-xl / text-2xl)</span>
                <h2 className="text-xl font-bold text-slate-800 mt-2">Biometric Face Recognition Scan</h2>
              </div>
              <div className="pt-4">
                <span className="text-[9px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold">h3 (text-base)</span>
                <h3 className="text-base font-semibold text-slate-700 mt-2">Lecturer Subject Assignments</h3>
              </div>
              <div className="pt-4">
                <span className="text-[9px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold">Body (text-sm)</span>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                  Automatic period-wise attendance simplifies department management operations and reduces register errors significantly.
                </p>
              </div>
              <div className="pt-4">
                <span className="text-[9px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold">Caption (text-xs)</span>
                <p className="text-xs text-slate-400 mt-2">
                  Created at: 2026-05-29 | HOD active audit trail
                </p>
              </div>
            </div>
          </div>

          {/* Spacing Matrix */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                <Ruler className="w-4 h-4 text-emerald-600" />
                Spacing Grid
              </h3>
              <p className="text-xs text-slate-400">Consistent padding, margin and column gap systems</p>
            </div>

            <div className="space-y-4">
              {spacingScale.map((space) => (
                <div key={space.size} className="flex items-center gap-4 text-xs font-semibold text-slate-600">
                  <span className="w-10 uppercase text-slate-400">{space.size}</span>
                  <div className={`h-6 rounded-md bg-emerald-50 border border-emerald-200 ${space.width} transition-all`} />
                  <span className="font-mono text-[10px] text-slate-400 font-medium">{space.tailwind}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab Area 3: UI Components Library */}
      {activeTab === "components" && (
        <div className="space-y-6">
          {/* Row 1: Cards & Buttons */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Button Collection */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Interactive Buttons</h3>
                <p className="text-xs text-slate-400">Buttons featuring emerald green states, loading status, and outlines</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button className="px-4 py-2 bg-primary hover:bg-secondary text-white rounded-lg text-xs font-bold transition-all shadow-sm">
                  Primary Brand
                </button>
                <button className="px-4 py-2 bg-secondary text-white rounded-lg text-xs font-bold transition-all shadow-sm">
                  Secondary Accent
                </button>
                <button className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition-all">
                  Outline Style
                </button>
                <button className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm">
                  Destructive Error
                </button>
                <button className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold transition-all">
                  Ghost Link
                </button>
              </div>
            </div>

            {/* Badges Collection */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Badges & Indicators</h3>
                <p className="text-xs text-slate-400">Verification status badges and standing tags</p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold inline-flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  FACIAL_VERIFIED
                </span>
                <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-bold inline-flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  ATTENDANCE_WARNING
                </span>
                <span className="px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-bold inline-flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-rose-600" />
                  DETAINED_STATUS
                </span>
                <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-bold">
                  DAY_SCHOLAR
                </span>
              </div>
            </div>
          </div>

          {/* Row 2: Inputs & Tables */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Inputs Column */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 lg:col-span-1">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Form Inputs</h3>
                <p className="text-xs text-slate-500">Standard Text fields and Select drop-down selectors</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Student Roll Number</label>
                  <input 
                    type="text" 
                    placeholder="e.g. MCS-109" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Academic Programme</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white">
                    <option>Master of Computer Science (MCS)</option>
                    <option>Bachelor of Science (BSCS)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tables & Dialog Columns */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 lg:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Data Tables & Modals</h3>
                  <p className="text-xs text-slate-500">Rosters with modal triggers for face validation profiles</p>
                </div>
                <button 
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-950 transition-all"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  Trigger Dialog
                </button>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-[11px] font-medium text-slate-600">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <th className="px-4 py-2.5">Roll No</th>
                      <th className="px-4 py-2.5">Student</th>
                      <th className="px-4 py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-bold text-slate-900">MCS-001</td>
                      <td className="px-4 py-3">Jane Doe</td>
                      <td className="px-4 py-3 text-right">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-bold">PRESENT</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-bold text-slate-900">MCS-002</td>
                      <td className="px-4 py-3">John Smith</td>
                      <td className="px-4 py-3 text-right">
                        <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded text-[9px] font-bold">ABSENT</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Area 4: Layout & Navigation Previews */}
      {activeTab === "layout" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-800">Navbar & Sidebar Layout Previews</h3>
            <p className="text-xs text-slate-400">Miniaturized wireframe diagrams illustrating grid alignments</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Sidebar Wireframe */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sidebar Navigation</span>
              <div className="bg-white border border-slate-200 rounded-lg p-3 w-48 space-y-3 shadow-sm">
                <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <div className="w-5 h-5 rounded bg-emerald-600" />
                  <span className="text-[10px] font-bold text-slate-800">HexaAttender</span>
                </div>
                <div className="space-y-1.5">
                  <div className="h-5 bg-emerald-50 rounded text-emerald-700 text-[10px] font-bold flex items-center px-2">Active Link</div>
                  <div className="h-5 hover:bg-slate-50 rounded text-slate-500 text-[10px] flex items-center px-2">Static Item</div>
                  <div className="h-5 hover:bg-slate-50 rounded text-slate-500 text-[10px] flex items-center px-2">Static Item</div>
                </div>
              </div>
            </div>

            {/* Navbar Wireframe */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Navbar Header</span>
              <div className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                  LECTURER ATTENDANCE ENGINE
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold">
                    Active Session
                  </span>
                  <div className="w-5 h-5 rounded-full bg-slate-200" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialog / Modal Trigger Container (ShadCN style) */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-sm font-bold text-slate-800">Biometric Scan Validation</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Reference student face record matching verification</p>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded transition-all"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 space-y-3 text-xs text-slate-650">
              <div className="flex justify-between font-medium">
                <span>Student Name:</span>
                <span className="font-bold text-slate-800">Jane Doe</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Facial Match Confidence:</span>
                <span className="font-bold text-emerald-600">98.4% Confidence</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Status Log:</span>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-extrabold">PRESENT</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2.5">
              <button 
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-all"
              >
                Cancel Override
              </button>
              <button 
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
              >
                Approve Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
