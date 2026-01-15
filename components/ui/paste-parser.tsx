"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, FileText, AlertCircle } from "lucide-react"
import { autoParseNetworkData } from "@/lib/parsers"
import type { ParsedARPEntry, ParsedDHCPLease, ParsedMACEntry } from "@/lib/parsers"

interface PasteParserProps {
  onDataParsed: (data: (ParsedARPEntry | ParsedDHCPLease | ParsedMACEntry)[]) => void
}

export function PasteParser({ onDataParsed }: PasteParserProps) {
  const [inputText, setInputText] = useState("")
  const [parsedData, setParsedData] = useState<
    (ParsedARPEntry | ParsedDHCPLease | ParsedMACEntry)[]
  >([])
  const [isLoading, setIsLoading] = useState(false)

  const handleParse = async () => {
    if (!inputText.trim()) return

    setIsLoading(true)
    try {
      const data = autoParseNetworkData(inputText)
      setParsedData(data)
      onDataParsed(data)
    } catch (error) {
      console.error("Parsing error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setInputText(text)
    }
    reader.readAsText(file)
  }

  const sampleFormats = {
    windowsARP: `Interface: 192.168.1.10 --- 0x13
  Internet Address      Physical Address      Type
  192.168.1.1           00-11-22-33-44-55     dynamic
  192.168.1.50          aa-bb-cc-dd-ee-ff     dynamic
  192.168.1.100         11-22-33-44-55-66     static`,

    linuxARP: `192.168.1.1 dev eth0 lladdr 00:11:22:33:44:55 REACHABLE
192.168.1.50 dev eth0 lladdr aa:bb:cc:dd:ee:ff STALE
192.168.1.100 dev eth0 lladdr 11:22:33:44:55:66 PERMANENT`,

    ciscoARP: `Internet  192.168.1.1             -   0011.2233.4455  ARPA   Vlan1
Internet  192.168.1.50            -   aabb.ccdd.eeff  ARPA   Vlan1
Internet  192.168.1.100           -   1122.3344.5566  ARPA   Vlan10`,

    ciscoMAC: `Mac Address Table
-------------------------------------------
Vlan    Mac Address       Type        Ports
----    -----------       --------    -----
   1    0011.2233.4455    DYNAMIC     Gi0/1
   1    aabb.ccdd.eeff    DYNAMIC     Gi0/2
  10    1122.3344.5566    STATIC      Gi0/10`,

    juniperARP: `192.168.1.1      00:11:22:33:44:55  none     ge-0/0/1.0
192.168.1.50     aa:bb:cc:dd:ee:ff  none     ge-0/0/2.0
192.168.1.100    11:22:33:44:55:66  none     ge-0/0/10.0`,

    dhcpCSV: `LeaseStart,LeaseEnd,IP,MAC,Hostname,VLAN,ScopeName
2024-01-01 10:00:00,2024-01-02 10:00:00,192.168.1.100,00:11:22:33:44:55,FILESERVER-01,10,Main
2024-01-01 11:00:00,2024-01-02 11:00:00,192.168.1.101,aa:bb:cc:dd:ee:ff,WORKSTATION-02,10,Main`,

    windowsDHCP: `192.168.1.100,00-11-22-33-44-55,FILESERVER-01,01/01/2024 10:00:00,01/02/2024 10:00:00
192.168.1.101,aa-bb-cc-dd-ee-ff,WORKSTATION-02,01/01/2024 11:00:00,01/02/2024 11:00:00`,

    iscDHCP: `lease 192.168.1.100 {
  starts 1 2024/01/01 10:00:00;
  ends 2 2024/01/02 10:00:00;
  hardware ethernet 00:11:22:33:44:55;
  client-hostname "FILESERVER-01";
}`,
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Network Data Parser</span>
          </CardTitle>
          <CardDescription>
            Paste network data from ARP tables, DHCP leases, MAC tables, or upload CSV files
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="paste" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="paste">Paste Data</TabsTrigger>
              <TabsTrigger value="upload">Upload File</TabsTrigger>
            </TabsList>

            <TabsContent value="paste" className="space-y-4">
              <Textarea
                placeholder="Paste your network data here (ARP tables, DHCP leases, MAC tables, etc.)"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
            </TabsContent>

            <TabsContent value="upload" className="space-y-4">
              <div className="border-border rounded-lg border-2 border-dashed p-6 text-center">
                <Upload className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
                <p className="text-muted-foreground mb-2 text-sm">
                  Upload a CSV or text file containing network data
                </p>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById("file-upload")?.click()}
                >
                  Choose File
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <Button
            onClick={handleParse}
            disabled={!inputText.trim() || isLoading}
            className="w-full"
          >
            {isLoading ? "Parsing..." : "Parse Data"}
          </Button>

          {parsedData.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Parsed Results</span>
                <Badge variant="secondary">{parsedData.length} entries</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(
                  parsedData.reduce(
                    (acc, item) => {
                      acc[item.source] = (acc[item.source] || 0) + 1
                      return acc
                    },
                    {} as Record<string, number>
                  )
                ).map(([source, count]) => (
                  <Badge key={source} variant="outline">
                    {source}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5" />
            <span>Supported Formats</span>
          </CardTitle>
          <CardDescription>Examples of supported network data formats</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="windows-arp" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="windows-arp">Windows ARP</TabsTrigger>
              <TabsTrigger value="linux-arp">Linux ARP</TabsTrigger>
              <TabsTrigger value="cisco-arp">Cisco ARP</TabsTrigger>
              <TabsTrigger value="cisco-mac">Cisco MAC</TabsTrigger>
            </TabsList>

            <TabsContent value="windows-arp">
              <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs">
                {sampleFormats.windowsARP}
              </pre>
            </TabsContent>
            <TabsContent value="linux-arp">
              <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs">
                {sampleFormats.linuxARP}
              </pre>
            </TabsContent>
            <TabsContent value="cisco-arp">
              <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs">
                {sampleFormats.ciscoARP}
              </pre>
            </TabsContent>
            <TabsContent value="cisco-mac">
              <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs">
                {sampleFormats.ciscoMAC}
              </pre>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
