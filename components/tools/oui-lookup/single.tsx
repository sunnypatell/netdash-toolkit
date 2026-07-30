"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle, Search } from "lucide-react"
import { parseMacInput } from "@/lib/oui-vendors"

const SAMPLES = ["00:50:56:aa:bb:cc", "00:0C:29:dd:ee:ff", "00:1B:21:11:22:33", "08:00:27:77:88:99"]

interface SingleLookupPanelProps {
  value: string
  busy: boolean
  /** true when this prefix is missing locally and the fallback is enabled */
  willGoRemote: boolean
  onChange: (value: string) => void
  onLookup: () => void
}

export function SingleLookupPanel({
  value,
  busy,
  willGoRemote,
  onChange,
  onLookup,
}: SingleLookupPanelProps) {
  const parsed = parseMacInput(value)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Single MAC lookup</CardTitle>
        <CardDescription>A full MAC address or just the 3-octet OUI prefix</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="mac-input">MAC address or OUI</Label>
          <Input
            id="mac-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="00:11:22:33:44:55 or 001122334455 or 00:11:22"
            className="font-mono"
            aria-invalid={value.trim() !== "" && parsed === null}
            aria-describedby="mac-input-status"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !busy) onLookup()
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2">
              {parsed ? (
                <CheckCircle className="h-3 w-3 text-green-600" aria-hidden="true" />
              ) : (
                <AlertCircle className="h-3 w-3 text-red-600" aria-hidden="true" />
              )}
              <span
                id="mac-input-status"
                className={parsed ? "text-green-700 dark:text-green-500" : "text-red-600"}
              >
                {parsed
                  ? `${parsed.isFullMac ? "Full MAC" : "OUI only"} - prefix ${parsed.ouiFormatted}`
                  : "Not a MAC address or OUI prefix"}
              </span>
            </span>
            <span className="text-muted-foreground font-mono">
              xx:xx:xx:xx:xx:xx, xx-xx-..., xxxx.xxxx.xxxx, xxxxxxxxxxxx
            </span>
          </div>
        </div>

        {parsed && (
          <p className="text-muted-foreground text-xs">
            {willGoRemote
              ? `${parsed.ouiFormatted} is not bundled - this lookup sends only that prefix to api.maclookup.app.`
              : "Answered from the bundled database. No network request."}
          </p>
        )}

        <Button onClick={onLookup} disabled={!parsed || busy} className="w-full">
          <Search className="mr-2 h-4 w-4" />
          {busy ? "Looking up..." : "Look up vendor"}
        </Button>

        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">Bundled samples, all offline</p>
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((sample) => (
              <Button
                key={sample}
                variant="outline"
                size="sm"
                className="font-mono text-xs"
                onClick={() => onChange(sample)}
              >
                {sample}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
