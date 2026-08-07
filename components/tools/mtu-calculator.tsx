"use client"

import { useMemo } from "react"
import { parseAsArrayOf, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Download, Ruler } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { ResultCard } from "@/components/ui/result-card"
import { calculateMTU, ENCAPSULATIONS, type IPVersion, type Transport } from "@/lib/mtu"
import { dateStamp, downloadTextFile } from "@/lib/download"

const ENCAP_IDS = ENCAPSULATIONS.map((option) => option.id)

export function MTUCalculator() {
  const [query, setQuery] = useQueryStates(
    {
      mtu: parseAsString.withDefault("1500"),
      ip: parseAsStringLiteral(["ipv4", "ipv6"] as const).withDefault("ipv4"),
      transport: parseAsStringLiteral(["tcp", "udp", "none"] as const).withDefault("tcp"),
      encap: parseAsArrayOf(parseAsString).withDefault([]),
    },
    // typing should not fill the back button with one entry per keystroke
    { history: "replace" }
  )

  const { mtu, ip, transport, encap } = query

  // unknown ids from a hand-edited link are dropped rather than silently summed
  const enabled = useMemo(() => encap.filter((id) => ENCAP_IDS.includes(id)), [encap])

  const result = useMemo(() => {
    const linkMTU = Number.parseInt(mtu, 10)
    if (!Number.isInteger(linkMTU) || linkMTU <= 0) return null
    return calculateMTU(linkMTU, ip as IPVersion, transport as Transport, enabled)
  }, [mtu, ip, transport, enabled])

  // every error is a statement about the effective mtu, which link mtu, ip
  // version, transport and the encapsulation set all feed into
  const errorIds = result?.errors.length
    ? result.errors.map((_, index) => `mtu-error-${index}`).join(" ")
    : undefined

  const toggleEncapsulation = (id: string) => {
    void setQuery({
      encap: enabled.includes(id) ? enabled.filter((other) => other !== id) : [...enabled, id],
    })
  }

  const exportResults = () => {
    if (!result) return
    downloadTextFile(
      JSON.stringify({ input: { mtu, ip, transport, encapsulations: enabled }, result }, null, 2),
      `mtu-calculation-${dateStamp()}.json`,
      "application/json"
    )
  }

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Ruler}
        title="MTU Calculator"
        description="Work out payload MTU and TCP MSS for a path, with the encapsulation cost broken down"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Set up your network path parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="link-mtu">Link MTU (bytes)</Label>
              <Input
                id="link-mtu"
                value={mtu}
                onChange={(e) => setQuery({ mtu: e.target.value })}
                placeholder="1500"
                aria-invalid={result === null || Boolean(errorIds)}
                aria-describedby={result === null ? "link-mtu-error" : errorIds}
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Layer 3 MTU of the outer link. Ethernet&apos;s 1500 already excludes the 14-byte
                frame header.
              </p>
            </div>

            <div>
              <Label htmlFor="ip-version">Inner IP Version</Label>
              <Select value={ip} onValueChange={(value) => setQuery({ ip: value as IPVersion })}>
                <SelectTrigger
                  id="ip-version"
                  aria-invalid={Boolean(errorIds)}
                  aria-describedby={errorIds}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ipv4">IPv4 (20-byte header)</SelectItem>
                  <SelectItem value="ipv6">IPv6 (40-byte header)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="transport">Transport Protocol</Label>
              <Select
                value={transport}
                onValueChange={(value) => setQuery({ transport: value as Transport })}
              >
                <SelectTrigger
                  id="transport"
                  aria-invalid={Boolean(errorIds)}
                  aria-describedby={errorIds}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tcp">TCP (20 bytes)</SelectItem>
                  <SelectItem value="udp">UDP (8 bytes)</SelectItem>
                  <SelectItem value="none">None (raw IP payload)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* described as a group: no single checkbox is malformed, the total overhead is */}
            <fieldset aria-describedby={errorIds}>
              <legend className="text-sm font-medium">Encapsulation</legend>
              <div className="mt-2 space-y-3">
                {ENCAPSULATIONS.map((option) => (
                  <div key={option.id} className="flex items-start gap-2">
                    <Checkbox
                      id={`encap-${option.id}`}
                      checked={enabled.includes(option.id)}
                      onCheckedChange={() => toggleEncapsulation(option.id)}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <Label
                        htmlFor={`encap-${option.id}`}
                        className="cursor-pointer text-sm font-normal"
                      >
                        {option.label}
                      </Label>
                      <p className="text-muted-foreground text-xs">{option.detail}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {option.bytes} bytes
                    </Badge>
                  </div>
                ))}
              </div>
            </fieldset>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {result ? (
            <>
              <ResultCard
                title="MTU Analysis"
                data={[
                  { label: "Link MTU", value: `${result.linkMTU} bytes` },
                  {
                    label: "Encapsulation Overhead",
                    value: `${result.encapsulationOverhead} bytes`,
                  },
                  { label: "Effective IP MTU", value: `${result.effectiveMTU} bytes` },
                  { label: "Payload MTU", value: `${result.payloadBytes} bytes`, highlight: true },
                  { label: "TCP MSS", value: `${result.tcpMSS} bytes`, highlight: true },
                  {
                    label: "Default MSS if unnegotiated",
                    value: `${result.defaultMSS} bytes`,
                    description: "RFC 9293 section 3.7.1",
                  },
                ]}
              />

              {result.errors.map((message, index) => (
                <Alert key={message} variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription id={`mtu-error-${index}`}>{message}</AlertDescription>
                </Alert>
              ))}

              {result.warnings.map((message) => (
                <Alert key={message}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              ))}

              <Card>
                <CardHeader>
                  <CardTitle>Overhead Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {result.breakdown.map((row) => (
                      <div key={row.label} className="flex justify-between text-sm">
                        <span>{row.label}</span>
                        <span className="font-mono">{row.bytes} bytes</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t pt-2 font-medium">
                      <span>Total subtracted from the link MTU</span>
                      <span className="font-mono">
                        {result.linkMTU - result.payloadBytes} bytes
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button onClick={exportResults} variant="outline" className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </>
          ) : (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription id="link-mtu-error">Enter a link MTU above zero.</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  )
}
