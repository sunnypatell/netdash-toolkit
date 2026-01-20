// Network testing utilities for RTT, throughput, and connectivity

// DNS Cache implementation with TTL support
interface DNSCacheEntry {
  result: DNSResult
  expiresAt: number
  minTTL: number
}

class DNSCache {
  private cache: Map<string, DNSCacheEntry> = new Map()
  private maxSize: number = 100
  private hits: number = 0
  private misses: number = 0

  private getCacheKey(domain: string, recordType: string, provider: string): string {
    return `${domain.toLowerCase()}:${recordType.toUpperCase()}:${provider}`
  }

  get(domain: string, recordType: string, provider: string): DNSResult | null {
    const key = this.getCacheKey(domain, recordType, provider)
    const entry = this.cache.get(key)

    if (!entry) {
      this.misses++
      return null
    }

    // Check if entry has expired based on TTL
    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key)
      this.misses++
      return null
    }

    this.hits++

    // Return cached result with updated metadata
    return {
      ...entry.result,
      timestamp: Date.now(),
      responseTime: 0, // Indicates cache hit
    }
  }

  set(domain: string, recordType: string, provider: string, result: DNSResult): void {
    if (!result.success || result.records.length === 0) {
      return // Don't cache failed or empty results
    }

    // Calculate minimum TTL from all records (at least 30 seconds, max 1 hour)
    const minTTL = Math.min(
      Math.max(30, Math.min(...result.records.map((r) => r.ttl || 300))),
      3600
    )

    // Enforce max cache size with LRU-like eviction
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    const key = this.getCacheKey(domain, recordType, provider)
    this.cache.set(key, {
      result,
      expiresAt: Date.now() + minTTL * 1000,
      minTTL,
    })
  }

  clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
  }

  getStats(): { size: number; hits: number; misses: number; hitRate: string } {
    const total = this.hits + this.misses
    const hitRate = total > 0 ? ((this.hits / total) * 100).toFixed(1) + "%" : "0%"
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate,
    }
  }

  // Get remaining TTL for a cached entry
  getRemainingTTL(domain: string, recordType: string, provider: string): number | null {
    const key = this.getCacheKey(domain, recordType, provider)
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    const remaining = Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000))
    return remaining > 0 ? remaining : null
  }
}

// Global DNS cache instance
export const dnsCache = new DNSCache()

export interface RTTTestResult {
  url: string
  requestedMethod: "HEAD" | "GET"
  method: string
  mode: "cors" | "no-cors"
  samples: number[]
  median: number
  p95: number
  average: number
  min: number
  max: number
  jitter: number
  packetLoss: number
  success: boolean
  warnings?: string[]
  error?: string
  errorDetails?: string[]
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
  timeout = 10000
): Promise<RTTTestResult> {
  let normalizedUrl: URL
  try {
    normalizedUrl = normalizeTestUrl(url)
  } catch (error) {
    return buildFailedRTTResult(url, method, ["Invalid or unsupported URL"], [])
  }
  const urlString = normalizedUrl.toString()

  if (!isHttpProtocol(normalizedUrl)) {
    return buildFailedRTTResult(urlString, method, ["Only HTTP and HTTPS URLs are supported"], [])
  }

  if (isMixedContentBlocked(normalizedUrl)) {
    return buildFailedRTTResult(
      urlString,
      method,
      ["Browsers block HTTP endpoints when the app is served over HTTPS. Use an HTTPS test URL."],
      []
    )
  }

  const results: number[] = []
  const errors: string[] = []
  const warnings = new Set<string>()
  let successCount = 0
  let effectiveMethod: "HEAD" | "GET" = method
  let mode: "cors" | "no-cors" = "cors"

  for (let i = 0; i < samples; i++) {
    let attempt = 0
    const maxAttempts = 3

    while (attempt < maxAttempts) {
      try {
        const measurement = await measureSingleSample(urlString, effectiveMethod, method, timeout)
        results.push(measurement.duration)
        successCount++
        effectiveMethod = measurement.methodUsed
        if (measurement.mode === "no-cors") {
          mode = "no-cors"
        }
        measurement.warnings.forEach((warning) => warnings.add(warning))
        break
      } catch (error) {
        attempt++
        if (attempt >= maxAttempts) {
          errors.push(`Sample ${i + 1}: ${describeRTTError(error, normalizedUrl, timeout)}`)
        } else {
          await new Promise((resolve) => setTimeout(resolve, 200 * attempt))
        }
      }
    }

    if (i < samples - 1) {
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
  }

  const packetLoss = ((samples - successCount) / samples) * 100

  if (results.length === 0) {
    return buildFailedRTTResult(urlString, method, errors, Array.from(warnings), mode)
  }

  if (packetLoss > 0) {
    warnings.add(`Detected ${packetLoss.toFixed(1)}% packet loss across ${samples} attempts`)
  }

  const sorted = [...results].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1]
  const average = results.reduce((sum, val) => sum + val, 0) / results.length
  const min = Math.min(...results)
  const max = Math.max(...results)
  const variance =
    results.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / results.length
  const jitter = Math.sqrt(variance)

  return {
    url: urlString,
    requestedMethod: method,
    method: effectiveMethod,
    mode,
    samples: results,
    median,
    p95,
    average,
    min,
    max,
    jitter,
    packetLoss,
    success: true,
    warnings: Array.from(warnings),
    timestamp: Date.now(),
  }
}

function normalizeTestUrl(input: string): URL {
  try {
    return new URL(input)
  } catch (error) {
    try {
      return new URL(`https://${input}`)
    } catch (innerError) {
      throw innerError
    }
  }
}

function isHttpProtocol(url: URL): boolean {
  return url.protocol === "http:" || url.protocol === "https:"
}

function isMixedContentBlocked(url: URL): boolean {
  if (url.protocol !== "http:") {
    return false
  }

  if (typeof window === "undefined") {
    return false
  }

  return window.location.protocol === "https:"
}

function buildFailedRTTResult(
  url: string,
  requestedMethod: "HEAD" | "GET",
  errors: string[],
  warnings: string[],
  mode: "cors" | "no-cors" = "cors"
): RTTTestResult {
  return {
    url,
    requestedMethod,
    method: requestedMethod,
    mode,
    samples: [],
    median: 0,
    p95: 0,
    average: 0,
    min: 0,
    max: 0,
    jitter: 0,
    packetLoss: 100,
    success: false,
    warnings: warnings.length > 0 ? warnings : undefined,
    error: errors.join("; ") || "All requests failed - check URL and CORS policy",
    errorDetails: errors,
    timestamp: Date.now(),
  }
}

interface RTTMeasurement {
  duration: number
  methodUsed: "HEAD" | "GET"
  mode: "cors" | "no-cors"
  warnings: string[]
}

async function measureSingleSample(
  url: string,
  effectiveMethod: "HEAD" | "GET",
  requestedMethod: "HEAD" | "GET",
  timeout: number
): Promise<RTTMeasurement> {
  try {
    const attempt = await timedFetch(url, effectiveMethod, timeout, "cors")

    if (attempt.response.status === 405 && requestedMethod === "HEAD") {
      const retry = await timedFetch(url, "GET", timeout, "cors")
      if (!isSuccessfulResponse(retry.response)) {
        throw new Error(
          `HTTP ${retry.response.status}: ${retry.response.statusText || "Request failed"}`
        )
      }
      return {
        duration: retry.duration,
        methodUsed: "GET",
        mode: "cors",
        warnings: ["Remote endpoint does not allow HEAD requests; retried with GET."],
      }
    }

    if (!isSuccessfulResponse(attempt.response)) {
      throw new Error(
        `HTTP ${attempt.response.status}: ${attempt.response.statusText || "Request failed"}`
      )
    }

    return {
      duration: attempt.duration,
      methodUsed: effectiveMethod,
      mode: "cors",
      warnings: [],
    }
  } catch (error) {
    if (isLikelyCorsIssue(error) && new URL(url).protocol === "https:") {
      const fallback = await timedFetch(url, "GET", timeout, "no-cors")
      return {
        duration: fallback.duration,
        methodUsed: "GET",
        mode: "no-cors",
        warnings: [
          "Remote server did not provide CORS headers. Used GET with no-cors mode; timing excludes HTTP status validation.",
        ],
      }
    }

    throw error
  }
}

interface TimedFetchResult {
  duration: number
  response: Response
}

async function timedFetch(
  baseUrl: string,
  method: "HEAD" | "GET",
  timeout: number,
  mode: RequestMode
): Promise<TimedFetchResult> {
  const target = new URL(baseUrl)
  target.searchParams.set("_netdash_ts", Date.now().toString())
  target.searchParams.set("_netdash_rand", Math.random().toString(36).slice(2))

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const startTime = performance.now()
    const response = await fetch(target.toString(), {
      method,
      mode,
      cache: "no-store",
      signal: controller.signal,
      credentials: "omit",
      headers:
        mode === "cors"
          ? {
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
              Expires: "0",
              "User-Agent": "NetworkToolbox/1.0 RTT-Tester",
            }
          : undefined,
    })
    const endTime = performance.now()

    return {
      duration: endTime - startTime,
      response,
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

function isSuccessfulResponse(response: Response): boolean {
  if (response.type === "opaque") {
    return true
  }
  return response.ok
}

function isLikelyCorsIssue(error: unknown): boolean {
  if (error instanceof TypeError && typeof error.message === "string") {
    return error.message.includes("fetch") || error.message.includes("Failed to fetch")
  }
  if (error instanceof Error && typeof error.message === "string") {
    return error.message.toLowerCase().includes("cors")
  }
  return false
}

function describeRTTError(error: unknown, url: URL, timeout: number): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return `Request timed out after ${timeout}ms`
  }

  if (isMixedContentBlocked(url)) {
    return "Mixed content blocked - use HTTPS for the test endpoint"
  }

  if (isLikelyCorsIssue(error)) {
    return "Remote server blocked the browser request (CORS). Provide a test endpoint with Access-Control-Allow-Origin headers."
  }

  if (error instanceof Error) {
    return error.message
  }

  return "Unknown network error"
}

// Enhanced throughput testing with better progress tracking
export async function testDownloadThroughput(
  url: string,
  timeout = 30000
): Promise<ThroughputTestResult> {
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
  timeout = 30000
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

// Enhanced DNS over HTTPS query with TTL-based caching
export async function queryDNSOverHTTPS(
  domain: string,
  recordType = "A",
  provider = "cloudflare",
  options: { skipCache?: boolean } = {}
): Promise<DNSResult> {
  // Check cache first (unless explicitly skipped)
  if (!options.skipCache) {
    const cachedResult = dnsCache.get(domain, recordType, provider)
    if (cachedResult) {
      // Add cache indicator to the result
      return {
        ...cachedResult,
        provider: `${provider} (cached)`,
      }
    }
  }

  const dohProviders: Record<
    string,
    {
      url: string
      format: "json" | "dns-message"
    }
  > = {
    cloudflare: { url: "https://cloudflare-dns.com/dns-query", format: "json" },
    google: { url: "https://dns.google/resolve", format: "json" },
    quad9: { url: "https://dns.quad9.net/dns-query", format: "dns-message" },
    opendns: { url: "https://doh.opendns.com/dns-query", format: "dns-message" },
    adguard: { url: "https://dns.adguard-dns.com/resolve", format: "json" },
  }

  const providerConfig = dohProviders[provider] || dohProviders.cloudflare

  const maxRetries = 2
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (!isValidDomain(domain)) {
        throw new Error("Invalid domain name format")
      }

      const recordTypeCode = getRecordTypeCode(recordType)
      if (recordTypeCode === undefined) {
        throw new Error(`Invalid record type: ${recordType}`)
      }

      const startTime = performance.now()
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      let response: Response
      let normalized: NormalizedDNSResponse

      if (providerConfig.format === "json") {
        const urlObject = new URL(providerConfig.url)
        urlObject.searchParams.set("name", domain)
        urlObject.searchParams.set("type", recordType.toUpperCase())
        urlObject.searchParams.set("do", "1")

        response = await fetch(urlObject.toString(), {
          headers: {
            Accept: "application/dns-json",
            "User-Agent": "NetworkToolbox/1.0 DNS-Client",
            "Cache-Control": "no-cache",
          },
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        normalized = normalizeJsonDnsResponse(data, domain)
      } else {
        const wireQuery = buildDnsQueryMessage(domain, recordTypeCode)
        const encodedQuery = encodeDnsQuery(wireQuery)
        const urlObject = new URL(providerConfig.url)
        urlObject.searchParams.set("dns", encodedQuery)
        urlObject.searchParams.set("do", "1")

        response = await fetch(urlObject.toString(), {
          headers: {
            Accept: "application/dns-message",
            "User-Agent": "NetworkToolbox/1.0 DNS-Client",
            "Cache-Control": "no-cache",
          },
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const buffer = new Uint8Array(await response.arrayBuffer())
        normalized = parseDnsMessage(buffer)
      }

      clearTimeout(timeoutId)
      const responseTime = performance.now() - startTime

      if (normalized.Status !== 0) {
        const statusMessages: Record<number, string> = {
          1: "Format Error - The name server was unable to interpret the query",
          2: "Server Failure - The name server encountered an internal failure",
          3: "Name Error (NXDOMAIN) - The domain name does not exist",
          4: "Not Implemented - The name server does not support the requested kind of query",
          5: "Refused - The name server refuses to perform the operation",
        }
        throw new Error(
          statusMessages[normalized.Status] || `DNS Error: Status ${normalized.Status}`
        )
      }

      const records = normalized.Answer.map((answer) => ({
        name: answer.name || domain,
        type: getRecordTypeName(answer.type) || recordType.toUpperCase(),
        ttl: answer.ttl,
        data: formatRecordData(answer.data, answer.type),
      }))

      const result: DNSResult = {
        domain,
        recordType: recordType.toUpperCase(),
        records,
        provider,
        dnssec: normalized.AD,
        responseTime,
        success: true,
        timestamp: Date.now(),
      }

      // Cache the successful result using TTL from records
      dnsCache.set(domain, recordType, provider, result)

      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error")

      if (
        attempt < maxRetries &&
        (lastError.message.includes("fetch") ||
          lastError.message.includes("timeout") ||
          lastError.message.includes("Server Failure"))
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
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

interface NormalizedDNSAnswer {
  name: string
  type: number
  ttl: number
  data: string
}

interface NormalizedDNSResponse {
  Status: number
  AD: boolean
  Answer: NormalizedDNSAnswer[]
}

function normalizeJsonDnsResponse(data: any, fallbackDomain: string): NormalizedDNSResponse {
  const status =
    typeof data?.Status === "number"
      ? data.Status
      : typeof data?.status === "number"
        ? data.status
        : -1
  const adFlag = Boolean(data?.AD ?? data?.Ad ?? data?.ad)

  const answers: NormalizedDNSAnswer[] = Array.isArray(data?.Answer)
    ? data.Answer.map((record: any) => {
        const typeValue =
          typeof record?.type === "number"
            ? record.type
            : (getRecordTypeCode(String(record?.type || "")) ?? 255)
        const ttlValue = Number.parseInt(record?.TTL ?? record?.ttl ?? "0", 10) || 0
        const nameValue = trimTrailingDot(record?.name || record?.Name || fallbackDomain)
        const dataValue = String(record?.data ?? record?.Data ?? record?.value ?? "")

        return {
          name: nameValue,
          type: typeValue,
          ttl: ttlValue,
          data: dataValue,
        }
      })
    : []

  return {
    Status: status,
    AD: adFlag,
    Answer: answers,
  }
}

function getRecordTypeCode(type: string): number | undefined {
  const codes: Record<string, number> = {
    A: 1,
    NS: 2,
    CNAME: 5,
    SOA: 6,
    PTR: 12,
    MX: 15,
    TXT: 16,
    AAAA: 28,
    SRV: 33,
  }

  return codes[type.toUpperCase()]
}

function buildDnsQueryMessage(domain: string, recordType: number): Uint8Array {
  const labels = trimTrailingDot(domain)
    .split(".")
    .map((label) => label.trim())
    .filter(Boolean)

  const questionLength = labels.reduce((sum, label) => sum + 1 + label.length, 0) + 1 + 4
  const message = new Uint8Array(12 + questionLength)
  const view = new DataView(message.buffer)

  const id = Math.floor(Math.random() * 0xffff)
  view.setUint16(0, id)
  view.setUint16(2, 0x0100) // recursion desired
  view.setUint16(4, 1) // QDCOUNT
  view.setUint16(6, 0) // ANCOUNT
  view.setUint16(8, 0) // NSCOUNT
  view.setUint16(10, 0) // ARCOUNT

  let offset = 12
  for (const label of labels) {
    message[offset] = label.length
    for (let i = 0; i < label.length; i++) {
      message[offset + 1 + i] = label.charCodeAt(i)
    }
    offset += label.length + 1
  }

  message[offset++] = 0
  view.setUint16(offset, recordType)
  view.setUint16(offset + 2, 1) // Class IN

  return message
}

function encodeDnsQuery(bytes: Uint8Array): string {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    let binary = ""
    for (const byte of bytes) {
      binary += String.fromCharCode(byte)
    }
    return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
  }

  const nodeBuffer = typeof globalThis !== "undefined" ? (globalThis as any).Buffer : undefined
  if (nodeBuffer) {
    return nodeBuffer
      .from(bytes)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "")
  }

  throw new Error("Base64 encoding not available in this environment")
}

function parseDnsMessage(message: Uint8Array): NormalizedDNSResponse {
  if (message.length < 12) {
    throw new Error("DNS response too short")
  }

  const view = new DataView(message.buffer, message.byteOffset, message.byteLength)
  const flags = view.getUint16(2)
  const qdCount = view.getUint16(4)
  const anCount = view.getUint16(6)

  let offset = 12

  for (let i = 0; i < qdCount; i++) {
    const question = readDomainName(message, offset)
    offset = question.nextOffset + 4 // skip type and class
  }

  const answers: NormalizedDNSAnswer[] = []

  for (let i = 0; i < anCount; i++) {
    const nameResult = readDomainName(message, offset)
    offset = nameResult.nextOffset

    if (offset + 10 > message.length) {
      break
    }

    const type = view.getUint16(offset)
    const ttl = view.getUint32(offset + 4)
    const rdlength = view.getUint16(offset + 8)
    const rdataOffset = offset + 10
    const rdataEnd = rdataOffset + rdlength

    if (rdataEnd > message.length) {
      break
    }

    const rdata = message.slice(rdataOffset, rdataEnd)
    const dataString = formatRDataFromBytes(type, rdata, message, rdataOffset)

    answers.push({
      name: trimTrailingDot(nameResult.name),
      type,
      ttl,
      data: dataString,
    })

    offset = rdataEnd
  }

  return {
    Status: flags & 0x000f,
    AD: (flags & 0x0020) === 0x0020,
    Answer: answers,
  }
}

function readDomainName(
  message: Uint8Array,
  offset: number,
  depth = 0
): { name: string; nextOffset: number } {
  if (depth > 10) {
    throw new Error("DNS pointer recursion limit exceeded")
  }

  const labels: string[] = []
  let currentOffset = offset
  let jumped = false
  let nextOffset = offset

  while (currentOffset < message.length) {
    const length = message[currentOffset]
    if (length === undefined) {
      break
    }

    // Pointer
    if ((length & 0xc0) === 0xc0) {
      const pointer = ((length & 0x3f) << 8) | message[currentOffset + 1]
      if (!jumped) {
        nextOffset = currentOffset + 2
      }
      const pointed = readDomainName(message, pointer, depth + 1)
      labels.push(pointed.name)
      currentOffset += 2
      jumped = true
      break
    }

    if (length === 0) {
      currentOffset += 1
      if (!jumped) {
        nextOffset = currentOffset
      }
      break
    }

    const end = currentOffset + 1 + length
    if (end > message.length) {
      break
    }

    const labelBytes = message.slice(currentOffset + 1, end)
    labels.push(String.fromCharCode(...labelBytes))
    currentOffset = end
    if (!jumped) {
      nextOffset = currentOffset
    }
  }

  const name = labels.filter(Boolean).join(".")
  return { name, nextOffset }
}

function formatRDataFromBytes(
  type: number,
  rdata: Uint8Array,
  message: Uint8Array,
  rdataOffset: number
): string {
  switch (type) {
    case 1: // A
      return Array.from(rdata).join(".")
    case 28: // AAAA
      return ipv6FromBytes(rdata)
    case 2: // NS
    case 5: // CNAME
    case 12: // PTR
      return readDomainName(message, rdataOffset).name
    case 15: {
      // MX
      if (rdata.length < 3) {
        return ""
      }
      const preference = (rdata[0] << 8) | rdata[1]
      const exchange = readDomainName(message, rdataOffset + 2).name
      return `${preference} ${exchange}`
    }
    case 16: {
      // TXT
      const chunks: string[] = []
      let index = 0
      while (index < rdata.length) {
        const length = rdata[index]
        index += 1
        const end = Math.min(index + length, rdata.length)
        const textBytes = rdata.slice(index, end)
        chunks.push(`"${String.fromCharCode(...textBytes)}"`)
        index = end
      }
      return chunks.join(" ")
    }
    case 33: {
      // SRV
      if (rdata.length < 7) {
        return ""
      }
      const priority = (rdata[0] << 8) | rdata[1]
      const weight = (rdata[2] << 8) | rdata[3]
      const port = (rdata[4] << 8) | rdata[5]
      const target = readDomainName(message, rdataOffset + 6).name
      return `${priority} ${weight} ${port} ${target}`
    }
    default:
      return Array.from(rdata)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
  }
}

function ipv6FromBytes(bytes: Uint8Array): string {
  if (bytes.length !== 16) {
    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
  }

  const groups = []
  for (let i = 0; i < 16; i += 2) {
    groups.push(((bytes[i] << 8) | bytes[i + 1]).toString(16))
  }

  let bestStart = -1
  let bestLength = 0
  let currentStart = -1
  let currentLength = 0

  for (let i = 0; i < groups.length; i++) {
    if (groups[i] === "0") {
      if (currentStart === -1) {
        currentStart = i
      }
      currentLength++
      if (currentLength > bestLength) {
        bestStart = currentStart
        bestLength = currentLength
      }
    } else {
      currentStart = -1
      currentLength = 0
    }
  }

  if (bestLength > 1) {
    const compressed: string[] = []
    let i = 0
    while (i < groups.length) {
      if (i === bestStart) {
        compressed.push("")
        i += bestLength
        if (i >= groups.length) {
          compressed.push("")
        }
      } else {
        compressed.push(groups[i].replace(/^0+/, "") || "0")
        i++
      }
    }
    let result = compressed.join(":")
    result = result.replace(/:{3,}/, "::")
    if (result.startsWith(":")) {
      result = `:${result}`
    }
    if (result.endsWith(":")) {
      result = `${result}:`
    }
    return result
  }

  return groups.map((group) => group.replace(/^0+/, "") || "0").join(":")
}

function trimTrailingDot(value: string): string {
  return value.endsWith(".") ? value.slice(0, -1) : value
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

export function calculateMTU(
  linkMTU: number,
  protocols: Array<{ name: string; size: number }>
): MTUCalculation {
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
  const iid =
    `${eui64.slice(0, 4)}:${eui64.slice(4, 8)}:${eui64.slice(8, 12)}:${eui64.slice(12, 16)}`.toLowerCase()

  // Combine with prefix
  const prefixPart = prefix.split("::")[0] || prefix.split("/")[0]
  return `${prefixPart}${iid}`
}
