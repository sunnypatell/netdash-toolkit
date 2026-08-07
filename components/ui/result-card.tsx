"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Copy, Check } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { copyText } from "@/lib/clipboard"

interface ResultData {
  label: string
  value: string | number | boolean
  copyable?: boolean
  highlight?: boolean
  description?: string
}

interface ResultCardProps {
  title: string
  data?: ResultData[]
  results?: Record<string, string | number | boolean> // Legacy support
  badges?: Array<{ label: string; variant?: "default" | "secondary" | "destructive" | "outline" }>
  className?: string
  description?: string
  // same dashed empty hint every tool uses; callers that know the input name should say so
  emptyHint?: ReactNode
}

// these are synchronous calculators, so every keystroke produced a whole new
// result. announcing each one read the full table four times while the user
// typed "1000". the render stays immediate; only the announcement waits.
function useSettledText(text: string, delayMs = 700): string {
  const [settled, setSettled] = useState("")
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setSettled(text), delayMs)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [text, delayMs])

  return settled
}

export function ResultCard({
  title,
  data,
  results,
  badges,
  className,
  description,
  emptyHint = "Enter a value - results appear here.",
}: ResultCardProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copyToClipboard = async (text: string, field: string) => {
    if (!(await copyText(text))) return
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const formatLabel = (key: string): string => {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim()
  }

  const formatValue = (value: string | number | boolean): string => {
    if (typeof value === "boolean") {
      return value ? "Yes" : "No"
    }
    return value.toString()
  }

  const displayData: ResultData[] = useMemo(() => {
    if (data) return data
    if (!results) return []
    // legacy record shape, mapped onto the data[] one
    return Object.entries(results).map(([key, value]) => ({
      label: formatLabel(key),
      value,
      copyable: true,
    }))
  }, [data, results])

  const summary = useMemo(
    () => displayData.map((item) => `${item.label}: ${formatValue(item.value)}`).join(". "),
    [displayData]
  )
  const announcement = useSettledText(summary)

  return (
    <Card className={cn("", className)} role="region" aria-label={title}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-lg">{title}</CardTitle>
            {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
          </div>
          {badges && (
            // a roleless div cannot carry a name; group can
            <div
              role="group"
              aria-label="Result tags"
              className="flex shrink-0 flex-wrap justify-end gap-1"
            >
              {badges.map((badge, index) => (
                <Badge key={index} variant={badge.variant || "secondary"}>
                  {badge.label}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      {/* the visible table is not live: it would re-read on every keystroke */}
      <span role="status" className="sr-only">
        {announcement}
      </span>
      <CardContent className="space-y-3">
        {displayData.length > 0 ? (
          displayData.map((item, index) => (
            <div
              key={index}
              className={cn(
                "flex items-center justify-between rounded-lg p-3 transition-colors",
                item.highlight ? "bg-primary/10 border-primary/20 border" : "bg-muted/50"
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="text-muted-foreground text-sm font-medium">{item.label}</div>
                <div
                  className={cn(
                    "mt-1 font-mono text-sm break-all",
                    item.highlight && "text-primary font-semibold"
                  )}
                >
                  {formatValue(item.value)}
                </div>
                {item.description && (
                  <div className="text-muted-foreground mt-1 text-xs">{item.description}</div>
                )}
              </div>
              {item.copyable !== false && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(formatValue(item.value), item.label)}
                  className="ml-2 shrink-0"
                  aria-label={
                    copiedField === item.label
                      ? `${item.label} copied to clipboard`
                      : `Copy ${item.label} to clipboard`
                  }
                >
                  {copiedField === item.label ? (
                    <Check className="h-4 w-4 text-green-600" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span className="sr-only">{copiedField === item.label ? "Copied" : "Copy"}</span>
                </Button>
              )}
            </div>
          ))
        ) : (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            {emptyHint}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
