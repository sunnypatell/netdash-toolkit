"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Activity,
  Globe,
  Wifi,
  Search,
  Zap,
  Play,
  StopCircle,
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  Upload,
} from "lucide-react"
import {
  testRTT,
  testDownloadThroughput,
  testUploadThroughput,
  queryDNSOverHTTPS,
  calculateMTU,
  lookupOUI,
  generateSolicitedNodeMulticast,
  generateEUI64FromMAC,
  protocolOverheads,
} from "@/lib/network-testing"
import type { RTTTestResult, ThroughputTestResult, DNSResult, MTUCalculation, OUIResult } from "@/lib/network-testing"

export function NetworkTester() {
  const [activeTest, setActiveTest] = useState<string | null>(null)
  const [rttResults, setRttResults] = useState<RTTTestResult[]>([])
  const [throughputResults, setThroughputResults] = useState<ThroughputTestResult[]>([])
  const [dnsResults, setDnsResults] = useState<DNSResult[]>([])
  const [mtuCalculation, setMtuCalculation] = useState<MTUCalculation | null>(null)
  const [ouiResult, setOuiResult] = useState<OUIResult | null>(null)

  // RTT Test State
  const [rttUrl, setRttUrl] = useState("https://www.google.com")
  const [rttMethod, setRttMethod] = useState<"HEAD" | "GET">("HEAD")
  const [rttSamples, setRttSamples] = useState("10")

  // Throughput Test State
  const [throughputUrl, setThroughputUrl] = useState("")
  const [uploadSize, setUploadSize] = useState("1048576") // 1MB

  // DNS Test State
  const [dnsQuery, setDnsQuery] = useState("example.com")
  const [dnsRecordType, setDnsRecordType] = useState("A")
  const [dnsProvider, setDnsProvider] = useState("cloudflare")

  // MTU Calculator State
  const [linkMTU, setLinkMTU] = useState("1500")
  const [selectedProtocols, setSelectedProtocols] = useState<string[]>(["Ethernet II", "IPv4", "TCP"])

  // OUI Lookup State
  const [macAddress, setMacAddress] = useState("")

  // IPv6 Tools State
  const [ipv6Address, setIpv6Address] = useState("2001:db8::1")
  const [macForEUI64, setMacForEUI64] = useState("00:11:22:33:44:55")
  const [ipv6Prefix, setIpv6Prefix] = useState("2001:db8::/64")

  const runRTTTest = async () => {
    if (!rttUrl) return

    setActiveTest("rtt")
    try {
      const result = await testRTT(rttUrl, rttMethod, Number.parseInt(rttSamples) || 10)
      setRttResults([result, ...rttResults.slice(0, 9)]) // Keep last 10 results
    } catch (error) {
      console.error("RTT test failed:", error)
    } finally {
      setActiveTest(null)
    }
  }

  const runThroughputTest = async (direction: "download" | "upload") => {
    if (!throughputUrl) return

    setActiveTest(`throughput-${direction}`)
    try {
      let result: ThroughputTestResult
      if (direction === "download") {
        result = await testDownloadThroughput(throughputUrl)
      } else {
        result = await testUploadThroughput(throughputUrl, Number.parseInt(uploadSize) || 1048576)
      }
      setThroughputResults([result, ...throughputResults.slice(0, 4)])
    } catch (error) {
      console.error("Throughput test failed:", error)
    } finally {
      setActiveTest(null)
    }
  }

  const runDNSQuery = async () => {
    if (!dnsQuery) return

    setActiveTest("dns")
    try {
      const result = await queryDNSOverHTTPS(dnsQuery, dnsRecordType, dnsProvider)
      setDnsResults([result, ...dnsResults.slice(0, 9)]) // Keep last 10 results
    } catch (error) {
      console.error("DNS query failed:", error)
    } finally {
      setActiveTest(null)
    }
  }

  const calculateMTUOverhead = () => {
    const protocols = selectedProtocols.map((name) => ({
      name,
      size: protocolOverheads[name as keyof typeof protocolOverheads] || 0,
    }))

    const calculation = calculateMTU(Number.parseInt(linkMTU) || 1500, protocols)
    setMtuCalculation(calculation)
  }

  const performOUILookup = () => {
    if (!macAddress) return
    const result = lookupOUI(macAddress)
    setOuiResult(result)
  }

  const formatDuration = (ms: number): string => {
    if (ms < 1) return `${(ms * 1000).toFixed(1)}μs`
    if (ms < 1000) return `${ms.toFixed(1)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatThroughput = (mbps: number): string => {
    if (mbps < 1) return `${(mbps * 1000).toFixed(1)} Kbps`
    if (mbps < 1000) return `${mbps.toFixed(2)} Mbps`
    return `${(mbps / 1000).toFixed(2)} Gbps`
  }

  const renderRTTResults = () => {
    if (rttResults.length === 0) return null

    return (
      <div className="space-y-4">
        <h4 className="font-semibold">Recent Results</h4>
        {rttResults.map((result, index) => (
          <Card key={index} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                {result.success ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600" />
                )}
                <span className="font-mono text-sm">{result.url}</span>
                <Badge variant="outline">{result.method}</Badge>
                {result.packetLoss > 0 && <Badge variant="destructive">{result.packetLoss.toFixed(1)}% loss</Badge>}
              </div>
              <span className="text-xs text-muted-foreground">{new Date(result.timestamp).toLocaleTimeString()}</span>
            </div>

            {result.success ? (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Median:</span>
                  <div className="font-mono font-semibold">{formatDuration(result.median)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Average:</span>
                  <div className="font-mono">{formatDuration(result.average)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Jitter:</span>
                  <div className="font-mono">{formatDuration(result.jitter)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Min:</span>
                  <div className="font-mono">{formatDuration(result.min)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Max:</span>
                  <div className="font-mono">{formatDuration(result.max)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">P95:</span>
                  <div className="font-mono">{formatDuration(result.p95)}</div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-red-600">{result.error}</div>
            )}
          </Card>
        ))}
      </div>
    )
  }

  const renderDNSResults = () => {
    if (dnsResults.length === 0) return null

    return (
      <div className="space-y-4">
        <h4 className="font-semibold">Recent Queries</h4>
        {dnsResults.map((result, index) => (
          <Card key={index} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                {result.success ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600" />
                )}
                <span className="font-mono">{result.domain}</span>
                <Badge variant="outline">{result.recordType}</Badge>
                <Badge variant="secondary">{result.provider}</Badge>
                {result.dnssec && <Badge variant="outline">DNSSEC</Badge>}
                {result.success && <Badge variant="outline">{formatDuration(result.responseTime)}</Badge>}
              </div>
              <span className="text-xs text-muted-foreground">{new Date(result.timestamp).toLocaleTimeString()}</span>
            </div>

            {result.success ? (
              result.records.length > 0 ? (
                <div className="space-y-2">
                  {result.records.map((record, recordIndex) => (
                    <div key={recordIndex} className="p-2 bg-muted/50 rounded text-sm font-mono">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                        <div>
                          <span className="text-muted-foreground">Name:</span> {record.name}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Type:</span> {record.type}
                        </div>
                        <div>
                          <span className="text-muted-foreground">TTL:</span> {record.ttl}s
                        </div>
                        <div className="md:col-span-1">
                          <span className="text-muted-foreground">Data:</span>
                          <div className="break-all">{record.data}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No records found</div>
              )
            ) : (
              <div className="text-sm text-red-600">{result.error}</div>
            )}
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Activity className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Network Testing Tools</h1>
          <p className="text-muted-foreground">Test RTT, throughput, DNS resolution, and network utilities</p>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Browser Limitations:</strong> These tests use HTTP requests and are subject to CORS policies. For
          accurate network testing, use dedicated tools or configure test endpoints with proper CORS headers.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="rtt" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="rtt">RTT Test</TabsTrigger>
          <TabsTrigger value="throughput">Throughput</TabsTrigger>
          <TabsTrigger value="dns">DNS Tools</TabsTrigger>
          <TabsTrigger value="mtu">MTU Calc</TabsTrigger>
          <TabsTrigger value="oui">OUI Lookup</TabsTrigger>
          <TabsTrigger value="ipv6">IPv6 Tools</TabsTrigger>
        </TabsList>

        <TabsContent value="rtt" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="w-5 h-5" />
                <span>Round Trip Time (RTT) Testing</span>
              </CardTitle>
              <CardDescription>Measure HTTP response times with jitter and packet loss analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="rtt-url">Test URL</Label>
                  <Input
                    id="rtt-url"
                    placeholder="https://example.com"
                    value={rttUrl}
                    onChange={(e) => setRttUrl(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Method</Label>
                  <Select value={rttMethod} onValueChange={(value: "HEAD" | "GET") => setRttMethod(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HEAD">HEAD (faster)</SelectItem>
                      <SelectItem value="GET">GET (full request)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="rtt-samples">Samples</Label>
                  <Input
                    id="rtt-samples"
                    type="number"
                    min="1"
                    max="50"
                    value={rttSamples}
                    onChange={(e) => setRttSamples(e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={runRTTTest} disabled={!rttUrl || activeTest === "rtt"} className="w-full">
                {activeTest === "rtt" ? (
                  <>
                    <StopCircle className="w-4 h-4 mr-2" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start RTT Test
                  </>
                )}
              </Button>

              {renderRTTResults()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="throughput" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="w-5 h-5" />
                <span>Throughput Testing</span>
              </CardTitle>
              <CardDescription>Measure download and upload speeds to test endpoints</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="throughput-url">Test URL</Label>
                  <Input
                    id="throughput-url"
                    placeholder="https://example.com/testfile"
                    value={throughputUrl}
                    onChange={(e) => setThroughputUrl(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="upload-size">Upload Size (bytes)</Label>
                  <Input
                    id="upload-size"
                    type="number"
                    value={uploadSize}
                    onChange={(e) => setUploadSize(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex space-x-2">
                <Button
                  onClick={() => runThroughputTest("download")}
                  disabled={!throughputUrl || activeTest?.startsWith("throughput")}
                  className="flex-1"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Test
                </Button>
                <Button
                  onClick={() => runThroughputTest("upload")}
                  disabled={!throughputUrl || activeTest?.startsWith("throughput")}
                  className="flex-1"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Test
                </Button>
              </div>

              {activeTest?.startsWith("throughput") && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-4 h-4 animate-spin" />
                    <span>Running {activeTest.split("-")[1]} test...</span>
                  </div>
                  <Progress value={50} className="w-full" />
                </div>
              )}

              {throughputResults.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-semibold">Recent Results</h4>
                  {throughputResults.map((result, index) => (
                    <Card key={index} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {result.success ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-600" />
                          )}
                          <span className="font-mono text-sm">{result.url}</span>
                          <Badge variant={result.direction === "download" ? "secondary" : "outline"}>
                            {result.direction}
                          </Badge>
                        </div>
                      </div>

                      {result.success ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Throughput:</span>
                            <div className="font-mono font-semibold">{formatThroughput(result.throughputMbps)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Data Transferred:</span>
                            <div className="font-mono">{(result.bytesTransferred / 1024 / 1024).toFixed(2)} MB</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Duration:</span>
                            <div className="font-mono">{formatDuration(result.durationMs)}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-red-600">{result.error}</div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dns" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Globe className="w-5 h-5" />
                <span>DNS over HTTPS</span>
              </CardTitle>
              <CardDescription>Query DNS records using secure DNS over HTTPS providers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="dns-query">Domain</Label>
                  <Input
                    id="dns-query"
                    placeholder="example.com"
                    value={dnsQuery}
                    onChange={(e) => setDnsQuery(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Record Type</Label>
                  <Select value={dnsRecordType} onValueChange={setDnsRecordType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A (IPv4)</SelectItem>
                      <SelectItem value="AAAA">AAAA (IPv6)</SelectItem>
                      <SelectItem value="CNAME">CNAME</SelectItem>
                      <SelectItem value="MX">MX (Mail)</SelectItem>
                      <SelectItem value="NS">NS (Name Server)</SelectItem>
                      <SelectItem value="TXT">TXT</SelectItem>
                      <SelectItem value="SOA">SOA</SelectItem>
                      <SelectItem value="PTR">PTR (Reverse)</SelectItem>
                      <SelectItem value="SRV">SRV (Service)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Provider</Label>
                  <Select value={dnsProvider} onValueChange={setDnsProvider}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cloudflare">Cloudflare (1.1.1.1)</SelectItem>
                      <SelectItem value="google">Google (8.8.8.8)</SelectItem>
                      <SelectItem value="quad9">Quad9 (9.9.9.9)</SelectItem>
                      <SelectItem value="opendns">OpenDNS</SelectItem>
                      <SelectItem value="adguard">AdGuard DNS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={runDNSQuery} disabled={!dnsQuery || activeTest === "dns"} className="w-full">
                    {activeTest === "dns" ? (
                      <>
                        <Activity className="w-4 h-4 mr-2 animate-spin" />
                        Querying...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4 mr-2" />
                        Query DNS
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {renderDNSResults()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mtu" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Wifi className="w-5 h-5" />
                <span>MTU Calculator</span>
              </CardTitle>
              <CardDescription>Calculate MTU and header overhead for network stacks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="link-mtu">Link MTU</Label>
                  <Input
                    id="link-mtu"
                    type="number"
                    value={linkMTU}
                    onChange={(e) => setLinkMTU(e.target.value)}
                    placeholder="1500"
                  />
                </div>
                <div>
                  <Label>Protocol Stack</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Object.keys(protocolOverheads).map((protocol) => (
                      <Badge
                        key={protocol}
                        variant={selectedProtocols.includes(protocol) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          if (selectedProtocols.includes(protocol)) {
                            setSelectedProtocols(selectedProtocols.filter((p) => p !== protocol))
                          } else {
                            setSelectedProtocols([...selectedProtocols, protocol])
                          }
                        }}
                      >
                        {protocol} ({protocolOverheads[protocol as keyof typeof protocolOverheads]}B)
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <Button onClick={calculateMTUOverhead} className="w-full">
                Calculate MTU
              </Button>

              {mtuCalculation && (
                <Card className="p-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{mtuCalculation.linkMTU}</div>
                        <div className="text-sm text-muted-foreground">Link MTU</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">{mtuCalculation.totalOverhead}</div>
                        <div className="text-sm text-muted-foreground">Total Overhead</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{mtuCalculation.payloadMTU}</div>
                        <div className="text-sm text-muted-foreground">Payload MTU</div>
                      </div>
                    </div>

                    {mtuCalculation.fragmentationWarning && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Warning: Payload MTU is below IPv6 minimum (1280 bytes). Fragmentation may occur.
                        </AlertDescription>
                      </Alert>
                    )}

                    <Separator />

                    <div>
                      <h5 className="font-medium mb-2">Protocol Breakdown</h5>
                      <div className="space-y-1">
                        {mtuCalculation.headers.map((header, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>{header.name}</span>
                            <span className="font-mono">{header.size} bytes</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="oui" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Search className="w-5 h-5" />
                <span>OUI Lookup</span>
              </CardTitle>
              <CardDescription>Look up MAC address vendor information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  placeholder="00:11:22:33:44:55"
                  value={macAddress}
                  onChange={(e) => setMacAddress(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={performOUILookup} disabled={!macAddress}>
                  Lookup
                </Button>
              </div>

              {ouiResult && (
                <Card className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      {ouiResult.found ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-orange-600" />
                      )}
                      <span className="font-mono">{ouiResult.mac}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">OUI:</span>
                        <div className="font-mono">{ouiResult.oui || "Unknown"}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Vendor:</span>
                        <div>{ouiResult.vendor || "Not found in database"}</div>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ipv6" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="w-5 h-5" />
                <span>IPv6 Tools</span>
              </CardTitle>
              <CardDescription>IPv6 address manipulation and generation tools</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3">Solicited-Node Multicast</h4>
                <div className="flex space-x-2">
                  <Input
                    placeholder="2001:db8::1"
                    value={ipv6Address}
                    onChange={(e) => setIpv6Address(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => {
                      try {
                        const multicast = generateSolicitedNodeMulticast(ipv6Address)
                        alert(`Solicited-node multicast: ${multicast}`)
                      } catch (error) {
                        alert("Invalid IPv6 address")
                      }
                    }}
                  >
                    Generate
                  </Button>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-3">EUI-64 from MAC</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>MAC Address</Label>
                    <Input
                      placeholder="00:11:22:33:44:55"
                      value={macForEUI64}
                      onChange={(e) => setMacForEUI64(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>IPv6 Prefix</Label>
                    <Input
                      placeholder="2001:db8::/64"
                      value={ipv6Prefix}
                      onChange={(e) => setIpv6Prefix(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  onClick={() => {
                    try {
                      const eui64 = generateEUI64FromMAC(macForEUI64, ipv6Prefix)
                      alert(`EUI-64 address: ${eui64}`)
                    } catch (error) {
                      alert("Invalid MAC address or prefix")
                    }
                  }}
                  className="w-full mt-4"
                >
                  Generate EUI-64
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
