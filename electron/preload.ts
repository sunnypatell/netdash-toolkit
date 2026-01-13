import { contextBridge, ipcRenderer } from "electron"

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld("electronAPI", {
  // App info
  getVersion: () => ipcRenderer.invoke("app:getVersion"),
  getPlatform: () => ipcRenderer.invoke("app:getPlatform"),
  isElectron: () => ipcRenderer.invoke("app:isElectron"),

  // Network operations - Real networking via Node.js
  ping: (host: string, options?: { timeout?: number; count?: number }) =>
    ipcRenderer.invoke("network:ping", host, options),

  traceroute: (host: string, options?: { maxHops?: number; timeout?: number }) =>
    ipcRenderer.invoke("network:traceroute", host, options),

  portScan: (
    host: string,
    ports: number[],
    options?: { timeout?: number; concurrent?: number }
  ) => ipcRenderer.invoke("network:portScan", host, ports, options),

  dnsLookup: (hostname: string, options?: { server?: string; type?: string }) =>
    ipcRenderer.invoke("network:dnsLookup", hostname, options),

  getNetworkInterfaces: () => ipcRenderer.invoke("network:getInterfaces"),

  arpScan: (subnet?: string) => ipcRenderer.invoke("network:arpScan", subnet),

  // System info
  getSystemInfo: () => ipcRenderer.invoke("system:getInfo"),
})

// Type definitions for TypeScript
declare global {
  interface Window {
    electronAPI: {
      getVersion: () => Promise<string>
      getPlatform: () => Promise<string>
      isElectron: () => Promise<boolean>
      ping: (
        host: string,
        options?: { timeout?: number; count?: number }
      ) => Promise<PingResult>
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
      arpScan: (subnet?: string) => Promise<ArpEntry[]>
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
}

interface PortScanResult {
  port: number
  state: "open" | "closed" | "filtered"
  service?: string
}

interface DnsResult {
  hostname: string
  records: Array<{
    type: string
    value: string
    ttl?: number
  }>
  server: string
  responseTime: number
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
  interface?: string
  vendor?: string
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
