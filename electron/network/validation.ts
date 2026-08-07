// pure so every rule is assertable without electron. not a substitute for spawning without a
// shell: this layer decides what renderer input is plausible and bounds the work it can ask for.

export type Validation<T> = { valid: true; sanitized: T } | { valid: false; error: string }

export const MAX_HOST_LENGTH = 253
export const MAX_PORTS = 4096

// rejects leading zeros so "010.0.0.1" cannot be read as octal by one consumer
// and decimal by another
const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/

// allow-list of rfc 1123 hostname and ip literal characters, which excludes every shell
// metacharacter, quote, space and control byte at once
const DISALLOWED_CHARS = /[^A-Za-z0-9.:-]/

const HOSTNAME = /^(?=.{1,253}$)(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(?:\.(?!-)[a-zA-Z0-9-]{1,63}(?<!-))*$/

export function isIpv4(value: string): boolean {
  return IPV4.test(value)
}

export function isIpv6(value: string): boolean {
  if (value.length === 0 || value.length > 45) return false
  if (!/^[0-9A-Fa-f:.]+$/.test(value)) return false

  const halves = value.split("::")
  if (halves.length > 2) return false
  const compressed = halves.length === 2

  // an ipv4 tail occupies the final two groups (rfc 4291 2.2) and may only
  // appear at the very end
  const groupsIn = (segment: string): number | null => {
    if (segment === "") return 0
    const parts = segment.split(":")
    let count = 0
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (i === parts.length - 1 && part.includes(".")) {
        if (!IPV4.test(part)) return null
        count += 2
        continue
      }
      if (!/^[0-9A-Fa-f]{1,4}$/.test(part)) return null
      count += 1
    }
    return count
  }

  if (compressed && halves[0].includes(".")) return false

  const head = groupsIn(halves[0])
  if (head === null) return false
  if (!compressed) return head === 8

  const tail = groupsIn(halves[1])
  if (tail === null) return false
  return head + tail <= 7
}

export function isHostname(value: string): boolean {
  return HOSTNAME.test(value)
}

// everything reaching a command line or the resolver goes through here
export function validateHost(host: unknown): Validation<string> {
  if (typeof host !== "string" || host.length === 0) {
    return { valid: false, error: "Host is required" }
  }

  const trimmed = host.trim()

  if (trimmed.length === 0) return { valid: false, error: "Host cannot be empty" }
  if (trimmed.length > MAX_HOST_LENGTH) {
    return { valid: false, error: `Host too long (max ${MAX_HOST_LENGTH} characters)` }
  }

  // a host that starts with "-" would be read as a flag by ping and traceroute
  // even though spawn never involves a shell
  if (trimmed.startsWith("-")) {
    return { valid: false, error: "Host cannot start with '-'" }
  }

  if (DISALLOWED_CHARS.test(trimmed)) {
    return { valid: false, error: "Invalid characters in host" }
  }

  if (isIpv4(trimmed)) return { valid: true, sanitized: trimmed }

  // inet_aton reads "010.0.0.1" as octal and "2130706433" as packed, so reject all-numeric
  // values outright rather than let two layers disagree about them
  if (/^[0-9.]+$/.test(trimmed)) {
    return { valid: false, error: "Ambiguous numeric address" }
  }

  if (isIpv6(trimmed)) return { valid: true, sanitized: trimmed.toLowerCase() }
  if (isHostname(trimmed)) return { valid: true, sanitized: trimmed.toLowerCase() }

  return { valid: false, error: "Invalid hostname or IP address format" }
}

export function validatePort(port: unknown): port is number {
  return typeof port === "number" && Number.isInteger(port) && port >= 1 && port <= 65535
}

// the dedupe is the point: without it a renderer gets thousands of real connections to one port
export function validatePorts(ports: unknown): Validation<number[]> {
  if (!Array.isArray(ports)) return { valid: false, error: "Ports must be an array" }
  if (ports.length === 0) return { valid: false, error: "At least one port is required" }
  if (ports.length > MAX_PORTS) {
    return { valid: false, error: `Too many ports (max ${MAX_PORTS})` }
  }

  const seen = new Set<number>()
  const sanitized: number[] = []
  for (const port of ports) {
    if (!validatePort(port) || seen.has(port)) continue
    seen.add(port)
    sanitized.push(port)
  }

  if (sanitized.length === 0) return { valid: false, error: "No valid ports provided" }
  return { valid: true, sanitized }
}

/** Resolvers must be IP literals; a hostname would need a resolver to resolve it. */
export function validateDnsServer(server: unknown): Validation<string> {
  if (server === undefined || server === null || server === "") {
    return { valid: true, sanitized: "" } // system default
  }

  const hostValidation = validateHost(server)
  if (!hostValidation.valid) return { valid: false, error: "Invalid DNS server address" }

  const candidate = hostValidation.sanitized
  if (!isIpv4(candidate) && !isIpv6(candidate)) {
    return { valid: false, error: "DNS server must be an IP address" }
  }

  return { valid: true, sanitized: candidate }
}

const COMMAND_PATHS: Record<string, Record<string, string[]>> = {
  ping: {
    darwin: ["/sbin/ping", "/usr/bin/ping", "/usr/sbin/ping"],
    linux: ["/bin/ping", "/usr/bin/ping", "/sbin/ping"],
  },
  traceroute: {
    darwin: ["/usr/sbin/traceroute", "/usr/bin/traceroute"],
    linux: ["/usr/bin/traceroute", "/usr/sbin/traceroute", "/sbin/traceroute"],
  },
  arp: {
    darwin: ["/usr/sbin/arp", "/usr/bin/arp"],
    linux: ["/usr/sbin/arp", "/sbin/arp", "/usr/bin/arp"],
  },
}

const WINDOWS_BINARIES: Record<string, string> = {
  ping: "PING.EXE",
  tracert: "TRACERT.EXE",
  arp: "ARP.EXE",
}

// first candidate that exists wins; windows resolves under %SystemRoot% so PATH cannot be poisoned
export function resolveCommandPath(
  command: string,
  platform: string,
  exists: (candidate: string) => boolean,
  systemRoot?: string
): string {
  if (platform === "win32") {
    const binary = WINDOWS_BINARIES[command]
    if (binary && systemRoot) {
      const candidate = `${systemRoot.replace(/[\\/]+$/, "")}\\System32\\${binary}`
      if (exists(candidate)) return candidate
    }
    return command
  }

  for (const candidate of COMMAND_PATHS[command]?.[platform] ?? []) {
    if (exists(candidate)) return candidate
  }

  // platforms we do not enumerate fall through to PATH resolution
  return command
}
