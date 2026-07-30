"use client"

import { useMemo, useState } from "react"
import { parseAsStringLiteral, useQueryStates } from "nuqs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Copy, Braces, Trash2, Download, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { copyText } from "@/lib/clipboard"
import { downloadTextFile, dateStamp } from "@/lib/download"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { INDENT_LABELS, analyzeJson, type JsonIndent, type JsonOutputMode } from "@/lib/json-format"

const INDENTS = ["2", "4", "tab"] as const
const OUTPUT_MODES = ["pretty", "minify"] as const

const SAMPLE = JSON.stringify(
  {
    name: "NetDash Toolkit",
    version: "1.0.0",
    features: ["subnet calculator", "dns tools", "port scanner"],
    config: { theme: "dark", notifications: true, maxResults: 100 },
    metadata: { created: "2024-01-15", updated: null, tags: ["networking", "tools"] },
  },
  null,
  2
)

// the two things JSON.parse destroys without a word
const TRAP_SAMPLE = '{"id": 9007199254740993, "role": "user", "role": "admin"}'

export function JSONFormatter() {
  // only the formatting options go in the url. a pasted document is routinely
  // tens of kilobytes and is often somebody's api response, so it stays local.
  const [{ indent, output: outputMode }, setQuery] = useQueryStates(
    {
      indent: parseAsStringLiteral(INDENTS).withDefault("2"),
      output: parseAsStringLiteral(OUTPUT_MODES).withDefault("pretty"),
    },
    { history: "replace" }
  )

  const [input, setInput] = useState("")

  const analysis = useMemo(
    () => analyzeJson(input, indent, outputMode),
    [input, indent, outputMode]
  )

  const copyToClipboard = async (value: string) => {
    if (await copyText(value)) toast.success("JSON copied to clipboard")
    else toast.error("Copy failed")
  }

  const stats = analysis.stats

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Braces}
        title="JSON Formatter"
        description="Format, validate and minify JSON, and surface what JSON.parse quietly changes"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Input
                  {analysis.valid !== null &&
                    (analysis.valid ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" aria-hidden="true" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" aria-hidden="true" />
                    ))}
                </CardTitle>
                <CardDescription>Paste or type JSON to format</CardDescription>
              </div>
              <Badge
                variant={
                  analysis.valid
                    ? "default"
                    : analysis.valid === false
                      ? "destructive"
                      : "secondary"
                }
              >
                {analysis.valid ? "Valid" : analysis.valid === false ? "Invalid" : "Empty"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* the card title is the visible label, so the control carries its own name */}
            <Textarea
              id="json-input"
              aria-label="JSON input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder='{"key": "value"}'
              className="h-80 resize-none font-mono text-sm"
            />

            {analysis.error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription className="font-mono text-xs">{analysis.error}</AlertDescription>
              </Alert>
            )}

            {analysis.warnings.map((warning) => (
              <Alert key={warning.message}>
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription className="text-xs">{warning.message}</AlertDescription>
              </Alert>
            ))}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setInput(SAMPLE)}>
                Load Sample
              </Button>
              <Button variant="outline" size="sm" onClick={() => setInput(TRAP_SAMPLE)}>
                Load Lossy Sample
              </Button>
              <Button variant="outline" size="sm" onClick={() => setInput("")}>
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Formatted Output</CardTitle>
                <CardDescription>
                  {analysis.output
                    ? `${analysis.output.length.toLocaleString()} characters`
                    : "Enter valid JSON to see output"}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="json-output-mode" className="text-sm">
                  Output:
                </Label>
                <Select
                  value={outputMode}
                  onValueChange={(value) => setQuery({ output: value as JsonOutputMode })}
                >
                  <SelectTrigger id="json-output-mode" className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pretty">Pretty</SelectItem>
                    <SelectItem value="minify">Minified</SelectItem>
                  </SelectContent>
                </Select>
                <Label htmlFor="json-indent" className="text-sm">
                  Indent:
                </Label>
                <Select
                  value={indent}
                  onValueChange={(value) => setQuery({ indent: value as JsonIndent })}
                  disabled={outputMode === "minify"}
                >
                  <SelectTrigger id="json-indent" className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INDENTS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {INDENT_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              id="json-output"
              aria-label="Formatted JSON output"
              value={analysis.output}
              readOnly
              placeholder="Formatted JSON will appear here..."
              className="bg-muted/50 h-80 resize-none font-mono text-sm"
            />

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(analysis.output)}
                disabled={!analysis.output}
              >
                <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                Copy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadTextFile(
                    analysis.output,
                    `formatted-${dateStamp()}.json`,
                    "application/json"
                  )
                }
                disabled={!analysis.output}
              >
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                Download
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>JSON Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-8">
              {[
                { label: "Total Keys", value: stats.keys },
                { label: "Objects", value: stats.objects },
                { label: "Arrays", value: stats.arrays },
                { label: "Strings", value: stats.strings },
                { label: "Numbers", value: stats.numbers },
                { label: "Booleans", value: stats.booleans },
                { label: "Nulls", value: stats.nulls },
                { label: "Max Depth", value: stats.depth },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">{stat.value.toLocaleString()}</p>
                  <p className="text-muted-foreground text-xs">{stat.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>What JSON.parse changes without telling you</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-muted-foreground list-inside list-disc space-y-2 text-sm">
            <li>
              An integer past 2<sup>53</sup>-1 is rounded to the nearest double, so{" "}
              <code className="font-mono">9007199254740993</code> comes back as{" "}
              <code className="font-mono">9007199254740992</code>. Keep large IDs as strings.
            </li>
            <li>
              A repeated key keeps only the last value. RFC 8259 calls duplicate names
              unpredictable, and every JavaScript parser resolves it the same silent way.
            </li>
            <li>
              A number too large for a double becomes Infinity on the way in and{" "}
              <code className="font-mono">null</code> on the way out.
            </li>
            <li>
              JSON.parse accepts any nesting depth, but JSON.stringify recurses and gives up near
              10,000 levels.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
