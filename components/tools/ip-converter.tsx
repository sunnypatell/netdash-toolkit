"use client"

import { useMemo } from "react"
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, ArrowRightLeft, RefreshCw } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"
import { SaveToProject } from "@/components/ui/save-to-project"
import { LoadFromProject } from "@/components/ui/load-from-project"
import {
  IPV4_INPUT_FORMATS,
  convertIPv4,
  parseIPv4Input,
  type IPv4InputFormat,
} from "@/lib/ip-formats"

const FORMAT_META: Record<
  IPv4InputFormat,
  { tab: string; label: string; placeholder: string; hint: string }
> = {
  dotted: {
    tab: "Dotted",
    label: "Dotted Decimal",
    placeholder: "192.168.1.1",
    hint: "Four octets, 0 to 255, no leading zeros",
  },
  decimal: {
    tab: "Decimal",
    label: "Decimal Integer",
    placeholder: "3232235777",
    hint: "Unsigned 32-bit integer, 0 to 4294967295",
  },
  binary: {
    tab: "Binary",
    label: "Binary",
    placeholder: "11000000.10101000.00000001.00000001",
    hint: "Up to 32 binary digits; dots and spaces are ignored",
  },
  hex: {
    tab: "Hex",
    label: "Hexadecimal",
    placeholder: "0xC0A80101",
    hint: "Up to 8 hex digits, with or without an 0x prefix",
  },
  octal: {
    tab: "Octal",
    label: "Octal",
    placeholder: "0o30052000401",
    hint: "Octal digits, with or without an 0o prefix",
  },
}

export function IPConverter() {
  const [query, setQuery] = useQueryStates(
    {
      format: parseAsStringLiteral(IPV4_INPUT_FORMATS).withDefault("dotted"),
      value: parseAsString.withDefault("192.168.1.1"),
    },
    { history: "replace" }
  )

  const { format, value } = query
  const result = useMemo(() => {
    const ipInt = parseIPv4Input(value, format)
    return ipInt === null ? null : convertIPv4(ipInt)
  }, [value, format])

  const meta = FORMAT_META[format]

  const handleLoadFromProject = (data: Record<string, unknown>) => {
    const input = data.input as { value?: string; format?: string } | undefined
    if (!input?.value) return
    void setQuery({
      value: input.value,
      ...(IPV4_INPUT_FORMATS.includes(input.format as IPv4InputFormat)
        ? { format: input.format as IPv4InputFormat }
        : {}),
    })
  }

  return (
    <div className="tool-container">
      <ToolHeader
        icon={ArrowRightLeft}
        title="IP Address Converter"
        description="Convert an IPv4 address between dotted decimal, integer, binary, hex and octal"
        actions={
          <>
            <LoadFromProject itemType="ip-converter" onLoad={handleLoadFromProject} size="sm" />
            {result && (
              <SaveToProject
                itemType="ip-converter"
                itemName={result.dottedDecimal}
                itemData={{ input: { value, format }, result }}
                toolSource="IP Converter"
                size="sm"
              />
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>
              Every format converts as you type. The address and format live in the query string.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs
              value={format}
              onValueChange={(next) => void setQuery({ format: next as IPv4InputFormat })}
              className="gap-4"
            >
              <div>
                <Label id="input-format-label">Input Format</Label>
                <TabsList
                  aria-labelledby="input-format-label"
                  className="mt-2 grid w-full grid-cols-5"
                >
                  {IPV4_INPUT_FORMATS.map((each) => (
                    <TabsTrigger key={each} value={each}>
                      {FORMAT_META[each].tab}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {/* the field each format tab controls, so the tab's aria-controls resolves */}
              <TabsContent value={format}>
                <Label htmlFor="ip-input">
                  {meta.label} (e.g. {meta.placeholder})
                </Label>
                <Input
                  id="ip-input"
                  value={value}
                  onChange={(event) => void setQuery({ value: event.target.value })}
                  placeholder={meta.placeholder}
                  className="font-mono"
                  aria-describedby="ip-input-hint"
                />
                <p id="ip-input-hint" className="text-muted-foreground mt-1 text-xs">
                  {meta.hint}
                </p>
              </TabsContent>
            </Tabs>

            {!result && value.trim() && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Not a valid {meta.label.toLowerCase()} IPv4 address
                </AlertDescription>
              </Alert>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => void setQuery({ value: "192.168.1.1", format: "dotted" })}
            >
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Reset
            </Button>

            {result && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Class {result.ipClass}</Badge>
                <Badge variant={result.scope.routable ? "secondary" : "destructive"}>
                  {result.scope.name}
                </Badge>
                <span className="text-muted-foreground text-xs">{result.scope.source}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4" aria-live="polite">
          {result ? (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Numeric Formats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Dotted Decimal", value: result.dottedDecimal },
                    { label: "Decimal (unsigned 32-bit)", value: result.decimal },
                    { label: "Hexadecimal", value: result.hex },
                    { label: "Octal", value: result.octal },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between gap-2 rounded-lg border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-muted-foreground text-xs">{row.label}</p>
                        <p className="truncate font-mono text-sm">{row.value}</p>
                      </div>
                      <CopyButton value={row.value} size="sm" />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Binary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-muted-foreground text-xs">Binary, one octet per group</p>
                      <p className="font-mono text-sm break-all">{result.binary}</p>
                    </div>
                    <CopyButton value={result.binary} size="sm" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">IPv6 Forms</CardTitle>
                  <CardDescription>RFC 4291 section 2.5.5</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    {
                      label: "IPv4-Mapped (::ffff:a.b.c.d)",
                      value: result.ipv6Mapped,
                      note: "Used by dual-stack socket APIs",
                    },
                    {
                      label: "IPv4-Compatible (::a.b.c.d)",
                      value: result.ipv6Compatible,
                      note: "Deprecated by RFC 4291 2.5.5.1; do not deploy",
                    },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between gap-2 rounded-lg border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-muted-foreground text-xs">{row.label}</p>
                        <p className="truncate font-mono text-sm">{row.value}</p>
                        <p className="text-muted-foreground mt-1 text-xs">{row.note}</p>
                      </div>
                      <CopyButton value={row.value} size="sm" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex h-48 items-center justify-center">
                <p className="text-muted-foreground text-center">
                  Enter a valid IPv4 address to see every conversion
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2 lg:grid-cols-4">
            <div>
              <h3 className="mb-2 font-semibold">Private (RFC 1918)</h3>
              <ul className="text-muted-foreground space-y-1 font-mono text-xs">
                <li>10.0.0.0/8</li>
                <li>172.16.0.0/12</li>
                <li>192.168.0.0/16</li>
              </ul>
            </div>
            <div>
              <h3 className="mb-2 font-semibold">Not globally routable</h3>
              <ul className="text-muted-foreground space-y-1 font-mono text-xs">
                <li>0.0.0.0/8</li>
                <li>100.64.0.0/10</li>
                <li>127.0.0.0/8</li>
                <li>169.254.0.0/16</li>
              </ul>
            </div>
            <div>
              <h3 className="mb-2 font-semibold">Classful ranges (RFC 791)</h3>
              <ul className="text-muted-foreground space-y-1 text-xs">
                <li>A: 1 to 126</li>
                <li>B: 128 to 191</li>
                <li>C: 192 to 223</li>
                <li>D: 224 to 239 (multicast)</li>
                <li>E: 240 to 255 (reserved)</li>
              </ul>
            </div>
            <div>
              <h3 className="mb-2 font-semibold">Same address, five ways</h3>
              <ul className="text-muted-foreground space-y-1 font-mono text-xs">
                <li>192.168.1.1</li>
                <li>3232235777</li>
                <li>0xC0A80101</li>
                <li>0o30052000401</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default IPConverter
