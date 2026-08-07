"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CopyButton } from "@/components/ui/copy-button"
import { Plus, Trash2, X } from "lucide-react"
import { buildUrl, type QueryParam } from "@/lib/url-encode"

export interface BuildPanelProps {
  base: string
  onBaseChange: (base: string) => void
  params: QueryParam[]
  onParamsChange: (params: QueryParam[]) => void
}

export function BuildPanel({ base, onBaseChange, params, onParamsChange }: BuildPanelProps) {
  const built = buildUrl(base, params)

  const updateParam = (index: number, field: "key" | "value", value: string) => {
    onParamsChange(params.map((p, i) => (i === index ? { ...p, [field]: value } : p)))
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="url-base">Base URL</Label>
        <Input
          id="url-base"
          value={base}
          onChange={(event) => onBaseChange(event.target.value)}
          placeholder="https://example.com/path"
          className="font-mono"
          aria-invalid={built.error !== null}
          aria-describedby={built.error ? "url-base-error" : undefined}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Query Parameters</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onParamsChange([...params, { key: "", value: "" }])}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Add Parameter
          </Button>
        </div>

        <div className="space-y-2">
          {params.map((param, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={param.key}
                onChange={(event) => updateParam(index, "key", event.target.value)}
                placeholder="Key"
                className="flex-1 font-mono"
                aria-label={`Parameter ${index + 1} name`}
              />
              <span className="text-muted-foreground" aria-hidden="true">
                =
              </span>
              <Input
                value={param.value}
                onChange={(event) => updateParam(index, "value", event.target.value)}
                placeholder="Value"
                className="flex-1 font-mono"
                aria-label={`Parameter ${index + 1} value`}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onParamsChange(params.filter((_, i) => i !== index))}
                disabled={params.length === 1}
                aria-label={`Remove parameter ${index + 1}`}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="url-built">Generated URL</Label>
        <div id="url-built" className="bg-muted/50 flex items-start gap-2 rounded-lg border p-3">
          <p className="min-w-0 flex-1 font-mono text-sm break-all">
            {built.url || "Enter a base URL to see the encoded result"}
          </p>
          {built.url && <CopyButton value={built.url} className="shrink-0" />}
        </div>
        <p className="text-muted-foreground text-xs">
          Values are serialised as application/x-www-form-urlencoded, which is what the URL standard
          specifies for a query string, so a space becomes + rather than %20.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onBaseChange("")
              onParamsChange([{ key: "", value: "" }])
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
            Clear
          </Button>
        </div>
      </div>

      {built.error && (
        <Alert variant="destructive">
          <AlertDescription id="url-base-error">{built.error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
