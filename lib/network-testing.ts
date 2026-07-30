// Network testing utilities for RTT, throughput, and connectivity

import * as dnsPacket from "@dnsquery/dns-packet"
import {
  toString as wireTypeToString,
  toType as wireTypeToType,
} from "@dnsquery/dns-packet/types.js"
import { compressIPv6, expandIPv6, solicitedNodeMulticast } from "@/lib/network-utils"

// DNS Cache implementation with TTL support
interface DNSCacheEntry {
  result: DNSResult
  expiresAt: number
  minTTL: number
}

// map iteration order is insertion order, so "least recently used" only holds
// if every read re-inserts its key. get() below does that; without it the
// eviction policy was plain fifo.
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

    // touch: move to the most-recently-used end of the map
    this.cache.delete(key)
    this.cache.set(key, entry)

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

    const key = this.getCacheKey(domain, recordType, provider)
    // re-setting an existing key keeps its old position, so drop it first
    this.cache.delete(key)

    // Enforce max cache size by evicting the least recently used entry
    if (this.cache.size >= this.maxSize) {
      const lruKey = this.cache.keys().next().value
      if (lruKey) {
        this.cache.delete(lruKey)
      }
    }

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
  truncated?: boolean
  error?: string
  timestamp: number
}

export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  // even counts average the two middle samples
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

// nearest-rank method: sorted[ceil(p/100 * n) - 1]
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.ceil((percentile / 100) * sorted.length)
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1]
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

  const median = calculateMedian(results)
  const p95 = calculatePercentile(results, 95)
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

      const startTime = performance.now()
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      let normalized: NormalizedDNSResponse

      try {
        if (providerConfig.format === "json") {
          // json providers take the type by name, so an exotic type is the
          // resolver's call to make rather than something to reject up front
          const urlObject = new URL(providerConfig.url)
          urlObject.searchParams.set("name", domain)
          urlObject.searchParams.set("type", recordType.toUpperCase())

          const response = await fetch(urlObject.toString(), {
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
          const recordTypeCode = getRecordTypeCode(recordType)
          if (recordTypeCode === undefined) {
            throw new Error(
              `${provider} needs a wire-format query and record type ${recordType.toUpperCase()} has no known type code`
            )
          }

          const wireQuery = buildDnsQueryMessage(domain, recordTypeCode)
          const encodedQuery = encodeDnsQuery(wireQuery)
          const urlObject = new URL(providerConfig.url)
          urlObject.searchParams.set("dns", encodedQuery)

          const response = await fetch(urlObject.toString(), {
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
      } finally {
        // this only ran on the success path before, leaking a timer per error
        clearTimeout(timeoutId)
      }

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
        truncated: normalized.truncated,
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
  truncated: boolean
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
  const tcFlag = Boolean(data?.TC ?? data?.Tc ?? data?.tc)

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
    truncated: tcFlag,
    Answer: answers,
  }
}

// dns-packet's tables predate the svcb family; everything else comes from there
const EXTRA_RECORD_TYPE_CODES: Record<string, number> = {
  SVCB: 64,
  HTTPS: 65,
}

// undefined means "no known type code", which only blocks wire-format providers
function getRecordTypeCode(type: string): number | undefined {
  const name = type.trim().toUpperCase()
  if (!name) return undefined

  if (EXTRA_RECORD_TYPE_CODES[name] !== undefined) {
    return EXTRA_RECORD_TYPE_CODES[name]
  }

  // rfc 3597 numeric escapes, plus the "UNKNOWN_n" spelling dns-packet decodes to
  const numeric = name.match(/^(?:TYPE|UNKNOWN_)(\d{1,5})$/)
  if (numeric) {
    const code = Number(numeric[1])
    return code <= 0xffff ? code : undefined
  }

  const code = wireTypeToType(name)
  return code === 0 ? undefined : code
}

// Helper function to get record type name from number
function getRecordTypeName(type: number): string {
  const extra = Object.keys(EXTRA_RECORD_TYPE_CODES).find(
    (name) => EXTRA_RECORD_TYPE_CODES[name] === type
  )
  if (extra) return extra

  const name = wireTypeToString(type)
  return name.startsWith("UNKNOWN_") ? `TYPE${type}` : name
}

export function buildDnsQueryMessage(domain: string, recordType: number): Uint8Array {
  const name = trimTrailingDot(domain)
    .split(".")
    .map((label) => label.trim())
    .filter(Boolean)
    .join(".")

  return dnsPacket.encode({
    type: "query",
    id: Math.floor(Math.random() * 0xffff),
    flags: dnsPacket.RECURSION_DESIRED,
    // round-trip through dns-packet's own table so unnamed types stay numeric
    questions: [{ type: wireTypeToString(recordType), name }],
    // edns0 opt rr (rfc 6891): 4096-byte payload size, do bit requests dnssec records
    additionals: [
      {
        type: "OPT",
        name: ".",
        udpPayloadSize: 4096,
        flags: dnsPacket.DNSSEC_OK,
      } as unknown as dnsPacket.Answer,
    ],
  })
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === "function") {
    let binary = ""
    for (const byte of bytes) {
      binary += String.fromCharCode(byte)
    }
    return btoa(binary)
  }

  const nodeBuffer = typeof globalThis !== "undefined" ? (globalThis as any).Buffer : undefined
  if (nodeBuffer) {
    return nodeBuffer.from(bytes).toString("base64")
  }

  throw new Error("Base64 encoding not available in this environment")
}

function encodeDnsQuery(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

export function parseDnsMessage(message: Uint8Array): NormalizedDNSResponse {
  if (message.length < 12) {
    throw new Error("DNS response too short")
  }

  const decoded = dnsPacket.decode(message)

  const answers: NormalizedDNSAnswer[] = (decoded.answers ?? []).map((answer) => ({
    name: trimTrailingDot(answer.name ?? ""),
    type: getRecordTypeCode(answer.type) ?? 255,
    ttl: answer.ttl ?? 0,
    data: formatAnswerData(answer),
  }))

  return {
    // decode() strips only the qr bit, so the rcode nibble is still in flags
    Status: (decoded.flags ?? 0) & 0x000f,
    AD: decoded.flag_ad === true,
    // tc bit: answer section was cut off, callers should flag incomplete results
    truncated: decoded.flag_tc === true,
    Answer: answers,
  }
}

const textDecoder = new TextDecoder()

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function quoteTxtString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

// each character-string stays its own quoted token: a multi-string txt record is
// semantically a list, and joining them changes what spf/dkim parsers would see
function formatTxtStrings(data: dnsPacket.TxtData): string {
  const parts = Array.isArray(data) ? data : [data]
  return parts
    .map((part) => quoteTxtString(typeof part === "string" ? part : textDecoder.decode(part)))
    .join(" ")
}

function formatAnswerData(answer: dnsPacket.Answer): string {
  const data = answer.data as unknown

  switch (answer.type) {
    case "A":
    case "CNAME":
    case "DNAME":
    case "NS":
    case "PTR":
      return trimTrailingDot(String(data))
    case "AAAA":
      // the underlying ip codec compresses the *first* zero run, not the
      // longest, so its output is not rfc 5952 canonical
      return compressIPv6(String(data))
    case "MX": {
      const mx = data as dnsPacket.MxData
      return `${mx.preference ?? 0} ${trimTrailingDot(mx.exchange)}`
    }
    case "SOA": {
      const soa = data as dnsPacket.SoaData
      return [
        trimTrailingDot(soa.mname),
        trimTrailingDot(soa.rname),
        soa.serial ?? 0,
        soa.refresh ?? 0,
        soa.retry ?? 0,
        soa.expire ?? 0,
        soa.minimum ?? 0,
      ].join(" ")
    }
    case "SRV": {
      const srv = data as dnsPacket.SrvData
      return `${srv.priority ?? 0} ${srv.weight ?? 0} ${srv.port ?? 0} ${trimTrailingDot(srv.target)}`
    }
    case "TXT":
      return formatTxtStrings(data as dnsPacket.TxtData)
    case "CAA": {
      const caa = data as dnsPacket.CaaData
      return `${caa.flags ?? 0} ${caa.tag} ${quoteTxtString(caa.value)}`
    }
    case "DS": {
      const ds = data as dnsPacket.DigestData
      return `${ds.keyTag} ${ds.algorithm} ${ds.digestType} ${toHex(ds.digest)}`
    }
    case "DNSKEY": {
      const key = data as dnsPacket.DNSKeyData
      // protocol field is always 3 (rfc 4034 2.1.2) and dns-packet drops it
      return `${key.flags} 3 ${key.algorithm} ${bytesToBase64(key.key as unknown as Uint8Array)}`
    }
    case "HINFO": {
      const hinfo = data as dnsPacket.HInfoData
      return `${quoteTxtString(hinfo.cpu)} ${quoteTxtString(hinfo.os)}`
    }
    default:
      return data instanceof Uint8Array ? toHex(data) : String(data ?? "")
  }
}

function trimTrailingDot(value: string): string {
  return value.endsWith(".") ? value.slice(0, -1) : value
}

// leading underscores are legal in srv/dmarc/dkim/tlsa owner names, and the old
// regex rejected them before a query could even be built
const DOMAIN_LABEL = /^_?[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/

// Helper function to validate domain names
function isValidDomain(domain: string): boolean {
  const name = trimTrailingDot(domain)
  if (!name || name.length > 253) return false
  return name.split(".").every((label) => label.length <= 63 && DOMAIN_LABEL.test(label))
}

// Helper function to format record data based on type (json provider payloads)
function formatRecordData(data: string, type: number): string {
  switch (type) {
    case 15: {
      // MX
      const parts = data.trim().split(/\s+/)
      return parts.length >= 2 ? `${parts[0]} ${trimTrailingDot(parts[1])}` : data
    }
    case 16:
      // TXT
      return normalizeJsonTxtData(data)
    default:
      return data
  }
}

// json resolvers hand back txt already quoted per character-string; stripping
// the quotes (as this used to) collapses a multi-string record into one blob
function normalizeJsonTxtData(data: string): string {
  const quoted = data.match(/"(?:\\.|[^"\\])*"/g)
  if (quoted && quoted.length > 0) {
    return quoted.join(" ")
  }
  return quoteTxtString(data)
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
    fragmentationWarning: payloadMTU < 1280, // IPv6 minimum MTU (RFC 8200 section 5)
  }
}

// common protocol overhead sizes in bytes, single source shared across tools
export const PROTOCOL_OVERHEADS = {
  "Ethernet II": 14,
  "802.1Q": 4,
  QinQ: 8, // full 802.1ad double-tag figure (2x 4-byte tags)
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

// legacy alias kept for existing importers
export const protocolOverheads = PROTOCOL_OVERHEADS

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

// single implementation lives in network-utils; the local copy mis-sliced
// unpadded groups. re-exported under the old name for existing importers.
export function generateSolicitedNodeMulticast(ipv6: string): string {
  return solicitedNodeMulticast(ipv6)
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
  const flippedOctet = (firstOctet ^ 0x02).toString(16).padStart(2, "0")

  const eui64 = (flippedOctet + firstHalf.slice(2) + "FFFE" + secondHalf).toLowerCase()
  const iidGroups = [eui64.slice(0, 4), eui64.slice(4, 8), eui64.slice(8, 12), eui64.slice(12, 16)]

  // expand so compressed prefixes like "2001:db8::" contribute proper zero groups
  const prefixGroups = expandIPv6(prefix.split("/")[0]).split(":").slice(0, 4)
  return compressIPv6([...prefixGroups, ...iidGroups].join(":"))
}
