/**
 * NetDash Toolkit - Network Handlers
 *
 * Every handler here runs in the main process and either spawns a system binary
 * or opens a socket, on input that came from the renderer. Validation, bounds and
 * lifecycle live here; the pure parts live in ./validation and ./parsers so they
 * can be tested without electron.
 *
 * @author Sunny Patel
 * @license MIT
 */

import { ipcMain } from "electron"
import type { ChildProcess } from "child_process"
import { spawn } from "child_process"
import { existsSync } from "fs"
import * as dns from "dns"
import * as net from "net"
import * as os from "os"
import {
  buildPingArgs,
  buildTracerouteArgs,
  parseArpOutput,
  parsePingLoss,
  parsePingOutput,
  parseTracerouteOutput,
  type ArpEntry,
  type TracerouteHop,
} from "./parsers"
import { resolveCommandPath, validateDnsServer, validateHost, validatePorts } from "./validation"

// ============================================================================
// BOUNDS
// ============================================================================

// nothing the renderer sends may exceed these. they exist because a renderer
// that is not the app (see navigation.ts) would otherwise decide how much work
// the privileged process does.
const MAX_COMMAND_MS = 120_000
const MAX_OUTPUT_BYTES = 1_000_000
const MAX_OPEN_SOCKETS = 256
const DNS_TIMEOUT_MS = 5_000
const ARP_TIMEOUT_MS = 10_000

type LogLevel = "info" | "warn" | "error" | "debug"

function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString()
  const prefix = `[NetDash][${timestamp}][${level.toUpperCase()}]`
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log

  if (data) {
    sink(`${prefix} ${message}`, JSON.stringify(data))
  } else {
    sink(`${prefix} ${message}`)
  }
}

// ============================================================================
// OPTION READING
// ============================================================================

function readOption(options: unknown, key: string): unknown {
  if (typeof options !== "object" || options === null) return undefined
  return (options as Record<string, unknown>)[key]
}

// a non-number reaching Math.min used to produce NaN and then the literal string
// "NaN" on a command line, so the type check is not decoration
function clampOption(
  options: unknown,
  key: string,
  fallback: number,
  min: number,
  max: number
): number {
  const raw = readOption(options, key)
  if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback
  return Math.min(Math.max(Math.floor(raw), min), max)
}

function readStringOption(options: unknown, key: string): string | undefined {
  const raw = readOption(options, key)
  return typeof raw === "string" ? raw : undefined
}

// ============================================================================
// RESOURCE LIFECYCLE
// ============================================================================

const activeChildren = new Set<ChildProcess>()
const activeSockets = new Set<net.Socket>()

/**
 * Called from app quit. A scan in flight owns real child processes and real
 * sockets; without this they outlive the window that asked for them.
 */
export function shutdownNetworkHandlers(): void {
  for (const child of activeChildren) child.kill("SIGKILL")
  activeChildren.clear()

  for (const socket of activeSockets) socket.destroy()
  activeSockets.clear()
}

// a global ceiling on concurrent connect attempts. the per-request concurrency
// cap alone does not bound anything, because the renderer can invoke the handler
// as many times as it likes.
let openSockets = 0
const socketWaiters: Array<() => void> = []

function acquireSocketSlot(): Promise<void> {
  if (openSockets < MAX_OPEN_SOCKETS) {
    openSockets += 1
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    socketWaiters.push(() => {
      openSockets += 1
      resolve()
    })
  })
}

function releaseSocketSlot(): void {
  openSockets -= 1
  socketWaiters.shift()?.()
}

// ============================================================================
// COMMAND EXECUTION
// ============================================================================

async function executeCommand(
  command: string,
  args: string[],
  timeout: number
): Promise<{ stdout: string; stderr: string }> {
  const bounded = Math.min(timeout, MAX_COMMAND_MS)

  return new Promise((resolve, reject) => {
    const fullCommand = resolveCommandPath(
      command,
      process.platform,
      existsSync,
      process.env.SystemRoot
    )

    log("debug", `Executing command: ${fullCommand} ${args.join(" ")}`)

    // argument array, no shell, absolute path where one exists
    const child = spawn(fullCommand, args, { windowsHide: true })
    activeChildren.add(child)

    let stdout = ""
    let stderr = ""
    let settled = false
    let escalation: NodeJS.Timeout | null = null

    const settle = (finish: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(deadline)
      finish()
    }

    const collect = (chunk: Buffer, into: "stdout" | "stderr") => {
      const text = chunk.toString()
      if (into === "stdout") {
        if (stdout.length < MAX_OUTPUT_BYTES) stdout += text
      } else if (stderr.length < MAX_OUTPUT_BYTES) {
        stderr += text
      }
    }

    child.stdout?.on("data", (chunk: Buffer) => collect(chunk, "stdout"))
    child.stderr?.on("data", (chunk: Buffer) => collect(chunk, "stderr"))

    const forget = () => {
      activeChildren.delete(child)
      if (escalation) {
        clearTimeout(escalation)
        escalation = null
      }
    }

    child.on("error", (error: NodeJS.ErrnoException) => {
      forget()
      settle(() => {
        if (error.code === "ENOENT") {
          reject(
            new Error(
              `Command not found: ${fullCommand}. The required network tool may not be installed.`
            )
          )
        } else if (error.code === "EACCES") {
          reject(
            new Error(`Permission denied: ${fullCommand}. Try running with elevated privileges.`)
          )
        } else {
          reject(error)
        }
      })
    })

    child.on("close", (code) => {
      forget()
      settle(() => {
        // ping exits non-zero on an unreachable host but still prints its summary
        if (stdout) return resolve({ stdout, stderr })

        // "cannot resolve host: Unknown host" only ever reaches stderr, and
        // discarding it turned a name failure into a silent 100% packet loss
        const diagnostic = stderr.trim().split("\n")[0]
        if (code !== 0) {
          return reject(new Error(diagnostic || `Command failed with exit code ${code}`))
        }
        resolve({ stdout, stderr })
      })
    })

    const deadline = setTimeout(() => {
      child.kill("SIGTERM")
      // child.killed only records that a signal was sent, so escalation cannot
      // be conditional on it
      escalation = setTimeout(() => child.kill("SIGKILL"), 1000)
      escalation.unref()

      settle(() => {
        if (stdout) resolve({ stdout, stderr })
        else reject(new Error(`Command timed out after ${bounded}ms`))
      })
    }, bounded)
  })
}

// ============================================================================
// PORT SCANNING
// ============================================================================

export interface PortScanResult {
  port: number
  state: "open" | "closed" | "filtered"
  service?: string
  responseTime?: number
}

/**
 * One real TCP connect attempt. Every exit path destroys the socket.
 */
export async function scanPort(
  host: string,
  port: number,
  timeout: number
): Promise<PortScanResult> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    activeSockets.add(socket)

    let resolved = false
    const startTime = Date.now()

    const cleanup = (state: "open" | "closed" | "filtered") => {
      if (resolved) return
      resolved = true

      const responseTime = Date.now() - startTime
      activeSockets.delete(socket)
      socket.destroy()

      resolve({
        port,
        state,
        service: getServiceName(port),
        responseTime: state === "open" ? responseTime : undefined,
      })
    }

    socket.setTimeout(timeout)
    socket.on("connect", () => cleanup("open"))
    socket.on("timeout", () => cleanup("filtered"))

    socket.on("error", (err: NodeJS.ErrnoException) => {
      // refused means something answered; everything else is indistinguishable
      // from a filter at this layer
      cleanup(err.code === "ECONNREFUSED" ? "closed" : "filtered")
    })

    socket.on("close", () => cleanup("filtered"))

    try {
      socket.connect(port, host)
    } catch {
      cleanup("filtered")
    }
  })
}

// ============================================================================
// NETWORK HANDLERS
// ============================================================================

const DNS_RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "NS", "TXT", "SOA", "PTR", "SRV"] as const
type DnsRecordType = (typeof DNS_RECORD_TYPES)[number]

interface DnsRecord {
  type: string
  value: string
  ttl?: number
}

function isDnsRecordType(value: string): value is DnsRecordType {
  return (DNS_RECORD_TYPES as readonly string[]).includes(value)
}

// a switch rather than resolve(host, type as any): it keeps the call typed and
// it is the only way to ask node for the ttl, which the return type promises
async function resolveRecords(
  resolver: dns.promises.Resolver,
  hostname: string,
  type: DnsRecordType
): Promise<DnsRecord[]> {
  switch (type) {
    case "A":
      return (await resolver.resolve4(hostname, { ttl: true })).map((record) => ({
        type,
        value: record.address,
        ttl: record.ttl,
      }))
    case "AAAA":
      return (await resolver.resolve6(hostname, { ttl: true })).map((record) => ({
        type,
        value: record.address,
        ttl: record.ttl,
      }))
    case "CNAME":
      return (await resolver.resolveCname(hostname)).map((value) => ({ type, value }))
    case "NS":
      return (await resolver.resolveNs(hostname)).map((value) => ({ type, value }))
    case "PTR":
      return (await resolver.resolvePtr(hostname)).map((value) => ({ type, value }))
    case "TXT":
      return (await resolver.resolveTxt(hostname)).map((chunks) => ({
        type,
        value: JSON.stringify(chunks),
      }))
    case "MX":
      return (await resolver.resolveMx(hostname)).map((record) => ({
        type,
        value: JSON.stringify(record),
      }))
    case "SRV":
      return (await resolver.resolveSrv(hostname)).map((record) => ({
        type,
        value: JSON.stringify(record),
      }))
    case "SOA":
      return [{ type, value: JSON.stringify(await resolver.resolveSoa(hostname)) }]
  }
}

export function registerNetworkHandlers() {
  log("info", "Registering network handlers")

  // --------------------------------
  // PING
  // --------------------------------
  ipcMain.handle("network:ping", async (_event, host: unknown, options: unknown) => {
    const validation = validateHost(host)
    if (!validation.valid) {
      log("warn", "Ping validation failed", { error: validation.error })
      return {
        host: typeof host === "string" ? host : "",
        alive: false,
        time: 0,
        min: 0,
        max: 0,
        avg: 0,
        packetLoss: 100,
        times: [],
        error: validation.error,
      }
    }

    const sanitizedHost = validation.sanitized
    const count = clampOption(options, "count", 4, 1, 10)
    const timeout = clampOption(options, "timeout", 5000, 1000, 30000)

    log("info", "Starting ping", { host: sanitizedHost, count, timeout })

    try {
      const platform = process.platform
      const args = buildPingArgs(platform, sanitizedHost, count, timeout)

      const startTime = Date.now()
      const result = await executeCommand("ping", args, timeout * count + 5000)
      const totalTime = Date.now() - startTime

      const times = parsePingOutput(result.stdout, platform)
      const alive = times.length > 0
      // prefer the figure ping printed: it knows how many probes it actually
      // sent, which our own count is only a request for
      const reportedLoss = parsePingLoss(result.stdout)
      const packetLoss =
        reportedLoss ?? Math.min(100, Math.max(0, ((count - times.length) / count) * 100))

      log("info", "Ping completed", { host: sanitizedHost, alive, packetLoss })

      return {
        host: sanitizedHost,
        alive,
        time: totalTime,
        min: times.length > 0 ? Math.min(...times) : 0,
        max: times.length > 0 ? Math.max(...times) : 0,
        avg: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
        packetLoss,
        times,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Ping failed"
      log("error", "Ping failed", { host: sanitizedHost, error: errorMessage })

      return {
        host: sanitizedHost,
        alive: false,
        time: 0,
        min: 0,
        max: 0,
        avg: 0,
        packetLoss: 100,
        times: [],
        error: errorMessage,
      }
    }
  })

  // --------------------------------
  // TRACEROUTE
  // --------------------------------
  ipcMain.handle("network:traceroute", async (_event, host: unknown, options: unknown) => {
    const validation = validateHost(host)
    if (!validation.valid) {
      log("warn", "Traceroute validation failed", { error: validation.error })
      return {
        destination: typeof host === "string" ? host : "",
        hops: [] as TracerouteHop[],
        error: validation.error,
      }
    }

    const sanitizedHost = validation.sanitized
    const maxHops = clampOption(options, "maxHops", 30, 1, 64)
    const timeout = clampOption(options, "timeout", 5000, 1000, 10000)

    log("info", "Starting traceroute", { host: sanitizedHost, maxHops, timeout })

    try {
      const platform = process.platform
      const args = buildTracerouteArgs(platform, sanitizedHost, maxHops, timeout)
      const command = platform === "win32" ? "tracert" : "traceroute"

      const result = await executeCommand(command, args, timeout * maxHops + 10000)
      const hops = parseTracerouteOutput(result.stdout, platform)

      log("info", "Traceroute completed", { host: sanitizedHost, hopCount: hops.length })
      return { destination: sanitizedHost, hops }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Traceroute failed"
      log("error", "Traceroute failed", { host: sanitizedHost, error: errorMessage })
      return { destination: sanitizedHost, hops: [] as TracerouteHop[], error: errorMessage }
    }
  })

  // --------------------------------
  // PORT SCAN
  // --------------------------------
  ipcMain.handle(
    "network:portScan",
    async (_event, host: unknown, ports: unknown, options: unknown) => {
      const hostValidation = validateHost(host)
      if (!hostValidation.valid) {
        log("warn", "Port scan host validation failed", { error: hostValidation.error })
        return []
      }

      const portsValidation = validatePorts(ports)
      if (!portsValidation.valid) {
        log("warn", "Port scan ports validation failed", { error: portsValidation.error })
        return []
      }

      const sanitizedHost = hostValidation.sanitized
      const sanitizedPorts = portsValidation.sanitized
      const timeout = clampOption(options, "timeout", 3000, 500, 10000)
      const concurrent = clampOption(options, "concurrent", 50, 1, 200)

      log("info", "Starting port scan", {
        host: sanitizedHost,
        portCount: sanitizedPorts.length,
        timeout,
        concurrent,
      })

      const results: PortScanResult[] = []

      for (let i = 0; i < sanitizedPorts.length; i += concurrent) {
        const batch = sanitizedPorts.slice(i, i + concurrent)
        const batchResults = await Promise.all(
          batch.map(async (port) => {
            await acquireSocketSlot()
            try {
              return await scanPort(sanitizedHost, port, timeout)
            } finally {
              releaseSocketSlot()
            }
          })
        )
        results.push(...batchResults)
      }

      log("info", "Port scan completed", {
        host: sanitizedHost,
        scanned: results.length,
        open: results.filter((r) => r.state === "open").length,
      })

      return results
    }
  )

  // --------------------------------
  // DNS LOOKUP
  // --------------------------------
  ipcMain.handle("network:dnsLookup", async (_event, hostname: unknown, options: unknown) => {
    const hostValidation = validateHost(hostname)
    if (!hostValidation.valid) {
      log("warn", "DNS lookup validation failed", { error: hostValidation.error })
      return {
        hostname: typeof hostname === "string" ? hostname : "",
        records: [] as DnsRecord[],
        server: "system",
        responseTime: 0,
        error: hostValidation.error,
      }
    }

    const requestedServer = readStringOption(options, "server")
    const serverValidation = validateDnsServer(requestedServer)
    if (!serverValidation.valid) {
      return {
        hostname: hostValidation.sanitized,
        records: [] as DnsRecord[],
        server: requestedServer ?? "system",
        responseTime: 0,
        error: serverValidation.error,
      }
    }

    const serverToUse = serverValidation.sanitized || "system"
    const sanitizedHostname = hostValidation.sanitized
    const recordType = readStringOption(options, "type") ?? "A"

    if (!isDnsRecordType(recordType)) {
      return {
        hostname: sanitizedHostname,
        records: [] as DnsRecord[],
        server: serverToUse,
        responseTime: 0,
        error: `Invalid record type. Supported: ${DNS_RECORD_TYPES.join(", ")}`,
      }
    }

    log("info", "Starting DNS lookup", {
      hostname: sanitizedHostname,
      type: recordType,
      server: serverToUse,
    })

    const startTime = Date.now()

    try {
      // per-request resolver: dns.setServers is process-global and concurrent
      // lookups would race. the timeout is explicit because the default is none,
      // and the server address came from the renderer.
      const resolver = new dns.promises.Resolver({ timeout: DNS_TIMEOUT_MS, tries: 2 })
      if (serverToUse !== "system") resolver.setServers([serverToUse])

      const records = await resolveRecords(resolver, sanitizedHostname, recordType)

      log("info", "DNS lookup completed", {
        hostname: sanitizedHostname,
        recordCount: records.length,
        responseTime: Date.now() - startTime,
      })

      return {
        hostname: sanitizedHostname,
        records,
        server: serverToUse,
        responseTime: Date.now() - startTime,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "DNS lookup failed"
      log("error", "DNS lookup failed", { hostname: sanitizedHostname, error: errorMessage })

      return {
        hostname: sanitizedHostname,
        records: [] as DnsRecord[],
        server: serverToUse,
        responseTime: Date.now() - startTime,
        error: errorMessage,
      }
    }
  })

  // --------------------------------
  // NETWORK INTERFACES
  // --------------------------------
  ipcMain.handle("network:getInterfaces", async () => {
    log("debug", "Getting network interfaces")

    const interfaces = os.networkInterfaces()
    const result: Array<{
      name: string
      mac: string
      ipv4?: string
      ipv6?: string
      netmask?: string
      internal: boolean
    }> = []

    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs || addrs.length === 0) continue

      const ipv4 = addrs.find((addr) => addr.family === "IPv4")
      const ipv6 = addrs.find((addr) => addr.family === "IPv6")

      result.push({
        name,
        mac: addrs[0].mac || "00:00:00:00:00:00",
        ipv4: ipv4?.address,
        ipv6: ipv6?.address,
        netmask: ipv4?.netmask,
        internal: addrs[0].internal,
      })
    }

    log("debug", "Network interfaces retrieved", { count: result.length })
    return result
  })

  // --------------------------------
  // ARP TABLE
  // --------------------------------
  // a cache read, not a sweep. it reports the neighbours this host has already
  // talked to and sends no packets of its own, which is why it takes no subnet.
  ipcMain.handle("network:arpTable", async () => {
    log("info", "Reading ARP table")

    try {
      const result = await executeCommand("arp", ["-a"], ARP_TIMEOUT_MS)
      const entries = parseArpOutput(result.stdout, process.platform)

      log("info", "ARP table read", { entryCount: entries.length })
      return entries
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "ARP table read failed"
      log("error", "ARP table read failed", { error: errorMessage })
      return [] as ArpEntry[]
    }
  })

  // --------------------------------
  // SYSTEM INFO
  // --------------------------------
  ipcMain.handle("system:getInfo", async () => {
    log("debug", "Getting system info")

    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      memory: os.totalmem(),
      uptime: os.uptime(),
    }
  })

  log("info", "Network handlers registered successfully")
}

// ============================================================================
// SERVICE NAME LOOKUP
// ============================================================================

const SERVICES: Record<number, string> = {
  20: "FTP-DATA",
  21: "FTP",
  22: "SSH",
  23: "Telnet",
  25: "SMTP",
  53: "DNS",
  67: "DHCP",
  68: "DHCP",
  80: "HTTP",
  110: "POP3",
  123: "NTP",
  143: "IMAP",
  161: "SNMP",
  162: "SNMP-Trap",
  443: "HTTPS",
  445: "SMB",
  465: "SMTPS",
  514: "Syslog",
  587: "SMTP-Submit",
  636: "LDAPS",
  993: "IMAPS",
  995: "POP3S",
  1433: "MSSQL",
  1521: "Oracle",
  3306: "MySQL",
  3389: "RDP",
  5432: "PostgreSQL",
  5900: "VNC",
  6379: "Redis",
  8080: "HTTP-Proxy",
  8443: "HTTPS-Alt",
  9200: "Elasticsearch",
  11211: "Memcached",
  27017: "MongoDB",
}

function getServiceName(port: number): string | undefined {
  return SERVICES[port]
}
