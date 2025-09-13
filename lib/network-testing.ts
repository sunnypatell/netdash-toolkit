// Network testing utilities for RTT, throughput, and connectivity

export interface RTTTestResult {
  url: string
  method: string
  samples: number[]
  median: number
  p95: number
  average: number
  min: number
  max: number
  jitter: number
  packetLoss: number
  success: boolean
  error?: string
  timestamp: number
}

export interface ThroughputTestResult {
  url: string
  direction: "download" | "upload"
  bytesTransferred: number
  durationMs: number
  throughputMbps: number
  success: boolean
  error?: string
  timestamp: number
}

export interface DNSResult {
  domain: string
  recordType: string
  records: Array<{
    name: string
    type: string
    ttl: number
    data: string
  }>
  provider: string
  dnssec: boolean
  responseTime: number
  success: boolean
  error?: string
  timestamp: number
}

// Enhanced RTT Testing with better reliability
export async function testRTT(
  url: string,
  method: "HEAD" | "GET" = "HEAD",
  samples = 5,
  timeout = 10000,
): Promise<RTTTestResult> {
  const results: number[] = []
  const errors: string[] = []
  let successCount = 0

  for (let i = 0; i < samples; i++) {
    let attempt = 0
    const maxAttempts = 3 // Increased retry attempts from 2 to 3

    while (attempt < maxAttempts) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        // Add cache busting to prevent cached responses
        const testUrl = new URL(url)
        testUrl.searchParams.set("_t", Date.now().toString())
        testUrl.searchParams.set("_r", Math.random().toString(36).substring(7))

        const startTime = performance.now()
        const response = await fetch(testUrl.toString(), {
          method,
          cache: "no-store",
          keepalive: false,
          signal: controller.signal,
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
            "User-Agent": "NetworkToolbox/1.0 RTT-Tester",
          },
        })

        clearTimeout(timeoutId)
        const endTime = performance.now()

        if (response.ok) {
          results.push(endTime - startTime)
          successCount++
          break // Success, no need to retry
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
      } catch (error) {
        attempt++
        const errorMsg = error instanceof Error ? error.message : "Network error"

        if (attempt >= maxAttempts) {
          errors.push(`Sample ${i + 1}: ${errorMsg}`)
        } else {
          await new Promise((resolve) => setTimeout(resolve, 200 * attempt))
        }
      }
    }

    // Delay between samples to avoid overwhelming the server
    if (i < samples - 1) {
      await new Promise((resolve) => setTimeout(resolve, 300)) // Increased delay from 250ms to 300ms
    }
  }

  const packetLoss = ((samples - successCount) / samples) * 100

  if (results.length === 0) {
    return {
      url,
      method,
      samples: [],
      median: 0,
      p95: 0,
      average: 0,
      min: 0,
      max: 0,
      jitter: 0,
      packetLoss: 100,
      success: false,
      error: errors.length > 0 ? errors.join("; ") : "All requests failed - check URL and CORS policy",
      timestamp: Date.now(),
    }
  }

  const sorted = [...results].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1]
  const average = results.reduce((sum, val) => sum + val, 0) / results.length
  const min = Math.min(...results)
  const max = Math.max(...results)

  // Calculate jitter (standard deviation)
  const variance = results.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / results.length
  const jitter = Math.sqrt(variance)

  return {
    url,
    method,
    samples: results,
    median,
    p95,
    average,
    min,
    max,
    jitter,
    packetLoss,
    success: true,
    timestamp: Date.now(),
  }
}

// Enhanced throughput testing with better progress tracking
export async function testDownloadThroughput(url: string, timeout = 30000): Promise<ThroughputTestResult> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const startTime = performance.now()
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Cache-Control": "no-cache",
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error("Response body not readable")
    }

    let bytesReceived = 0
    const chunks: Uint8Array[] = []

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        if (value) {
          bytesReceived += value.length
          chunks.push(value)
        }
      }
    } finally {
      reader.releaseLock()
    }

    clearTimeout(timeoutId)
    const endTime = performance.now()
    const durationMs = endTime - startTime
    const throughputMbps = (bytesReceived * 8) / (durationMs * 1000) // Convert to Mbps

    return {
      url,
      direction: "download",
      bytesTransferred: bytesReceived,
      durationMs,
      throughputMbps,
      success: true,
      timestamp: Date.now(),
    }
  } catch (error) {
    return {
      url,
      direction: "download",
      bytesTransferred: 0,
      durationMs: 0,
      throughputMbps: 0,
      success: false,
      error: error instanceof Error ? error.message : "Download test failed",
      timestamp: Date.now(),
    }
  }
}

// Enhanced upload throughput testing
export async function testUploadThroughput(
  url: string,
  sizeBytes: number,
  timeout = 30000,
): Promise<ThroughputTestResult> {
  try {
    // Generate more realistic test data
    const testData = new Uint8Array(sizeBytes)
    const pattern = new TextEncoder().encode("NETWORK_TEST_DATA_")
    for (let i = 0; i < sizeBytes; i++) {
      testData[i] = pattern[i % pattern.length]
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const startTime = performance.now()
    const response = await fetch(url, {
      method: "POST",
      body: testData,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": sizeBytes.toString(),
      },
    })

    clearTimeout(timeoutId)
    const endTime = performance.now()

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const durationMs = endTime - startTime
    const throughputMbps = (sizeBytes * 8) / (durationMs * 1000) // Convert to Mbps

    return {
      url,
      direction: "upload",
      bytesTransferred: sizeBytes,
      durationMs,
      throughputMbps,
      success: true,
      timestamp: Date.now(),
    }
  } catch (error) {
    return {
      url,
      direction: "upload",
      bytesTransferred: 0,
      durationMs: 0,
      throughputMbps: 0,
      success: false,
      error: error instanceof Error ? error.message : "Upload test failed",
      timestamp: Date.now(),
    }
  }
}

// Enhanced DNS over HTTPS query with better reliability
export async function queryDNSOverHTTPS(domain: string, recordType = "A", provider = "cloudflare"): Promise<DNSResult> {
  const providers = {
    cloudflare: "https://cloudflare-dns.com/dns-query",
    google: "https://dns.google/dns-query",
    quad9: "https://dns.quad9.net:5053/dns-query",
    opendns: "https://doh.opendns.com/dns-query",
    adguard: "https://dns.adguard.com/dns-query",
  }

  const baseUrl = providers[provider as keyof typeof providers] || providers.cloudflare

  const maxRetries = 2
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Validate domain name
      if (!isValidDomain(domain)) {
        throw new Error("Invalid domain name format")
      }

      // Validate record type
      const validTypes = ["A", "AAAA", "CNAME", "MX", "NS", "TXT", "SOA", "PTR", "SRV"]
      if (!validTypes.includes(recordType.toUpperCase())) {
        throw new Error(`Invalid record type: ${recordType}`)
      }

      const startTime = performance.now()
      const url = `${baseUrl}?name=${encodeURIComponent(domain)}&type=${recordType.toUpperCase()}&do=1`

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // Increased timeout from 10s to 15s

      const response = await fetch(url, {
        headers: {
          Accept: "application/dns-json",
          "User-Agent": "NetworkToolbox/1.0 DNS-Client",
          "Cache-Control": "no-cache",
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      const endTime = performance.now()
      const responseTime = endTime - startTime

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // Validate response structure
      if (typeof data !== "object" || data === null) {
        throw new Error("Invalid DNS response format")
      }

      // Handle different response statuses
      if (data.Status !== 0) {
        const statusMessages: Record<number, string> = {
          1: "Format Error - The name server was unable to interpret the query",
          2: "Server Failure - The name server encountered an internal failure",
          3: "Name Error (NXDOMAIN) - The domain name does not exist",
          4: "Not Implemented - The name server does not support the requested kind of query",
          5: "Refused - The name server refuses to perform the operation",
        }
        throw new Error(statusMessages[data.Status] || `DNS Error: Status ${data.Status}`)
      }

      const records = (data.Answer || []).map((record: any) => ({
        name: record.name || domain,
        type: getRecordTypeName(record.type) || recordType,
        ttl: record.TTL || 0,
        data: formatRecordData(record.data, record.type),
      }))

      return {
        domain,
        recordType: recordType.toUpperCase(),
        records,
        provider,
        dnssec: data.AD || false,
        responseTime,
        success: true,
        timestamp: Date.now(),
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error")

      if (
        attempt < maxRetries &&
        (lastError.message.includes("fetch") ||
          lastError.message.includes("timeout") ||
          lastError.message.includes("Server Failure"))
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1))) // Exponential backoff
        continue
      }
      break
    }
  }

  return {
    domain,
    recordType: recordType.toUpperCase(),
    records: [],
    provider,
    dnssec: false,
    responseTime: 0,
    success: false,
    error: lastError?.message || "DNS query failed",
    timestamp: Date.now(),
  }
}

// Helper function to validate domain names
function isValidDomain(domain: string): boolean {
  const domainRegex =
    /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/
  return domainRegex.test(domain) && domain.length <= 253
}

// Helper function to get record type name from number
function getRecordTypeName(type: number): string {
  const types: Record<number, string> = {
    1: "A",
    2: "NS",
    5: "CNAME",
    6: "SOA",
    12: "PTR",
    15: "MX",
    16: "TXT",
    28: "AAAA",
    33: "SRV",
  }
  return types[type] || `TYPE${type}`
}

// Helper function to format record data based on type
function formatRecordData(data: string, type: number): string {
  switch (type) {
    case 15: // MX
      const parts = data.split(" ")
      return parts.length >= 2 ? `${parts[0]} ${parts[1]}` : data
    case 16: // TXT
      return data.replace(/"/g, "") // Remove quotes from TXT records
    case 33: // SRV
      return data // SRV records are already formatted
    default:
      return data
  }
}

// MTU and header overhead calculation
export interface MTUCalculation {
  linkMTU: number
  headers: Array<{ name: string; size: number }>
  totalOverhead: number
  payloadMTU: number
  fragmentationWarning: boolean
}

export function calculateMTU(linkMTU: number, protocols: Array<{ name: string; size: number }>): MTUCalculation {
  const totalOverhead = protocols.reduce((sum, protocol) => sum + protocol.size, 0)
  const payloadMTU = linkMTU - totalOverhead

  return {
    linkMTU,
    headers: protocols,
    totalOverhead,
    payloadMTU,
    fragmentationWarning: payloadMTU < 1200, // IPv6 minimum MTU
  }
}

// Common protocol overhead sizes
export const protocolOverheads = {
  "Ethernet II": 14,
  "802.1Q": 4,
  QinQ: 8,
  IPv4: 20,
  IPv6: 40,
  TCP: 20,
  UDP: 8,
  GRE: 24,
  VXLAN: 50,
  PPPoE: 8,
  "IPsec ESP": 50,
  MPLS: 4,
}

// Enhanced OUI database with more vendors
const ouiDatabase: Record<string, string> = {
  // Cisco
  "00:00:0C": "Cisco Systems",
  "00:01:42": "Cisco Systems",
  "00:01:43": "Cisco Systems",
  "00:01:96": "Cisco Systems",
  "00:01:97": "Cisco Systems",
  "00:02:16": "Cisco Systems",
  "00:02:17": "Cisco Systems",
  "00:02:3D": "Cisco Systems",
  "00:02:4A": "Cisco Systems",
  "00:02:4B": "Cisco Systems",

  // VMware
  "00:0C:29": "VMware",
  "00:1C:14": "VMware",
  "00:50:56": "VMware",

  // Microsoft
  "00:15:5D": "Microsoft Corporation",
  "00:17:FA": "Microsoft Corporation",
  "00:03:FF": "Microsoft Corporation",

  // Intel
  "00:1B:21": "Intel Corporation",
  "AC:DE:48": "Intel Corporation",
  "E4:5F:01": "Intel Corporation",
  "00:13:02": "Intel Corporation",
  "00:15:17": "Intel Corporation",
  "00:16:76": "Intel Corporation",
  "00:19:D1": "Intel Corporation",
  "00:1E:67": "Intel Corporation",
  "00:21:6A": "Intel Corporation",
  "00:24:D7": "Intel Corporation",

  // Apple
  "B4:2E:99": "Apple Inc",
  "F0:18:98": "Apple Inc",
  "00:03:93": "Apple Inc",
  "00:05:02": "Apple Inc",
  "00:0A:27": "Apple Inc",
  "00:0A:95": "Apple Inc",
  "00:0D:93": "Apple Inc",
  "00:11:24": "Apple Inc",
  "00:14:51": "Apple Inc",
  "00:16:CB": "Apple Inc",
  "00:17:F2": "Apple Inc",
  "00:19:E3": "Apple Inc",
  "00:1B:63": "Apple Inc",
  "00:1E:C2": "Apple Inc",
  "00:21:E9": "Apple Inc",
  "00:23:12": "Apple Inc",
  "00:23:DF": "Apple Inc",
  "00:25:00": "Apple Inc",
  "00:25:4B": "Apple Inc",
  "00:25:BC": "Apple Inc",
  "00:26:08": "Apple Inc",
  "00:26:4A": "Apple Inc",
  "00:26:B0": "Apple Inc",
  "00:26:BB": "Apple Inc",

  // Dell
  "00:14:22": "Dell Inc",
  "00:1A:A0": "Dell Inc",
  "00:21:9B": "Dell Inc",
  "00:23:AE": "Dell Inc",
  "00:24:E8": "Dell Inc",
  "00:25:64": "Dell Inc",
  "00:26:B9": "Dell Inc",
  "B0:83:FE": "Dell Inc",
  "D0:67:E5": "Dell Inc",
  "F0:1F:AF": "Dell Inc",

  // HP/HPE
  "00:10:83": "Hewlett Packard Enterprise",
  "00:11:0A": "Hewlett Packard Enterprise",
  "00:13:21": "Hewlett Packard Enterprise",
  "00:15:60": "Hewlett Packard Enterprise",
  "00:16:35": "Hewlett Packard Enterprise",
  "00:17:08": "Hewlett Packard Enterprise",
  "00:18:71": "Hewlett Packard Enterprise",
  "00:19:BB": "Hewlett Packard Enterprise",
  "00:1A:4B": "Hewlett Packard Enterprise",
  "00:1B:78": "Hewlett Packard Enterprise",
  "00:1C:C4": "Hewlett Packard Enterprise",
  "00:1E:0B": "Hewlett Packard Enterprise",
  "00:1F:29": "Hewlett Packard Enterprise",
  "00:21:5A": "Hewlett Packard Enterprise",
  "00:22:64": "Hewlett Packard Enterprise",
  "00:23:7D": "Hewlett Packard Enterprise",
  "00:24:81": "Hewlett Packard Enterprise",
  "00:25:B3": "Hewlett Packard Enterprise",
  "00:26:55": "Hewlett Packard Enterprise",

  // Virtualization
  "00:16:3E": "Xensource (Citrix)",
  "08:00:27": "PCS Systemtechnik GmbH (VirtualBox)",
  "52:54:00": "QEMU/KVM",
  "00:1C:42": "Parallels",

  // Raspberry Pi
  "DC:A6:32": "Raspberry Pi Foundation",
  "B8:27:EB": "Raspberry Pi Foundation",
  "E4:5F:01": "Raspberry Pi Foundation",

  // Network Equipment
  "00:04:96": "Extreme Networks",
  "00:E0:2B": "Extreme Networks",
  "00:01:30": "Foundry Networks",
  "00:E0:52": "Foundry Networks",
  "00:A0:C9": "Intel Corporation",
  "00:E0:81": "Tyan Computer",
  "00:20:AF": "3Com Corporation",
  "00:50:04": "3Com Corporation",
  "00:60:08": "3Com Corporation",
  "00:60:97": "3Com Corporation",
  "00:A0:24": "3Com Corporation",

  // Juniper
  "00:05:85": "Juniper Networks",
  "00:12:1E": "Juniper Networks",
  "00:17:CB": "Juniper Networks",
  "00:19:E2": "Juniper Networks",
  "00:1B:C0": "Juniper Networks",
  "00:1D:B5": "Juniper Networks",
  "00:21:59": "Juniper Networks",
  "00:22:83": "Juniper Networks",
  "00:23:9C": "Juniper Networks",
  "00:24:DC": "Juniper Networks",
  "00:26:88": "Juniper Networks",
  "2C:6B:F5": "Juniper Networks",
  "3C:61:04": "Juniper Networks",
  "5C:5E:AB": "Juniper Networks",
  "84:18:88": "Juniper Networks",
  "84:B5:9C": "Juniper Networks",
  "9C:CC:83": "Juniper Networks",

  // Arista
  "00:1C:73": "Arista Networks",
  "28:99:3A": "Arista Networks",
  "44:4C:A8": "Arista Networks",
  "50:08:00": "Arista Networks",

  // Fortinet
  "00:09:0F": "Fortinet",
  "90:6C:AC": "Fortinet",

  // Palo Alto
  "00:1B:17": "Palo Alto Networks",
  "8C:EA:1B": "Palo Alto Networks",

  // Ubiquiti
  "00:15:6D": "Ubiquiti Networks",
  "04:18:D6": "Ubiquiti Networks",
  "24:A4:3C": "Ubiquiti Networks",
  "68:72:51": "Ubiquiti Networks",
  "78:8A:20": "Ubiquiti Networks",
  "80:2A:A8": "Ubiquiti Networks",
  "B4:FB:E4": "Ubiquiti Networks",
  "DC:9F:DB": "Ubiquiti Networks",
  "E8:DE:27": "Ubiquiti Networks",
  "F0:9F:C2": "Ubiquiti Networks",
  "FC:EC:DA": "Ubiquiti Networks",
}

export function lookupOUI(mac: string): OUIResult {
  // Extract first 3 octets (OUI)
  const cleanMac = mac.replace(/[^0-9A-Fa-f]/g, "").toUpperCase()
  if (cleanMac.length < 6) {
    return {
      mac,
      oui: "",
      vendor: "",
      found: false,
    }
  }

  const oui = `${cleanMac.slice(0, 2)}:${cleanMac.slice(2, 4)}:${cleanMac.slice(4, 6)}`
  const vendor = ouiDatabase[oui] || ""

  return {
    mac,
    oui,
    vendor,
    found: !!vendor,
  }
}

// OUI (Organizationally Unique Identifier) lookup
export interface OUIResult {
  mac: string
  oui: string
  vendor: string
  found: boolean
}

// IPv6 utilities
export function generateSolicitedNodeMulticast(ipv6: string): string {
  // Extract last 24 bits of IPv6 address
  const expanded = ipv6.includes("::") ? expandIPv6(ipv6) : ipv6
  const groups = expanded.split(":")
  const lastGroup = groups[groups.length - 1]
  const secondLastGroup = groups[groups.length - 2]

  const last24Bits = (secondLastGroup.slice(-2) + lastGroup).toLowerCase()
  return `ff02::1:ff${last24Bits.slice(-6, -4)}:${last24Bits.slice(-4)}`
}

function expandIPv6(ip: string): string {
  if (ip.includes("::")) {
    const parts = ip.split("::")
    const left = parts[0] ? parts[0].split(":") : []
    const right = parts[1] ? parts[1].split(":") : []
    const missing = 8 - left.length - right.length

    const expanded = [...left, ...Array(missing).fill("0000"), ...right]
    return expanded.map((part) => part.padStart(4, "0")).join(":")
  }

  return ip
    .split(":")
    .map((part) => part.padStart(4, "0"))
    .join(":")
}

export function generateEUI64FromMAC(mac: string, prefix: string): string {
  // Remove separators and convert to uppercase
  const cleanMac = mac.replace(/[^0-9A-Fa-f]/g, "").toUpperCase()
  if (cleanMac.length !== 12) {
    throw new Error("Invalid MAC address")
  }

  // Split MAC into two halves and insert FFFE
  const firstHalf = cleanMac.slice(0, 6)
  const secondHalf = cleanMac.slice(6)

  // Flip the universal/local bit (7th bit of first octet)
  const firstOctet = Number.parseInt(firstHalf.slice(0, 2), 16)
  const flippedOctet = (firstOctet ^ 0x02).toString(16).padStart(2, "0").toUpperCase()

  const eui64 = flippedOctet + firstHalf.slice(2) + "FFFE" + secondHalf

  // Format as IPv6 interface identifier
  const iid = `${eui64.slice(0, 4)}:${eui64.slice(4, 8)}:${eui64.slice(8, 12)}:${eui64.slice(12, 16)}`.toLowerCase()

  // Combine with prefix
  const prefixPart = prefix.split("::")[0] || prefix.split("/")[0]
  return `${prefixPart}${iid}`
}
