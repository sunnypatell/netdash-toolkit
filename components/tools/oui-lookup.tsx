"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import {
  Search,
  Download,
  Info,
  Wifi,
  CheckCircle,
  AlertCircle,
  Copy,
  ExternalLink,
} from "lucide-react"

interface OUIResult {
  mac: string
  oui: string
  vendor: string
  found: boolean
  error?: string
}

interface LookupResult extends OUIResult {
  timestamp: number
}

export function OUILookup() {
  const [macInput, setMacInput] = useState("00:11:22:33:44:55")
  const [bulkInput, setBulkInput] = useState("")
  const [results, setResults] = useState<LookupResult[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const lookupOUIFromAPI = async (macAddress: string): Promise<OUIResult> => {
    try {
      // Clean and format MAC address
      const cleanMac = macAddress.replace(/[^0-9A-Fa-f]/g, "")
      if (cleanMac.length < 6) {
        throw new Error("MAC address too short")
      }

      // Extract OUI (first 6 characters)
      const oui = cleanMac.substring(0, 6).toUpperCase()
      const formattedOui = `${oui.substring(0, 2)}:${oui.substring(2, 4)}:${oui.substring(4, 6)}`

      // Try maclookup.app first (more reliable, has CORS support)
      try {
        const response = await fetch(`https://api.maclookup.app/v2/macs/${oui}`, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        })

        if (response.ok) {
          const data = await response.json()
          if (data.found && data.company) {
            return {
              mac: macAddress,
              oui: formattedOui,
              vendor: data.company,
              found: true,
            }
          }
        }
      } catch (primaryError) {
        console.warn("Primary API (maclookup.app) failed, trying fallback:", primaryError)
      }

      // Fallback to macvendors.com via CORS proxy
      const proxyUrl = "https://api.allorigins.win/get?url="
      const targetUrl = encodeURIComponent(`https://api.macvendors.com/${formattedOui}`)

      const response = await fetch(`${proxyUrl}${targetUrl}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        const vendor = data.contents?.trim() || "Unknown vendor"

        return {
          mac: macAddress,
          oui: formattedOui,
          vendor: vendor,
          found: vendor !== "Unknown vendor" && vendor !== "Not Found",
        }
      } else {
        throw new Error(`API error: ${response.status}`)
      }
    } catch (error) {
      console.error("OUI lookup error:", error)

      const oui = macAddress
        .replace(/[^0-9A-Fa-f]/g, "")
        .substring(0, 6)
        .toUpperCase()
      const vendor = getLocalOUIVendor(oui)

      return {
        mac: macAddress,
        oui: macAddress.substring(0, 8),
        vendor: vendor || "Lookup failed",
        found: !!vendor,
        error: vendor ? undefined : error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  const getLocalOUIVendor = (oui: string): string | null => {
    const localOUI: Record<string, string> = {
      // VMware
      "005056": "VMware",
      "000C29": "VMware",
      "001C14": "VMware",
      // Microsoft
      "00155D": "Microsoft Corporation",
      "0017FA": "Microsoft Corporation",
      "0003FF": "Microsoft Corporation",
      // Intel
      "001B21": "Intel Corporation",
      ACDE48: "Intel Corporation",
      "001302": "Intel Corporation",
      "001517": "Intel Corporation",
      "001676": "Intel Corporation",
      "0019D1": "Intel Corporation",
      "001E67": "Intel Corporation",
      "00216A": "Intel Corporation",
      "0024D7": "Intel Corporation",
      // VirtualBox/QEMU
      "080027": "Oracle VirtualBox",
      "525400": "QEMU/KVM",
      "001C42": "Parallels",
      "00163E": "Xensource (Citrix)",
      // Apple
      F01898: "Apple Inc",
      B42E99: "Apple Inc",
      "000393": "Apple Inc",
      "000502": "Apple Inc",
      "000A27": "Apple Inc",
      "000A95": "Apple Inc",
      "000D93": "Apple Inc",
      "001124": "Apple Inc",
      "001451": "Apple Inc",
      "0016CB": "Apple Inc",
      "0017F2": "Apple Inc",
      "0019E3": "Apple Inc",
      "001B63": "Apple Inc",
      "001EC2": "Apple Inc",
      "0021E9": "Apple Inc",
      "002312": "Apple Inc",
      "0023DF": "Apple Inc",
      "002500": "Apple Inc",
      "00254B": "Apple Inc",
      "0025BC": "Apple Inc",
      "002608": "Apple Inc",
      "00264A": "Apple Inc",
      "0026B0": "Apple Inc",
      "0026BB": "Apple Inc",
      // Cisco
      "00000C": "Cisco Systems",
      "000142": "Cisco Systems",
      "000143": "Cisco Systems",
      "000196": "Cisco Systems",
      "000197": "Cisco Systems",
      "000216": "Cisco Systems",
      "000217": "Cisco Systems",
      "00023D": "Cisco Systems",
      "00024A": "Cisco Systems",
      "00024B": "Cisco Systems",
      // Dell
      "001422": "Dell Inc",
      "001AA0": "Dell Inc",
      "00219B": "Dell Inc",
      "0023AE": "Dell Inc",
      "0024E8": "Dell Inc",
      "002564": "Dell Inc",
      "0026B9": "Dell Inc",
      B083FE: "Dell Inc",
      D067E5: "Dell Inc",
      F01FAF: "Dell Inc",
      // HP/HPE
      "001083": "Hewlett Packard Enterprise",
      "00110A": "Hewlett Packard Enterprise",
      "001321": "Hewlett Packard Enterprise",
      "001560": "Hewlett Packard Enterprise",
      "001635": "Hewlett Packard Enterprise",
      "001708": "Hewlett Packard Enterprise",
      "001871": "Hewlett Packard Enterprise",
      "0019BB": "Hewlett Packard Enterprise",
      "001A4B": "Hewlett Packard Enterprise",
      "001B78": "Hewlett Packard Enterprise",
      "001CC4": "Hewlett Packard Enterprise",
      "001E0B": "Hewlett Packard Enterprise",
      "001F29": "Hewlett Packard Enterprise",
      "00215A": "Hewlett Packard Enterprise",
      "002264": "Hewlett Packard Enterprise",
      "00237D": "Hewlett Packard Enterprise",
      "002481": "Hewlett Packard Enterprise",
      "0025B3": "Hewlett Packard Enterprise",
      "002655": "Hewlett Packard Enterprise",
      // Juniper
      "000585": "Juniper Networks",
      "00121E": "Juniper Networks",
      "0017CB": "Juniper Networks",
      "0019E2": "Juniper Networks",
      "001BC0": "Juniper Networks",
      "001DB5": "Juniper Networks",
      "002159": "Juniper Networks",
      "002283": "Juniper Networks",
      "00239C": "Juniper Networks",
      "0024DC": "Juniper Networks",
      "002688": "Juniper Networks",
      "2C6BF5": "Juniper Networks",
      "3C6104": "Juniper Networks",
      "5C5EAB": "Juniper Networks",
      "841888": "Juniper Networks",
      "84B59C": "Juniper Networks",
      "9CCC83": "Juniper Networks",
      // Arista
      "001C73": "Arista Networks",
      "28993A": "Arista Networks",
      "444CA8": "Arista Networks",
      "500800": "Arista Networks",
      // Fortinet
      "00090F": "Fortinet",
      "906CAC": "Fortinet",
      // Palo Alto
      "001B17": "Palo Alto Networks",
      "8CEA1B": "Palo Alto Networks",
      // Ubiquiti
      "00156D": "Ubiquiti Networks",
      "0418D6": "Ubiquiti Networks",
      "24A43C": "Ubiquiti Networks",
      "687251": "Ubiquiti Networks",
      "788A20": "Ubiquiti Networks",
      "802AA8": "Ubiquiti Networks",
      B4FBE4: "Ubiquiti Networks",
      DC9FDB: "Ubiquiti Networks",
      E8DE27: "Ubiquiti Networks",
      F09FC2: "Ubiquiti Networks",
      FCECDA: "Ubiquiti Networks",
      // Raspberry Pi
      DCA632: "Raspberry Pi Foundation",
      B827EB: "Raspberry Pi Foundation",
      E45F01: "Raspberry Pi Foundation",
      // Network Equipment
      "000496": "Extreme Networks",
      "00E02B": "Extreme Networks",
      "000130": "Foundry Networks",
      "00E052": "Foundry Networks",
      "00A0C9": "Intel Corporation",
      "00E081": "Tyan Computer",
      "0020AF": "3Com Corporation",
      "005004": "3Com Corporation",
      "006008": "3Com Corporation",
      "006097": "3Com Corporation",
      "00A024": "3Com Corporation",
      // Consumer Electronics
      "00E04C": "Realtek Semiconductor",
      "001217": "Cisco-Linksys",
      "00E018": "Asustek Computer",
      "001731": "Asustek Computer",
      "002354": "Asustek Computer",
      "485B39": "Asustek Computer",
      "00E09D": "Shandong Intelligent Optical",
      "001E58": "D-Link Corporation",
      "0019E0": "TP-Link Technologies",
      "5C899A": "TP-Link Technologies",
      E894F6: "TP-Link Technologies",
      "001438": "Hewlett Packard",
      "0015C5": "Dell",
      B8AC6F: "Dell",
      "0050F2": "Microsoft",
      "001DD8": "Microsoft",
      "7C1E52": "Microsoft",
      // Samsung
      "002119": "Samsung Electronics",
      "0021D1": "Samsung Electronics",
      "002339": "Samsung Electronics",
      "0024E9": "Samsung Electronics",
      "0025C3": "Samsung Electronics",
      "0026E2": "Samsung Electronics",
      "00265D": "Samsung Electronics",
      "5CCACF": "Samsung Electronics",
      "942E63": "Samsung Electronics",
      A82BB9: "Samsung Electronics",
      // Google
      "001A11": "Google",
      "3C5AB4": "Google",
      "54608B": "Google",
      "94EB2C": "Google",
      F4F5D8: "Google",
      // Amazon
      "0C47C9": "Amazon Technologies",
      "18742E": "Amazon Technologies",
      "34D270": "Amazon Technologies",
      "44650D": "Amazon Technologies",
      "68372B": "Amazon Technologies",
      "84D6D0": "Amazon Technologies",
      A002DC: "Amazon Technologies",
      FC65DE: "Amazon Technologies",
    }

    return localOUI[oui] || null
  }

  const handleSingleLookup = async () => {
    if (!macInput.trim()) return

    setIsLoading(true)
    try {
      const result = await lookupOUIFromAPI(macInput.trim())
      const lookupResult: LookupResult = {
        ...result,
        timestamp: Date.now(),
      }
      setResults([lookupResult])
    } catch (error) {
      console.error("Single lookup error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBulkLookup = async () => {
    const macs = bulkInput.split("\n").filter((line) => line.trim())
    if (macs.length === 0) return

    setIsLoading(true)
    try {
      const lookupResults: LookupResult[] = []

      // Process in batches to respect API rate limits (1 request per second)
      for (let i = 0; i < macs.length; i++) {
        const mac = macs[i].trim()
        if (mac) {
          const result = await lookupOUIFromAPI(mac)
          lookupResults.push({
            ...result,
            timestamp: Date.now(),
          })

          // Rate limiting: wait 1 second between requests (except for the last one)
          if (i < macs.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1100))
          }
        }
      }

      setResults(lookupResults)
    } catch (error) {
      console.error("Bulk lookup error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error("Failed to copy to clipboard:", err)
    }
  }

  const exportResults = () => {
    const data = {
      timestamp: new Date().toISOString(),
      totalResults: results.length,
      foundResults: results.filter((r) => r.found).length,
      results: results,
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `oui-lookup-results-${new Date().toISOString().split("T")[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportCSV = () => {
    const csv = [
      "MAC Address,OUI,Vendor,Found,Timestamp,Error",
      ...results.map(
        (r) =>
          `"${r.mac}","${r.oui}","${r.vendor}",${r.found},"${new Date(r.timestamp).toISOString()}","${r.error || ""}"`
      ),
    ].join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `oui-lookup-results-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const vendorStats = useMemo(() => {
    const stats: Record<string, number> = {}
    results.forEach((result) => {
      if (result.found) {
        stats[result.vendor] = (stats[result.vendor] || 0) + 1
      }
    })
    return Object.entries(stats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
  }, [results])

  const validateMacFormat = (mac: string): { isValid: boolean; format: string } => {
    const cleanMac = mac.replace(/[^0-9A-Fa-f]/g, "")
    if (cleanMac.length < 6) return { isValid: false, format: "Too short" }
    if (cleanMac.length === 12) return { isValid: true, format: "Full MAC" }
    if (cleanMac.length === 6) return { isValid: true, format: "OUI only" }
    return { isValid: false, format: "Invalid length" }
  }

  const macValidation = validateMacFormat(macInput)

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Wifi className="text-primary h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">OUI Lookup</h1>
          <p className="text-muted-foreground">
            Look up MAC address vendor information using the live macvendors.com API database
          </p>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Live API Integration:</strong> This tool uses maclookup.app as the primary API
          with macvendors.com as fallback. Over 50,000 vendor records available.{" "}
          <a
            href="https://maclookup.app/api-v2/documentation"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary inline-flex items-center hover:underline"
          >
            Learn more <ExternalLink className="ml-1 h-3 w-3" />
          </a>
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Single MAC Lookup</CardTitle>
              <CardDescription>
                Enter a MAC address to identify the vendor using live API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="mac-input">MAC Address</Label>
                <Input
                  id="mac-input"
                  value={macInput}
                  onChange={(e) => setMacInput(e.target.value)}
                  placeholder="00:11:22:33:44:55 or 001122334455"
                  onKeyDown={(e) => e.key === "Enter" && !isLoading && handleSingleLookup()}
                />
                <div className="mt-2 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    {macValidation.isValid ? (
                      <CheckCircle className="h-3 w-3 text-green-600" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-red-600" />
                    )}
                    <span className={macValidation.isValid ? "text-green-600" : "text-red-600"}>
                      {macValidation.format}
                    </span>
                  </div>
                  <span className="text-muted-foreground">
                    Supports: xx:xx:xx, xx-xx-xx, xxxxxx
                  </span>
                </div>
              </div>
              <Button
                onClick={handleSingleLookup}
                disabled={!macValidation.isValid || isLoading}
                className="w-full"
              >
                <Search className="mr-2 h-4 w-4" />
                {isLoading ? "Looking up..." : "Lookup Vendor"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bulk MAC Lookup</CardTitle>
              <CardDescription>
                Enter multiple MAC addresses (one per line) - Rate limited to 1/second
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="bulk-input">MAC Addresses</Label>
                <textarea
                  id="bulk-input"
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder="00:11:22:33:44:55&#10;00:50:56:aa:bb:cc&#10;08:00:27:dd:ee:ff&#10;001122334455"
                  className="h-32 w-full resize-none rounded-md border p-3 font-mono text-sm"
                />
                <div className="text-muted-foreground mt-1 text-xs">
                  {bulkInput.split("\n").filter((line) => line.trim()).length} addresses entered
                  {bulkInput.split("\n").filter((line) => line.trim()).length > 1 &&
                    ` (≈${bulkInput.split("\n").filter((line) => line.trim()).length} seconds)`}
                </div>
              </div>
              <Button
                onClick={handleBulkLookup}
                disabled={isLoading || !bulkInput.trim()}
                className="w-full"
              >
                <Search className="mr-2 h-4 w-4" />
                {isLoading ? "Processing..." : "Bulk Lookup"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>Primary API:</span>
                  <Badge variant="secondary">maclookup.app</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Fallback API:</span>
                  <Badge variant="outline">macvendors.com</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Database Size:</span>
                  <span className="text-muted-foreground">50,000+ vendors</span>
                </div>
                <div className="flex justify-between">
                  <span>Rate Limit:</span>
                  <span className="text-muted-foreground">1 request/second</span>
                </div>
                <div className="flex justify-between">
                  <span>Coverage:</span>
                  <span className="text-muted-foreground">Global OUI registry</span>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>• Real-time lookups</div>
                  <div>• IEEE OUI database</div>
                  <div>• Enterprise vendors</div>
                  <div>• Consumer devices</div>
                  <div>• Virtualization platforms</div>
                  <div>• Network equipment</div>
                  <div>• Mobile devices</div>
                  <div>• IoT manufacturers</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {results.length > 0 && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Lookup Results
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{results.length} total</Badge>
                      <Badge variant="secondary">
                        {results.filter((r) => r.found).length} found
                      </Badge>
                      {results.some((r) => r.error) && (
                        <Badge variant="destructive">
                          {results.filter((r) => r.error).length} errors
                        </Badge>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 space-y-3 overflow-y-auto">
                    {results.map((result, index) => (
                      <div
                        key={index}
                        className="hover:bg-muted/50 rounded-lg border p-3 transition-colors"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-sm">{result.mac}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(result.mac)}
                              className="h-6 w-6 p-0"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <Badge
                            variant={
                              result.found ? "default" : result.error ? "destructive" : "secondary"
                            }
                          >
                            {result.found ? "Found" : result.error ? "Error" : "Unknown"}
                          </Badge>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">OUI:</span>
                            <span className="font-mono">{result.oui || "N/A"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Vendor:</span>
                            <span
                              className={result.found ? "font-medium" : "text-muted-foreground"}
                            >
                              {result.vendor || "Not found in database"}
                            </span>
                          </div>
                          {result.error && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Error:</span>
                              <span className="text-xs text-red-600">{result.error}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Looked up:</span>
                            <span className="text-muted-foreground">
                              {new Date(result.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {vendorStats.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Vendor Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {vendorStats.map(([vendor, count]) => (
                        <div key={vendor} className="flex items-center justify-between">
                          <span className="mr-2 flex-1 truncate text-sm">{vendor}</span>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex space-x-2">
                <Button onClick={exportResults} variant="outline" className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Export JSON
                </Button>
                <Button onClick={exportCSV} variant="outline" className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Quick Test Samples</CardTitle>
              <CardDescription>Click to test common vendor MAC addresses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { oui: "00:50:56", vendor: "VMware", mac: "00:50:56:aa:bb:cc" },
                    { oui: "00:0C:29", vendor: "VMware", mac: "00:0C:29:dd:ee:ff" },
                    { oui: "00:1B:21", vendor: "Intel", mac: "00:1B:21:11:22:33" },
                    { oui: "00:15:5D", vendor: "Microsoft", mac: "00:15:5D:44:55:66" },
                    { oui: "08:00:27", vendor: "VirtualBox", mac: "08:00:27:77:88:99" },
                    { oui: "00:05:85", vendor: "Juniper", mac: "00:05:85:aa:bb:cc" },
                    { oui: "F0:18:98", vendor: "Apple", mac: "F0:18:98:dd:ee:ff" },
                    { oui: "00:1C:73", vendor: "Arista", mac: "00:1C:73:11:22:33" },
                  ].map(({ oui, vendor, mac }) => (
                    <div key={oui} className="flex items-center justify-between">
                      <button
                        onClick={() => setMacInput(mac)}
                        className="hover:text-primary cursor-pointer text-left font-mono transition-colors"
                      >
                        {oui}:xx:xx:xx
                      </button>
                      <span className="text-muted-foreground ml-2 truncate">{vendor}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
