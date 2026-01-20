"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { BookOpen, Search, Network, Globe, Server, Layers, Binary, Copy } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

// Common Ports Data
const COMMON_PORTS = [
  {
    port: 20,
    protocol: "TCP",
    service: "FTP Data",
    description: "File Transfer Protocol data channel",
  },
  {
    port: 21,
    protocol: "TCP",
    service: "FTP Control",
    description: "File Transfer Protocol control/command",
  },
  { port: 22, protocol: "TCP", service: "SSH", description: "Secure Shell, secure remote login" },
  {
    port: 23,
    protocol: "TCP",
    service: "Telnet",
    description: "Unencrypted remote login (legacy)",
  },
  { port: 25, protocol: "TCP", service: "SMTP", description: "Simple Mail Transfer Protocol" },
  { port: 53, protocol: "TCP/UDP", service: "DNS", description: "Domain Name System" },
  {
    port: 67,
    protocol: "UDP",
    service: "DHCP Server",
    description: "Dynamic Host Configuration Protocol",
  },
  { port: 68, protocol: "UDP", service: "DHCP Client", description: "DHCP client requests" },
  { port: 69, protocol: "UDP", service: "TFTP", description: "Trivial File Transfer Protocol" },
  { port: 80, protocol: "TCP", service: "HTTP", description: "Hypertext Transfer Protocol" },
  { port: 110, protocol: "TCP", service: "POP3", description: "Post Office Protocol v3" },
  { port: 119, protocol: "TCP", service: "NNTP", description: "Network News Transfer Protocol" },
  { port: 123, protocol: "UDP", service: "NTP", description: "Network Time Protocol" },
  { port: 137, protocol: "UDP", service: "NetBIOS Name", description: "NetBIOS Name Service" },
  {
    port: 138,
    protocol: "UDP",
    service: "NetBIOS Datagram",
    description: "NetBIOS Datagram Service",
  },
  {
    port: 139,
    protocol: "TCP",
    service: "NetBIOS Session",
    description: "NetBIOS Session Service",
  },
  { port: 143, protocol: "TCP", service: "IMAP", description: "Internet Message Access Protocol" },
  {
    port: 161,
    protocol: "UDP",
    service: "SNMP",
    description: "Simple Network Management Protocol",
  },
  { port: 162, protocol: "UDP", service: "SNMP Trap", description: "SNMP Trap messages" },
  {
    port: 389,
    protocol: "TCP/UDP",
    service: "LDAP",
    description: "Lightweight Directory Access Protocol",
  },
  { port: 443, protocol: "TCP", service: "HTTPS", description: "HTTP over TLS/SSL" },
  { port: 445, protocol: "TCP", service: "SMB", description: "Server Message Block / CIFS" },
  { port: 465, protocol: "TCP", service: "SMTPS", description: "SMTP over SSL (deprecated)" },
  { port: 500, protocol: "UDP", service: "IKE", description: "Internet Key Exchange (IPsec)" },
  { port: 514, protocol: "UDP", service: "Syslog", description: "System logging" },
  {
    port: 587,
    protocol: "TCP",
    service: "SMTP Submission",
    description: "Email message submission",
  },
  { port: 636, protocol: "TCP", service: "LDAPS", description: "LDAP over SSL" },
  { port: 993, protocol: "TCP", service: "IMAPS", description: "IMAP over SSL" },
  { port: 995, protocol: "TCP", service: "POP3S", description: "POP3 over SSL" },
  { port: 1433, protocol: "TCP", service: "MSSQL", description: "Microsoft SQL Server" },
  { port: 1521, protocol: "TCP", service: "Oracle", description: "Oracle Database" },
  {
    port: 1723,
    protocol: "TCP",
    service: "PPTP",
    description: "Point-to-Point Tunneling Protocol",
  },
  { port: 3306, protocol: "TCP", service: "MySQL", description: "MySQL Database" },
  { port: 3389, protocol: "TCP", service: "RDP", description: "Remote Desktop Protocol" },
  { port: 5432, protocol: "TCP", service: "PostgreSQL", description: "PostgreSQL Database" },
  { port: 5900, protocol: "TCP", service: "VNC", description: "Virtual Network Computing" },
  { port: 6379, protocol: "TCP", service: "Redis", description: "Redis key-value store" },
  { port: 8080, protocol: "TCP", service: "HTTP Alt", description: "Alternative HTTP port" },
  { port: 8443, protocol: "TCP", service: "HTTPS Alt", description: "Alternative HTTPS port" },
  { port: 27017, protocol: "TCP", service: "MongoDB", description: "MongoDB Database" },
]

// Private IP Ranges
const PRIVATE_RANGES = [
  {
    range: "10.0.0.0/8",
    cidr: "/8",
    addresses: "16,777,216",
    rfc: "RFC 1918",
    type: "Class A Private",
    description: "Large enterprise networks",
  },
  {
    range: "172.16.0.0/12",
    cidr: "/12",
    addresses: "1,048,576",
    rfc: "RFC 1918",
    type: "Class B Private",
    description: "Medium-sized networks",
  },
  {
    range: "192.168.0.0/16",
    cidr: "/16",
    addresses: "65,536",
    rfc: "RFC 1918",
    type: "Class C Private",
    description: "Home and small office networks",
  },
  {
    range: "127.0.0.0/8",
    cidr: "/8",
    addresses: "16,777,216",
    rfc: "RFC 1122",
    type: "Loopback",
    description: "Local host loopback",
  },
  {
    range: "169.254.0.0/16",
    cidr: "/16",
    addresses: "65,536",
    rfc: "RFC 3927",
    type: "Link-Local",
    description: "Auto-configured when DHCP fails",
  },
  {
    range: "224.0.0.0/4",
    cidr: "/4",
    addresses: "268,435,456",
    rfc: "RFC 5771",
    type: "Multicast",
    description: "Multicast addresses",
  },
  {
    range: "240.0.0.0/4",
    cidr: "/4",
    addresses: "268,435,456",
    rfc: "RFC 1112",
    type: "Reserved",
    description: "Reserved for future use",
  },
  {
    range: "100.64.0.0/10",
    cidr: "/10",
    addresses: "4,194,304",
    rfc: "RFC 6598",
    type: "CGNAT",
    description: "Carrier-grade NAT shared space",
  },
  {
    range: "192.0.0.0/24",
    cidr: "/24",
    addresses: "256",
    rfc: "RFC 6890",
    type: "IETF Protocol",
    description: "IETF protocol assignments",
  },
  {
    range: "192.0.2.0/24",
    cidr: "/24",
    addresses: "256",
    rfc: "RFC 5737",
    type: "TEST-NET-1",
    description: "Documentation and examples",
  },
  {
    range: "198.51.100.0/24",
    cidr: "/24",
    addresses: "256",
    rfc: "RFC 5737",
    type: "TEST-NET-2",
    description: "Documentation and examples",
  },
  {
    range: "203.0.113.0/24",
    cidr: "/24",
    addresses: "256",
    rfc: "RFC 5737",
    type: "TEST-NET-3",
    description: "Documentation and examples",
  },
]

// IPv6 Private/Special Ranges
const IPV6_RANGES = [
  {
    range: "fc00::/7",
    name: "Unique Local (ULA)",
    description: "Private addresses, similar to RFC 1918",
    routable: "No",
  },
  {
    range: "fd00::/8",
    name: "Unique Local Assigned",
    description: "Locally assigned ULA addresses",
    routable: "No",
  },
  {
    range: "fe80::/10",
    name: "Link-Local",
    description: "Auto-configured on each interface",
    routable: "No",
  },
  { range: "::1/128", name: "Loopback", description: "Local host loopback", routable: "No" },
  { range: "::/128", name: "Unspecified", description: "No address specified", routable: "No" },
  {
    range: "2000::/3",
    name: "Global Unicast",
    description: "Publicly routable addresses",
    routable: "Yes",
  },
  { range: "ff00::/8", name: "Multicast", description: "Multicast addresses", routable: "Varies" },
  {
    range: "::ffff:0:0/96",
    name: "IPv4-Mapped",
    description: "IPv4 addresses mapped to IPv6",
    routable: "No",
  },
  {
    range: "64:ff9b::/96",
    name: "NAT64 Well-Known",
    description: "IPv4/IPv6 translation",
    routable: "Varies",
  },
  {
    range: "2001:db8::/32",
    name: "Documentation",
    description: "Reserved for documentation/examples",
    routable: "No",
  },
  { range: "2001::/32", name: "Teredo", description: "Teredo tunneling", routable: "Yes" },
  { range: "2002::/16", name: "6to4", description: "6to4 tunneling (deprecated)", routable: "Yes" },
]

// CIDR Cheat Sheet
const CIDR_TABLE = [
  { cidr: "/32", mask: "255.255.255.255", hosts: 1, wildcard: "0.0.0.0" },
  { cidr: "/31", mask: "255.255.255.254", hosts: 2, wildcard: "0.0.0.1" },
  { cidr: "/30", mask: "255.255.255.252", hosts: 2, wildcard: "0.0.0.3" },
  { cidr: "/29", mask: "255.255.255.248", hosts: 6, wildcard: "0.0.0.7" },
  { cidr: "/28", mask: "255.255.255.240", hosts: 14, wildcard: "0.0.0.15" },
  { cidr: "/27", mask: "255.255.255.224", hosts: 30, wildcard: "0.0.0.31" },
  { cidr: "/26", mask: "255.255.255.192", hosts: 62, wildcard: "0.0.0.63" },
  { cidr: "/25", mask: "255.255.255.128", hosts: 126, wildcard: "0.0.0.127" },
  { cidr: "/24", mask: "255.255.255.0", hosts: 254, wildcard: "0.0.0.255" },
  { cidr: "/23", mask: "255.255.254.0", hosts: 510, wildcard: "0.0.1.255" },
  { cidr: "/22", mask: "255.255.252.0", hosts: 1022, wildcard: "0.0.3.255" },
  { cidr: "/21", mask: "255.255.248.0", hosts: 2046, wildcard: "0.0.7.255" },
  { cidr: "/20", mask: "255.255.240.0", hosts: 4094, wildcard: "0.0.15.255" },
  { cidr: "/19", mask: "255.255.224.0", hosts: 8190, wildcard: "0.0.31.255" },
  { cidr: "/18", mask: "255.255.192.0", hosts: 16382, wildcard: "0.0.63.255" },
  { cidr: "/17", mask: "255.255.128.0", hosts: 32766, wildcard: "0.0.127.255" },
  { cidr: "/16", mask: "255.255.0.0", hosts: 65534, wildcard: "0.0.255.255" },
  { cidr: "/15", mask: "255.254.0.0", hosts: 131070, wildcard: "0.1.255.255" },
  { cidr: "/14", mask: "255.252.0.0", hosts: 262142, wildcard: "0.3.255.255" },
  { cidr: "/13", mask: "255.248.0.0", hosts: 524286, wildcard: "0.7.255.255" },
  { cidr: "/12", mask: "255.240.0.0", hosts: 1048574, wildcard: "0.15.255.255" },
  { cidr: "/11", mask: "255.224.0.0", hosts: 2097150, wildcard: "0.31.255.255" },
  { cidr: "/10", mask: "255.192.0.0", hosts: 4194302, wildcard: "0.63.255.255" },
  { cidr: "/9", mask: "255.128.0.0", hosts: 8388606, wildcard: "0.127.255.255" },
  { cidr: "/8", mask: "255.0.0.0", hosts: 16777214, wildcard: "0.255.255.255" },
]

// Protocol Numbers
const PROTOCOL_NUMBERS = [
  { number: 1, name: "ICMP", description: "Internet Control Message Protocol", rfc: "RFC 792" },
  { number: 2, name: "IGMP", description: "Internet Group Management Protocol", rfc: "RFC 1112" },
  { number: 4, name: "IPv4", description: "IPv4 encapsulation", rfc: "RFC 2003" },
  { number: 6, name: "TCP", description: "Transmission Control Protocol", rfc: "RFC 793" },
  { number: 17, name: "UDP", description: "User Datagram Protocol", rfc: "RFC 768" },
  { number: 41, name: "IPv6", description: "IPv6 encapsulation", rfc: "RFC 2473" },
  { number: 43, name: "IPv6-Route", description: "Routing Header for IPv6", rfc: "RFC 8200" },
  { number: 44, name: "IPv6-Frag", description: "Fragment Header for IPv6", rfc: "RFC 8200" },
  { number: 47, name: "GRE", description: "Generic Routing Encapsulation", rfc: "RFC 2784" },
  { number: 50, name: "ESP", description: "Encapsulating Security Payload", rfc: "RFC 4303" },
  { number: 51, name: "AH", description: "Authentication Header", rfc: "RFC 4302" },
  { number: 58, name: "ICMPv6", description: "ICMP for IPv6", rfc: "RFC 4443" },
  { number: 59, name: "IPv6-NoNxt", description: "No Next Header for IPv6", rfc: "RFC 8200" },
  { number: 60, name: "IPv6-Opts", description: "Destination Options for IPv6", rfc: "RFC 8200" },
  { number: 89, name: "OSPF", description: "Open Shortest Path First", rfc: "RFC 2328" },
  { number: 112, name: "VRRP", description: "Virtual Router Redundancy Protocol", rfc: "RFC 5798" },
  { number: 115, name: "L2TP", description: "Layer 2 Tunneling Protocol", rfc: "RFC 3931" },
  {
    number: 132,
    name: "SCTP",
    description: "Stream Control Transmission Protocol",
    rfc: "RFC 4960",
  },
]

// Common Subnet Examples
const COMMON_SUBNETS = [
  {
    name: "Single Host",
    cidr: "/32",
    mask: "255.255.255.255",
    hosts: 1,
    useCase: "Host routes, loopback",
  },
  {
    name: "Point-to-Point",
    cidr: "/31",
    mask: "255.255.255.254",
    hosts: 2,
    useCase: "Router links (RFC 3021)",
  },
  {
    name: "Minimal Network",
    cidr: "/30",
    mask: "255.255.255.252",
    hosts: 2,
    useCase: "Small WAN links",
  },
  {
    name: "Small LAN",
    cidr: "/29",
    mask: "255.255.255.248",
    hosts: 6,
    useCase: "Very small office",
  },
  {
    name: "Small Office",
    cidr: "/28",
    mask: "255.255.255.240",
    hosts: 14,
    useCase: "Small departments",
  },
  {
    name: "Medium Office",
    cidr: "/27",
    mask: "255.255.255.224",
    hosts: 30,
    useCase: "Meeting rooms, small teams",
  },
  {
    name: "Large Office",
    cidr: "/26",
    mask: "255.255.255.192",
    hosts: 62,
    useCase: "Floor segments",
  },
  {
    name: "Half Class C",
    cidr: "/25",
    mask: "255.255.255.128",
    hosts: 126,
    useCase: "Building sections",
  },
  {
    name: "Class C",
    cidr: "/24",
    mask: "255.255.255.0",
    hosts: 254,
    useCase: "Standard LAN segment",
  },
  {
    name: "Supernet",
    cidr: "/23",
    mask: "255.255.254.0",
    hosts: 510,
    useCase: "Large departments",
  },
  { name: "Campus", cidr: "/22", mask: "255.255.252.0", hosts: 1022, useCase: "Campus buildings" },
  {
    name: "Enterprise",
    cidr: "/21",
    mask: "255.255.248.0",
    hosts: 2046,
    useCase: "Large enterprise sites",
  },
]

export function ReferenceHub() {
  const [searchTerm, setSearchTerm] = useState("")

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  // Filtered data based on search
  const filteredPorts = useMemo(() => {
    if (!searchTerm) return COMMON_PORTS
    const lower = searchTerm.toLowerCase()
    return COMMON_PORTS.filter(
      (p) =>
        p.port.toString().includes(lower) ||
        p.service.toLowerCase().includes(lower) ||
        p.description.toLowerCase().includes(lower) ||
        p.protocol.toLowerCase().includes(lower)
    )
  }, [searchTerm])

  const filteredPrivateRanges = useMemo(() => {
    if (!searchTerm) return PRIVATE_RANGES
    const lower = searchTerm.toLowerCase()
    return PRIVATE_RANGES.filter(
      (r) =>
        r.range.toLowerCase().includes(lower) ||
        r.type.toLowerCase().includes(lower) ||
        r.description.toLowerCase().includes(lower) ||
        r.rfc.toLowerCase().includes(lower)
    )
  }, [searchTerm])

  const filteredIPv6Ranges = useMemo(() => {
    if (!searchTerm) return IPV6_RANGES
    const lower = searchTerm.toLowerCase()
    return IPV6_RANGES.filter(
      (r) =>
        r.range.toLowerCase().includes(lower) ||
        r.name.toLowerCase().includes(lower) ||
        r.description.toLowerCase().includes(lower)
    )
  }, [searchTerm])

  const filteredCIDR = useMemo(() => {
    if (!searchTerm) return CIDR_TABLE
    const lower = searchTerm.toLowerCase()
    return CIDR_TABLE.filter(
      (c) =>
        c.cidr.includes(lower) ||
        c.mask.includes(lower) ||
        c.hosts.toString().includes(lower) ||
        c.wildcard.includes(lower)
    )
  }, [searchTerm])

  const filteredProtocols = useMemo(() => {
    if (!searchTerm) return PROTOCOL_NUMBERS
    const lower = searchTerm.toLowerCase()
    return PROTOCOL_NUMBERS.filter(
      (p) =>
        p.number.toString().includes(lower) ||
        p.name.toLowerCase().includes(lower) ||
        p.description.toLowerCase().includes(lower)
    )
  }, [searchTerm])

  const filteredSubnets = useMemo(() => {
    if (!searchTerm) return COMMON_SUBNETS
    const lower = searchTerm.toLowerCase()
    return COMMON_SUBNETS.filter(
      (s) =>
        s.name.toLowerCase().includes(lower) ||
        s.cidr.includes(lower) ||
        s.mask.includes(lower) ||
        s.useCase.toLowerCase().includes(lower)
    )
  }, [searchTerm])

  return (
    <div className="tool-container">
      <ToolHeader
        icon={BookOpen}
        title="Networking Reference"
        description="Quick reference for common ports, IP ranges, CIDR notation, and more"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Search across all references..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </CardContent>
      </Card>

      <Tabs defaultValue="ports" className="space-y-4">
        <TabsList className="sm:bg-muted flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0 sm:grid sm:w-full sm:grid-cols-6 sm:gap-0 sm:p-1">
          <TabsTrigger
            value="ports"
            className="border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"
          >
            <Server className="mr-1 h-3 w-3 sm:hidden" />
            Ports
          </TabsTrigger>
          <TabsTrigger
            value="private"
            className="border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"
          >
            <Network className="mr-1 h-3 w-3 sm:hidden" />
            IPv4 Ranges
          </TabsTrigger>
          <TabsTrigger
            value="ipv6"
            className="border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"
          >
            <Globe className="mr-1 h-3 w-3 sm:hidden" />
            IPv6 Ranges
          </TabsTrigger>
          <TabsTrigger
            value="cidr"
            className="border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"
          >
            <Binary className="mr-1 h-3 w-3 sm:hidden" />
            CIDR
          </TabsTrigger>
          <TabsTrigger
            value="protocols"
            className="border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"
          >
            <Layers className="mr-1 h-3 w-3 sm:hidden" />
            Protocols
          </TabsTrigger>
          <TabsTrigger
            value="subnets"
            className="border-input bg-muted data-[state=active]:bg-background rounded-md border px-3 py-1.5 text-xs sm:rounded-sm sm:border-0 sm:bg-transparent sm:text-sm"
          >
            <Network className="mr-1 h-3 w-3 sm:hidden" />
            Subnets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Common Port Numbers</CardTitle>
              <CardDescription>
                Well-known and frequently used TCP/UDP ports ({filteredPorts.length} shown)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Port</TableHead>
                      <TableHead className="w-24">Protocol</TableHead>
                      <TableHead className="w-32">Service</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPorts.map((port) => (
                      <TableRow key={port.port}>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="font-mono font-medium">{port.port}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => copyToClipboard(port.port.toString())}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {port.protocol}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{port.service}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {port.description}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="private" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Private & Reserved IPv4 Ranges</CardTitle>
              <CardDescription>
                RFC 1918 private ranges and other special-use addresses (
                {filteredPrivateRanges.length} shown)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">Range</TableHead>
                      <TableHead className="w-28">Type</TableHead>
                      <TableHead className="w-28">Addresses</TableHead>
                      <TableHead className="w-24">RFC</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPrivateRanges.map((range) => (
                      <TableRow key={range.range}>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="font-mono font-medium">{range.range}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => copyToClipboard(range.range)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {range.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{range.addresses}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{range.rfc}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {range.description}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ipv6" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>IPv6 Address Types</CardTitle>
              <CardDescription>
                Special IPv6 address ranges and their purposes ({filteredIPv6Ranges.length} shown)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">Range</TableHead>
                      <TableHead className="w-40">Name</TableHead>
                      <TableHead className="w-24">Routable</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredIPv6Ranges.map((range) => (
                      <TableRow key={range.range}>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-sm font-medium">{range.range}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => copyToClipboard(range.range)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{range.name}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              range.routable === "Yes"
                                ? "default"
                                : range.routable === "No"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="text-xs"
                          >
                            {range.routable}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {range.description}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cidr" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>CIDR Notation Cheat Sheet</CardTitle>
              <CardDescription>
                Subnet masks, wildcard masks, and usable hosts ({filteredCIDR.length} shown)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">CIDR</TableHead>
                      <TableHead className="w-40">Subnet Mask</TableHead>
                      <TableHead className="w-40">Wildcard</TableHead>
                      <TableHead className="w-32">Usable Hosts</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCIDR.map((row) => (
                      <TableRow key={row.cidr}>
                        <TableCell className="font-mono font-bold">{row.cidr}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="font-mono">{row.mask}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => copyToClipboard(row.mask)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono">
                          {row.wildcard}
                        </TableCell>
                        <TableCell className="font-mono">{row.hosts.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="protocols" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>IP Protocol Numbers</CardTitle>
              <CardDescription>
                Protocol numbers used in the IP header ({filteredProtocols.length} shown)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Number</TableHead>
                      <TableHead className="w-28">Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-24">RFC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProtocols.map((protocol) => (
                      <TableRow key={protocol.number}>
                        <TableCell className="font-mono font-bold">{protocol.number}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{protocol.name}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {protocol.description}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {protocol.rfc}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subnets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Common Subnet Sizes</CardTitle>
              <CardDescription>
                Typical subnet configurations and their use cases ({filteredSubnets.length} shown)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">Name</TableHead>
                      <TableHead className="w-20">CIDR</TableHead>
                      <TableHead className="w-40">Subnet Mask</TableHead>
                      <TableHead className="w-24">Hosts</TableHead>
                      <TableHead>Use Case</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubnets.map((subnet) => (
                      <TableRow key={subnet.cidr}>
                        <TableCell className="font-medium">{subnet.name}</TableCell>
                        <TableCell className="font-mono font-bold">{subnet.cidr}</TableCell>
                        <TableCell className="font-mono">{subnet.mask}</TableCell>
                        <TableCell className="font-mono">{subnet.hosts.toLocaleString()}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {subnet.useCase}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
