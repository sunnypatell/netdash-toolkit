import { contextBridge, ipcRenderer } from "electron"

contextBridge.exposeInMainWorld("electronAPI", {
  getVersion: () => ipcRenderer.invoke("app:getVersion"),
  getPlatform: () => ipcRenderer.invoke("app:getPlatform"),
  isElectron: () => ipcRenderer.invoke("app:isElectron"),

  ping: (host: string, options?: { timeout?: number; count?: number }) =>
    ipcRenderer.invoke("network:ping", host, options),

  traceroute: (host: string, options?: { maxHops?: number; timeout?: number }) =>
    ipcRenderer.invoke("network:traceroute", host, options),

  portScan: (host: string, ports: number[], options?: { timeout?: number; concurrent?: number }) =>
    ipcRenderer.invoke("network:portScan", host, ports, options),

  dnsLookup: (hostname: string, options?: { server?: string; type?: string }) =>
    ipcRenderer.invoke("network:dnsLookup", hostname, options),

  getNetworkInterfaces: () => ipcRenderer.invoke("network:getInterfaces"),

  // reads the local arp cache. it takes no subnet because it sends no packets:
  // it can only report neighbours this host has already resolved.
  getArpTable: () => ipcRenderer.invoke("network:arpTable"),

  getSystemInfo: () => ipcRenderer.invoke("system:getInfo"),
})

declare global {
  interface Window {
    electronAPI: {
      getVersion: () => Promise<string>
      getPlatform: () => Promise<string>
      isElectron: () => Promise<boolean>
      ping: (host: string, options?: { timeout?: number; count?: number }) => Promise<PingResult>
      traceroute: (
        host: string,
        options?: { maxHops?: number; timeout?: number }
      ) => Promise<TracerouteResult>
      portScan: (
        host: string,
        ports: number[],
        options?: { timeout?: number; concurrent?: number }
      ) => Promise<PortScanResult[]>
      dnsLookup: (
        hostname: string,
        options?: { server?: string; type?: string }
      ) => Promise<DnsResult>
      getNetworkInterfaces: () => Promise<NetworkInterface[]>
      getArpTable: () => Promise<ArpEntry[]>
      getSystemInfo: () => Promise<SystemInfo>
    }
  }
}

interface PingResult {
  host: string
  alive: boolean
  time: number
  min: number
  max: number
  avg: number
  packetLoss: number
  times: number[]
  error?: string
}

interface TracerouteHop {
  hop: number
  ip: string
  hostname?: string
  rtt: number[]
  timeout: boolean
}

interface TracerouteResult {
  destination: string
  hops: TracerouteHop[]
  error?: string
}

interface PortScanResult {
  port: number
  state: "open" | "closed" | "filtered"
  service?: string
  responseTime?: number
}

interface DnsResult {
  hostname: string
  records: Array<{
    type: string
    value: string
    // populated for A and AAAA, which are the only types node reports a ttl for
    ttl?: number
  }>
  server: string
  responseTime: number
  error?: string
}

interface NetworkInterface {
  name: string
  mac: string
  ipv4?: string
  ipv6?: string
  netmask?: string
  internal: boolean
}

interface ArpEntry {
  ip: string
  mac: string
  // a device name on unix, the interface's own address on windows
  interface?: string
}

interface SystemInfo {
  hostname: string
  platform: string
  arch: string
  cpus: number
  memory: number
  uptime: number
}

export {}
