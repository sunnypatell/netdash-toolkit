"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Cpu, AlertTriangle, CheckCircle2 } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"

interface MACInfo {
  raw: string
  colon: string
  dash: string
  cisco: string
  none: string
  colonLower: string
  dashLower: string
  ciscoLower: string
  noneLower: string
  oui: string
  nic: string
  isMulticast: boolean
  isUnicast: boolean
  isLocallyAdministered: boolean
  isUniversallyAdministered: boolean
  binary: string
  eui64: string
}

export function MACFormatter() {
  const [input, setInput] = useState("00:1A:2B:3C:4D:5E")
  const [error, setError] = useState<string | null>(null)

  const parseMAC = (mac: string): string | null => {
    // Remove all common separators and convert to uppercase
    const clean = mac.replace(/[:\-.\s]/g, "").toUpperCase()

    // Validate hex characters and length
    if (!/^[0-9A-F]{12}$/.test(clean)) {
      return null
    }

    return clean
  }

  const result = useMemo<MACInfo | null>(() => {
    setError(null)
    const clean = parseMAC(input)

    if (!clean) {
      if (input.trim()) {
        setError("Invalid MAC address. Enter 12 hex characters in any format.")
      }
      return null
    }

    const bytes = []
    for (let i = 0; i < 12; i += 2) {
      bytes.push(clean.slice(i, i + 2))
    }

    const firstByte = parseInt(bytes[0], 16)
    const isMulticast = (firstByte & 0x01) === 1
    const isLocallyAdministered = (firstByte & 0x02) === 2

    // Generate EUI-64 from MAC (insert FFFE in the middle and flip the 7th bit)
    const eui64FirstByte = (firstByte ^ 0x02).toString(16).padStart(2, "0").toUpperCase()
    const eui64 = `${eui64FirstByte}${bytes[1]}:${bytes[2]}FF:FE${bytes[3]}:${bytes[4]}${bytes[5]}`

    return {
      raw: clean,
      colon: bytes.join(":"),
      dash: bytes.join("-"),
      cisco: `${bytes[0]}${bytes[1]}.${bytes[2]}${bytes[3]}.${bytes[4]}${bytes[5]}`,
      none: clean,
      colonLower: bytes.join(":").toLowerCase(),
      dashLower: bytes.join("-").toLowerCase(),
      ciscoLower:
        `${bytes[0]}${bytes[1]}.${bytes[2]}${bytes[3]}.${bytes[4]}${bytes[5]}`.toLowerCase(),
      noneLower: clean.toLowerCase(),
      oui: bytes.slice(0, 3).join(":"),
      nic: bytes.slice(3).join(":"),
      isMulticast,
      isUnicast: !isMulticast,
      isLocallyAdministered,
      isUniversallyAdministered: !isLocallyAdministered,
      binary: bytes.map((b) => parseInt(b, 16).toString(2).padStart(8, "0")).join(" "),
      eui64,
    }
  }, [input])

  const FormatRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="font-mono text-sm">{value}</p>
      </div>
      <CopyButton value={value} size="sm" />
    </div>
  )

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Cpu}
        title="MAC Address Formatter"
        description="Convert MAC addresses between formats and analyze properties"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>Enter a MAC address in any format</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="mac">MAC Address</Label>
              <Input
                id="mac"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="00:1A:2B:3C:4D:5E"
                className="font-mono"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Accepts: colon, dash, Cisco, or no separator
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {result && (
              <div className="space-y-3 border-t pt-4">
                <h4 className="text-sm font-medium">Address Properties</h4>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {result.isUnicast ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    )}
                    <span className="text-sm">{result.isUnicast ? "Unicast" : "Multicast"}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {result.isUniversallyAdministered ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    )}
                    <span className="text-sm">
                      {result.isUniversallyAdministered
                        ? "Universally Administered (UAA)"
                        : "Locally Administered (LAA)"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 border-t pt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">OUI (Vendor)</span>
                    <span className="font-mono">{result.oui}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">NIC Specific</span>
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
              {result ? "All common MAC address formats" : "Enter a MAC address to see formats"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FormatRow label="Colon (uppercase)" value={result.colon} />
                <FormatRow label="Colon (lowercase)" value={result.colonLower} />
                <FormatRow label="Dash (uppercase)" value={result.dash} />
                <FormatRow label="Dash (lowercase)" value={result.dashLower} />
                <FormatRow label="Cisco (uppercase)" value={result.cisco} />
                <FormatRow label="Cisco (lowercase)" value={result.ciscoLower} />
                <FormatRow label="No separator (uppercase)" value={result.none} />
                <FormatRow label="No separator (lowercase)" value={result.noneLower} />
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
            <CardTitle>Additional Formats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-4">
                <p className="text-muted-foreground text-sm">Binary Representation</p>
                <p className="mt-1 font-mono text-sm break-all">{result.binary}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-muted-foreground text-sm">EUI-64 (for IPv6 SLAAC)</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="font-mono text-sm">{result.eui64}</p>
                  <CopyButton value={result.eui64} size="sm" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>MAC Address Formats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Badge variant="secondary">IEEE Standard</Badge>
              <p className="font-mono text-sm">00:1A:2B:3C:4D:5E</p>
              <p className="text-muted-foreground text-xs">Colons, used in Unix/Linux</p>
            </div>
            <div className="space-y-1">
              <Badge variant="secondary">Windows</Badge>
              <p className="font-mono text-sm">00-1A-2B-3C-4D-5E</p>
              <p className="text-muted-foreground text-xs">Dashes, Windows standard</p>
            </div>
            <div className="space-y-1">
              <Badge variant="secondary">Cisco</Badge>
              <p className="font-mono text-sm">001a.2b3c.4d5e</p>
              <p className="text-muted-foreground text-xs">Dots, Cisco IOS</p>
            </div>
            <div className="space-y-1">
              <Badge variant="secondary">Bare</Badge>
              <p className="font-mono text-sm">001A2B3C4D5E</p>
              <p className="text-muted-foreground text-xs">No separators</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
