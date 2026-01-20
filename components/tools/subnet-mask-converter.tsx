"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Binary, AlertTriangle } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"

interface MaskResult {
  cidr: number
  dotted: string
  wildcard: string
  binary: string
  hosts: number
  networks: string
  class: string
}

const PRESET_MASKS = [
  { cidr: 8, label: "/8 (Class A)" },
  { cidr: 16, label: "/16 (Class B)" },
  { cidr: 24, label: "/24 (Class C)" },
  { cidr: 25, label: "/25" },
  { cidr: 26, label: "/26" },
  { cidr: 27, label: "/27" },
  { cidr: 28, label: "/28" },
  { cidr: 29, label: "/29" },
  { cidr: 30, label: "/30 (P2P)" },
  { cidr: 31, label: "/31 (P2P)" },
  { cidr: 32, label: "/32 (Host)" },
]

export function SubnetMaskConverter() {
  const [input, setInput] = useState("255.255.255.0")
  const [error, setError] = useState<string | null>(null)

  const parseMask = (value: string): number | null => {
    const trimmed = value.trim()

    // Check if it is CIDR notation
    if (trimmed.startsWith("/")) {
      const cidr = parseInt(trimmed.slice(1), 10)
      if (!isNaN(cidr) && cidr >= 0 && cidr <= 32) return cidr
    }

    // Check if its just a number
    if (/^\d+$/.test(trimmed)) {
      const cidr = parseInt(trimmed, 10)
      if (!isNaN(cidr) && cidr >= 0 && cidr <= 32) return cidr
    }

    // Check if it is dotted decimal
    const parts = trimmed.split(".")
    if (parts.length === 4) {
      const octets = parts.map((p) => parseInt(p, 10))
      if (octets.every((o) => !isNaN(o) && o >= 0 && o <= 255)) {
        // Convert to 32-bit number
        const maskInt = ((octets[0] << 24) >>> 0) + (octets[1] << 16) + (octets[2] << 8) + octets[3]
        // Check if it is a valid mask (contiguous 1s)
        const binary = maskInt.toString(2).padStart(32, "0")
        if (/^1*0*$/.test(binary)) {
          return binary.indexOf("0") === -1 ? 32 : binary.indexOf("0")
        }
      }
    }

    return null
  }

  const result = useMemo<MaskResult | null>(() => {
    setError(null)
    const cidr = parseMask(input)

    if (cidr === null) {
      if (input.trim()) {
        setError(
          "Invalid subnet mask. Enter CIDR (/24), prefix length (24), or dotted decimal (255.255.255.0)"
        )
      }
      return null
    }

    // Create mask integer
    const maskInt = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0
    const wildcardInt = ~maskInt >>> 0

    // Convert to dotted decimal
    const dotted = [
      (maskInt >>> 24) & 255,
      (maskInt >>> 16) & 255,
      (maskInt >>> 8) & 255,
      maskInt & 255,
    ].join(".")

    const wildcard = [
      (wildcardInt >>> 24) & 255,
      (wildcardInt >>> 16) & 255,
      (wildcardInt >>> 8) & 255,
      wildcardInt & 255,
    ].join(".")

    const binary = [
      ((maskInt >>> 24) & 255).toString(2).padStart(8, "0"),
      ((maskInt >>> 16) & 255).toString(2).padStart(8, "0"),
      ((maskInt >>> 8) & 255).toString(2).padStart(8, "0"),
      (maskInt & 255).toString(2).padStart(8, "0"),
    ].join(".")

    const hostBits = 32 - cidr
    const hosts = cidr >= 31 ? Math.pow(2, hostBits) : Math.pow(2, hostBits) - 2

    // Determine class
    let netClass = "Classless"
    if (cidr <= 8) netClass = "Class A or larger"
    else if (cidr <= 16) netClass = "Class B or larger"
    else if (cidr <= 24) netClass = "Class C or larger"

    const networks = Math.pow(2, cidr).toLocaleString()

    return {
      cidr,
      dotted,
      wildcard,
      binary,
      hosts,
      networks,
      class: netClass,
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
        icon={Binary}
        title="Subnet Mask Converter"
        description="Convert between CIDR, dotted decimal, and wildcard masks"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>Enter a subnet mask in any format</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="mask">Subnet Mask</Label>
              <Input
                id="mask"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="/24 or 255.255.255.0"
                className="font-mono"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Accepts: /24, 24, or 255.255.255.0
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2 pt-2">
              <p className="text-muted-foreground text-xs">Quick Select</p>
              <div className="flex flex-wrap gap-1">
                {PRESET_MASKS.map((m) => (
                  <Badge
                    key={m.cidr}
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => setInput("/" + m.cidr)}
                  >
                    /{m.cidr}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Conversions</CardTitle>
            <CardDescription>
              {result
                ? "All subnet mask formats for /" + result.cidr
                : "Enter a mask to see conversions"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FormatRow label="CIDR Notation" value={"/" + result.cidr} />
                <FormatRow label="Subnet Mask (Dotted Decimal)" value={result.dotted} />
                <FormatRow label="Wildcard Mask" value={result.wildcard} />
                <FormatRow label="Usable Hosts" value={result.hosts.toLocaleString()} />
                <FormatRow label="Binary" value={result.binary} />
                <FormatRow label="Total Networks" value={result.networks} />
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center">
                <p className="text-muted-foreground">Enter a valid subnet mask</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Common Subnet Masks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left font-medium">CIDR</th>
                  <th className="p-2 text-left font-medium">Subnet Mask</th>
                  <th className="p-2 text-left font-medium">Wildcard</th>
                  <th className="p-2 text-left font-medium">Hosts</th>
                  <th className="p-2 text-left font-medium">Use Case</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { cidr: 8, hosts: "16,777,214", use: "Large enterprise" },
                  { cidr: 16, hosts: "65,534", use: "Medium enterprise" },
                  { cidr: 24, hosts: "254", use: "Small network/VLAN" },
                  { cidr: 25, hosts: "126", use: "Half Class C" },
                  { cidr: 26, hosts: "62", use: "Quarter Class C" },
                  { cidr: 27, hosts: "30", use: "Small department" },
                  { cidr: 28, hosts: "14", use: "Small group" },
                  { cidr: 29, hosts: "6", use: "Point-to-multipoint" },
                  { cidr: 30, hosts: "2", use: "Point-to-point link" },
                  { cidr: 31, hosts: "2", use: "P2P link (RFC 3021)" },
                  { cidr: 32, hosts: "1", use: "Host route/Loopback" },
                ].map((row) => {
                  const maskInt = row.cidr === 0 ? 0 : (~0 << (32 - row.cidr)) >>> 0
                  const wildcardInt = ~maskInt >>> 0
                  const mask = [
                    (maskInt >>> 24) & 255,
                    (maskInt >>> 16) & 255,
                    (maskInt >>> 8) & 255,
                    maskInt & 255,
                  ].join(".")
                  const wildcard = [
                    (wildcardInt >>> 24) & 255,
                    (wildcardInt >>> 16) & 255,
                    (wildcardInt >>> 8) & 255,
                    wildcardInt & 255,
                  ].join(".")
                  return (
                    <tr key={row.cidr} className="hover:bg-muted/50 border-b">
                      <td className="p-2">
                        <Badge variant="secondary">/{row.cidr}</Badge>
                      </td>
                      <td className="p-2 font-mono">{mask}</td>
                      <td className="p-2 font-mono">{wildcard}</td>
                      <td className="p-2">{row.hosts}</td>
                      <td className="text-muted-foreground p-2">{row.use}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
