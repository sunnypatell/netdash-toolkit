"use client"

import { useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AlertTriangle, Loader2, Radio, ShieldAlert } from "lucide-react"
import { fetchRelayHeaders, isProbeableUrl } from "@/lib/http-relay"
import { buildRedirectChain } from "@/lib/redirect-chain"
import { toast } from "sonner"
import type { TracedChain } from "./chain-view"

interface RelayPanelProps {
  target: string
  onTrace: (chain: TracedChain) => void
  onBusyChange?: (busy: boolean) => void
}

export default function RelayPanel({ target, onTrace, onBusyChange }: RelayPanelProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [raw, setRaw] = useState("")

  const setBusy = (busy: boolean) => {
    setLoading(busy)
    onBusyChange?.(busy)
  }

  const run = async () => {
    // the alert the input is described by carries the message; a toast said the same thing twice
    if (!target) {
      setError("Enter a URL first")
      return
    }
    if (!isProbeableUrl(target)) {
      setError("Only http:// and https:// URLs can be traced")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const response = await fetchRelayHeaders(target)
      setRaw(response.raw)
      onTrace({ ...buildRedirectChain(response.blocks, target), source: "relay" })
      toast.success("Traced via relay - chain is labelled unverified")
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
        <AlertTitle>The chain comes from an unaffiliated third party</AlertTitle>
        {/* the relay is named once at the top of the page by the shared runtime
            disclosure; what only belongs here is what it can do to the answer */}
        <AlertDescription className="text-sm">
          The request goes through an unaffiliated third-party relay, which can invent, drop, or
          rewrite any hop. Treat the chain as indicative and confirm with curl before acting on it.
          It traces from its own network, so geography and user-agent based redirects may differ
          from what you would get.
        </AlertDescription>
      </Alert>
      <Button onClick={run} disabled={loading} variant="outline" className="w-full">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Tracing via relay...
          </>
        ) : (
          <>
            <Radio className="mr-2 h-4 w-4" />
            Trace via relay
          </>
        )}
      </Button>
      <p className="text-muted-foreground text-xs">
        Rate limited to a small number of free lookups per day per IP. Unlike this page, the relay
        can start from an <span className="font-mono">http://</span> URL.
      </p>
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription id="rc-url-error">{error}</AlertDescription>
        </Alert>
      )}
      {raw && (
        <div>
          <Label htmlFor="rc-relay-raw">Exactly what the relay returned</Label>
          <Textarea id="rc-relay-raw" readOnly value={raw} className="min-h-32 font-mono text-xs" />
        </div>
      )}
    </div>
  )
}
