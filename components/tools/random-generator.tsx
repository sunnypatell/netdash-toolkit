"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Copy, Download, RefreshCw, Shuffle, Trash2 } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { useToast } from "@/hooks/use-toast"
import { SaveToProject } from "@/components/ui/save-to-project"

type IPType = "any" | "private-a" | "private-b" | "private-c" | "public" | "loopback" | "link-local"
type MACType = "unicast" | "multicast" | "local" | "universal"

interface GeneratedItem {
  value: string
  type: string
  timestamp: number
}

export function RandomGenerator() {
  const { toast } = useToast()

  // IP Generator state
  const [ipCount, setIpCount] = useState("10")
  const [ipType, setIpType] = useState<IPType>("any")
  const [generatedIPs, setGeneratedIPs] = useState<GeneratedItem[]>([])

  // MAC Generator state
  const [macCount, setMacCount] = useState("10")
  const [macType, setMacType] = useState<MACType>("unicast")
  const [macFormat, setMacFormat] = useState<"colon" | "dash" | "none">("colon")
  const [uppercase, setUppercase] = useState(true)
  const [generatedMACs, setGeneratedMACs] = useState<GeneratedItem[]>([])

  // IPv6 Generator state
  const [ipv6Count, setIpv6Count] = useState("10")
  const [ipv6Type, setIpv6Type] = useState<"global" | "ula" | "link-local">("global")
  const [generatedIPv6s, setGeneratedIPv6s] = useState<GeneratedItem[]>([])

  // Random helpers
  const randomByte = () => Math.floor(Math.random() * 256)
  const randomInRange = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min

  // Generate random IPv4
  const generateIPv4 = useCallback((): string => {
    let octets: number[]

    switch (ipType) {
      case "private-a":
        octets = [10, randomByte(), randomByte(), randomInRange(1, 254)]
        break
      case "private-b":
        octets = [172, randomInRange(16, 31), randomByte(), randomInRange(1, 254)]
        break
      case "private-c":
        octets = [192, 168, randomByte(), randomInRange(1, 254)]
        break
      case "loopback":
        octets = [127, randomByte(), randomByte(), randomInRange(1, 254)]
        break
      case "link-local":
        octets = [169, 254, randomByte(), randomInRange(1, 254)]
        break
      case "public": {
        // Generate public IP (avoid private, loopback, multicast, reserved)
        let first: number
        do {
          first = randomInRange(1, 223)
        } while (first === 10 || first === 127 || (first >= 172 && first <= 191) || first === 192)
        octets = [first, randomByte(), randomByte(), randomInRange(1, 254)]
        break
      }
      default:
        octets = [randomInRange(1, 223), randomByte(), randomByte(), randomInRange(1, 254)]
    }

    return octets.join(".")
  }, [ipType])

  // Generate random MAC
  const generateMAC = useCallback((): string => {
    const bytes: number[] = []

    // First byte determines unicast/multicast and local/universal
    let firstByte = randomByte()

    if (macType === "unicast") {
      firstByte &= 0xfe // Clear multicast bit (bit 0)
    } else if (macType === "multicast") {
      firstByte |= 0x01 // Set multicast bit
    }

    if (macType === "local") {
      firstByte |= 0x02 // Set locally administered bit
    } else if (macType === "universal") {
      firstByte &= 0xfd // Clear locally administered bit
    }

    bytes.push(firstByte)
    for (let i = 1; i < 6; i++) {
      bytes.push(randomByte())
    }

    const mac = bytes
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(macFormat === "colon" ? ":" : macFormat === "dash" ? "-" : "")

    return uppercase ? mac.toUpperCase() : mac.toLowerCase()
  }, [macType, macFormat, uppercase])

  // Generate random IPv6
  const generateIPv6 = useCallback((): string => {
    const segments: string[] = []

    switch (ipv6Type) {
      case "ula":
        // fd00::/8 - Unique Local Address
        segments.push("fd" + randomByte().toString(16).padStart(2, "0"))
        for (let i = 1; i < 8; i++) {
          segments.push(((randomByte() << 8) | randomByte()).toString(16).padStart(4, "0"))
        }
        break
      case "link-local":
        // fe80::/10
        segments.push("fe80")
        segments.push("0000", "0000", "0000")
        for (let i = 4; i < 8; i++) {
          segments.push(((randomByte() << 8) | randomByte()).toString(16).padStart(4, "0"))
        }
        break
      default:
        // Global unicast 2000::/3
        segments.push(
          "2" + randomInRange(0, 3).toString(16) + randomByte().toString(16).padStart(2, "0")
        )
        for (let i = 1; i < 8; i++) {
          segments.push(((randomByte() << 8) | randomByte()).toString(16).padStart(4, "0"))
        }
    }

    return segments.join(":")
  }, [ipv6Type])

  // Batch generators
  const generateIPv4Batch = () => {
    const count = Math.min(parseInt(ipCount) || 10, 1000)
    const items: GeneratedItem[] = []
    const timestamp = Date.now()

    for (let i = 0; i < count; i++) {
      items.push({
        value: generateIPv4(),
        type: ipType,
        timestamp,
      })
    }

    setGeneratedIPs(items)
  }

  const generateMACBatch = () => {
    const count = Math.min(parseInt(macCount) || 10, 1000)
    const items: GeneratedItem[] = []
    const timestamp = Date.now()

    for (let i = 0; i < count; i++) {
      items.push({
        value: generateMAC(),
        type: macType,
        timestamp,
      })
    }

    setGeneratedMACs(items)
  }

  const generateIPv6Batch = () => {
    const count = Math.min(parseInt(ipv6Count) || 10, 1000)
    const items: GeneratedItem[] = []
    const timestamp = Date.now()

    for (let i = 0; i < count; i++) {
      items.push({
        value: generateIPv6(),
        type: ipv6Type,
        timestamp,
      })
    }

    setGeneratedIPv6s(items)
  }

  // Copy and export helpers
  const copyToClipboard = async (items: GeneratedItem[]) => {
    try {
      await navigator.clipboard.writeText(items.map((i) => i.value).join("\n"))
      toast({ title: "Copied", description: `${items.length} items copied` })
    } catch {
      toast({ title: "Copy failed", variant: "destructive" })
    }
  }

  const exportItems = (items: GeneratedItem[], filename: string) => {
    const csv = items.map((i) => i.value).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const ResultList = ({
    items,
    onCopy,
    onExport,
    onClear,
    filename,
  }: {
    items: GeneratedItem[]
    onCopy: () => void
    onExport: () => void
    onClear: () => void
    filename: string
  }) => (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onCopy} disabled={items.length === 0}>
          <Copy className="mr-2 h-4 w-4" />
          Copy All
        </Button>
        <Button variant="outline" size="sm" onClick={onExport} disabled={items.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
        <Button variant="outline" size="sm" onClick={onClear} disabled={items.length === 0}>
          <Trash2 className="mr-2 h-4 w-4" />
          Clear
        </Button>
      </div>

      {items.length > 0 ? (
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-3">
          {items.map((item, index) => (
            <div
              key={index}
              className="hover:bg-muted/50 rounded px-2 py-1 font-mono text-sm break-all"
            >
              {item.value}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-lg border">
          <p className="text-muted-foreground text-sm">Click Generate to create random addresses</p>
        </div>
      )}

      {items.length > 0 && (
        <p className="text-muted-foreground text-xs">{items.length} items generated</p>
      )}
    </div>
  )

  const allItems = [...generatedIPs, ...generatedMACs, ...generatedIPv6s]

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Shuffle}
        title="Random Generator"
        description="Generate random IPv4, IPv6, and MAC addresses for testing and development"
        actions={
          allItems.length > 0 ? (
            <SaveToProject
              itemType="random-gen"
              itemName={`${allItems.length} generated addresses`}
              itemData={{
                ipv4: generatedIPs.map((i) => i.value),
                ipv6: generatedIPv6s.map((i) => i.value),
                mac: generatedMACs.map((i) => i.value),
              }}
              toolSource="Random Generator"
              size="sm"
            />
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* IPv4 Generator */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>IPv4 Addresses</span>
              <Badge variant="secondary">{generatedIPs.length}</Badge>
            </CardTitle>
            <CardDescription>Generate random IPv4 addresses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="ip-count">Count</Label>
              <Input
                id="ip-count"
                type="number"
                min="1"
                max="1000"
                value={ipCount}
                onChange={(e) => setIpCount(e.target.value)}
              />
            </div>

            <div>
              <Label>Address Type</Label>
              <Select value={ipType} onValueChange={(v) => setIpType(v as IPType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="private-a">Private Class A (10.x.x.x)</SelectItem>
                  <SelectItem value="private-b">Private Class B (172.16-31.x.x)</SelectItem>
                  <SelectItem value="private-c">Private Class C (192.168.x.x)</SelectItem>
                  <SelectItem value="public">Public Only</SelectItem>
                  <SelectItem value="loopback">Loopback (127.x.x.x)</SelectItem>
                  <SelectItem value="link-local">Link-local (169.254.x.x)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={generateIPv4Batch} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Generate IPv4
            </Button>

            <ResultList
              items={generatedIPs}
              onCopy={() => copyToClipboard(generatedIPs)}
              onExport={() => exportItems(generatedIPs, "random-ipv4.csv")}
              onClear={() => setGeneratedIPs([])}
              filename="random-ipv4.csv"
            />
          </CardContent>
        </Card>

        {/* MAC Generator */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>MAC Addresses</span>
              <Badge variant="secondary">{generatedMACs.length}</Badge>
            </CardTitle>
            <CardDescription>Generate random MAC addresses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="mac-count">Count</Label>
              <Input
                id="mac-count"
                type="number"
                min="1"
                max="1000"
                value={macCount}
                onChange={(e) => setMacCount(e.target.value)}
              />
            </div>

            <div>
              <Label>MAC Type</Label>
              <Select value={macType} onValueChange={(v) => setMacType(v as MACType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unicast">Unicast</SelectItem>
                  <SelectItem value="multicast">Multicast</SelectItem>
                  <SelectItem value="local">Locally Administered</SelectItem>
                  <SelectItem value="universal">Universally Administered</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Format</Label>
              <Select value={macFormat} onValueChange={(v) => setMacFormat(v as typeof macFormat)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="colon">Colon (AA:BB:CC:DD:EE:FF)</SelectItem>
                  <SelectItem value="dash">Dash (AA-BB-CC-DD-EE-FF)</SelectItem>
                  <SelectItem value="none">None (AABBCCDDEEFF)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="uppercase"
                checked={uppercase}
                onCheckedChange={(c) => setUppercase(c === true)}
              />
              <Label htmlFor="uppercase" className="text-sm font-normal">
                Uppercase
              </Label>
            </div>

            <Button onClick={generateMACBatch} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Generate MAC
            </Button>

            <ResultList
              items={generatedMACs}
              onCopy={() => copyToClipboard(generatedMACs)}
              onExport={() => exportItems(generatedMACs, "random-mac.csv")}
              onClear={() => setGeneratedMACs([])}
              filename="random-mac.csv"
            />
          </CardContent>
        </Card>

        {/* IPv6 Generator */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>IPv6 Addresses</span>
              <Badge variant="secondary">{generatedIPv6s.length}</Badge>
            </CardTitle>
            <CardDescription>Generate random IPv6 addresses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="ipv6-count">Count</Label>
              <Input
                id="ipv6-count"
                type="number"
                min="1"
                max="1000"
                value={ipv6Count}
                onChange={(e) => setIpv6Count(e.target.value)}
              />
            </div>

            <div>
              <Label>Address Type</Label>
              <Select value={ipv6Type} onValueChange={(v) => setIpv6Type(v as typeof ipv6Type)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global Unicast (2000::/3)</SelectItem>
                  <SelectItem value="ula">Unique Local (fd00::/8)</SelectItem>
                  <SelectItem value="link-local">Link-Local (fe80::/10)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={generateIPv6Batch} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Generate IPv6
            </Button>

            <ResultList
              items={generatedIPv6s}
              onCopy={() => copyToClipboard(generatedIPv6s)}
              onExport={() => exportItems(generatedIPv6s, "random-ipv6.csv")}
              onClear={() => setGeneratedIPv6s([])}
              filename="random-ipv6.csv"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Address Type Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 text-sm md:grid-cols-3">
            <div>
              <h4 className="mb-2 font-semibold">IPv4 Ranges</h4>
              <ul className="text-muted-foreground space-y-1">
                <li>
                  • <strong>Private A:</strong> 10.0.0.0/8
                </li>
                <li>
                  • <strong>Private B:</strong> 172.16.0.0/12
                </li>
                <li>
                  • <strong>Private C:</strong> 192.168.0.0/16
                </li>
                <li>
                  • <strong>Loopback:</strong> 127.0.0.0/8
                </li>
                <li>
                  • <strong>Link-local:</strong> 169.254.0.0/16
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-2 font-semibold">MAC Address Bits</h4>
              <ul className="text-muted-foreground space-y-1">
                <li>
                  • <strong>Bit 0:</strong> Unicast (0) / Multicast (1)
                </li>
                <li>
                  • <strong>Bit 1:</strong> Universal (0) / Local (1)
                </li>
                <li>
                  • <strong>Unicast:</strong> Normal device MAC
                </li>
                <li>
                  • <strong>Local:</strong> Software-assigned
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-2 font-semibold">IPv6 Ranges</h4>
              <ul className="text-muted-foreground space-y-1">
                <li>
                  • <strong>Global:</strong> 2000::/3
                </li>
                <li>
                  • <strong>ULA:</strong> fc00::/7 (fd00::/8 used)
                </li>
                <li>
                  • <strong>Link-local:</strong> fe80::/10
                </li>
                <li>
                  • <strong>Multicast:</strong> ff00::/8
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
