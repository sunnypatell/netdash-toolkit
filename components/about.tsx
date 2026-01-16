"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  ExternalLink,
  Github,
  Linkedin,
  Globe,
  Network,
  Zap,
  Shield,
  Calculator,
  GitCommit,
  Clock,
  Plus,
  Bug,
  Wrench,
  Star,
} from "lucide-react"
import changelogData from "@/data/changelog.json"

// Extract changelog from JSON data
const changelog = changelogData.releases

const features = [
  {
    title: "Subnet Calculator",
    description:
      "Pure IPv4/IPv6 subnet calculations with deterministic algorithms. Handles /31 RFC 3021 point-to-point links and /32 host routes. Implements bit-level masking operations with unsigned 32-bit arithmetic to avoid floating-point precision issues.",
    icon: Calculator,
    capabilities: [
      "RFC 3021 /31 support",
      "Wildcard mask calculation",
      "Private range detection",
      "CIDR validation",
    ],
  },
  {
    title: "VLSM Planner",
    description:
      "Variable Length Subnet Masking with optimal binary boundary allocation. Sorts requirements by host count descending, calculates minimal prefix lengths using 2^(32-p)-2 formula, and validates against base network capacity with fragmentation analysis.",
    icon: Network,
    capabilities: [
      "Binary boundary alignment",
      "Capacity validation",
      "Fragmentation detection",
      "Utilization heatmaps",
    ],
  },
  {
    title: "VLAN Manager",
    description:
      "IEEE 802.1Q VLAN database with multi-vendor switch configuration generation. Supports Cisco IOS (switchport commands) and Aruba CX (vlan access/trunk) with native VLAN validation and trunk consistency checking.",
    icon: Shield,
    capabilities: [
      "IEEE 802.1Q compliance",
      "Multi-vendor configs",
      "Trunk validation",
      "Native VLAN checks",
    ],
  },
  {
    title: "IP Conflict Checker",
    description:
      "Multi-source network data correlation engine with enhanced regex parsers for Windows ARP, Linux ip neigh, Cisco show arp, DHCP leases, and switch MAC tables. Detects duplicate IP/MAC conflicts, static-DHCP overlaps, and provides detailed remediation guidance.",
    icon: Zap,
    capabilities: [
      "Enhanced multi-format parsing",
      "Real-time conflict detection",
      "Evidence tracking",
      "Remediation workflows",
    ],
  },
  {
    title: "Ping & Traceroute",
    description:
      "Browser-based network connectivity testing with animated real-time results. Implements HTTP-based RTT measurement using performance.now() timing with CORS-aware requests and configurable timeout handling for reliable network diagnostics.",
    icon: Network,
    capabilities: [
      "Real-time animations",
      "HTTP RTT measurement",
      "CORS handling",
      "Performance metrics",
    ],
  },
  {
    title: "DNS Tools",
    description:
      "RFC 8484 compliant DNS over HTTPS client with multiple provider support. Implements TTL-based caching, DNSSEC AD flag validation, and supports A/AAAA/CNAME/MX/NS/TXT record types with comprehensive JSON response parsing.",
    icon: Globe,
    capabilities: [
      "RFC 8484 compliance",
      "TTL caching",
      "DNSSEC validation",
      "Multi-provider support",
    ],
  },
  {
    title: "MTU Calculator",
    description:
      "Protocol stack overhead analysis with configurable encapsulation layers. Calculates payload MTU using link MTU minus sum of protocol overheads (Ethernet, 802.1Q, IPv4/IPv6, TCP/UDP, tunneling protocols) with fragmentation warnings.",
    icon: Calculator,
    capabilities: [
      "Protocol stack analysis",
      "Encapsulation overhead",
      "Fragmentation detection",
      "Path MTU calculation",
    ],
  },
  {
    title: "ACL Generator",
    description:
      "Multi-platform Access Control List generation with wildcard mask calculation (~netmask). Supports Cisco IOS extended ACLs, Palo Alto security rules, and Juniper SRX policies with comprehensive protocol/port validation and rule documentation.",
    icon: Shield,
    capabilities: [
      "Multi-platform output",
      "Wildcard mask math",
      "Protocol validation",
      "Rule documentation",
    ],
  },
  {
    title: "IPv6 Tools",
    description:
      "RFC 5952 compliant IPv6 address compression with longest zero sequence replacement. Implements EUI-64 generation from MAC (U/L bit flip, FF:FE insertion) and solicited-node multicast calculation (ff02::1:ffXX:XXXX).",
    icon: Network,
    capabilities: [
      "RFC 5952 compression",
      "EUI-64 generation",
      "Solicited-node multicast",
      "Link-local addresses",
    ],
  },
  {
    title: "OUI Lookup",
    description:
      "Live IEEE OUI database integration using macvendors.com API for real-time vendor identification. Implements rate-limited bulk processing with local fallback database, comprehensive MAC address format support, and detailed error handling.",
    icon: Zap,
    capabilities: [
      "Live API integration",
      "Vendor identification",
      "Bulk processing",
      "Rate limiting",
    ],
  },
  {
    title: "Port Scanner",
    description:
      "Network port connectivity testing using TCP socket connections (desktop) and HTTP probes (browser). Implements concurrent scanning with configurable timeouts, service detection, and comprehensive port status reporting for network security assessment.",
    icon: Shield,
    capabilities: [
      "TCP socket scanning",
      "Service detection",
      "Timeout handling",
      "Security assessment",
    ],
  },
  {
    title: "Network Analyzer",
    description:
      "Comprehensive network interface analysis with real-time statistics, traffic monitoring, and protocol breakdown. Provides detailed metrics on network performance, interface status, and connection health for troubleshooting.",
    icon: Shield,
    capabilities: [
      "Interface analysis",
      "Traffic monitoring",
      "Protocol breakdown",
      "Performance metrics",
    ],
  },
  {
    title: "Routing Tools",
    description:
      "Complete suite of routing protocol configuration generators including OSPF, EIGRP, static routes, and administrative distance reference.",
    icon: Network,
    capabilities: [
      "OSPF configuration",
      "EIGRP configuration",
      "Static routes",
      "Administrative distance",
    ],
  },
  {
    title: "Wireless Tools",
    description:
      "Channel planning, interference analysis, and WiFi configuration tools for wireless network management.",
    icon: Network,
    capabilities: ["Channel planning", "Interference analysis", "WiFi configuration"],
  },
]

const technicalHighlights = [
  "Frontend-only SPA with zero backend dependencies - all calculations client-side",
  "Real-time network testing with animated results and comprehensive error handling",
  "Enhanced parsing engines supporting 15+ network data formats from major vendors",
  "Live API integrations with rate limiting and fallback mechanisms for reliability",
  "Electron desktop app with native TCP socket access for real network operations",
  "WCAG 2.2 AA accessibility with semantic HTML, ARIA labels, and keyboard navigation",
  "Performance optimized for 50k+ IP/subnet operations using efficient data structures",
  "Responsive design with CSS Grid/Flexbox and comprehensive dark/light theme support",
  "Multi-vendor configuration generators for Cisco, Juniper, and Palo Alto platforms",
  "RFC-compliant implementations for IPv4/IPv6 subnetting, DNS-over-HTTPS, and more",
]

const algorithmDetails = [
  {
    title: "IPv4 Subnet Math",
    description:
      "Network = IP & Mask, Broadcast = Network | ~Mask, using unsigned 32-bit operations to prevent overflow",
  },
  {
    title: "VLSM Allocation",
    description:
      "Sort by host count descending, calculate prefix p where 2^(32-p)-2 ≥ hosts, place on binary boundaries",
  },
  {
    title: "Conflict Detection",
    description:
      "Multi-source correlation with regex parsing, duplicate detection, and evidence-based remediation",
  },
  {
    title: "IPv6 Compression",
    description:
      "RFC 5952: remove leading zeros, replace longest consecutive zero sequence with :: (once only)",
  },
]

const recentImprovements = [
  "Complete Project Manager with localStorage persistence for organizing network configurations",
  "Multi-vendor ACL generators now support Cisco IOS, Juniper SRX, and Palo Alto platforms",
  "TTL-based DNS caching for DoH queries with real-time cache statistics visualization",
  "WCAG 2.2 AA accessibility compliance with ARIA labels, keyboard navigation, and focus management",
  "Desktop navigation defaults to expanded state on larger screens while staying collapsible on mobile",
  "IPv4 wildcard and subnet validators reject discontiguous masks with inline guidance",
  "Enhanced IP Conflict Checker with support for DHCP leases, MAC tables, and 15+ network data formats",
  "Real-time OUI Lookup integration with macvendors.com API for vendor identification",
  "Improved search functionality with dynamic filtering and consistent tool counts",
]

const getVersionBadgeVariant = (type: string) => {
  switch (type) {
    case "major":
      return "default"
    case "minor":
      return "secondary"
    case "patch":
      return "outline"
    default:
      return "outline"
  }
}

const getVersionIcon = (type: string) => {
  switch (type) {
    case "major":
      return Star
    case "minor":
      return Plus
    case "patch":
      return Bug
    default:
      return Wrench
  }
}

export function About() {
  return (
    <div className="space-y-8">
      <div className="space-y-4 text-center">
        <h1 className="text-foreground text-4xl font-bold">Professional Networking Toolbox</h1>
        <p className="text-muted-foreground mx-auto max-w-4xl text-xl">
          A comprehensive, production-quality networking toolbox implementing industry-standard
          algorithms and protocols. Built as a frontend-only SPA with real network integrations,
          live API connections, and enterprise-grade security while solving real-world network
          engineering challenges with mathematical precision.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Badge variant="secondary">Live API Integration</Badge>
          <Badge variant="secondary">Real Network Testing</Badge>
          <Badge variant="secondary">Production-Ready</Badge>
          <Badge variant="secondary">RFC Compliant</Badge>
          <Badge variant="secondary">Enterprise Security</Badge>
          <Badge variant="secondary">Professional Tools</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Improvements & Enhancements</CardTitle>
          <CardDescription>
            Latest updates focused on real-world functionality and professional-grade reliability
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentImprovements.map((improvement, index) => (
              <div key={index} className="flex items-start space-x-2">
                <div className="bg-primary mt-2 h-2 w-2 flex-shrink-0 rounded-full" />
                <span className="text-sm leading-relaxed">{improvement}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Technical Implementation</CardTitle>
          <CardDescription>
            Built for network engineers and system administrators with real-world functionality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            This application implements a complete professional networking toolbox with live API
            integrations, real network testing capabilities, and comprehensive data parsing engines.
            Every algorithm follows industry standards and RFCs, from IPv4 subnet calculations using
            bit-level masking to IPv6 compression per RFC 5952 rules, with enhanced conflict
            detection supporting 15+ network data formats.
          </p>
          <p className="text-muted-foreground">
            The architecture demonstrates enterprise-grade practices with live API integrations
            (macvendors.com for OUI lookups), real-time network testing with animated results,
            enhanced parsing engines for network data correlation, AES-GCM encryption for data
            security, and comprehensive error handling. Built to handle real network operations with
            the sophistication needed for production network management and troubleshooting.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Core Algorithms & Standards</CardTitle>
          <CardDescription>
            Mathematical precision and RFC compliance in every calculation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {algorithmDetails.map((algorithm, index) => (
              <div key={index} className="rounded-lg border p-4">
                <h4 className="mb-2 font-semibold">{algorithm.title}</h4>
                <p className="text-muted-foreground font-mono text-sm">{algorithm.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, index) => {
          const Icon = feature.icon
          return (
            <Card key={index} className="h-full">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Icon className="text-primary h-5 w-5" />
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </div>
                <CardDescription className="text-sm leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-sm font-medium">Technical Features:</div>
                  <div className="flex flex-wrap gap-1">
                    {feature.capabilities.map((capability, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {capability}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Architecture & Performance</CardTitle>
          <CardDescription>
            Enterprise-grade implementation with security-first design and real-world functionality
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {technicalHighlights.map((highlight, index) => (
              <div key={index} className="flex items-start space-x-2">
                <div className="bg-primary mt-2 h-2 w-2 flex-shrink-0 rounded-full" />
                <span className="text-sm leading-relaxed">{highlight}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Performance & Security Metrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="text-center">
              <div className="text-primary text-2xl font-bold">18k+</div>
              <div className="text-muted-foreground text-sm">OUI vendor database</div>
            </div>
            <div className="text-center">
              <div className="text-primary text-2xl font-bold">15+</div>
              <div className="text-muted-foreground text-sm">Network data formats</div>
            </div>
            <div className="text-center">
              <div className="text-primary text-2xl font-bold">AES-GCM</div>
              <div className="text-muted-foreground text-sm">Encryption standard</div>
            </div>
            <div className="text-center">
              <div className="text-primary text-2xl font-bold">WCAG 2.2</div>
              <div className="text-muted-foreground text-sm">Accessibility level</div>
            </div>
          </div>
          <p className="text-muted-foreground text-sm">
            Engineered for real-world network operations with live API integrations, comprehensive
            data parsing engines, real-time network testing capabilities, and security-first design
            with CSP policies, encrypted local storage, and comprehensive input validation to
            prevent injection attacks. All tools work with actual network data and provide genuine
            functionality for network professionals.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCommit className="h-5 w-5" />
            Technical Changelog
          </CardTitle>
          <CardDescription>
            Complete development history across {changelog.length} revisions - from v1.0.0 to v
            {changelog[0].version}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="default" className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                Major
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Plus className="h-3 w-3" />
                Minor
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <Bug className="h-3 w-3" />
                Patch
              </Badge>
            </div>
            <div className="text-muted-foreground text-sm">Latest: v{changelog[0].version}</div>
          </div>

          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-6">
              {changelog.map((release, index) => {
                const VersionIcon = getVersionIcon(release.type)
                return (
                  <div key={release.version} className="relative">
                    {index < changelog.length - 1 && (
                      <div className="bg-border absolute top-8 bottom-0 left-4 w-px" />
                    )}

                    <div className="flex items-start gap-4">
                      <div className="bg-background border-border flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2">
                        <VersionIcon className="text-muted-foreground h-4 w-4" />
                      </div>

                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold">v{release.version}</h3>
                          <Badge variant={getVersionBadgeVariant(release.type)}>
                            {release.type}
                          </Badge>
                        </div>

                        <h4 className="text-foreground font-medium">{release.title}</h4>

                        <div className="space-y-3">
                          <div>
                            <h5 className="mb-2 text-sm font-medium">Features & Changes</h5>
                            <ul className="space-y-1">
                              {release.changes.map((change, changeIndex) => (
                                <li key={changeIndex} className="flex items-start gap-2 text-sm">
                                  <div className="bg-primary mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full" />
                                  <span className="text-muted-foreground leading-relaxed">
                                    {change}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {release.technical && release.technical.length > 0 && (
                            <div>
                              <h5 className="mb-2 text-sm font-medium">Technical Implementation</h5>
                              <ul className="space-y-1">
                                {release.technical.map((tech, techIndex) => (
                                  <li key={techIndex} className="flex items-start gap-2 text-sm">
                                    <div className="bg-muted-foreground mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full" />
                                    <span className="text-muted-foreground font-mono text-xs leading-relaxed">
                                      {tech}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>

          <Separator className="my-4" />

          <div className="grid grid-cols-1 gap-4 text-center md:grid-cols-4">
            <div>
              <div className="text-primary text-2xl font-bold">{changelog.length}</div>
              <div className="text-muted-foreground text-sm">Total Revisions</div>
            </div>
            <div>
              <div className="text-primary text-2xl font-bold">
                {changelog.filter((r) => r.type === "major").length}
              </div>
              <div className="text-muted-foreground text-sm">Major Releases</div>
            </div>
            <div>
              <div className="text-primary text-2xl font-bold">
                {changelog.filter((r) => r.type === "minor").length}
              </div>
              <div className="text-muted-foreground text-sm">Minor Updates</div>
            </div>
            <div>
              <div className="text-primary text-2xl font-bold">
                {changelog.filter((r) => r.type === "patch").length}
              </div>
              <div className="text-muted-foreground text-sm">Patch Fixes</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About the Developer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Developed by Sunny Patel, a software engineer passionate about creating sophisticated,
            user-centric applications that solve real-world problems. This project demonstrates
            expertise in modern web development, network engineering protocols, mathematical
            algorithm implementation, live API integrations, and enterprise-grade application
            architecture with a focus on practical functionality for network professionals.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" asChild>
              <a href="https://www.sunnypatel.net/" target="_blank" rel="noopener noreferrer">
                <Globe className="mr-2 h-4 w-4" />
                Portfolio Website
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="https://github.com/sunnypatell" target="_blank" rel="noopener noreferrer">
                <Github className="mr-2 h-4 w-4" />
                GitHub Profile
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a
                href="https://www.linkedin.com/in/sunny-patel-30b460204/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Linkedin className="mr-2 h-4 w-4" />
                LinkedIn Profile
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
