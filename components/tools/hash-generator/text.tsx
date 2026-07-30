"use client"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { encodeText } from "@/lib/hash"
import { formatBytes } from "@/lib/format"

export interface TextPanelProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function TextPanel({ value, onChange, disabled }: TextPanelProps) {
  // a hash is over bytes, and utf-8 makes those two numbers differ for any
  // non-ascii input, so showing only the character count is misleading
  const byteLength = value ? encodeText(value).length : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="hash-text-input">Text to Hash</Label>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{value.length} chars</Badge>
          <Badge variant="outline">{formatBytes(byteLength)} UTF-8</Badge>
        </div>
      </div>
      <Textarea
        id="hash-text-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Enter text to generate hash..."
        className="h-32 font-mono"
        disabled={disabled}
      />
      <p className="text-muted-foreground text-xs">
        Hashed as UTF-8 bytes, so &quot;café&quot; is 5 bytes and not 4.
      </p>
    </div>
  )
}
