"use client"

import { useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/ui/copy-button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AlertTriangle, Terminal } from "lucide-react"
import { parseResponseBlocks } from "@/lib/http-header-parse"
import { toast } from "sonner"
import type { HeaderAnalysis } from "./header-report"

interface PastePanelProps {
  // the normalized target url, used only to build the command and label the result
  target: string
  hostLabel: string
  onAnalysis: (analysis: HeaderAnalysis) => void
}

export default function PastePanel({ target, hostLabel, onAnalysis }: PastePanelProps) {
  const [pasted, setPasted] = useState("")
  const [error, setError] = useState<string | null>(null)

  const curlCommand = `curl -sS -o /dev/null -D - -L ${target || "https://example.com"}`

  const analyze = () => {
    setError(null)
    if (!pasted.trim()) {
      setError("Paste the output of the curl command above first")
      toast.error("Nothing to analyze yet")
      return
    }
    const blocks = parseResponseBlocks(pasted)
    if (blocks.length === 0) {
      setError(
        'No headers found in that paste. Expected lines like "content-type: text/html; charset=utf-8"'
      )
      toast.error("Could not parse any headers")
      return
    }
    onAnalysis({ label: hostLabel || "pasted response", source: "pasted", blocks })
    toast.success(`Parsed ${blocks.length} response block${blocks.length === 1 ? "" : "s"}`)
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
        <Label htmlFor="hh-paste">Raw response headers</Label>
        <Textarea
          id="hh-paste"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "hh-paste-error" : undefined}
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder={"HTTP/2 200\ncontent-type: text/html; charset=utf-8\n..."}
          className="min-h-40 font-mono text-xs"
        />
      </div>
      <Button onClick={analyze} className="w-full">
        Analyze pasted headers
      </Button>
      <p className="text-muted-foreground text-xs">
        curl sees the response exactly as the server sent it, with no CORS filtering in the way.
      </p>
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription id="hh-paste-error">{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
