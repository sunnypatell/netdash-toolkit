"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { generateVLSMHeatmap } from "@/lib/vlsm-utils"
import type { VLSMPlan } from "@/lib/vlsm-utils"

export function VisualizationPanel({ plan }: { plan: VLSMPlan | null }) {
  const segments = useMemo(() => (plan?.success ? generateVLSMHeatmap(plan) : []), [plan])

  if (!plan || !plan.success) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          A successful plan is needed before the allocation map can be drawn.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Network Allocation Map</CardTitle>
        <CardDescription>
          Each block drawn to scale across {plan.baseNetwork}/{plan.basePrefix}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="bg-muted relative h-16 overflow-hidden rounded-lg">
            {segments.map((segment) => (
              <div
                key={`${segment.name}-${segment.start}`}
                className="absolute top-0 flex h-full items-center justify-center text-xs font-medium text-white"
                style={{
                  left: `${segment.start}%`,
                  width: `${segment.end - segment.start}%`,
                  backgroundColor: segment.color,
                }}
              >
                {segment.end - segment.start > 10 && segment.name}
              </div>
            ))}
          </div>
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {segments.map((segment) => (
              <li key={`${segment.name}-${segment.start}`} className="flex items-center gap-2">
                <span
                  className="h-4 w-4 shrink-0 rounded"
                  style={{ backgroundColor: segment.color }}
                  aria-hidden="true"
                />
                <span className="text-sm">{segment.name}</span>
                <span className="text-muted-foreground text-xs">
                  ({(segment.end - segment.start).toFixed(1)}% of the base block)
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
