"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Server, Search } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"

interface PortEntry {
  port: number
  protocol: "TCP" | "UDP" | "TCP/UDP"
  service: string
  description: string
  category: string
}

const COMMON_PORTS: PortEntry[] = [
  // Web
  {
    port: 80,
    protocol: "TCP",
    service: "HTTP",
    description: "Hypertext Transfer Protocol",
    category: "web",
  },
  {
    port: 443,
    protocol: "TCP",
    service: "HTTPS",
    description: "HTTP Secure (TLS/SSL)",
    category: "web",
  },
  {
    port: 8080,
    protocol: "TCP",
    service: "HTTP-Alt",
    description: "Alternative HTTP port",
    category: "web",
  },
  {
    port: 8443,
    protocol: "TCP",
    service: "HTTPS-Alt",
    description: "Alternative HTTPS port",
    category: "web",
  },

  // Email
  {
    port: 25,
    protocol: "TCP",
    service: "SMTP",
    description: "Simple Mail Transfer Protocol",
    category: "email",
  },
  {
    port: 465,
    protocol: "TCP",
    service: "SMTPS",
    description: "SMTP over SSL (deprecated)",
    category: "email",
  },
  {
    port: 587,
    protocol: "TCP",
    service: "Submission",
    description: "Email submission",
    category: "email",
  },
  {
    port: 110,
    protocol: "TCP",
    service: "POP3",
    description: "Post Office Protocol v3",
    category: "email",
  },
  { port: 995, protocol: "TCP", service: "POP3S", description: "POP3 over SSL", category: "email" },
  {
    port: 143,
    protocol: "TCP",
    service: "IMAP",
    description: "Internet Message Access Protocol",
    category: "email",
  },
  { port: 993, protocol: "TCP", service: "IMAPS", description: "IMAP over SSL", category: "email" },

  // File Transfer
  {
    port: 20,
    protocol: "TCP",
    service: "FTP-Data",
    description: "FTP data transfer",
    category: "file",
  },
  { port: 21, protocol: "TCP", service: "FTP", description: "FTP control", category: "file" },
  {
    port: 22,
    protocol: "TCP",
    service: "SSH/SFTP",
    description: "Secure Shell / SFTP",
    category: "file",
  },
  {
    port: 69,
    protocol: "UDP",
    service: "TFTP",
    description: "Trivial File Transfer Protocol",
    category: "file",
  },
  {
    port: 445,
    protocol: "TCP",
    service: "SMB",
    description: "Server Message Block",
    category: "file",
  },
  { port: 873, protocol: "TCP", service: "rsync", description: "Remote sync", category: "file" },

  // Remote Access
  {
    port: 23,
    protocol: "TCP",
    service: "Telnet",
    description: "Telnet (insecure)",
    category: "remote",
  },
  {
    port: 3389,
    protocol: "TCP",
    service: "RDP",
    description: "Remote Desktop Protocol",
    category: "remote",
  },
  {
    port: 5900,
    protocol: "TCP",
    service: "VNC",
    description: "Virtual Network Computing",
    category: "remote",
  },

  // DNS
  {
    port: 53,
    protocol: "TCP/UDP",
    service: "DNS",
    description: "Domain Name System",
    category: "dns",
  },
  { port: 853, protocol: "TCP", service: "DoT", description: "DNS over TLS", category: "dns" },

  // Database
  {
    port: 3306,
    protocol: "TCP",
    service: "MySQL",
    description: "MySQL database",
    category: "database",
  },
  {
    port: 5432,
    protocol: "TCP",
    service: "PostgreSQL",
    description: "PostgreSQL database",
    category: "database",
  },
  {
    port: 27017,
    protocol: "TCP",
    service: "MongoDB",
    description: "MongoDB database",
    category: "database",
  },
  {
    port: 6379,
    protocol: "TCP",
    service: "Redis",
    description: "Redis cache/database",
    category: "database",
  },
  {
    port: 1433,
    protocol: "TCP",
    service: "MSSQL",
    description: "Microsoft SQL Server",
    category: "database",
  },
  {
    port: 1521,
    protocol: "TCP",
    service: "Oracle",
    description: "Oracle database",
    category: "database",
  },

  // Infrastructure
  { port: 67, protocol: "UDP", service: "DHCP", description: "DHCP server", category: "infra" },
  { port: 68, protocol: "UDP", service: "DHCP", description: "DHCP client", category: "infra" },
  {
    port: 123,
    protocol: "UDP",
    service: "NTP",
    description: "Network Time Protocol",
    category: "infra",
  },
  { port: 161, protocol: "UDP", service: "SNMP", description: "SNMP queries", category: "infra" },
  {
    port: 162,
    protocol: "UDP",
    service: "SNMP-Trap",
    description: "SNMP traps",
    category: "infra",
  },
  {
    port: 389,
    protocol: "TCP",
    service: "LDAP",
    description: "Lightweight Directory Access Protocol",
    category: "infra",
  },
  { port: 636, protocol: "TCP", service: "LDAPS", description: "LDAP over SSL", category: "infra" },
  {
    port: 514,
    protocol: "UDP",
    service: "Syslog",
    description: "System logging",
    category: "infra",
  },

  // VPN
  { port: 500, protocol: "UDP", service: "IKE", description: "IPsec IKE", category: "vpn" },
  {
    port: 4500,
    protocol: "UDP",
    service: "IPsec NAT-T",
    description: "IPsec NAT traversal",
    category: "vpn",
  },
  { port: 1194, protocol: "UDP", service: "OpenVPN", description: "OpenVPN", category: "vpn" },
  {
    port: 1701,
    protocol: "UDP",
    service: "L2TP",
    description: "Layer 2 Tunneling Protocol",
    category: "vpn",
  },
  {
    port: 1723,
    protocol: "TCP",
    service: "PPTP",
    description: "Point-to-Point Tunneling Protocol",
    category: "vpn",
  },
  {
    port: 51820,
    protocol: "UDP",
    service: "WireGuard",
    description: "WireGuard VPN",
    category: "vpn",
  },

  // Messaging
  {
    port: 5222,
    protocol: "TCP",
    service: "XMPP",
    description: "XMPP client",
    category: "messaging",
  },
  {
    port: 5269,
    protocol: "TCP",
    service: "XMPP-S2S",
    description: "XMPP server-to-server",
    category: "messaging",
  },
  {
    port: 1883,
    protocol: "TCP",
    service: "MQTT",
    description: "MQTT messaging",
    category: "messaging",
  },
  {
    port: 8883,
    protocol: "TCP",
    service: "MQTT/TLS",
    description: "MQTT over TLS",
    category: "messaging",
  },

  // Containers/Dev
  {
    port: 2375,
    protocol: "TCP",
    service: "Docker",
    description: "Docker daemon (insecure)",
    category: "dev",
  },
  {
    port: 2376,
    protocol: "TCP",
    service: "Docker TLS",
    description: "Docker daemon (TLS)",
    category: "dev",
  },
  {
    port: 6443,
    protocol: "TCP",
    service: "Kubernetes API",
    description: "Kubernetes API server",
    category: "dev",
  },
  {
    port: 9090,
    protocol: "TCP",
    service: "Prometheus",
    description: "Prometheus metrics",
    category: "dev",
  },
  {
    port: 3000,
    protocol: "TCP",
    service: "Grafana",
    description: "Grafana dashboard",
    category: "dev",
  },
]

const CATEGORIES = [
  { id: "all", label: "All Ports" },
  { id: "web", label: "Web" },
  { id: "email", label: "Email" },
  { id: "file", label: "File Transfer" },
  { id: "remote", label: "Remote Access" },
  { id: "dns", label: "DNS" },
  { id: "database", label: "Database" },
  { id: "infra", label: "Infrastructure" },
  { id: "vpn", label: "VPN" },
  { id: "messaging", label: "Messaging" },
  { id: "dev", label: "Dev/Containers" },
]

export function PortReference() {
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")

  const filteredPorts = useMemo(() => {
    let ports = COMMON_PORTS

    if (category !== "all") {
      ports = ports.filter((p) => p.category === category)
    }

    if (search) {
      const q = search.toLowerCase()
      ports = ports.filter(
        (p) =>
          p.port.toString().includes(q) ||
          p.service.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      )
    }

    return ports.sort((a, b) => a.port - b.port)
  }, [search, category])

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Server}
        title="Port Reference"
        description="Quick reference for common network ports and services"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Ports
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="search">Search by port number or service</Label>
            <Input
              id="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="80, HTTPS, database..."
              className="max-w-md"
            />
          </div>

          <Tabs value={category} onValueChange={setCategory}>
            <TabsList className="h-auto flex-wrap">
              {CATEGORIES.map((cat) => (
                <TabsTrigger key={cat.id} value={cat.id}>
                  {cat.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {filteredPorts.length} Port{filteredPorts.length !== 1 ? "s" : ""} Found
          </CardTitle>
          <CardDescription>
            {category === "all"
              ? "All categories"
              : CATEGORIES.find((c) => c.id === category)?.label}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left font-medium">Port</th>
                  <th className="p-2 text-left font-medium">Protocol</th>
                  <th className="p-2 text-left font-medium">Service</th>
                  <th className="p-2 text-left font-medium">Description</th>
                  <th className="p-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filteredPorts.map((port) => (
                  <tr key={port.port + port.protocol} className="hover:bg-muted/50 border-b">
                    <td className="p-2">
                      <Badge variant="secondary" className="font-mono">
                        {port.port}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Badge variant="outline">{port.protocol}</Badge>
                    </td>
                    <td className="p-2 font-medium">{port.service}</td>
                    <td className="text-muted-foreground p-2">{port.description}</td>
                    <td className="p-2">
                      <CopyButton value={port.port.toString()} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredPorts.length === 0 && (
            <div className="flex h-32 items-center justify-center">
              <p className="text-muted-foreground">No ports match your search</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Port Ranges</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <Badge className="mb-2">0-1023</Badge>
              <h4 className="font-semibold">Well-Known Ports</h4>
              <p className="text-muted-foreground text-sm">
                Reserved for common services. Requires root/admin to bind.
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <Badge className="mb-2">1024-49151</Badge>
              <h4 className="font-semibold">Registered Ports</h4>
              <p className="text-muted-foreground text-sm">
                Assigned by IANA for specific services. User processes can bind.
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <Badge className="mb-2">49152-65535</Badge>
              <h4 className="font-semibold">Dynamic/Private Ports</h4>
              <p className="text-muted-foreground text-sm">
                Ephemeral ports used for client connections.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
