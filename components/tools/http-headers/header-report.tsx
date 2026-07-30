"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CopyButton } from "@/components/ui/copy-button"
import { CheckCircle2, Info, XCircle } from "lucide-react"
import { describeStatus, type ResponseBlock } from "@/lib/http-header-parse"
import { dateStamp, downloadTextFile } from "@/lib/download"

export type HeaderSource = "pasted" | "relay"

export interface HeaderAnalysis {
  label: string
  source: HeaderSource
  blocks: ResponseBlock[]
}

type HeaderCategory = "security" | "cache" | "content" | "cors" | "other"

export const HEADER_CATEGORIES: Record<string, { category: HeaderCategory; description: string }> =
  {
    "content-type": {
      category: "content",
      description: "Specifies the media type of the resource",
    },
    "content-length": { category: "content", description: "Size of the response body in bytes" },
    "content-encoding": { category: "content", description: "Compression algorithm used" },
    "content-disposition": {
      category: "content",
      description: "Whether the body is shown inline or downloaded",
    },
    "cache-control": { category: "cache", description: "Caching directives for browsers and CDNs" },
    expires: { category: "cache", description: "Date/time after which the response is stale" },
    etag: { category: "cache", description: "Identifier for a specific version of the resource" },
    "last-modified": { category: "cache", description: "Date the resource was last modified" },
    age: { category: "cache", description: "Seconds the response has sat in a cache" },
    vary: { category: "cache", description: "Request headers that change the cached response" },
    "strict-transport-security": { category: "security", description: "Forces HTTPS connections" },
    "content-security-policy": {
      category: "security",
      description: "Controls resources the browser can load",
    },
    "content-security-policy-report-only": {
      category: "security",
      description: "CSP in monitor mode - reports violations without blocking",
    },
    "x-frame-options": { category: "security", description: "Prevents clickjacking attacks" },
    "x-content-type-options": { category: "security", description: "Prevents MIME type sniffing" },
    "x-xss-protection": { category: "security", description: "XSS filter (legacy, deprecated)" },
    "referrer-policy": { category: "security", description: "Controls referrer information" },
    "permissions-policy": { category: "security", description: "Controls browser feature access" },
    "cross-origin-opener-policy": {
      category: "security",
      description: "Isolates the browsing context from other origins",
    },
    "cross-origin-resource-policy": {
      category: "security",
      description: "Restricts which origins may embed this resource",
    },
    "set-cookie": {
      category: "security",
      description: "Sets a cookie - check Secure and HttpOnly",
    },
    "access-control-allow-origin": { category: "cors", description: "Allowed origins for CORS" },
    "access-control-allow-methods": {
      category: "cors",
      description: "Allowed HTTP methods for CORS",
    },
    "access-control-allow-headers": { category: "cors", description: "Allowed headers for CORS" },
    "access-control-expose-headers": {
      category: "cors",
      description: "Response headers scripts are allowed to read",
    },
    "access-control-allow-credentials": {
      category: "cors",
      description: "Whether credentialed CORS requests are allowed",
    },
    location: { category: "other", description: "Target of a redirect" },
    server: { category: "other", description: "Software identified by the origin server" },
  }

export const SECURITY_HEADERS = [
  "strict-transport-security",
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
]

interface DisplayField {
  name: string
  value: string
  category: HeaderCategory
  description?: string
}

// rfc 9110 5.3: repeated field lines are separate lines, so each one is listed
// rather than collapsed, which is the only way Set-Cookie stays readable
function toDisplayFields(block: ResponseBlock): DisplayField[] {
  return block.fields
    .map(({ name, value }) => {
      const info = HEADER_CATEGORIES[name.toLowerCase()]
      return { name, value, category: info?.category ?? "other", description: info?.description }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

function categoryColor(category: HeaderCategory) {
  switch (category) {
    case "security":
      return "bg-green-500/10 text-green-600 border-green-500/20"
    case "cache":
      return "bg-blue-500/10 text-blue-600 border-blue-500/20"
    case "content":
      return "bg-purple-500/10 text-purple-600 border-purple-500/20"
    case "cors":
      return "bg-orange-500/10 text-orange-600 border-orange-500/20"
    default:
      return "bg-gray-500/10 text-gray-600 border-gray-500/20"
  }
}

interface HeaderReportProps {
  analysis: HeaderAnalysis | null
  blockIndex: number
  onBlockIndexChange: (index: number) => void
}

export function HeaderReport({ analysis, blockIndex, onBlockIndexChange }: HeaderReportProps) {
  const active = analysis?.blocks[Math.min(blockIndex, analysis.blocks.length - 1)]
  const fields = active ? toDisplayFields(active) : []
  const presentSecurity = SECURITY_HEADERS.filter((key) =>
    fields.some((f) => f.name.toLowerCase() === key)
  )

  const exportHeaders = () => {
    if (!analysis || !active) return
    downloadTextFile(
      JSON.stringify(
        {
          target: analysis.label,
          source:
            analysis.source === "relay"
              ? "api.hackertarget.com relay (unverified third party)"
              : "pasted by the user",
          status: active.status,
          statusText: active.statusText,
          // an array, because a header can legitimately appear more than once
          headers: active.fields,
        },
        null,
        2
      ),
      `headers-${analysis.label || "response"}-${dateStamp()}.json`,
      "application/json"
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {analysis && active && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2">
              <span>Response</span>
              <Badge variant={analysis.source === "relay" ? "destructive" : "secondary"}>
                {analysis.source === "relay" ? "unverified - via relay" : "from your own request"}
              </Badge>
            </CardTitle>
            <CardDescription className="break-all">{analysis.label}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium">Status</p>
              <p className="font-mono text-lg">{describeStatus(active)}</p>
            </div>

            {analysis.blocks.length > 1 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Redirect chain - {analysis.blocks.length} responses
                </p>
                <div className="flex flex-wrap gap-2">
                  {analysis.blocks.map((block, i) => (
                    <Button
                      key={i}
                      size="sm"
                      variant={i === blockIndex ? "default" : "outline"}
                      onClick={() => onBlockIndexChange(i)}
                    >
                      {i + 1}. {block.status || "?"}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">
                Security headers on this response: {presentSecurity.length} of{" "}
                {SECURITY_HEADERS.length}
              </p>
              <p className="text-muted-foreground text-xs">
                {analysis.source === "relay"
                  ? "Counted from relayed values, so this is indicative only - it is not a verified assessment of the server."
                  : "Counted from the headers you captured yourself."}{" "}
                Presence is not correctness: a weak policy still counts as present. The Security
                Headers tool grades the values.
              </p>
            </div>

            <Button variant="outline" size="sm" onClick={exportHeaders}>
              Export JSON
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Response headers</span>
            {active && <Badge variant="secondary">{fields.length} field lines</Badge>}
          </CardTitle>
          <CardDescription>
            {analysis ? `Headers for ${analysis.label}` : "Paste or fetch headers to see them here"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {active ? (
            <div className="max-h-[500px] space-y-2 overflow-y-auto">
              {fields.map((field, index) => (
                <div key={`${field.name}-${index}`} className="space-y-1 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge variant="outline" className={categoryColor(field.category)}>
                        {field.category}
                      </Badge>
                      <span className="truncate font-mono text-sm font-medium">{field.name}</span>
                    </div>
                    <CopyButton value={field.value} className="flex-shrink-0" />
                  </div>
                  <p className="text-muted-foreground font-mono text-xs break-all">{field.value}</p>
                  {field.description && (
                    <p className="text-muted-foreground text-xs">{field.description}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center">
              <p className="text-muted-foreground">No headers loaded yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security headers reference</CardTitle>
          <CardDescription>
            {analysis
              ? analysis.source === "relay"
                ? "Ticks reflect relayed values - unverified"
                : "Ticks reflect the headers you captured"
              : "Load a response to see which of these are set"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {SECURITY_HEADERS.map((header) => {
              const hasHeader = fields.some((f) => f.name.toLowerCase() === header)
              return (
                <div key={header} className="flex items-start gap-2 rounded-lg border p-3">
                  {!active ? (
                    <Info className="text-muted-foreground mt-0.5 h-5 w-5 flex-shrink-0" />
                  ) : hasHeader ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
                  ) : (
                    <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                  )}
                  <div>
                    <p className="font-mono text-sm font-medium">{header}</p>
                    <p className="text-muted-foreground text-xs">
                      {HEADER_CATEGORIES[header]?.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
