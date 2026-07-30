"use client"

import { useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AlertTriangle, Loader2, Radio, ShieldAlert } from "lucide-react"
import { RELAY_HOST, fetchRelayHeaders, isProbeableUrl } from "@/lib/http-relay"
import { toast } from "sonner"
import type { GradeInput } from "./grade-report"

interface RelayPanelProps {
  target: string
  hostLabel: string
  onGrade: (input: GradeInput) => void
  onBusyChange?: (busy: boolean) => void
}

export default function RelayPanel({ target, hostLabel, onGrade, onBusyChange }: RelayPanelProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [raw, setRaw] = useState("")

  const setBusy = (busy: boolean) => {
    setLoading(busy)
    onBusyChange?.(busy)
  }

  const run = async () => {
    if (!target) {
      setError("Enter a URL first")
      return
    }
    if (!isProbeableUrl(target)) {
      setError("Only http:// and https:// URLs can be fetched.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const response = await fetchRelayHeaders(target)
      setRaw(response.raw)
      onGrade({ label: hostLabel, source: "relay", url: target, blocks: response.blocks })
      toast.success("Fetched via relay - result is labelled unverified")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Relay request failed"
      setError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>This route is not trustworthy for a security verdict</AlertTitle>
        <AlertDescription className="text-sm">
          The request goes to <span className="font-mono">{RELAY_HOST}</span>, an unaffiliated third
          party. It sees the URL you asked about and it can add, drop, or rewrite any header before
          you see it - so a security grade computed from its output proves nothing about the real
          server. Use it to get a quick look, then confirm with the curl paste before you act on it.
        </AlertDescription>
      </Alert>
      <Button onClick={run} disabled={loading} variant="outline" className="w-full">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Fetching via relay...
          </>
        ) : (
          <>
            <Radio className="mr-2 h-4 w-4" />
            Fetch headers via relay
          </>
        )}
      </Button>
      <p className="text-muted-foreground text-xs">
        The relay is rate limited to a small number of free lookups per day per IP.
      </p>
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription id="sh-url-error">{error}</AlertDescription>
        </Alert>
      )}
      {raw && (
        <div>
          <Label htmlFor="sh-relay-raw">Exactly what the relay returned</Label>
          <Textarea id="sh-relay-raw" readOnly value={raw} className="min-h-32 font-mono text-xs" />
        </div>
      )}
    </div>
  )
}
