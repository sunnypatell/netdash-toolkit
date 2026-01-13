// Utility to detect if running in Electron and access Electron APIs

export function isElectron(): boolean {
  // Check if window.electronAPI exists (set by preload script)
  if (typeof window !== "undefined" && window.electronAPI) {
    return true
  }
  return false
}

// Type-safe wrapper for Electron API calls
export async function callElectronAPI<T>(
  method: keyof typeof window.electronAPI,
  ...args: any[]
): Promise<T | null> {
  if (!isElectron()) {
    return null
  }

  try {
    const api = window.electronAPI as any
    return await api[method](...args)
  } catch (error) {
    console.error(`Electron API call failed: ${method}`, error)
    return null
  }
}

// Convenience wrappers for network operations
export const electronNetwork = {
  async ping(host: string, options?: { timeout?: number; count?: number }) {
    return callElectronAPI<{
      host: string
      alive: boolean
      time: number
      min: number
      max: number
      avg: number
      packetLoss: number
      times: number[]
      error?: string
    }>("ping", host, options)
  },

  async traceroute(host: string, options?: { maxHops?: number; timeout?: number }) {
    return callElectronAPI<{
      destination: string
      hops: Array<{
        hop: number
        ip: string
        hostname?: string
        rtt: number[]
        timeout: boolean
      }>
      error?: string
    }>("traceroute", host, options)
  },

  async portScan(
    host: string,
    ports: number[],
    options?: { timeout?: number; concurrent?: number }
  ) {
    return callElectronAPI<
      Array<{
        port: number
        state: "open" | "closed" | "filtered"
        service?: string
      }>
    >("portScan", host, ports, options)
  },

  async dnsLookup(hostname: string, options?: { server?: string; type?: string }) {
    return callElectronAPI<{
      hostname: string
      records: Array<{ type: string; value: string; ttl?: number }>
      server: string
      responseTime: number
      error?: string
    }>("dnsLookup", hostname, options)
  },

  async getNetworkInterfaces() {
    return callElectronAPI<
      Array<{
        name: string
        mac: string
        ipv4?: string
        ipv6?: string
        netmask?: string
        internal: boolean
      }>
    >("getNetworkInterfaces")
  },

  async arpScan(subnet?: string) {
    return callElectronAPI<
      Array<{
        ip: string
        mac: string
        interface?: string
        vendor?: string
      }>
    >("arpScan", subnet)
  },

  async getSystemInfo() {
    return callElectronAPI<{
      hostname: string
      platform: string
      arch: string
      cpus: number
      memory: number
      uptime: number
    }>("getSystemInfo")
  },
}

// Check platform
export async function getElectronPlatform(): Promise<string | null> {
  return callElectronAPI<string>("getPlatform")
}

export async function getElectronVersion(): Promise<string | null> {
  return callElectronAPI<string>("getVersion")
}
