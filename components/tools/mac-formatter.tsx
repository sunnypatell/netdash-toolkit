"use client"

import { useMemo } from "react"
import { parseAsString, useQueryStates } from "nuqs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Cpu, AlertTriangle, CheckCircle2 } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"
import { parseMac } from "@/lib/mac-format"

const EXAMPLES = [
  { label: "IEEE colon", value: "00:1A:2B:3C:4D:5E", note: "Colons, used across Unix and Linux" },
  { label: "Windows hyphen", value: "00-1A-2B-3C-4D-5E", note: "Hyphens, Windows and ProCurve" },
  { label: "Cisco dotted", value: "001a.2b3c.4d5e", note: "Three dotted quads, Cisco IOS" },
  { label: "Bare", value: "001A2B3C4D5E", note: "No separators" },
]

function FormatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="font-mono text-sm break-all">{value}</p>
      </div>
      <CopyButton value={value} size="sm" />
    </div>
  )
}

export function MACFormatter() {
  const [query, setQuery] = useQueryStates(
    { mac: parseAsString.withDefault("00:1A:2B:3C:4D:5E") },
    // typing should not fill the back button with one entry per keystroke
    { history: "replace" }
  )

  const { mac } = query

  // derived, so a half-typed address cannot leave the previous answer on screen
  const result = useMemo(() => parseMac(mac), [mac])
  const showError = !result && mac.trim().length > 0

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Cpu}
        title="MAC Address Formatter"
        description="Convert MAC addresses between formats and read the IEEE 802 address bits"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>Enter a MAC address in any of the four formats</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="mac">MAC Address</Label>
              <Input
                id="mac"
                value={mac}
                onChange={(e) => setQuery({ mac: e.target.value })}
                placeholder="00:1A:2B:3C:4D:5E"
                className="font-mono"
                aria-invalid={showError}
                aria-describedby={showError ? "mac-error" : undefined}
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Accepts colon, hyphen, Cisco dotted, ProCurve 6-6 and bare
              </p>
            </div>

            {showError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription id="mac-error">
                  Not a MAC address. Expected 12 hex digits as 00:1A:2B:3C:4D:5E, 00-1A-2B-3C-4D-5E,
                  001a.2b3c.4d5e or 001A2B3C4D5E.
                </AlertDescription>
              </Alert>
            )}

            {result && (
              <div className="space-y-3 border-t pt-4">
                <h4 className="text-sm font-medium">Address Bits</h4>

                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    {result.isMulticast ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-600" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
                    )}
                    <span className="text-sm">
                      {result.isMulticast ? "Group (multicast)" : "Individual (unicast)"}
                      <span className="text-muted-foreground block text-xs">
                        I/G bit, bit 0 of the first octet
                      </span>
                    </span>
                  </div>

                  <div className="flex items-start gap-2">
                    {result.isLocallyAdministered ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-600" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
                    )}
                    <span className="text-sm">
                      {result.isLocallyAdministered
                        ? "Locally administered (LAA)"
                        : "Universally administered (UAA)"}
                      <span className="text-muted-foreground block text-xs">
                        U/L bit, bit 1 of the first octet
                      </span>
                    </span>
                  </div>

                  {result.isBroadcast && <Badge variant="destructive">Broadcast address</Badge>}
                </div>

                <div className="space-y-2 border-t pt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Detected input format</span>
                    <span className="font-mono">{result.detectedFormat}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">OUI (first 24 bits)</span>
                    <span className="font-mono">{result.oui}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">NIC specific</span>
                    <span className="font-mono">{result.nic}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Formatted Output</CardTitle>
            <CardDescription>
              {result ? "Every common notation, upper and lower case" : "Enter a MAC address"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FormatRow label="Colon (uppercase)" value={result.colon} />
                <FormatRow label="Colon (lowercase)" value={result.colon.toLowerCase()} />
                <FormatRow label="Hyphen (uppercase)" value={result.hyphen} />
                <FormatRow label="Hyphen (lowercase)" value={result.hyphen.toLowerCase()} />
                <FormatRow label="Cisco dotted (lowercase)" value={result.cisco} />
                <FormatRow label="Cisco dotted (uppercase)" value={result.cisco.toUpperCase()} />
                <FormatRow label="Bare (uppercase)" value={result.bare} />
                <FormatRow label="Bare (lowercase)" value={result.bare.toLowerCase()} />
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center">
                <p className="text-muted-foreground">Enter a valid MAC address to see formats</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Derived Values</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-4">
                <p className="text-muted-foreground text-sm">Binary</p>
                <p className="mt-1 font-mono text-sm break-all">{result.binary}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-muted-foreground text-sm">
                  Modified EUI-64 interface identifier
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="font-mono text-sm break-all">{result.modifiedEui64}</p>
                  <CopyButton value={result.modifiedEui64} size="sm" />
                </div>
                <p className="text-muted-foreground mt-2 text-xs">
                  FFFE inserted and the U/L bit inverted per RFC 4291 appendix A. RFC 8064 now
                  prefers stable opaque identifiers for SLAAC instead.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Accepted Formats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {EXAMPLES.map((example) => (
              <div key={example.label} className="space-y-1">
                <Badge variant="secondary">{example.label}</Badge>
                <p className="font-mono text-sm break-all">{example.value}</p>
                <p className="text-muted-foreground text-xs">{example.note}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
