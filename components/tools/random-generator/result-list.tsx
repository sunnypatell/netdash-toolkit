"use client"

import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/ui/copy-button"
import { Download, Trash2 } from "lucide-react"

interface ResultListProps {
  /** what the values are, for the accessible names of the buttons */
  kind: string
  values: string[]
  onExport: () => void
  onClear: () => void
}

export function ResultList({ kind, values, onExport, onClear }: ResultListProps) {
  const empty = values.length === 0
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {!empty && <CopyButton value={values.join("\n")} variant="outline" />}
        <Button variant="outline" size="sm" onClick={onExport} disabled={empty}>
          <Download className="mr-2 h-4 w-4" />
          Export<span className="sr-only"> {kind}</span>
        </Button>
        <Button variant="outline" size="sm" onClick={onClear} disabled={empty}>
          <Trash2 className="mr-2 h-4 w-4" />
          Clear<span className="sr-only"> {kind}</span>
        </Button>
      </div>

      {empty ? (
        <div className="flex h-32 items-center justify-center rounded-lg border">
          <p className="text-muted-foreground text-sm">Press Generate to draw new values</p>
        </div>
      ) : (
        <>
          <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-3">
            {values.map((value, index) => (
              <li
                key={`${value}-${index}`}
                className="hover:bg-muted/50 rounded px-2 py-1 font-mono text-sm break-all"
              >
                {value}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">
            {values.length} {kind} generated
          </p>
        </>
      )}
    </div>
  )
}
