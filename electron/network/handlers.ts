import { ipcMain } from "electron"
import * as os from "os"
import * as dns from "dns"
import * as net from "net"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

// Register all network-related IPC handlers
export function registerNetworkHandlers() {
  // Ping handler - uses system ping command
  ipcMain.handle(
    "network:ping",
    async (
      _event,
      host: string,
      options?: { timeout?: number; count?: number }
    ) => {
      const count = options?.count || 4
      const timeout = options?.timeout || 5000

      try {
        const platform = process.platform
        let cmd: string

        if (platform === "win32") {
          cmd = `ping -n ${count} -w ${timeout} ${host}`
        } else if (platform === "darwin") {
          cmd = `ping -c ${count} -W ${Math.ceil(timeout / 1000)} ${host}`
        } else {
          cmd = `ping -c ${count} -W ${Math.ceil(timeout / 1000)} ${host}`
        }

        const startTime = Date.now()
        const { stdout } = await execAsync(cmd, { timeout: timeout * count + 5000 })
        const totalTime = Date.now() - startTime

        // Parse ping output
        const times = parsePingOutput(stdout, platform)
        const alive = times.length > 0
        const packetLoss = ((count - times.length) / count) * 100

        return {
          host,
          alive,
          time: totalTime,
          min: times.length > 0 ? Math.min(...times) : 0,
          max: times.length > 0 ? Math.max(...times) : 0,
          avg:
            times.length > 0
              ? times.reduce((a, b) => a + b, 0) / times.length
              : 0,
          packetLoss,
          times,
        }
      } catch (error) {
        return {
          host,
          alive: false,
          time: 0,
          min: 0,
          max: 0,
          avg: 0,
          packetLoss: 100,
          times: [],
          error: error instanceof Error ? error.message : "Ping failed",
        }
      }
    }
  )

  // Traceroute handler
  ipcMain.handle(
    "network:traceroute",
    async (
      _event,
      host: string,
      options?: { maxHops?: number; timeout?: number }
    ) => {
      const maxHops = options?.maxHops || 30
      const timeout = options?.timeout || 5000

      try {
        const platform = process.platform
        let cmd: string

        if (platform === "win32") {
          cmd = `tracert -h ${maxHops} -w ${timeout} ${host}`
        } else if (platform === "darwin") {
          cmd = `traceroute -m ${maxHops} -w ${Math.ceil(timeout / 1000)} ${host}`
        } else {
          cmd = `traceroute -m ${maxHops} -w ${Math.ceil(timeout / 1000)} ${host}`
        }

        const { stdout } = await execAsync(cmd, {
          timeout: timeout * maxHops + 10000,
        })

        const hops = parseTracerouteOutput(stdout, platform)

        return {
          destination: host,
          hops,
        }
      } catch (error) {
        return {
          destination: host,
          hops: [],
          error: error instanceof Error ? error.message : "Traceroute failed",
        }
      }
    }
  )

  // Port scan handler
  ipcMain.handle(
    "network:portScan",
    async (
      _event,
      host: string,
      ports: number[],
      options?: { timeout?: number; concurrent?: number }
    ) => {
      const timeout = options?.timeout || 3000
      const concurrent = options?.concurrent || 50

      const results: Array<{
        port: number
        state: "open" | "closed" | "filtered"
        service?: string
      }> = []

      // Process ports in batches
      for (let i = 0; i < ports.length; i += concurrent) {
        const batch = ports.slice(i, i + concurrent)
        const batchResults = await Promise.all(
          batch.map((port) => scanPort(host, port, timeout))
        )
        results.push(...batchResults)
      }

      return results
    }
  )

  // DNS lookup handler
  ipcMain.handle(
    "network:dnsLookup",
    async (
      _event,
      hostname: string,
      options?: { server?: string; type?: string }
    ) => {
      const startTime = Date.now()

      try {
        // Use system DNS or custom server
        if (options?.server) {
          dns.setServers([options.server])
        }

        const records: Array<{ type: string; value: string; ttl?: number }> = []
        const recordType = options?.type || "A"

        await new Promise<void>((resolve, reject) => {
          dns.resolve(hostname, recordType as any, (err, addresses) => {
            if (err) {
              reject(err)
              return
            }

            if (Array.isArray(addresses)) {
              addresses.forEach((addr) => {
                if (typeof addr === "string") {
                  records.push({ type: recordType, value: addr })
                } else if (typeof addr === "object") {
                  records.push({
                    type: recordType,
                    value: JSON.stringify(addr),
                  })
                }
              })
            }
            resolve()
          })
        })

        return {
          hostname,
          records,
          server: options?.server || dns.getServers()[0],
          responseTime: Date.now() - startTime,
        }
      } catch (error) {
        return {
          hostname,
          records: [],
          server: options?.server || "system",
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : "DNS lookup failed",
        }
      }
    }
  )

  // Get network interfaces
  ipcMain.handle("network:getInterfaces", async () => {
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

      const iface: any = {
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

    return result
  })

  // ARP scan handler
  ipcMain.handle("network:arpScan", async (_event, _subnet?: string) => {
    try {
      const platform = process.platform
      let cmd: string

      if (platform === "win32") {
        cmd = "arp -a"
      } else if (platform === "darwin") {
        cmd = "arp -a"
      } else {
        cmd = "arp -a"
      }

      const { stdout } = await execAsync(cmd)
      return parseArpOutput(stdout, platform)
    } catch (error) {
      return []
    }
  })

  // System info handler
  ipcMain.handle("system:getInfo", async () => {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      memory: os.totalmem(),
      uptime: os.uptime(),
    }
  })
}

// Helper function to scan a single port
async function scanPort(
  host: string,
  port: number,
  timeout: number
): Promise<{ port: number; state: "open" | "closed" | "filtered"; service?: string }> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    let state: "open" | "closed" | "filtered" = "filtered"

    socket.setTimeout(timeout)

    socket.on("connect", () => {
      state = "open"
      socket.destroy()
    })

    socket.on("timeout", () => {
      state = "filtered"
      socket.destroy()
    })

    socket.on("error", (err: any) => {
      if (err.code === "ECONNREFUSED") {
        state = "closed"
      } else {
        state = "filtered"
      }
    })

    socket.on("close", () => {
      resolve({
        port,
        state,
        service: getServiceName(port),
      })
    })

    socket.connect(port, host)
  })
}

// Parse ping output based on platform
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

// Parse traceroute output based on platform
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
        if (match[2] && match[2] !== "*")
          rtt.push(parseFloat(match[2].replace("<", "")))
        if (match[3] && match[3] !== "*")
          rtt.push(parseFloat(match[3].replace("<", "")))
        if (match[4] && match[4] !== "*")
          rtt.push(parseFloat(match[4].replace("<", "")))
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

// Parse ARP output
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
      match = line.match(
        /\s*([\d.]+)\s+([0-9A-Fa-f-]{17})\s+(?:dynamic|static)/i
      )
    } else {
      // macOS/Linux: "? (192.168.1.1) at 00:11:22:33:44:55 on en0"
      match = line.match(
        /\(?([\d.]+)\)?\s+at\s+([0-9A-Fa-f:]{17})\s+(?:on\s+(\w+))?/i
      )
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

// Common port to service name mapping
function getServiceName(port: number): string | undefined {
  const services: Record<number, string> = {
    20: "FTP-DATA",
    21: "FTP",
    22: "SSH",
    23: "Telnet",
    25: "SMTP",
    53: "DNS",
    80: "HTTP",
    110: "POP3",
    143: "IMAP",
    443: "HTTPS",
    445: "SMB",
    993: "IMAPS",
    995: "POP3S",
    3306: "MySQL",
    3389: "RDP",
    5432: "PostgreSQL",
    5900: "VNC",
    6379: "Redis",
    8080: "HTTP-Proxy",
    8443: "HTTPS-Alt",
    27017: "MongoDB",
  }

  return services[port]
}
