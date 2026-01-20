"use client"

import type { LucideIcon } from "lucide-react"
import type React from "react"

interface ToolHeaderProps {
  icon: LucideIcon
  title: string
  description: string
  actions?: React.ReactNode
}

export function ToolHeader({ icon: Icon, title, description, actions }: ToolHeaderProps) {
  return (
    <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
      <div className="flex items-start space-x-3">
        <Icon className="text-primary mt-0.5 h-6 w-6 flex-shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
          <p className="text-muted-foreground text-sm sm:text-base">{description}</p>
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
