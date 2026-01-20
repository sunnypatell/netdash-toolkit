"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RefreshCw, AlertTriangle, ArrowRightLeft } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"
import { SaveToProject } from "@/components/ui/save-to-project"
import { LoadFromProject } from "@/components/ui/load-from-project"
import type { ProjectItem } from "@/contexts/project-context"

interface ConversionResult {
  dottedDecimal: string
  decimal: string
  binary: string
  hex: string
  octal: string
  ipv6Mapped: string
  ipv6Compatible: string
  isValid: boolean
  isPrivate: boolean
  isLoopback: boolean
  isMulticast: boolean
  class: string
}

export function IPConverter() {
  const [ipInput, setIpInput] = useState("192.168.1.1")
  const [inputFormat, setInputFormat] = useState<"dotted" | "decimal" | "binary" | "hex">("dotted")

  // Parse IP from different formats
  const parseIP = (input: string, format: string): number | null => {
    try {
      switch (format) {
        case "dotted": {
          const parts = input.trim().split(".")
          if (parts.length !== 4) return null
          const octets = parts.map((p) => parseInt(p, 10))
          if (octets.some((o) => isNaN(o) || o < 0 || o > 255)) return null
          return (octets[0] << 24) + (octets[1] << 16) + (octets[2] << 8) + octets[3]
        }
        case "decimal": {
          const num = parseInt(input.trim(), 10)
          if (isNaN(num) || num < 0 || num > 4294967295) return null
          return num
        }
        case "binary": {
          const clean = input.replace(/[\s.]/g, "")
          if (!/^[01]+$/.test(clean) || clean.length > 32) return null
          const padded = clean.padStart(32, "0")
          return parseInt(padded, 2)
        }
        case "hex": {
          const clean = input.replace(/[\s:0x]/gi, "")
          if (!/^[0-9a-fA-F]+$/.test(clean) || clean.length > 8) return null
          return parseInt(clean, 16)
        }
        default:
          return null
      }
    } catch {
      return null
    }
  }

  // Convert IP integer to various formats
  const convertIP = (ipInt: number): ConversionResult => {
    // Ensure unsigned 32-bit
    const unsigned = ipInt >>> 0

    // Dotted decimal
    const octets = [
      (unsigned >>> 24) & 0xff,
      (unsigned >>> 16) & 0xff,
      (unsigned >>> 8) & 0xff,
      unsigned & 0xff,
    ]
    const dottedDecimal = octets.join(".")

    // Decimal
    const decimal = unsigned.toString(10)

    // Binary with dots
    const binary = octets.map((o) => o.toString(2).padStart(8, "0")).join(".")

    // Hex
    const hex = "0x" + unsigned.toString(16).toUpperCase().padStart(8, "0")

    // Octal
    const octal = "0o" + unsigned.toString(8)

    // IPv6 mapped (::ffff:x.x.x.x)
    const ipv6Mapped = `::ffff:${dottedDecimal}`

    // IPv6 compatible (deprecated but still useful) (::x.x.x.x)
    const ipv6Compatible = `::${dottedDecimal}`

    // Classification
    const firstOctet = octets[0]
    let ipClass = "Unknown"
    if (firstOctet >= 1 && firstOctet <= 126) ipClass = "A"
    else if (firstOctet >= 128 && firstOctet <= 191) ipClass = "B"
    else if (firstOctet >= 192 && firstOctet <= 223) ipClass = "C"
    else if (firstOctet >= 224 && firstOctet <= 239) ipClass = "D (Multicast)"
    else if (firstOctet >= 240 && firstOctet <= 255) ipClass = "E (Reserved)"

    // Private check (RFC 1918)
    const isPrivate =
      octets[0] === 10 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168)

    // Loopback (127.0.0.0/8)
    const isLoopback = octets[0] === 127

    // Multicast (224.0.0.0/4)
    const isMulticast = octets[0] >= 224 && octets[0] <= 239

    return {
      dottedDecimal,
      decimal,
      binary,
      hex,
      octal,
      ipv6Mapped,
      ipv6Compatible,
      isValid: true,
      isPrivate,
      isLoopback,
      isMulticast,
      class: ipClass,
    }
  }

  const result = useMemo((): ConversionResult | null => {
    const ipInt = parseIP(ipInput, inputFormat)
    if (ipInt === null) return null
    return convertIP(ipInt)
  }, [ipInput, inputFormat])

  const ResultRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="truncate font-mono text-sm">{value}</p>
      </div>
      <CopyButton value={value} size="sm" />
    </div>
  )

  const handleLoadFromProject = (data: Record<string, unknown>, _item: ProjectItem) => {
    const input = data.input as { value: string; format: string } | undefined
    if (input) {
      setIpInput(input.value)
      setInputFormat(input.format as typeof inputFormat)
    }
  }

  return (
    <div className="tool-container">
      <ToolHeader
        icon={ArrowRightLeft}
        title="IP Address Converter"
        description="Convert IPv4 addresses between binary, decimal, hexadecimal, and dotted-decimal formats"
        actions={
          <>
            <LoadFromProject itemType="ip-converter" onLoad={handleLoadFromProject} size="sm" />
            {result && (
              <SaveToProject
                itemType="ip-converter"
                itemName={result.dottedDecimal}
                itemData={{
                  input: { value: ipInput, format: inputFormat },
                  result: result,
                }}
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
            <CardDescription>Enter an IP address in any supported format</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Input Format</Label>
              <Tabs
                value={inputFormat}
                onValueChange={(v) => setInputFormat(v as typeof inputFormat)}
              >
                <TabsList className="mt-2 grid w-full grid-cols-4">
                  <TabsTrigger value="dotted">Dotted</TabsTrigger>
                  <TabsTrigger value="decimal">Decimal</TabsTrigger>
                  <TabsTrigger value="binary">Binary</TabsTrigger>
                  <TabsTrigger value="hex">Hex</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div>
              <Label htmlFor="ip-input">
                {inputFormat === "dotted" && "Dotted Decimal (e.g., 192.168.1.1)"}
                {inputFormat === "decimal" && "Decimal Integer (e.g., 3232235777)"}
                {inputFormat === "binary" && "Binary (e.g., 11000000.10101000.00000001.00000001)"}
                {inputFormat === "hex" && "Hexadecimal (e.g., 0xC0A80101)"}
              </Label>
              <Input
                id="ip-input"
                value={ipInput}
                onChange={(e) => setIpInput(e.target.value)}
                placeholder={
                  inputFormat === "dotted"
                    ? "192.168.1.1"
                    : inputFormat === "decimal"
                      ? "3232235777"
                      : inputFormat === "binary"
                        ? "11000000.10101000.00000001.00000001"
                        : "0xC0A80101"
                }
                className="font-mono"
              />
            </div>

            {!result && ipInput.trim() && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>Invalid IP address format</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIpInput("192.168.1.1")
                  setInputFormat("dotted")
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>

            {result && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Class {result.class}</Badge>
                  {result.isPrivate && <Badge variant="secondary">Private</Badge>}
                  {result.isLoopback && <Badge variant="secondary">Loopback</Badge>}
                  {result.isMulticast && <Badge variant="secondary">Multicast</Badge>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {result ? (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Standard Formats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ResultRow label="Dotted Decimal" value={result.dottedDecimal} />
                  <ResultRow label="Decimal (32-bit integer)" value={result.decimal} />
                  <ResultRow label="Hexadecimal" value={result.hex} />
                  <ResultRow label="Octal" value={result.octal} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Binary Representation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-muted-foreground text-xs">Binary (with dots)</p>
                        <p className="font-mono text-sm break-all">{result.binary}</p>
                      </div>
                      <CopyButton value={result.binary} size="sm" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">IPv6 Formats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ResultRow label="IPv6 Mapped (::ffff:x.x.x.x)" value={result.ipv6Mapped} />
                  <ResultRow label="IPv6 Compatible (::x.x.x.x)" value={result.ipv6Compatible} />
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex h-48 items-center justify-center">
                <p className="text-muted-foreground text-center">
                  Enter a valid IP address to see conversions
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
              <h4 className="mb-2 font-semibold">Private Ranges (RFC 1918)</h4>
              <ul className="text-muted-foreground space-y-1">
                <li>• 10.0.0.0/8</li>
                <li>• 172.16.0.0/12</li>
                <li>• 192.168.0.0/16</li>
              </ul>
            </div>
            <div>
              <h4 className="mb-2 font-semibold">Special Addresses</h4>
              <ul className="text-muted-foreground space-y-1">
                <li>• 127.0.0.0/8 (Loopback)</li>
                <li>• 169.254.0.0/16 (Link-local)</li>
                <li>• 0.0.0.0/8 (This network)</li>
              </ul>
            </div>
            <div>
              <h4 className="mb-2 font-semibold">IP Classes</h4>
              <ul className="text-muted-foreground space-y-1">
                <li>• Class A: 1-126.x.x.x</li>
                <li>• Class B: 128-191.x.x.x</li>
                <li>• Class C: 192-223.x.x.x</li>
              </ul>
            </div>
            <div>
              <h4 className="mb-2 font-semibold">Format Examples</h4>
              <ul className="text-muted-foreground space-y-1 font-mono text-xs">
                <li>• 192.168.1.1</li>
                <li>• 3232235777</li>
                <li>• 0xC0A80101</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
