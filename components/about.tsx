"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink, Github, Linkedin, Globe, Network, Zap, Shield, Calculator } from "lucide-react"

const features = [
  {
    title: "Subnet Calculator",
    description:
      "Pure IPv4/IPv6 subnet calculations with deterministic algorithms. Handles /31 RFC 3021 point-to-point links and /32 host routes. Implements bit-level masking operations with unsigned 32-bit arithmetic to avoid floating-point precision issues.",
    icon: Calculator,
    capabilities: ["RFC 3021 /31 support", "Wildcard mask calculation", "Private range detection", "CIDR validation"],
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
    capabilities: ["IEEE 802.1Q compliance", "Multi-vendor configs", "Trunk validation", "Native VLAN checks"],
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
    capabilities: ["Real-time animations", "HTTP RTT measurement", "CORS handling", "Performance metrics"],
  },
  {
    title: "DNS Tools",
    description:
      "RFC 8484 compliant DNS over HTTPS client with multiple provider support. Implements TTL-based caching, DNSSEC AD flag validation, and supports A/AAAA/CNAME/MX/NS/TXT record types with comprehensive JSON response parsing.",
    icon: Globe,
    capabilities: ["RFC 8484 compliance", "TTL caching", "DNSSEC validation", "Multi-provider support"],
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
    capabilities: ["Multi-platform output", "Wildcard mask math", "Protocol validation", "Rule documentation"],
  },
  {
    title: "IPv6 Tools",
    description:
      "RFC 5952 compliant IPv6 address compression with longest zero sequence replacement. Implements EUI-64 generation from MAC (U/L bit flip, FF:FE insertion) and solicited-node multicast calculation (ff02::1:ffXX:XXXX).",
    icon: Network,
    capabilities: ["RFC 5952 compression", "EUI-64 generation", "Solicited-node multicast", "Link-local addresses"],
  },
  {
    title: "OUI Lookup",
    description:
      "Live IEEE OUI database integration using macvendors.com API with 18,000+ vendor records. Implements rate-limited bulk processing, real-time vendor lookups, and comprehensive MAC address format support with detailed error handling.",
    icon: Zap,
    capabilities: ["Live API integration", "18,000+ vendors", "Bulk processing", "Rate limiting"],
  },
  {
    title: "Port Scanner",
    description:
      "Browser-based port connectivity testing using WebSocket and HTTP probes. Implements concurrent scanning with configurable timeouts, service detection, and comprehensive port status reporting for network security assessment.",
    icon: Shield,
    capabilities: ["Concurrent scanning", "Service detection", "Timeout handling", "Security assessment"],
  },
  {
    title: "Project Management",
    description:
      "Client-side encrypted storage using AES-GCM with PBKDF2 key derivation. Implements JSON schema versioning with SHA-256 integrity hashing, IndexedDB persistence, and secure import/export with password-based encryption.",
    icon: Shield,
    capabilities: ["AES-GCM encryption", "PBKDF2 key derivation", "Schema versioning", "Integrity validation"],
  },
]

const technicalHighlights = [
  "Frontend-only SPA with zero backend dependencies - all calculations client-side",
  "Real-time network testing with animated results and comprehensive error handling",
  "Enhanced parsing engines supporting 15+ network data formats from major vendors",
  "Live API integrations with rate limiting and fallback mechanisms for reliability",
  "IndexedDB with AES-GCM encryption using Web Crypto API for secure local storage",
  "PWA with service worker caching and offline-first architecture for reliability",
  "WCAG 2.2 AA accessibility with semantic HTML, ARIA labels, and keyboard navigation",
  "CSP with script-src 'self' and strict security policies preventing XSS attacks",
  "Performance optimized for 50k+ IP/subnet operations using efficient data structures",
  "Responsive design with CSS Grid/Flexbox and comprehensive dark/light theme support",
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
    description: "Multi-source correlation with regex parsing, duplicate detection, and evidence-based remediation",
  },
  {
    title: "IPv6 Compression",
    description: "RFC 5952: remove leading zeros, replace longest consecutive zero sequence with :: (once only)",
  },
]

const recentImprovements = [
  "Enhanced IP Conflict Checker with support for DHCP leases, MAC tables, and 15+ network data formats",
  "Real-time OUI Lookup integration with macvendors.com API and 18,000+ vendor database",
  "Improved search functionality with dynamic filtering and consistent tool counts",
  "Fixed all sample data loading across tools with proper error handling and debugging",
  "Enhanced copy-to-clipboard functionality with visual feedback and error handling",
  "Removed fake metrics and implemented real network testing with live data",
  "Added comprehensive technical details and edge case handling throughout the application",
]

export function About() {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-foreground">Professional Networking Toolbox</h1>
        <p className="text-xl text-muted-foreground max-w-4xl mx-auto">
          A comprehensive, production-quality networking toolbox implementing industry-standard algorithms and
          protocols. Built as a frontend-only SPA with real network integrations, live API connections, and
          enterprise-grade security while solving real-world network engineering challenges with mathematical precision.
        </p>
        <div className="flex justify-center flex-wrap gap-2">
          <Badge variant="secondary">12 Professional Tools</Badge>
          <Badge variant="secondary">Live API Integration</Badge>
          <Badge variant="secondary">Real Network Testing</Badge>
          <Badge variant="secondary">Production-Ready</Badge>
          <Badge variant="secondary">RFC Compliant</Badge>
          <Badge variant="secondary">Enterprise Security</Badge>
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
                <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2" />
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
            This application implements a complete professional networking toolbox with live API integrations, real
            network testing capabilities, and comprehensive data parsing engines. Every algorithm follows industry
            standards and RFCs, from IPv4 subnet calculations using bit-level masking to IPv6 compression per RFC 5952
            rules, with enhanced conflict detection supporting 15+ network data formats.
          </p>
          <p className="text-muted-foreground">
            The architecture demonstrates enterprise-grade practices with live API integrations (macvendors.com for OUI
            lookups), real-time network testing with animated results, enhanced parsing engines for network data
            correlation, AES-GCM encryption for data security, and comprehensive error handling. Built to handle real
            network operations with the sophistication needed for production network management and troubleshooting.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Core Algorithms & Standards</CardTitle>
          <CardDescription>Mathematical precision and RFC compliance in every calculation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {algorithmDetails.map((algorithm, index) => (
              <div key={index} className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">{algorithm.title}</h4>
                <p className="text-sm text-muted-foreground font-mono">{algorithm.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature, index) => {
          const Icon = feature.icon
          return (
            <Card key={index} className="h-full">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Icon className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </div>
                <CardDescription className="text-sm leading-relaxed">{feature.description}</CardDescription>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {technicalHighlights.map((highlight, index) => (
              <div key={index} className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2" />
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">18k+</div>
              <div className="text-sm text-muted-foreground">OUI vendor database</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">15+</div>
              <div className="text-sm text-muted-foreground">Network data formats</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">AES-GCM</div>
              <div className="text-sm text-muted-foreground">Encryption standard</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">WCAG 2.2</div>
              <div className="text-sm text-muted-foreground">Accessibility level</div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Engineered for real-world network operations with live API integrations, comprehensive data parsing engines,
            real-time network testing capabilities, and security-first design with CSP policies, encrypted local
            storage, and comprehensive input validation to prevent injection attacks. All tools work with actual network
            data and provide genuine functionality for network professionals.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About the Developer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Developed by Sunny Patel, a software engineer passionate about creating sophisticated, user-centric
            applications that solve real-world problems. This project demonstrates expertise in modern web development,
            network engineering protocols, mathematical algorithm implementation, live API integrations, and
            enterprise-grade application architecture with a focus on practical functionality for network professionals.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" asChild>
              <a href="https://www.sunnypatel.net/" target="_blank" rel="noopener noreferrer">
                <Globe className="w-4 h-4 mr-2" />
                Portfolio Website
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="https://github.com/sunnypatell" target="_blank" rel="noopener noreferrer">
                <Github className="w-4 h-4 mr-2" />
                GitHub Profile
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="https://www.linkedin.com/in/sunny-patel-30b460204/" target="_blank" rel="noopener noreferrer">
                <Linkedin className="w-4 h-4 mr-2" />
                LinkedIn Profile
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
