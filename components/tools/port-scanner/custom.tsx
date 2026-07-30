"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangle, Search } from "lucide-react"
import { isBlockedPort } from "@/lib/browser-limits"
import { parsePortList } from "@/lib/port-probe"

interface CustomPortsPanelProps {
  value: string
  onValueChange: (value: string) => void
  disabled: boolean
  browserMode: boolean
  onScan: (ports: number[]) => void
}

export default function CustomPortsPanel({
  value,
  onValueChange,
  disabled,
  browserMode,
  onScan,
}: CustomPortsPanelProps) {
  const parsed = parsePortList(value)
  const blocked = browserMode ? parsed.ports.filter(isBlockedPort) : []

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="custom-ports">Ports (comma-separated, ranges allowed)</Label>
        <Input
          id="custom-ports"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder="80,443,8000-8010"
          disabled={disabled}
          aria-invalid={parsed.errors.length > 0}
          aria-describedby={
            parsed.errors.length > 0
              ? "custom-ports-count custom-ports-error"
              : "custom-ports-count"
          }
        />
        <p id="custom-ports-count" className="text-muted-foreground mt-1 text-xs">
          {parsed.ports.length} port{parsed.ports.length === 1 ? "" : "s"} selected
        </p>
      </div>

      {parsed.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription id="custom-ports-error">
            <ul className="list-inside list-disc space-y-1 text-sm">
              {parsed.errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {blocked.length > 0 && (
        <p className="text-muted-foreground text-xs">
          {blocked.length} of the selected ports ({blocked.slice(0, 12).join(", ")}
          {blocked.length > 12 ? ", ..." : ""}) are on the Fetch Standard&apos;s port blocking list.
          Nothing will be sent to them, and they are reported as unmeasurable rather than as closed.
        </p>
      )}

      <Button
        onClick={() => onScan(parsed.ports)}
        disabled={disabled || parsed.ports.length === 0}
        className="w-full"
      >
        <Search className="mr-2 h-4 w-4" />
        Scan Custom Ports
      </Button>
    </div>
  )
}
