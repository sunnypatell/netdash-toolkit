"use client"

import { useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/ui/copy-button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AlertTriangle, Terminal } from "lucide-react"
import { parseResponseBlocks } from "@/lib/http-header-parse"
import { buildRedirectChain } from "@/lib/redirect-chain"
import { toast } from "sonner"
import type { TracedChain } from "./chain-view"

interface PastePanelProps {
  target: string
  onTrace: (chain: TracedChain) => void
}

export default function PastePanel({ target, onTrace }: PastePanelProps) {
  const [pasted, setPasted] = useState("")
  const [error, setError] = useState<string | null>(null)

  const curlCommand = `curl -sS -o /dev/null -D - -L ${target || "http://example.com"}`

  const trace = () => {
    setError(null)
    if (!pasted.trim()) {
      setError("Paste the output of the curl command above first")
      toast.error("Nothing to trace yet")
      return
    }
    const blocks = parseResponseBlocks(pasted)
    if (blocks.length === 0) {
      setError(
        "No response blocks found. Each hop must start with a status line like “HTTP/2 301”."
      )
      toast.error("Could not parse a redirect chain")
      return
    }
    // without a status line there is no hop, and a hop invented with status 0 was
    // exactly the fiction this tool was rewritten to stop telling
    if (blocks.every((block) => block.status === 0)) {
      setError(
        "That paste has header lines but no status line, so there is no hop to trace. Include the “HTTP/1.1 301 ...” lines that curl -D - prints."
      )
      toast.error("No status line in the paste")
      return
    }
    onTrace({
      ...buildRedirectChain(blocks, target || "unknown"),
      source: "pasted",
    })
    toast.success(`Traced ${blocks.length} hop${blocks.length === 1 ? "" : "s"}`)
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Terminal className="h-4 w-4" />
          Run this, then paste everything it prints
        </p>
        <div className="flex items-start gap-2">
          <pre className="bg-muted/50 flex-1 overflow-x-auto rounded p-3 font-mono text-xs">
            {curlCommand}
          </pre>
          <CopyButton value={curlCommand} variant="outline" />
        </div>
      </div>
      <div>
        <Label htmlFor="rc-paste">Raw response blocks</Label>
        <Textarea
          id="rc-paste"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "rc-paste-error" : undefined}
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder={
            "HTTP/1.1 301 Moved Permanently\nlocation: https://example.com/\n\nHTTP/2 200"
          }
          className="min-h-40 font-mono text-xs"
        />
      </div>
      <Button onClick={trace} className="w-full">
        Trace pasted chain
      </Button>
      <p className="text-muted-foreground text-xs">
        Fully offline - the paste never leaves your browser.
      </p>
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription id="rc-paste-error">{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
