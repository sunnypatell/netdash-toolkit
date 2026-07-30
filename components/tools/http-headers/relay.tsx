"use client"

import { useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AlertTriangle, Loader2, Radio, ShieldAlert } from "lucide-react"
import { RELAY_HOST, fetchRelayHeaders, isProbeableUrl } from "@/lib/http-relay"
import { toast } from "sonner"
import type { HeaderAnalysis } from "./header-report"

interface RelayPanelProps {
  target: string
  hostLabel: string
  onAnalysis: (analysis: HeaderAnalysis) => void
  // lets the shell mark its result region aria-busy while the request is in flight
  onBusyChange?: (busy: boolean) => void
}

export default function RelayPanel({
  target,
  hostLabel,
  onAnalysis,
  onBusyChange,
}: RelayPanelProps) {
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
      toast.error("Enter a URL first")
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
      onAnalysis({ label: hostLabel, source: "relay", blocks: response.blocks })
      toast.success("Fetched via relay - values are labelled unverified")
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
        <AlertTitle>Values come from an unaffiliated third party</AlertTitle>
        <AlertDescription className="text-sm">
          The request goes to <span className="font-mono">{RELAY_HOST}</span>. It sees the URL you
          asked about and can add, drop, or rewrite any header before you see it. Useful for a quick
          look, not for a security decision - confirm with the curl paste before acting on anything.
          It can, however, fetch an <span className="font-mono">http://</span> target that this page
          cannot reach itself.
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
        Rate limited to a small number of free lookups per day per IP.
      </p>
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription id="hh-url-error">{error}</AlertDescription>
        </Alert>
      )}
      {raw && (
        <div>
          <Label htmlFor="hh-relay-raw">Exactly what the relay returned</Label>
          <Textarea id="hh-relay-raw" readOnly value={raw} className="min-h-32 font-mono text-xs" />
        </div>
      )}
    </div>
  )
}
