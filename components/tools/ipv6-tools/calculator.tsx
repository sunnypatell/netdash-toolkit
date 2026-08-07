"use client"

import { useMemo } from "react"
import { parseAsString, useQueryStates } from "nuqs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Download, Globe, Network } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { ResultCard } from "@/components/ui/result-card"
import { compressIPv6, expandIPv6, ipv6NetworkPrefix, isValidIPv6 } from "@/lib/network-utils"
import { classifyIPv6, eui64Address, linkLocalFromMac, solicitedNode } from "@/lib/ipv6-address"
import { downloadTextFile, dateStamp } from "@/lib/download"
import type { PanelProps } from "@/lib/tool-panel"

interface IPv6Results {
  original: string
  compressed: string
  expanded: string
  addressType: string
  addressTypePrefix: string
  addressTypeSource: string
  networkPrefix: string
  solicitedNode: string
  eui64: string
  linkLocal: string
}

// derived, never stored: every field below is a pure function of the three
// inputs, so an invalid address can no longer sit beside a stale answer
function compute(
  address: string,
  mac: string,
  prefixText: string
): { result: IPv6Results | null; error: string } {
  if (!address.trim()) return { result: null, error: "" }
  if (!isValidIPv6(address)) return { result: null, error: "Invalid IPv6 address" }

  const prefixLength = Number.parseInt(prefixText, 10)
  if (!Number.isInteger(prefixLength) || prefixLength < 0 || prefixLength > 128) {
    return { result: null, error: "Invalid prefix length (must be 0-128)" }
  }

  try {
    const classification = classifyIPv6(address)
    const networkPrefix = ipv6NetworkPrefix(address, prefixLength)
    const compressedPrefix = compressIPv6(networkPrefix)

    let eui64 = "-"
    let linkLocal = "-"
    let error = ""
    if (mac.trim()) {
      try {
        linkLocal = linkLocalFromMac(mac)
        // an eui-64 interface identifier is 64 bits, so it cannot fit a longer prefix
        eui64 =
          prefixLength > 64
            ? "n/a: an EUI-64 identifier needs /64 or shorter"
            : eui64Address(compressedPrefix, mac, prefixLength)
      } catch (err) {
        error = err instanceof Error ? err.message : "Unable to derive an EUI-64 address"
      }
    }

    return {
      result: {
        original: address,
        compressed: compressIPv6(address),
        expanded: expandIPv6(address),
        addressType: classification.type,
        addressTypePrefix: classification.prefix,
        addressTypeSource: classification.source,
        networkPrefix: `${compressedPrefix}/${prefixLength}`,
        solicitedNode: solicitedNode(address),
        eui64,
        linkLocal,
      },
      error,
    }
  } catch (err) {
    return { result: null, error: err instanceof Error ? err.message : "Calculation failed" }
  }
}

const EXAMPLES = [
  { label: "Documentation", ip6: "2001:db8::1", mac: "00:11:22:33:44:55", prefix: "64" },
  { label: "Google DNS", ip6: "2001:4860:4860::8888", mac: "00:1a:11:22:33:44", prefix: "64" },
  { label: "Loopback", ip6: "::1", mac: "02:00:00:00:00:01", prefix: "128" },
  { label: "Link-Local", ip6: "fe80::1", mac: "00:50:56:12:34:56", prefix: "64" },
  { label: "IPv4-Mapped", ip6: "::ffff:192.0.2.33", mac: "00:11:22:33:44:55", prefix: "96" },
  { label: "Unique Local", ip6: "fd12:3456:789a::1", mac: "00:11:22:33:44:55", prefix: "48" },
]

export function IPv6Calculator({ embedded }: PanelProps) {
  const [query, setQuery] = useQueryStates(
    {
      ip6: parseAsString.withDefault("2001:db8::1"),
      mac: parseAsString.withDefault("00:11:22:33:44:55"),
      prefix: parseAsString.withDefault("64"),
    },
    { history: "replace" }
  )

  const { ip6, mac, prefix } = query
  const { result, error } = useMemo(() => compute(ip6, mac, prefix), [ip6, mac, prefix])

  // compute() returns one message at a time, so mirror its order to name the field
  const invalidField = useMemo(() => {
    if (!error) return null
    if (!isValidIPv6(ip6)) return "address"
    // the eui-64 failure is the only one that still produces a result
    if (result) return "mac"
    const prefixLength = Number.parseInt(prefix, 10)
    const prefixOk = Number.isInteger(prefixLength) && prefixLength >= 0 && prefixLength <= 128
    return prefixOk ? "address" : "prefix"
  }, [error, ip6, prefix, result])

  const exportResults = () => {
    if (!result) return
    downloadTextFile(
      JSON.stringify({ input: { ip6, mac, prefix }, results: result }, null, 2),
      `ipv6-tools-${dateStamp()}.json`,
      "application/json"
    )
  }

  return (
    <div className={embedded ? "space-y-6" : "tool-container"}>
      {!embedded && (
        <ToolHeader
          icon={Globe}
          title="IPv6 Calculator"
          description="Compress, expand, classify and derive EUI-64 and solicited-node addresses"
        />
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription id="ipv6-calculator-error">{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Input
            </CardTitle>
            <CardDescription>
              Results update as you type; the inputs live in the address bar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="ipv6-address">IPv6 Address</Label>
              <Input
                id="ipv6-address"
                value={ip6}
                onChange={(event) => void setQuery({ ip6: event.target.value })}
                placeholder="2001:db8::1"
                className="font-mono"
                aria-invalid={invalidField === "address"}
                aria-describedby={invalidField === "address" ? "ipv6-calculator-error" : undefined}
              />
              {result && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {result.addressType}
                  </Badge>
                  <span className="text-muted-foreground font-mono text-xs">
                    {result.addressTypePrefix}
                  </span>
                  <span className="text-muted-foreground text-xs">{result.addressTypeSource}</span>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="ipv6-mac">MAC Address</Label>
              <Input
                id="ipv6-mac"
                value={mac}
                onChange={(event) => void setQuery({ mac: event.target.value })}
                placeholder="00:11:22:33:44:55"
                className="font-mono"
                aria-invalid={invalidField === "mac"}
                aria-describedby={invalidField === "mac" ? "ipv6-calculator-error" : undefined}
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Used for the EUI-64 interface identifier. Leave blank to skip it.
              </p>
            </div>

            <div>
              <Label htmlFor="ipv6-prefix">Prefix Length</Label>
              <Input
                id="ipv6-prefix"
                value={prefix}
                onChange={(event) => void setQuery({ prefix: event.target.value })}
                placeholder="64"
                inputMode="numeric"
                aria-invalid={invalidField === "prefix"}
                aria-describedby={invalidField === "prefix" ? "ipv6-calculator-error" : undefined}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Quick Load Examples</p>
              <div className="grid grid-cols-2 gap-2">
                {EXAMPLES.map((example) => (
                  <Button
                    key={example.label}
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void setQuery({
                        ip6: example.ip6,
                        mac: example.mac,
                        prefix: example.prefix,
                      })
                    }
                  >
                    {example.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {result ? (
            <>
              <ResultCard
                title="Address Formats"
                data={[
                  { label: "Original", value: result.original, copyable: true },
                  {
                    label: "Compressed (RFC 5952)",
                    value: result.compressed,
                    copyable: true,
                    highlight: true,
                  },
                  { label: "Expanded", value: result.expanded, copyable: true },
                  { label: "Network Prefix", value: result.networkPrefix, copyable: true },
                ]}
              />

              <ResultCard
                title="Multicast"
                description="Solicited-node group per RFC 4291 2.7.1, ff02::1:ff00:0/104"
                data={[
                  {
                    label: "Solicited-Node Multicast",
                    value: result.solicitedNode,
                    copyable: true,
                    highlight: true,
                  },
                ]}
              />

              <ResultCard
                title="EUI-64"
                description="Modified EUI-64 interface identifier per RFC 4291 Appendix A"
                data={[
                  { label: "EUI-64 Address", value: result.eui64, copyable: true, highlight: true },
                  { label: "Link-Local Address", value: result.linkLocal, copyable: true },
                ]}
              />

              <Button onClick={exportResults} variant="outline" className="w-full bg-transparent">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </>
          ) : (
            <Card>
              <CardContent className="flex h-48 items-center justify-center">
                <p className="text-muted-foreground text-center">
                  Enter a valid IPv6 address to see the derived values
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default IPv6Calculator
