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
import type { GradeInput } from "./grade-report"

interface PastePanelProps {
  target: string
  hostLabel: string
  onGrade: (input: GradeInput) => void
}

export default function PastePanel({ target, hostLabel, onGrade }: PastePanelProps) {
  const [pasted, setPasted] = useState("")
  const [error, setError] = useState<string | null>(null)

  const curlCommand = `curl -sS -o /dev/null -D - -L ${target || "https://example.com"}`

  const grade = () => {
    setError(null)
    if (!pasted.trim()) {
      setError("Paste the output of the curl command above first")
      toast.error("Nothing to grade yet")
      return
    }
    const blocks = parseResponseBlocks(pasted)
    if (blocks.length === 0) {
      setError(
        'No headers found in that paste. Expected lines like "strict-transport-security: max-age=63072000"'
      )
      toast.error("Could not parse any headers")
      return
    }
    onGrade({
      label: hostLabel || "pasted response",
      source: "pasted",
      url: target,
      blocks,
    })
    toast.success("Graded pasted headers")
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
        <Label htmlFor="sh-paste">Raw response headers</Label>
        <Textarea
          id="sh-paste"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "sh-paste-error" : undefined}
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder={"HTTP/2 200\nstrict-transport-security: max-age=63072000\n..."}
          className="min-h-40 font-mono text-xs"
        />
      </div>
      <Button onClick={grade} className="w-full">
        Grade pasted headers
      </Button>
      <p className="text-muted-foreground text-xs">
        Runs offline - the paste never leaves your browser, and the grade is trustworthy because you
        obtained the headers yourself.
      </p>
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription id="sh-paste-error">{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
