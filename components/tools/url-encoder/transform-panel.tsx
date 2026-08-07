"use client"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CopyButton } from "@/components/ui/copy-button"
import { Trash2 } from "lucide-react"
import {
  URL_MODE_HELP,
  URL_MODE_LABELS,
  decodeUrlText,
  encodeUrlText,
  type UrlEncodeMode,
} from "@/lib/url-encode"

const MODES: UrlEncodeMode[] = ["component", "uri", "form", "rfc3986"]

export interface TransformPanelProps {
  direction: "encode" | "decode"
  encoding: UrlEncodeMode
  onEncodingChange: (encoding: UrlEncodeMode) => void
  text: string
  onTextChange: (text: string) => void
  onParseIntoBuilder?: () => void
}

export function TransformPanel({
  direction,
  encoding,
  onEncodingChange,
  text,
  onTextChange,
  onParseIntoBuilder,
}: TransformPanelProps) {
  const result =
    direction === "encode" ? encodeUrlText(text, encoding) : decodeUrlText(text, encoding)
  const inputId = `url-${direction}-input`
  const outputId = `url-${direction}-output`
  const errorId = `url-${direction}-error`

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Encoding</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {MODES.map((value) => (
            <div key={value} className="flex items-center gap-2">
              <input
                type="radio"
                id={`${direction}-encoding-${value}`}
                name={`${direction}-encoding`}
                value={value}
                checked={encoding === value}
                onChange={() => onEncodingChange(value)}
                className="accent-primary h-4 w-4"
              />
              <Label
                htmlFor={`${direction}-encoding-${value}`}
                className="cursor-pointer font-mono text-xs font-normal"
              >
                {URL_MODE_LABELS[value]}
              </Label>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">{URL_MODE_HELP[encoding]}</p>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={inputId}>{direction === "encode" ? "Plain Text" : "URL Encoded"}</Label>
            <Badge variant="outline">{text.length} chars</Badge>
          </div>
          <Textarea
            id={inputId}
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder={
              direction === "encode" ? "Enter text to URL encode..." : "Enter URL-encoded string..."
            }
            className="h-32 resize-none font-mono"
            aria-invalid={result.error !== null}
            aria-describedby={result.error ? errorId : undefined}
          />
          {onParseIntoBuilder && (
            <Button
              variant="outline"
              size="sm"
              onClick={onParseIntoBuilder}
              disabled={!text.trim()}
            >
              Parse URL into Builder
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={outputId}>
              {direction === "encode" ? "URL Encoded" : "Plain Text"}
            </Label>
            <Badge variant="outline">{result.output.length} chars</Badge>
          </div>
          <Textarea
            id={outputId}
            value={result.output}
            readOnly
            placeholder="Output will appear here..."
            className="bg-muted/50 h-32 resize-none font-mono"
          />
          <div className="flex flex-wrap gap-2">
            {result.output && <CopyButton value={result.output} variant="outline" />}
            <Button variant="outline" size="sm" onClick={() => onTextChange("")}>
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Clear
            </Button>
          </div>
        </div>
      </div>

      {result.error && (
        <Alert variant="destructive">
          <AlertDescription id={errorId}>{result.error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
