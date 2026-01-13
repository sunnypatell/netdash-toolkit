/**
 * NetDash Toolkit - Network Handlers
 * Enterprise-grade network operations with security hardening
 *
 * @author Sunny Patel
 * @license MIT
 */

import { ipcMain } from "electron"
import * as os from "os"
import * as dns from "dns"
import * as net from "net"
import { exec, spawn } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

// ============================================================================
// SECURITY: Input Validation
// ============================================================================

/**
 * Validates and sanitizes hostname/IP input to prevent command injection
 * Allows: hostnames, IPv4, IPv6 addresses
 * Blocks: shell metacharacters, command injection attempts
 */
function validateHost(host: string): { valid: boolean; sanitized: string; error?: string } {
  if (!host || typeof host !== "string") {
    return { valid: false, sanitized: "", error: "Host is required" }
  }

  const trimmed = host.trim()

  if (trimmed.length === 0) {
    return { valid: false, sanitized: "", error: "Host cannot be empty" }
  }

  if (trimmed.length > 253) {
    return { valid: false, sanitized: "", error: "Host too long (max 253 characters)" }
  }

  // Block dangerous shell characters that could lead to command injection
  const dangerousChars = /[;&|`$(){}[\]<>\\'"!\n\r\t]/
  if (dangerousChars.test(trimmed)) {
    return { valid: false, sanitized: "", error: "Invalid characters in host" }
  }

  // IPv4 validation
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  if (ipv4Regex.test(trimmed)) {
    return { valid: true, sanitized: trimmed }
  }

  // IPv6 validation (simplified - covers most cases)
  const ipv6Regex = /^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$|^::(?:[a-fA-F0-9]{1,4}:){0,6}[a-fA-F0-9]{1,4}$|^(?:[a-fA-F0-9]{1,4}:){1,7}:$|^(?:[a-fA-F0-9]{1,4}:){1,6}:[a-fA-F0-9]{1,4}$|^(?:[a-fA-F0-9]{1,4}:){1,5}(?::[a-fA-F0-9]{1,4}){1,2}$|^(?:[a-fA-F0-9]{1,4}:){1,4}(?::[a-fA-F0-9]{1,4}){1,3}$|^(?:[a-fA-F0-9]{1,4}:){1,3}(?::[a-fA-F0-9]{1,4}){1,4}$|^(?:[a-fA-F0-9]{1,4}:){1,2}(?::[a-fA-F0-9]{1,4}){1,5}$|^[a-fA-F0-9]{1,4}:(?::[a-fA-F0-9]{1,4}){1,6}$/
  if (ipv6Regex.test(trimmed)) {
    return { valid: true, sanitized: trimmed }
  }

  // Hostname validation (RFC 1123)
  const hostnameRegex = /^(?=.{1,253}$)(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(?:\.(?!-)[a-zA-Z0-9-]{1,63}(?<!-))*$/
  if (hostnameRegex.test(trimmed)) {
    return { valid: true, sanitized: trimmed.toLowerCase() }
  }

  return { valid: false, sanitized: "", error: "Invalid hostname or IP address format" }
}

/**
 * Validates port number
 */
function validatePort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535
}

/**
 * Validates port array
 */
function validatePorts(ports: number[]): { valid: boolean; sanitized: number[]; error?: string } {
  if (!Array.isArray(ports)) {
    return { valid: false, sanitized: [], error: "Ports must be an array" }
  }

  if (ports.length === 0) {
    return { valid: false, sanitized: [], error: "At least one port is required" }
  }

  if (ports.length > 10000) {
    return { valid: false, sanitized: [], error: "Too many ports (max 10000)" }
  }

  const sanitized = ports.filter(validatePort)
  if (sanitized.length === 0) {
    return { valid: false, sanitized: [], error: "No valid ports provided" }
  }

  return { valid: true, sanitized }
}

/**
 * Validates DNS server address
 */
function validateDnsServer(server: string): { valid: boolean; sanitized: string; error?: string } {
  if (!server) {
    return { valid: true, sanitized: "" } // Use system default
  }

  // DNS server should be an IP address
  const hostValidation = validateHost(server)
  if (!hostValidation.valid) {
    return { valid: false, sanitized: "", error: "Invalid DNS server address" }
  }

  // Only allow IP addresses for DNS servers (not hostnames)
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  if (!ipv4Regex.test(hostValidation.sanitized)) {
    return { valid: false, sanitized: "", error: "DNS server must be an IP address" }
  }

  return { valid: true, sanitized: hostValidation.sanitized }
}

// ============================================================================
// LOGGING
// ============================================================================

type LogLevel = "info" | "warn" | "error" | "debug"

function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString()
  const prefix = `[NetDash][${timestamp}][${level.toUpperCase()}]`

  if (data) {
    console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](
      `${prefix} ${message}`,
      JSON.stringify(data)
    )
  } else {
    console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](`${prefix} ${message}`)
  }
}

// ============================================================================
// NETWORK HANDLERS
// ============================================================================

/**
 * Register all network-related IPC handlers
 */
export function registerNetworkHandlers() {
  log("info", "Registering network handlers")

  // --------------------------------
  // PING Handler
  // --------------------------------
  ipcMain.handle(
    "network:ping",
    async (
      _event,
      host: string,
      options?: { timeout?: number; count?: number }
    ) => {
      const validation = validateHost(host)
      if (!validation.valid) {
        log("warn", "Ping validation failed", { host, error: validation.error })
        return {
          host,
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
      const count = Math.min(Math.max(options?.count || 4, 1), 10) // Limit to 1-10
      const timeout = Math.min(Math.max(options?.timeout || 5000, 1000), 30000) // Limit to 1-30 seconds

      log("info", "Starting ping", { host: sanitizedHost, count, timeout })

      try {
        const platform = process.platform
        const args = buildPingArgs(platform, sanitizedHost, count, timeout)

        const startTime = Date.now()
        const result = await executeCommand("ping", args, timeout * count + 5000)
        const totalTime = Date.now() - startTime

        const times = parsePingOutput(result.stdout, platform)
        const alive = times.length > 0
        const packetLoss = ((count - times.length) / count) * 100

        log("info", "Ping completed", {
          host: sanitizedHost,
          alive,
          packetLoss,
          avgTime: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
        })

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
    }
  )

  // --------------------------------
  // TRACEROUTE Handler
  // --------------------------------
  ipcMain.handle(
    "network:traceroute",
    async (
      _event,
      host: string,
      options?: { maxHops?: number; timeout?: number }
    ) => {
      const validation = validateHost(host)
      if (!validation.valid) {
        log("warn", "Traceroute validation failed", { host, error: validation.error })
        return {
          destination: host,
          hops: [],
          error: validation.error,
        }
      }

      const sanitizedHost = validation.sanitized
      const maxHops = Math.min(Math.max(options?.maxHops || 30, 1), 64) // Limit to 1-64
      const timeout = Math.min(Math.max(options?.timeout || 5000, 1000), 10000) // Limit to 1-10 seconds

      log("info", "Starting traceroute", { host: sanitizedHost, maxHops, timeout })

      try {
        const platform = process.platform
        const args = buildTracerouteArgs(platform, sanitizedHost, maxHops, timeout)
        const command = platform === "win32" ? "tracert" : "traceroute"

        const result = await executeCommand(command, args, timeout * maxHops + 10000)
        const hops = parseTracerouteOutput(result.stdout, platform)

        log("info", "Traceroute completed", { host: sanitizedHost, hopCount: hops.length })

        return {
          destination: sanitizedHost,
          hops,
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Traceroute failed"
        log("error", "Traceroute failed", { host: sanitizedHost, error: errorMessage })

        return {
          destination: sanitizedHost,
          hops: [],
          error: errorMessage,
        }
      }
    }
  )

  // --------------------------------
  // PORT SCAN Handler
  // --------------------------------
  ipcMain.handle(
    "network:portScan",
    async (
      _event,
      host: string,
      ports: number[],
      options?: { timeout?: number; concurrent?: number }
    ) => {
      const hostValidation = validateHost(host)
      if (!hostValidation.valid) {
        log("warn", "Port scan host validation failed", { host, error: hostValidation.error })
        return []
      }

      const portsValidation = validatePorts(ports)
      if (!portsValidation.valid) {
        log("warn", "Port scan ports validation failed", { error: portsValidation.error })
        return []
      }

      const sanitizedHost = hostValidation.sanitized
      const sanitizedPorts = portsValidation.sanitized
      const timeout = Math.min(Math.max(options?.timeout || 3000, 500), 10000) // 500ms - 10s
      const concurrent = Math.min(Math.max(options?.concurrent || 50, 1), 200) // 1-200 concurrent

      log("info", "Starting port scan", {
        host: sanitizedHost,
        portCount: sanitizedPorts.length,
        timeout,
        concurrent,
      })

      const results: Array<{
        port: number
        state: "open" | "closed" | "filtered"
        service?: string
      }> = []

      // Process ports in batches
      for (let i = 0; i < sanitizedPorts.length; i += concurrent) {
        const batch = sanitizedPorts.slice(i, i + concurrent)
        const batchResults = await Promise.all(
          batch.map((port) => scanPort(sanitizedHost, port, timeout))
        )
        results.push(...batchResults)
      }

      const openPorts = results.filter((r) => r.state === "open").length
      log("info", "Port scan completed", {
        host: sanitizedHost,
        scanned: results.length,
        open: openPorts,
      })

      return results
    }
  )

  // --------------------------------
  // DNS LOOKUP Handler
  // --------------------------------
  ipcMain.handle(
    "network:dnsLookup",
    async (
      _event,
      hostname: string,
      options?: { server?: string; type?: string }
    ) => {
      const hostValidation = validateHost(hostname)
      if (!hostValidation.valid) {
        log("warn", "DNS lookup validation failed", { hostname, error: hostValidation.error })
        return {
          hostname,
          records: [],
          server: "system",
          responseTime: 0,
          error: hostValidation.error,
        }
      }

      let serverToUse = "system"
      if (options?.server) {
        const serverValidation = validateDnsServer(options.server)
        if (!serverValidation.valid) {
          return {
            hostname,
            records: [],
            server: options.server,
            responseTime: 0,
            error: serverValidation.error,
          }
        }
        serverToUse = serverValidation.sanitized || "system"
      }

      const sanitizedHostname = hostValidation.sanitized
      const recordType = options?.type || "A"
      const validTypes = ["A", "AAAA", "CNAME", "MX", "NS", "TXT", "SOA", "PTR", "SRV"]

      if (!validTypes.includes(recordType)) {
        return {
          hostname: sanitizedHostname,
          records: [],
          server: serverToUse,
          responseTime: 0,
          error: `Invalid record type. Supported: ${validTypes.join(", ")}`,
        }
      }

      log("info", "Starting DNS lookup", { hostname: sanitizedHostname, type: recordType, server: serverToUse })

      const startTime = Date.now()

      try {
        // Store original servers to restore later
        const originalServers = dns.getServers()

        // Set custom DNS server if provided
        if (serverToUse !== "system") {
          dns.setServers([serverToUse])
        }

        const records: Array<{ type: string; value: string; ttl?: number }> = []

        await new Promise<void>((resolve, reject) => {
          dns.resolve(sanitizedHostname, recordType as any, (err, addresses) => {
            // Restore original servers
            if (serverToUse !== "system") {
              try {
                dns.setServers(originalServers)
              } catch {
                // Ignore errors restoring servers
              }
            }

            if (err) {
              reject(err)
              return
            }

            if (Array.isArray(addresses)) {
              addresses.forEach((addr) => {
                if (typeof addr === "string") {
                  records.push({ type: recordType, value: addr })
                } else if (typeof addr === "object") {
                  records.push({ type: recordType, value: JSON.stringify(addr) })
                }
              })
            }
            resolve()
          })
        })

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
          records: [],
          server: serverToUse,
          responseTime: Date.now() - startTime,
          error: errorMessage,
        }
      }
    }
  )

  // --------------------------------
  // NETWORK INTERFACES Handler
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
      if (!addrs) continue

      const iface: {
        name: string
        mac: string
        ipv4?: string
        ipv6?: string
        netmask?: string
        internal: boolean
      } = {
        name,
        mac: addrs[0]?.mac || "00:00:00:00:00:00",
        internal: addrs[0]?.internal || false,
      }

      for (const addr of addrs) {
        if (addr.family === "IPv4") {
          iface.ipv4 = addr.address
          iface.netmask = addr.netmask
        } else if (addr.family === "IPv6") {
          iface.ipv6 = addr.address
        }
      }

      result.push(iface)
    }

    log("debug", "Network interfaces retrieved", { count: result.length })
    return result
  })

  // --------------------------------
  // ARP SCAN Handler
  // --------------------------------
  ipcMain.handle("network:arpScan", async () => {
    log("info", "Starting ARP scan")

    try {
      const platform = process.platform
      // ARP command is safe - no user input
      const result = await executeCommand("arp", ["-a"], 10000)
      const entries = parseArpOutput(result.stdout, platform)

      log("info", "ARP scan completed", { entryCount: entries.length })
      return entries
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "ARP scan failed"
      log("error", "ARP scan failed", { error: errorMessage })
      return []
    }
  })

  // --------------------------------
  // SYSTEM INFO Handler
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
// COMMAND EXECUTION (Safe)
// ============================================================================

/**
 * Execute a command safely using spawn (avoids shell interpretation)
 */
async function executeCommand(
  command: string,
  args: string[],
  timeout: number
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      timeout,
      windowsHide: true,
      // No shell = no command injection
    })

    let stdout = ""
    let stderr = ""

    child.stdout?.on("data", (data) => {
      stdout += data.toString()
    })

    child.stderr?.on("data", (data) => {
      stderr += data.toString()
    })

    child.on("error", (error) => {
      reject(error)
    })

    child.on("close", (code) => {
      // Some network commands return non-zero even on partial success
      resolve({ stdout, stderr })
    })

    // Timeout handling
    setTimeout(() => {
      child.kill()
      reject(new Error("Command timed out"))
    }, timeout)
  })
}

/**
 * Build ping command arguments based on platform
 */
function buildPingArgs(
  platform: string,
  host: string,
  count: number,
  timeout: number
): string[] {
  if (platform === "win32") {
    return ["-n", String(count), "-w", String(timeout), host]
  } else {
    // macOS and Linux
    return ["-c", String(count), "-W", String(Math.ceil(timeout / 1000)), host]
  }
}

/**
 * Build traceroute command arguments based on platform
 */
function buildTracerouteArgs(
  platform: string,
  host: string,
  maxHops: number,
  timeout: number
): string[] {
  if (platform === "win32") {
    return ["-h", String(maxHops), "-w", String(timeout), host]
  } else {
    // macOS and Linux
    return ["-m", String(maxHops), "-w", String(Math.ceil(timeout / 1000)), host]
  }
}

// ============================================================================
// PORT SCANNING
// ============================================================================

/**
 * Scan a single port using TCP socket
 */
async function scanPort(
  host: string,
  port: number,
  timeout: number
): Promise<{ port: number; state: "open" | "closed" | "filtered"; service?: string }> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    let state: "open" | "closed" | "filtered" = "filtered"
    let resolved = false

    const cleanup = () => {
      if (!resolved) {
        resolved = true
        socket.destroy()
        resolve({
          port,
          state,
          service: getServiceName(port),
        })
      }
    }

    socket.setTimeout(timeout)

    socket.on("connect", () => {
      state = "open"
      cleanup()
    })

    socket.on("timeout", () => {
      state = "filtered"
      cleanup()
    })

    socket.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ECONNREFUSED") {
        state = "closed"
      } else if (err.code === "EHOSTUNREACH" || err.code === "ENETUNREACH") {
        state = "filtered"
      } else {
        state = "filtered"
      }
      cleanup()
    })

    socket.on("close", cleanup)

    socket.connect(port, host)
  })
}

// ============================================================================
// OUTPUT PARSERS
// ============================================================================

/**
 * Parse ping output based on platform
 */
function parsePingOutput(output: string, platform: string): number[] {
  const times: number[] = []
  const lines = output.split("\n")

  for (const line of lines) {
    let match: RegExpMatchArray | null = null

    if (platform === "win32") {
      match = line.match(/time[=<](\d+(?:\.\d+)?)\s*ms/i)
    } else {
      match = line.match(/time=(\d+(?:\.\d+)?)\s*ms/i)
    }

    if (match) {
      times.push(parseFloat(match[1]))
    }
  }

  return times
}

/**
 * Parse traceroute output based on platform
 */
function parseTracerouteOutput(
  output: string,
  platform: string
): Array<{ hop: number; ip: string; hostname?: string; rtt: number[]; timeout: boolean }> {
  const hops: Array<{
    hop: number
    ip: string
    hostname?: string
    rtt: number[]
    timeout: boolean
  }> = []

  const lines = output.split("\n")

  for (const line of lines) {
    // Skip header lines
    if (
      line.trim().startsWith("traceroute") ||
      line.trim().startsWith("Tracing") ||
      line.trim() === ""
    ) {
      continue
    }

    let match: RegExpMatchArray | null = null

    if (platform === "win32") {
      // Windows: "  1    <1 ms    <1 ms    <1 ms  192.168.1.1"
      match = line.match(
        /^\s*(\d+)\s+(?:(<?\d+)\s*ms)?\s+(?:(<?\d+)\s*ms)?\s+(?:(<?\d+)\s*ms)?\s+([\d.]+|\*)/
      )
    } else {
      // macOS/Linux: " 1  192.168.1.1 (192.168.1.1)  1.234 ms  1.456 ms  1.789 ms"
      match = line.match(
        /^\s*(\d+)\s+(?:([^\s(]+)\s+)?\(?([\d.]+|\*)\)?\s+(?:([\d.]+)\s*ms)?\s*(?:([\d.]+)\s*ms)?\s*(?:([\d.]+)\s*ms)?/
      )
    }

    if (match) {
      const hop = parseInt(match[1])
      const rtt: number[] = []
      let ip = "*"
      let hostname: string | undefined

      if (platform === "win32") {
        ip = match[5] || "*"
        if (match[2] && match[2] !== "*") rtt.push(parseFloat(match[2].replace("<", "")))
        if (match[3] && match[3] !== "*") rtt.push(parseFloat(match[3].replace("<", "")))
        if (match[4] && match[4] !== "*") rtt.push(parseFloat(match[4].replace("<", "")))
      } else {
        hostname = match[2]
        ip = match[3] || "*"
        if (match[4]) rtt.push(parseFloat(match[4]))
        if (match[5]) rtt.push(parseFloat(match[5]))
        if (match[6]) rtt.push(parseFloat(match[6]))
      }

      hops.push({
        hop,
        ip,
        hostname,
        rtt,
        timeout: ip === "*" || rtt.length === 0,
      })
    }
  }

  return hops
}

/**
 * Parse ARP output
 */
function parseArpOutput(
  output: string,
  platform: string
): Array<{ ip: string; mac: string; interface?: string }> {
  const entries: Array<{ ip: string; mac: string; interface?: string }> = []
  const lines = output.split("\n")

  for (const line of lines) {
    let match: RegExpMatchArray | null = null

    if (platform === "win32") {
      // Windows: "  192.168.1.1           00-11-22-33-44-55     dynamic"
      match = line.match(/\s*([\d.]+)\s+([0-9A-Fa-f-]{17})\s+(?:dynamic|static)/i)
    } else {
      // macOS/Linux: "? (192.168.1.1) at 00:11:22:33:44:55 on en0"
      match = line.match(/\(?([\d.]+)\)?\s+at\s+([0-9A-Fa-f:]{17})\s+(?:on\s+(\w+))?/i)
    }

    if (match) {
      entries.push({
        ip: match[1],
        mac: match[2].replace(/-/g, ":").toLowerCase(),
        interface: match[3],
      })
    }
  }

  return entries
}

// ============================================================================
// SERVICE NAME LOOKUP
// ============================================================================

/**
 * Common port to service name mapping
 */
function getServiceName(port: number): string | undefined {
  const services: Record<number, string> = {
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

  return services[port]
}
