"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"
import { isBlockedPort } from "@/lib/browser-limits"
import { COMMON_PORTS } from "@/lib/port-probe"

interface CommonPortsPanelProps {
  disabled: boolean
  // true in the browser, where the fetch standard refuses several of these ports
  browserMode: boolean
  onScan: (ports: number[]) => void
}

export default function CommonPortsPanel({ disabled, browserMode, onScan }: CommonPortsPanelProps) {
  const blocked = COMMON_PORTS.filter((p) => isBlockedPort(p.port))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
        {COMMON_PORTS.map(({ port, service }) => {
          const unreachable = browserMode && isBlockedPort(port)
          return (
            <div key={port} className="bg-muted/50 flex items-center justify-between rounded p-2">
              <span className="font-mono">{port}</span>
              <span className="text-muted-foreground flex items-center gap-1">
                {service}
                {unreachable && (
                  <Badge variant="outline" className="text-[0.625rem] font-normal">
                    blocked
                  </Badge>
                )}
              </span>
            </div>
          )
        })}
      </div>

      {browserMode && blocked.length > 0 && (
        <p className="text-muted-foreground text-xs">
          {blocked.length} of these {COMMON_PORTS.length} ports (
          {blocked.map((p) => p.port).join(", ")}) are on the Fetch Standard&apos;s port blocking
          list. The browser refuses to send anything to them, so they will come back as{" "}
          <strong>blocked by the browser</strong> rather than as a finding about the host. The
          desktop app scans them for real.
        </p>
      )}

      <Button
        onClick={() => onScan(COMMON_PORTS.map((p) => p.port))}
        disabled={disabled}
        className="w-full"
      >
        <Search className="mr-2 h-4 w-4" />
        Scan Common Ports ({COMMON_PORTS.length} ports)
      </Button>
    </div>
  )
}
