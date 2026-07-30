// cli output parsers for ping, traceroute and arp, plus the argument builders
// that produce the output they parse. pure on purpose: they are tested against
// recorded output from macos, linux and windows rather than live probes.
//
// the rule they follow is that a line the tool actually produced never
// disappears. an unparsed hop or arp row reads to the caller as "nothing was
// there", which is the one failure mode worth engineering against here.

export interface TracerouteHop {
  hop: number
  ip: string
  hostname?: string
  rtt: number[]
  timeout: boolean
}

export interface ArpEntry {
  ip: string
  mac: string
  interface?: string
}

const lines = (output: string): string[] => output.split(/\r?\n/)

/**
 * Round-trip times, one per probe that was answered.
 */
export function parsePingOutput(output: string, platform: string): number[] {
  const times: number[] = []
  const seen = new Set<string>()

  for (const line of lines(output)) {
    // windows localizes the "time" label (Zeit=, temps=, tiempo=) but always
    // prints it as "<label>=<n>ms" with no space after the separator, while its
    // summary block prints " = <n>ms" with one. matching the shape instead of
    // the english word stops non-english installs reporting 100% loss.
    const match =
      platform === "win32"
        ? line.match(/[=<](\d+(?:[.,]\d+)?)\s?ms/i)
        : line.match(/time[=<](\d+(?:[.,]\d+)?)\s*ms/i)
    if (!match) continue

    // count each icmp sequence once so dup! replies do not inflate the count
    const seq = line.match(/icmp_seq[=\s](\d+)/i)
    if (seq) {
      if (seen.has(seq[1])) continue
      seen.add(seq[1])
    }

    times.push(parseFloat(match[1].replace(",", ".")))
  }

  return times
}

/**
 * Packet loss as ping itself reported it, or null when it printed no summary
 * (an unreachable name, or a run our own timeout killed). Every implementation
 * prints exactly one percentage and it is the loss figure, so the last percent
 * in the output is locale-independent.
 */
export function parsePingLoss(output: string): number | null {
  const matches = Array.from(output.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g))
  if (matches.length === 0) return null

  const value = parseFloat(matches[matches.length - 1][1].replace(",", "."))
  if (!Number.isFinite(value) || value < 0 || value > 100) return null
  return value
}

// tracert reports sub-millisecond hops as "<1 ms"; record the bound itself
function parseRtt(raw: string): number {
  const cleaned = raw.replace(",", ".")
  return cleaned.startsWith("<") ? Math.ceil(parseFloat(cleaned.slice(1))) : parseFloat(cleaned)
}

const TRAILING_ADDRESS = /(\d{1,3}(?:\.\d{1,3}){3}|[0-9A-Fa-f]{0,4}(?::[0-9A-Fa-f]{0,4}){2,})\s*$/
const EMBEDDED_ADDRESS =
  /(?:^|\s)(\d{1,3}(?:\.\d{1,3}){3}|[0-9A-Fa-f]{0,4}(?::[0-9A-Fa-f]{0,4}){2,})(?:\s|$)/

function parseWindowsHop(line: string): TracerouteHop | null {
  const head = line.match(/^\s*(\d+)\s+(.*)$/)
  if (!head) return null

  const rest = head[2]
  const rtt = Array.from(rest.matchAll(/(<?\d+(?:[.,]\d+)?)\s*ms/gi), (m) => parseRtt(m[1]))
  const hasStar = /(?:^|\s)\*(?:\s|$)/.test(rest)
  if (rtt.length === 0 && !hasStar) return null

  let ip = "*"
  let hostname: string | undefined

  // "one.one.one.one [192.0.2.1]" without -d, a bare address with it. anything
  // else is the localized "request timed out" text, which still has to produce a
  // hop rather than a hole in the numbering.
  const named = rest.match(/([^\s[\]]+)\s+\[([0-9A-Fa-f.:]+)\]\s*$/)
  if (named) {
    hostname = named[1]
    ip = named[2]
  } else {
    const bare = rest.match(TRAILING_ADDRESS)
    if (bare) ip = bare[1]
  }

  return { hop: parseInt(head[1], 10), ip, hostname, rtt, timeout: rtt.length === 0 }
}

function parseUnixHop(line: string): TracerouteHop | null {
  const head = line.trim().match(/^(\d+)\s+(.+)$/)
  if (!head) return null

  const rest = head[2].trim()
  const rtt = Array.from(rest.matchAll(/(\d+(?:\.\d+)?)\s*ms/g), (m) => parseFloat(m[1]))
  const hasStar = /(?:^|\s)\*(?:\s|$)/.test(rest)
  // require an rtt or a "*" so unrelated numbered lines never parse as hops
  if (rtt.length === 0 && !hasStar) return null

  let ip = "*"
  let hostname: string | undefined

  // the address is not always first: traceroute prints " 2  * 10.0.0.1  8.1 ms"
  // when only the first probe of a hop was lost
  const named = rest.match(/(?:^|\s)([A-Za-z0-9][A-Za-z0-9.-]*)\s+\(([0-9A-Fa-f.:]+)\)/)
  if (named) {
    hostname = named[1]
    ip = named[2]
  } else {
    const bare = rest.match(EMBEDDED_ADDRESS)
    if (bare) ip = bare[1]
  }

  return { hop: parseInt(head[1], 10), ip, hostname, rtt, timeout: rtt.length === 0 }
}

export function parseTracerouteOutput(output: string, platform: string): TracerouteHop[] {
  const parseHop = platform === "win32" ? parseWindowsHop : parseUnixHop
  const hops: TracerouteHop[] = []

  for (const line of lines(output)) {
    const hop = parseHop(line)
    if (hop) hops.push(hop)
  }

  return hops
}

// bsd arp prints unpadded octets ("8:0:27:1a:2b:3c"); pad every form to
// lowercase colon-separated so downstream comparisons match
export function normalizeMac(raw: string): string {
  const hex = raw.replace(/[^0-9a-fA-F]/g, "")
  if (hex.length === 12) {
    return (hex.match(/.{2}/g) ?? []).join(":").toLowerCase()
  }
  return raw
    .split(/[:-]/)
    .map((octet) => octet.padStart(2, "0"))
    .join(":")
    .toLowerCase()
}

const WINDOWS_ARP_ROW =
  /^\s*(\d{1,3}(?:\.\d{1,3}){3})\s+([0-9A-Fa-f]{2}(?:-[0-9A-Fa-f]{2}){5})(?:\s+\S+)?\s*$/
// "Interface: 192.168.1.10 --- 0xc". the label is localized, the shape is not.
const WINDOWS_ARP_INTERFACE = /^\s*[^:]+:\s*(\d{1,3}(?:\.\d{1,3}){3})\s+---/
const UNIX_ARP_ROW =
  /\(?(\d{1,3}(?:\.\d{1,3}){3})\)?\s+at\s+((?:[0-9A-Fa-f]{1,2}:){5}[0-9A-Fa-f]{1,2})(?:\s+\[\w+\])?(?:\s+on\s+([\w.]+))?/i

export function parseArpOutput(output: string, platform: string): ArpEntry[] {
  const entries: ArpEntry[] = []
  // windows groups rows under a per-interface header and identifies the
  // interface by its own address; there is no device name in the output
  let windowsInterface: string | undefined

  for (const line of lines(output)) {
    if (platform === "win32") {
      const header = line.match(WINDOWS_ARP_INTERFACE)
      if (header) {
        windowsInterface = header[1]
        continue
      }
      // the type column is localized ("dynamisch", "statique"), so matching on
      // it used to drop every row of a non-english table
      const row = line.match(WINDOWS_ARP_ROW)
      if (row) entries.push({ ip: row[1], mac: normalizeMac(row[2]), interface: windowsInterface })
      continue
    }

    const row = line.match(UNIX_ARP_ROW)
    if (row) entries.push({ ip: row[1], mac: normalizeMac(row[2]), interface: row[3] })
  }

  return entries
}

export function buildPingArgs(
  platform: string,
  host: string,
  count: number,
  timeout: number
): string[] {
  if (platform === "win32") {
    // -n count, -w per-reply timeout in milliseconds
    return ["-n", String(count), "-w", String(timeout), host]
  }

  if (platform === "darwin") {
    // -W per-packet wait in milliseconds, -t overall deadline in seconds
    return [
      "-c",
      String(count),
      "-W",
      String(timeout),
      "-t",
      String(Math.ceil((timeout * count) / 1000) + 2),
      host,
    ]
  }

  // iputils: -W per-reply wait in seconds, -w overall deadline in seconds
  const waitSeconds = Math.max(1, Math.ceil(timeout / 1000))
  return [
    "-c",
    String(count),
    "-W",
    String(waitSeconds),
    "-w",
    String(waitSeconds * count + 2),
    host,
  ]
}

export function buildTracerouteArgs(
  platform: string,
  host: string,
  maxHops: number,
  timeout: number
): string[] {
  const waitSeconds = Math.max(1, Math.ceil(timeout / 1000))

  if (platform === "win32") {
    // -h maxHops, -w timeout in milliseconds, -d to skip reverse dns
    return ["-h", String(maxHops), "-w", String(timeout), "-d", host]
  }

  // -m maxHops, -w wait in seconds, -q one probe per hop, -n to skip reverse dns
  return ["-m", String(maxHops), "-w", String(waitSeconds), "-q", "1", "-n", host]
}
