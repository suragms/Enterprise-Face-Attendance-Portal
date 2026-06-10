import React from "react"

interface StudentPageHeaderProps {
  title: string
  description?: string
  children?: React.ReactNode
}

export const StudentPageHeader: React.FC<StudentPageHeaderProps> = ({ title, description, children }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h2>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
    </div>
    {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
  </div>
)
