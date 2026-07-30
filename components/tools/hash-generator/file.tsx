"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2 } from "lucide-react"
import { formatBytes } from "@/lib/format"

export interface FilePanelProps {
  file: File | null
  onSelect: (file: File | null) => void
  disabled?: boolean
}

export function FilePanel({ file, onSelect, disabled }: FilePanelProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="hash-file-input">File to Hash</Label>
        <Input
          id="hash-file-input"
          type="file"
          onChange={(event) => onSelect(event.target.files?.[0] ?? null)}
          className="cursor-pointer"
          disabled={disabled}
        />
        <p className="text-muted-foreground text-xs">
          Read in the browser and hashed byte for byte. Nothing is uploaded.
        </p>
      </div>

      {file && (
        <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-muted-foreground text-xs">
              {formatBytes(file.size)}
              {file.type ? ` - ${file.type}` : ""}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelect(null)}
            aria-label={`Remove ${file.name}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  )
}
