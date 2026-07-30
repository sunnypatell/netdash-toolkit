"use client"

import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle, CheckCircle2 } from "lucide-react"

interface WarningListProps {
  title: string
  items: string[]
  emptyLabel?: string
}

export function WarningList({ title, items, emptyLabel }: WarningListProps) {
  if (items.length === 0) {
    if (!emptyLabel) return null
    return (
      <div className="flex items-center gap-2 rounded-md border border-green-500/50 bg-green-500/10 px-3 py-2">
        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" aria-hidden="true" />
        <span className="text-sm text-green-700 dark:text-green-400">{emptyLabel}</span>
      </div>
    )
  }

  return (
    <Card className="border-yellow-500/50">
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <h3 className="text-sm font-medium">{title}</h3>
        </div>
        <ul className="text-muted-foreground mt-2 list-inside list-disc space-y-1 text-xs">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
