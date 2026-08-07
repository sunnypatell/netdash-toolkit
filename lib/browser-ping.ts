import { pageIsHttps } from "./browser-limits"

// a browser cannot send an ICMP echo, so this number includes dns, tcp, tls and a full
// request/response and must not be read against ICMP rtt guidance
export type ProbeTransport = "icmp" | "https-round-trip" | "http-round-trip"

export interface ReachabilityResult {
  host: string
  timestamp: number
  success: boolean
  transport: ProbeTransport
  roundTripMs?: number
  // icmp only: the desktop app sends several echoes
  packetsSent?: number
  packetLossPercent?: number
  minMs?: number
  maxMs?: number
  // http only: which method answered, and whether a scheme fallback was needed
  methodUsed?: "HEAD" | "GET"
  schemeFallback?: boolean
  error?: string
}

export function describeTransport(transport: ProbeTransport): string {
  switch (transport) {
    case "icmp":
      return "ICMP echo, round-trip time of the packet itself"
    case "https-round-trip":
      return "HTTPS round trip: DNS + TCP handshake + TLS handshake + request and response"
    case "http-round-trip":
      return "HTTP round trip: DNS + TCP handshake + request and response"
  }
}

export interface PingTarget {
  displayHost: string
  urls: string[]
  // set when the requested http:// probe was dropped as mixed content, so the ui can say so
  insecureDropped: boolean
}

// a bare "host:port" is not an ipv6 literal. treating any colon as ipv6 bracketed
// example.com:8443 into [example.com:8443] and then rejected the whole target.
function looksLikeIPv6Literal(value: string): boolean {
  return (value.match(/:/g) ?? []).length > 1 && !value.includes("/")
}

export function parsePingTarget(input: string, https = pageIsHttps()): PingTarget | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const hasScheme = /^[a-zA-Z][a-zA-Z\d+-.]*:\/\//.test(trimmed)
  const addSchemeIfMissing = () => {
    const needsBrackets =
      looksLikeIPv6Literal(trimmed) && !trimmed.startsWith("[") && !trimmed.endsWith("]")
    const hostPort = needsBrackets ? `[${trimmed}]` : trimmed
    // default a bare host to the page's own scheme. defaulting to http meant every
    // probe on the deployed https site was blocked as mixed content before it left.
    return `${https ? "https" : "http"}://${hostPort}`
  }

  let url: URL
  try {
    url = new URL(hasScheme ? trimmed : addSchemeIfMissing())
  } catch {
    return null
  }
  if (!["http:", "https:"].includes(url.protocol)) return null

  const primary = url.protocol === "http:" ? "http" : "https"
  const alternate = primary === "http" ? "https" : "http"
  const candidates = Array.from(new Set([`${primary}://${url.host}`, `${alternate}://${url.host}`]))
  const urls = candidates.filter((u) => !(https && u.startsWith("http://")))

  return {
    displayHost: url.port ? `${url.hostname}:${url.port}` : url.hostname,
    urls,
    insecureDropped: hasScheme && primary === "http" && urls.length < candidates.length,
  }
}

export function transportForUrl(url: string): ProbeTransport {
  return url.startsWith("https://") ? "https-round-trip" : "http-round-trip"
}

function timeoutSignal(ms: number): AbortSignal | undefined {
  if (typeof AbortController === "undefined") return undefined
  const withTimeout = (
    AbortSignal as typeof AbortSignal & { timeout?: (ms: number) => AbortSignal }
  ).timeout
  if (typeof withTimeout === "function") return withTimeout(ms)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  controller.signal.addEventListener("abort", () => clearTimeout(timer), { once: true })
  return controller.signal
}

// injectable so the fallback ladder can be tested without touching the network
export type HttpProbe = (url: string, method: "HEAD" | "GET") => Promise<void>

const defaultProbe: HttpProbe = async (url, method) => {
  await fetch(url, { method, mode: "no-cors", cache: "no-cache", signal: timeoutSignal(5000) })
}

export interface AttemptOutcome {
  success: boolean
  roundTripMs?: number
  methodUsed?: "HEAD" | "GET"
  methodFallback?: boolean
  error?: unknown
}

export async function attemptHttpProbe(
  url: string,
  probe: HttpProbe = defaultProbe,
  now: () => number = () => performance.now()
): Promise<AttemptOutcome> {
  const methods: Array<"HEAD" | "GET"> = ["HEAD", "GET"]
  let lastError: unknown = null

  for (let i = 0; i < methods.length; i++) {
    const start = now()
    try {
      await probe(url, methods[i])
      return {
        success: true,
        roundTripMs: now() - start,
        methodUsed: methods[i],
        methodFallback: i > 0,
      }
    } catch (error) {
      lastError = error
    }
  }
  return { success: false, error: lastError }
}

export function formatProbeError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "AbortError") return "Request timed out"
    return error.message || error.name
  }
  if (error instanceof Error) return error.message
  return "Host unreachable, blocked, or not answering HTTP"
}
