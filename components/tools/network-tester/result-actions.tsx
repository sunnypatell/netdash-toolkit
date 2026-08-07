"use client"

import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/ui/copy-button"
import { Download } from "lucide-react"
import { dateStamp, downloadTextFile } from "@/lib/download"

interface ResultActionsProps {
  /** filename stem, also the `type` recorded in the exported file */
  kind: string
  /** what the numbers actually measure, stated in the file so they cannot be misread */
  measurement: string
  results: unknown[]
  /** tab-separated rendering for the clipboard */
  text: string
}

// the three async panels each produce a list of structured results; this is the
// one copy-and-export pair they share, so all three label and datestamp alike
export function ResultActions({ kind, measurement, results, text }: ResultActionsProps) {
  const exportResults = () => {
    downloadTextFile(
      JSON.stringify(
        { type: kind, timestamp: new Date().toISOString(), measurement, results },
        null,
        2
      ),
      `network-tester-${kind}-${dateStamp()}.json`,
      "application/json"
    )
  }

  return (
    <div className="flex items-center gap-2">
      <CopyButton value={text} variant="outline" />
      <Button variant="outline" size="sm" onClick={exportResults}>
        <Download className="mr-2 h-4 w-4" aria-hidden="true" />
        Export
      </Button>
    </div>
  )
}
