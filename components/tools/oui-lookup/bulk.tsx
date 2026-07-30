"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Search } from "lucide-react"
import { dedupeByOui, lookupLocal } from "@/lib/oui-vendors"

interface BulkLookupPanelProps {
  value: string
  busy: boolean
  progress: string | null
  offlineOnly: boolean
  /** prefixes already resolved this session, so the plan does not over-count */
  cached: (oui: string) => boolean
  onChange: (value: string) => void
  onLookup: (lines: string[]) => void
}

export function BulkLookupPanel({
  value,
  busy,
  progress,
  offlineOnly,
  cached,
  onChange,
  onLookup,
}: BulkLookupPanelProps) {
  const lines = useMemo(() => value.split("\n").filter((line) => line.trim()), [value])

  const plan = useMemo(() => {
    const groups = dedupeByOui(lines)
    const remote = groups.filter((g) => g.oui && !lookupLocal(g.oui) && !cached(g.oui)).length
    return { unique: groups.length, remote: offlineOnly ? 0 : remote }
  }, [lines, offlineOnly, cached])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk MAC lookup</CardTitle>
        <CardDescription>
          One address per line. Repeated vendor prefixes are looked up once.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="bulk-input">MAC addresses</Label>
          <textarea
            id="bulk-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={"00:11:22:33:44:55\n00:50:56:aa:bb:cc\n08:00:27:dd:ee:ff\n001122334455"}
            className="h-32 w-full resize-none rounded-md border p-3 font-mono text-sm"
          />
          <p className="text-muted-foreground text-xs">
            {lines.length} line{lines.length === 1 ? "" : "s"}, {plan.unique} unique prefix
            {plan.unique === 1 ? "" : "es"}
            {plan.remote > 0
              ? ` - ${plan.remote} need a remote call (about ${plan.remote} s at the 1 req/s limit)`
              : lines.length > 0
                ? " - all answered offline, instantly"
                : ""}
          </p>
        </div>

        <Button
          onClick={() => onLookup(lines)}
          disabled={busy || lines.length === 0}
          className="w-full"
        >
          <Search className="mr-2 h-4 w-4" />
          {busy ? (progress ?? "Processing...") : "Bulk lookup"}
        </Button>

        <p className="text-muted-foreground text-xs">
          A pasted inventory stays in this tab: bulk input is deliberately kept out of the address
          bar, so a shared link never carries a list of the devices on your network.
        </p>
      </CardContent>
    </Card>
  )
}
