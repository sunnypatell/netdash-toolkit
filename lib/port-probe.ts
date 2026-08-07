import { blockedPortService, isBlockedPort, pageIsHttps } from "./browser-limits"

// a failed fetch cannot tell closed from filtered, but browser-blocked is provable without
// sending anything, so it is reported separately rather than hidden in unknown
export type PortState = "open" | "closed" | "filtered" | "unknown" | "browser-blocked"

export type ScanMethod = "tcp-connect" | "http-probe"

export interface PortProbeResult {
  port: number
  service: string
  state: PortState
  method: ScanMethod
  responseTime?: number
  // why this state, when the state alone would be misread
  detail?: string
}

export const COMMON_PORTS = [
  { port: 21, service: "FTP" },
  { port: 22, service: "SSH" },
  { port: 23, service: "Telnet" },
  { port: 25, service: "SMTP" },
  { port: 53, service: "DNS" },
  { port: 80, service: "HTTP" },
  { port: 110, service: "POP3" },
  { port: 143, service: "IMAP" },
  { port: 443, service: "HTTPS" },
  { port: 993, service: "IMAPS" },
  { port: 995, service: "POP3S" },
  { port: 3389, service: "RDP" },
  { port: 5432, service: "PostgreSQL" },
  { port: 3306, service: "MySQL" },
  { port: 1433, service: "MSSQL" },
  { port: 27017, service: "MongoDB" },
] as const

// a name from a static table, never a banner read off the wire
export function serviceNameFor(port: number): string {
  return COMMON_PORTS.find((p) => p.port === port)?.service ?? blockedPortService(port) ?? "Unknown"
}

export const MAX_PORTS_PER_SCAN = 512

export interface PortListParse {
  ports: number[]
  errors: string[]
}

// accepts "80", "80,443", "8000-8010" and any mix, because the registry has
// advertised custom ranges since day one while the input only took a flat list
export function parsePortList(input: string): PortListParse {
  const ports = new Set<number>()
  const errors: string[] = []

  for (const rawPart of input.split(",")) {
    const part = rawPart.trim()
    if (!part) continue

    const range = /^(\d{1,5})\s*-\s*(\d{1,5})$/.exec(part)
    if (range) {
      const start = Number(range[1])
      const end = Number(range[2])
      if (!isPort(start) || !isPort(end)) {
        errors.push(`${part}: ports must be between 1 and 65535`)
        continue
      }
      if (end < start) {
        errors.push(`${part}: the range ends before it starts`)
        continue
      }
      for (let port = start; port <= end; port++) ports.add(port)
      continue
    }

    if (!/^\d{1,5}$/.test(part)) {
      errors.push(`${part}: not a port number or range`)
      continue
    }
    const port = Number(part)
    if (!isPort(port)) {
      errors.push(`${part}: ports must be between 1 and 65535`)
      continue
    }
    ports.add(port)
  }

  const sorted = [...ports].sort((a, b) => a - b)
  if (sorted.length > MAX_PORTS_PER_SCAN) {
    errors.push(
      `${sorted.length} ports requested; only the first ${MAX_PORTS_PER_SCAN} will be probed`
    )
    return { ports: sorted.slice(0, MAX_PORTS_PER_SCAN), errors }
  }
  return { ports: sorted, errors }
}

function isPort(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 65535
}

// injectable so the probe logic is testable without opening a socket
export type ProbeTransport = (url: string) => Promise<void>

const defaultTransport: ProbeTransport = async (url) => {
  await fetch(url, { method: "HEAD", mode: "no-cors", signal: AbortSignal.timeout(2000) })
}

export interface HttpProbeOptions {
  transport?: ProbeTransport
  scheme?: "http" | "https"
  now?: () => number
}

export async function probePortOverHttp(
  host: string,
  port: number,
  options: HttpProbeOptions = {}
): Promise<PortProbeResult> {
  const service = serviceNameFor(port)

  if (isBlockedPort(port)) {
    // the fetch standard's port blocking makes this fail before a packet leaves,
    // so reporting it as unknown would blame the host for the browser's refusal
    return {
      port,
      service,
      state: "browser-blocked",
      method: "http-probe",
      detail: `The Fetch Standard's port blocking list refuses any fetch to port ${port} (${blockedPortService(port)}), so nothing was sent and the port's real state is unmeasurable here.`,
    }
  }

  const transport = options.transport ?? defaultTransport
  const scheme = options.scheme ?? (pageIsHttps() ? "https" : "http")
  const now = options.now ?? (() => performance.now())
  const start = now()

  try {
    await transport(`${scheme}://${host}:${port}`)
    return {
      port,
      service,
      state: "open",
      method: "http-probe",
      responseTime: now() - start,
      detail: `Something accepted a ${scheme.toUpperCase()} request on this port. The response is opaque, so its status code and identity are unknown.`,
    }
  } catch {
    // never guess: this branch used to report Math.random() > 0.8 as "open"
    return {
      port,
      service,
      state: "unknown",
      method: "http-probe",
      detail: `The ${scheme.toUpperCase()} probe did not complete. Closed, filtered, non-HTTP service, TLS mismatch and content blocker all fail identically here, so the state is undeterminable.`,
    }
  }
}

export function summarizeStates(results: PortProbeResult[]): Record<PortState, number> {
  const counts: Record<PortState, number> = {
    open: 0,
    closed: 0,
    filtered: 0,
    unknown: 0,
    "browser-blocked": 0,
  }
  for (const result of results) counts[result.state] += 1
  return counts
}
