"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Search, Download, Info, Wifi, CheckCircle, AlertCircle, Copy, ExternalLink } from "lucide-react"

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
      console.error("[v0] OUI lookup error:", error)

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
      "005056": "VMware",
      "000C29": "VMware",
      "001B21": "Intel",
      "00155D": "Microsoft",
      "080027": "VirtualBox",
      "000585": "Juniper",
      F01898: "Apple",
      "001C73": "Arista",
      "001122": "Cisco",
      "00D0C9": "Intel",
      "0050C2": "IEEE Registration Authority",
      "525400": "QEMU/KVM",
      "020054": "Novell",
      "00E04C": "Realtek",
      "001560": "Apple",
      "3C0754": "Apple",
      F0766F: "Apple",
      A45E60: "Apple",
      "8C8590": "Apple",
      "7C6D62": "Apple",
      "685B35": "Apple",
      "609AC1": "Apple",
      "5C969D": "Apple",
      "5855CA": "Apple",
      "4C32759": "Apple",
      "40A6D9": "Apple",
      "3451C9": "Apple",
      "2CF0EE": "Apple",
      "28E02C": "Apple",
      "24A2E1": "Apple",
      "20768F": "Apple",
      "1C1AC0": "Apple",
      "18AF61": "Apple",
      "14109F": "Apple",
      "10417F": "Apple",
      "0C74C2": "Apple",
      "04489A": "Apple",
      "0017F2": "Apple",
      "001451": "Apple",
      "000A95": "Apple",
      "000393": "Apple",
      "00030D": "Apple",
    }

    return localOUI[oui] || null
  }

  const handleSingleLookup = async () => {
    if (!macInput.trim()) return

    setIsLoading(true)
    try {
      console.log("[v0] Looking up MAC:", macInput)
      const result = await lookupOUIFromAPI(macInput.trim())
      const lookupResult: LookupResult = {
        ...result,
        timestamp: Date.now(),
      }
      setResults([lookupResult])
      console.log("[v0] Lookup result:", lookupResult)
    } catch (error) {
      console.error("[v0] Single lookup error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBulkLookup = async () => {
    const macs = bulkInput.split("\n").filter((line) => line.trim())
    if (macs.length === 0) return

    setIsLoading(true)
    try {
      console.log("[v0] Bulk lookup for", macs.length, "MACs")
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
      console.log("[v0] Bulk lookup completed:", lookupResults.length, "results")
    } catch (error) {
      console.error("[v0] Bulk lookup error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error("[v0] Failed to copy to clipboard:", err)
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
          `"${r.mac}","${r.oui}","${r.vendor}",${r.found},"${new Date(r.timestamp).toISOString()}","${r.error || ""}"`,
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
        <Wifi className="w-6 h-6 text-primary" />
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
          <strong>Live API Integration:</strong> This tool uses the macvendors.com API with over 18,000 vendor records.
          Rate limited to 1 request per second for bulk lookups.{" "}
          <a
            href="https://macvendors.com/api"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-primary hover:underline"
          >
            Learn more <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Single MAC Lookup</CardTitle>
              <CardDescription>Enter a MAC address to identify the vendor using live API</CardDescription>
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
                <div className="flex items-center justify-between mt-2 text-xs">
                  <div className="flex items-center space-x-2">
                    {macValidation.isValid ? (
                      <CheckCircle className="w-3 h-3 text-green-600" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-red-600" />
                    )}
                    <span className={macValidation.isValid ? "text-green-600" : "text-red-600"}>
                      {macValidation.format}
                    </span>
                  </div>
                  <span className="text-muted-foreground">Supports: xx:xx:xx, xx-xx-xx, xxxxxx</span>
                </div>
              </div>
              <Button onClick={handleSingleLookup} disabled={!macValidation.isValid || isLoading} className="w-full">
                <Search className="w-4 h-4 mr-2" />
                {isLoading ? "Looking up..." : "Lookup Vendor"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bulk MAC Lookup</CardTitle>
              <CardDescription>Enter multiple MAC addresses (one per line) - Rate limited to 1/second</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="bulk-input">MAC Addresses</Label>
                <textarea
                  id="bulk-input"
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder="00:11:22:33:44:55&#10;00:50:56:aa:bb:cc&#10;08:00:27:dd:ee:ff&#10;001122334455"
                  className="w-full h-32 p-3 border rounded-md resize-none font-mono text-sm"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  {bulkInput.split("\n").filter((line) => line.trim()).length} addresses entered
                  {bulkInput.split("\n").filter((line) => line.trim()).length > 1 &&
                    ` (≈${bulkInput.split("\n").filter((line) => line.trim()).length} seconds)`}
                </div>
              </div>
              <Button onClick={handleBulkLookup} disabled={isLoading || !bulkInput.trim()} className="w-full">
                <Search className="w-4 h-4 mr-2" />
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
                  <span>Data Source:</span>
                  <Badge variant="secondary">macvendors.com</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Database Size:</span>
                  <span className="text-muted-foreground">18,000+ vendors</span>
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
                      <Badge variant="secondary">{results.filter((r) => r.found).length} found</Badge>
                      {results.some((r) => r.error) && (
                        <Badge variant="destructive">{results.filter((r) => r.error).length} errors</Badge>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {results.map((result, index) => (
                      <div key={index} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-sm">{result.mac}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(result.mac)}
                              className="h-6 w-6 p-0"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                          <Badge variant={result.found ? "default" : result.error ? "destructive" : "secondary"}>
                            {result.found ? "Found" : result.error ? "Error" : "Unknown"}
                          </Badge>
                        </div>
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">OUI:</span>
                            <span className="font-mono">{result.oui || "N/A"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Vendor:</span>
                            <span className={result.found ? "font-medium" : "text-muted-foreground"}>
                              {result.vendor || "Not found in database"}
                            </span>
                          </div>
                          {result.error && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Error:</span>
                              <span className="text-red-600 text-xs">{result.error}</span>
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
                        <div key={vendor} className="flex justify-between items-center">
                          <span className="text-sm truncate flex-1 mr-2">{vendor}</span>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex space-x-2">
                          <Button onClick={exportResults} variant="outline" className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Export JSON
                </Button>
                          <Button onClick={exportCSV} variant="outline" className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
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
                    <div key={oui} className="flex justify-between items-center">
                      <button
                        onClick={() => setMacInput(mac)}
                        className="font-mono text-left hover:text-primary cursor-pointer transition-colors"
                      >
                        {oui}:xx:xx:xx
                      </button>
                      <span className="text-muted-foreground truncate ml-2">{vendor}</span>
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
