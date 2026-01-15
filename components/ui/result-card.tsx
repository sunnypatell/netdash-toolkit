"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Copy, Check } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

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
}

export function ResultCard({
  title,
  data,
  results,
  badges,
  className,
  description,
}: ResultCardProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
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

  let displayData: ResultData[] = []

  if (data) {
    displayData = data
  } else if (results) {
    // Convert legacy format to new format
    displayData = Object.entries(results).map(([key, value]) => ({
      label: formatLabel(key),
      value,
      copyable: true,
    }))
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
          </div>
          {badges && (
            <div className="flex gap-1">
              {badges.map((badge, index) => (
                <Badge key={index} variant={badge.variant || "secondary"}>
                  {badge.label}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
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
              <div className="flex-1">
                <div className="text-muted-foreground text-sm font-medium">{item.label}</div>
                <div
                  className={cn(
                    "mt-1 font-mono text-sm",
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
                  className="ml-2"
                >
                  {copiedField === item.label ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          ))
        ) : (
          <div className="text-muted-foreground py-4 text-center">No results to display</div>
        )}
      </CardContent>
    </Card>
  )
}
