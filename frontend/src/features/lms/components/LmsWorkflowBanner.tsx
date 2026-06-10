import React from "react"
import { ArrowRight, CheckCircle2 } from "lucide-react"

const STEPS = ["Faculty Upload", "Submit for Approval", "HOD Approval", "Student Download"]

export const LmsWorkflowBanner: React.FC = () => (
  <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-indigo-700">Material workflow</p>
    <div className="flex flex-wrap items-center gap-2">
      {STEPS.map((step, index) => (
        <React.Fragment key={step}>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            {step}
          </span>
          {index < STEPS.length - 1 ? <ArrowRight className="h-4 w-4 text-indigo-400" /> : null}
        </React.Fragment>
      ))}
    </div>
  </div>
)
