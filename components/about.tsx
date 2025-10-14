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
  {
    title: "Routing Tools",
    description:
      "Complete suite of routing protocol configuration generators including OSPF, EIGRP, static routes, and administrative distance reference.",
    icon: Network,
    capabilities: ["OSPF configuration", "EIGRP configuration", "Static routes", "Administrative distance"],
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
  "Form controls across the suite now sit on high-contrast surfaces so inputs, selects, and checkboxes stay legible in dark and light themes.",
  "Outline actions and dashboard launch buttons gain accent borders/backgrounds to prevent blending into card surfaces.",
  "Desktop navigation now defaults to an expanded state on larger screens while staying collapsible on mobile.",
  "IPv4 wildcard and subnet validators reject discontiguous masks across routing and ACL tooling with inline guidance.",
  "Enhanced IP Conflict Checker with support for DHCP leases, MAC tables, and 15+ network data formats",
  "Real-time OUI Lookup integration with macvendors.com API and 18,000+ vendor database",
  "Improved search functionality with dynamic filtering and consistent tool counts",
  "Fixed all sample data loading across tools with proper error handling and debugging",
  "Enhanced copy-to-clipboard functionality with visual feedback and error handling",
  "Removed fake metrics and implemented real network testing with live data",
  "Added comprehensive technical details and edge case handling throughout the application",
]

const changelog = [
  {
    version: "2.4.0",
    type: "minor",
    title: "High-contrast theming refresh",
    changes: [
      "Updated the global dark theme palette so cards and data-entry surfaces are visually distinct and meet contrast guidelines.",
      "Refined input, select, textarea, and checkbox components with opaque surfaces and clearer focus states across light and dark modes.",
      "Adjusted outline buttons and dashboard calls-to-action for better prominence on all backgrounds and synced the documentation with the release.",
    ],
    technical: [
      "Tweaked OKLCH tokens for card, border, input, and ring colours to produce accessible contrast ratios.",
      "Normalized shadcn UI primitives to share the new surfaces and focus treatments across inputs, selects, and checkboxes.",
      "Documentation and in-app badges bumped to 2.4 with changelog entries covering the refresh.",
    ],
  },
  {
    version: "2.3.0",
    type: "minor",
    title: "Navigation polish & subnet sanity checks",
    changes: [
      "Sidebar automatically expands on desktop breakpoints while remaining collapsible for touch devices.",
      "Routing and static route builders now fail fast on discontiguous IPv4 masks and provide clear remediation tips.",
      "Documentation refreshed to highlight the stricter validation and layout behaviour.",
    ],
    technical: [
      "MediaQuery-synchronised sidebar state with SSR-safe guards.",
      "Subnet mask parser rejects non-contiguous bit patterns before generating configuration output.",
      "README/About changelog updates matching the release cadence.",
    ],
  },
  {
    version: "2.2.0",
    type: "minor",
    title: "Routing Reliability & Documentation Refresh",
    changes: [
      "Validated OSPF, EIGRP, and static route generators with CIDR-aware normalization, wildcard validation, and contextual warnings.",
      "Extended VLAN manager conflict detection to flag overlapping IPv4 and IPv6 allocations using range analysis.",
      "Hardened ACL generator host parsing to keep Cisco IOS output consistent for mixed CIDR and host entries.",
      "Added a branded favicon and comprehensive README outlining deployment workflow, tool coverage, and frontend-only constraints.",
    ],
    technical: [
      "Shared CIDR normalization utilities across routing and ACL tooling.",
      "BigInt-backed IPv6 range math for multi-VLAN overlap detection.",
      "Static route evaluation pipeline with combined next-hop/interface support and warning emission.",
      "Repository documentation overhaul capturing infrastructure limits and DoH/HTTP RTT architecture.",
    ],
  },
  {
    version: "2.1.1",
    type: "patch",
    title: "Mobile Enhancement",
    changes: [
      "Added scrollbar to hamburger menu for mobile devices to fix overflow issues",
    ],
    technical: [
      "hamburger menu that stays visible with shrink-0 class and truncates on launch",
    ],
  },
  {
    version: "2.1.0",
    type: "major",
    title: "Comprehensive Networking Suite Expansion",
    changes: [
      "Added complete Routing Tools suite with OSPF, EIGRP, static routes, and administrative distance reference",
      "Enhanced ACL Generator with Standard ACL support alongside Extended ACLs",
      "Introduced Wireless Tools with channel planning, interference analysis, and WiFi configuration",
      "Added comprehensive security best practices guide for wireless networks",
      "Implemented technical changelog system with complete revision history",
    ],
    technical: [
      "Multi-tab interface for routing protocol configuration generators",
      "Real-time channel interference simulation and recommendations",
      "Enhanced ACL validation with security warnings and best practices",
      "Comprehensive wireless security checklist and enterprise features",
    ],
  },
  {
    version: "2.0.3",
    type: "patch",
    title: "Enhanced IP Conflict Detection",
    changes: [
      "Improved multi-source network data correlation with enhanced format support",
      "Added enhanced regex parsers for Windows ARP, Linux ip neigh, Cisco show arp",
      "Implemented DHCP lease and switch MAC table parsing",
      "Enhanced conflict detection with evidence tracking and remediation workflows",
    ],
    technical: [
      "Advanced regex patterns for network data extraction",
      "Real-time conflict correlation algorithms",
      "Evidence-based remediation guidance system",
    ],
  },
  {
    version: "2.0.2",
    type: "patch",
    title: "Live OUI Database Integration",
    changes: [
      "Integrated macvendors.com API with comprehensive vendor records",
      "Implemented rate-limited bulk processing for MAC address lookups",
      "Added comprehensive MAC address format support",
      "Enhanced error handling and fallback mechanisms",
    ],
    technical: [
      "HTTP API integration with rate limiting",
      "Bulk processing with concurrent request management",
      "Comprehensive error handling and retry logic",
    ],
  },
  {
    version: "2.0.1",
    type: "patch",
    title: "Real Network Testing Implementation",
    changes: [
      "Replaced simulated ping/traceroute with real HTTP-based RTT measurement",
      "Implemented animated real-time results with performance.now() timing",
      "Added CORS-aware requests with configurable timeout handling",
      "Enhanced port scanner with WebSocket and HTTP probes",
    ],
    technical: [
      "Performance.now() for microsecond timing precision",
      "CORS handling for cross-origin network requests",
      "WebSocket probes for port connectivity testing",
    ],
  },
  {
    version: "2.0.0",
    type: "major",
    title: "Production-Grade Architecture Overhaul",
    changes: [
      "Complete rewrite with enterprise-grade security and performance",
      "Implemented AES-GCM encryption with PBKDF2 key derivation for project storage",
      "Added comprehensive WCAG 2.2 AA accessibility compliance",
      "Introduced CSP with strict security policies preventing XSS attacks",
    ],
    technical: [
      "Web Crypto API for client-side encryption",
      "IndexedDB with encrypted storage layer",
      "Semantic HTML with ARIA labels and keyboard navigation",
      "Content Security Policy implementation",
    ],
  },
  {
    version: "1.9.2",
    type: "patch",
    title: "Enhanced VLSM Planning Algorithm",
    changes: [
      "Improved binary boundary allocation with fragmentation analysis",
      "Added capacity validation with utilization heatmaps",
      "Enhanced subnet sorting by host count descending",
      "Implemented optimal prefix calculation validation",
    ],
    technical: [
      "Binary boundary alignment algorithms",
      "Fragmentation detection and analysis",
      "Capacity utilization visualization",
    ],
  },
  {
    version: "1.9.1",
    type: "patch",
    title: "IPv6 Tools RFC Compliance",
    changes: [
      "Implemented RFC 5952 compliant IPv6 address compression",
      "Added EUI-64 generation from MAC with U/L bit flip and FF:FE insertion",
      "Enhanced solicited-node multicast calculation",
      "Improved link-local address generation and validation",
    ],
    technical: [
      "RFC 5952 longest zero sequence replacement",
      "EUI-64 MAC address transformation",
      "Solicited-node multicast address calculation",
    ],
  },
  {
    version: "1.9.0",
    type: "minor",
    title: "Multi-Platform ACL Generator",
    changes: [
      "Added support for Cisco IOS, Palo Alto, and Juniper SRX platforms",
      "Implemented wildcard mask calculation using bitwise operations",
      "Enhanced protocol and port validation with comprehensive error checking",
      "Added rule documentation and configuration export functionality",
    ],
    technical: [
      "Multi-platform configuration generation",
      "Bitwise wildcard mask calculations",
      "Comprehensive input validation and sanitization",
    ],
  },
  {
    version: "1.8.3",
    type: "patch",
    title: "DNS Tools RFC 8484 Compliance",
    changes: [
      "Implemented RFC 8484 compliant DNS over HTTPS client",
      "Added multiple provider support with TTL-based caching",
      "Enhanced DNSSEC AD flag validation",
      "Improved support for comprehensive record types",
    ],
    technical: [
      "RFC 8484 DNS over HTTPS implementation",
      "TTL-based response caching system",
      "DNSSEC validation and verification",
    ],
  },
  {
    version: "1.8.2",
    type: "patch",
    title: "Enhanced VLAN Management",
    changes: [
      "Added IEEE 802.1Q VLAN database with multi-vendor support",
      "Implemented Cisco IOS and Aruba CX configuration generation",
      "Enhanced native VLAN validation and trunk consistency checking",
      "Added comprehensive VLAN conflict detection",
    ],
    technical: [
      "IEEE 802.1Q standard compliance",
      "Multi-vendor configuration templates",
      "Trunk port validation algorithms",
    ],
  },
  {
    version: "1.8.1",
    type: "patch",
    title: "MTU Calculator Protocol Analysis",
    changes: [
      "Implemented protocol stack overhead analysis with configurable layers",
      "Added support for Ethernet, 802.1Q, IPv4/IPv6, TCP/UDP calculations",
      "Enhanced tunneling protocol overhead calculations",
      "Added fragmentation warnings and path MTU discovery",
    ],
    technical: [
      "Protocol stack overhead calculations",
      "Encapsulation layer analysis",
      "Path MTU discovery algorithms",
    ],
  },
  {
    version: "1.8.0",
    type: "minor",
    title: "Advanced Subnet Calculator",
    changes: [
      "Enhanced IPv4 subnet calculations with RFC 3021 support",
      "Implemented deterministic algorithms with bit-level masking operations",
      "Added support for host routes and point-to-point links",
      "Enhanced private range detection and CIDR validation",
    ],
    technical: [
      "Unsigned 32-bit arithmetic for precision",
      "RFC 3021 point-to-point link support",
      "Bit-level network and broadcast calculations",
    ],
  },
  {
    version: "1.7.2",
    type: "patch",
    title: "Project Management Security",
    changes: [
      "Implemented client-side AES-GCM encryption for project storage",
      "Added PBKDF2 key derivation with SHA-256 integrity hashing",
      "Enhanced JSON schema versioning with migration support",
      "Improved secure import/export with password-based encryption",
    ],
    technical: [
      "AES-GCM encryption with Web Crypto API",
      "PBKDF2 key derivation functions",
      "SHA-256 integrity verification",
    ],
  },
  {
    version: "1.7.1",
    type: "patch",
    title: "Enhanced Port Scanner",
    changes: [
      "Implemented browser-based port connectivity testing",
      "Added WebSocket and HTTP probe methods",
      "Enhanced concurrent scanning with configurable timeouts",
      "Improved service detection and status reporting",
    ],
    technical: ["WebSocket connection probing", "Concurrent request management", "Service fingerprinting algorithms"],
  },
  {
    version: "1.7.0",
    type: "minor",
    title: "Network Testing Suite",
    changes: [
      "Added comprehensive network connectivity testing tools",
      "Implemented real-time ping and traceroute functionality",
      "Enhanced DNS resolution testing with multiple record types",
      "Added network performance metrics and analysis",
    ],
    technical: [
      "Real-time network connectivity probes",
      "DNS resolution performance metrics",
      "Network latency and packet loss analysis",
    ],
  },
  {
    version: "1.6.3",
    type: "patch",
    title: "UI/UX Enhancements",
    changes: [
      "Improved responsive design with CSS Grid and Flexbox",
      "Enhanced dark/light theme support with system preference detection",
      "Added comprehensive keyboard navigation and focus management",
      "Improved accessibility with semantic HTML and ARIA labels",
    ],
    technical: [
      "CSS Grid and Flexbox layout systems",
      "System theme preference detection",
      "Keyboard navigation event handling",
    ],
  },
  {
    version: "1.6.2",
    type: "patch",
    title: "Performance Optimizations",
    changes: [
      "Optimized for large IP/subnet operations using efficient data structures",
      "Implemented service worker caching for offline-first architecture",
      "Enhanced memory management for large dataset processing",
      "Added progressive loading for improved initial page load times",
    ],
    technical: [
      "Efficient data structure implementations",
      "Service worker caching strategies",
      "Memory optimization for large datasets",
    ],
  },
  {
    version: "1.6.1",
    type: "patch",
    title: "Security Hardening",
    changes: [
      "Implemented Content Security Policy with script-src 'self'",
      "Added comprehensive input validation and sanitization",
      "Enhanced XSS protection with output encoding",
      "Improved error handling to prevent information disclosure",
    ],
    technical: [
      "Content Security Policy implementation",
      "Input validation and sanitization",
      "XSS prevention mechanisms",
    ],
  },
  {
    version: "1.6.0",
    type: "minor",
    title: "Core Networking Tools",
    changes: [
      "Launched comprehensive subnet calculator with VLSM support",
      "Added VLAN management with multi-vendor configuration",
      "Implemented IP conflict detection with multi-source correlation",
      "Added DNS tools with comprehensive record type support",
    ],
    technical: [
      "VLSM algorithm implementation",
      "Multi-vendor configuration generation",
      "Network data correlation engines",
    ],
  },
  {
    version: "1.5.0",
    type: "minor",
    title: "Foundation Architecture",
    changes: [
      "Established React/TypeScript foundation with modern tooling",
      "Implemented component-based architecture with reusable UI elements",
      "Added comprehensive state management and data flow patterns",
      "Established development workflow with testing and deployment pipelines",
    ],
    technical: [
      "React 18 with TypeScript strict mode",
      "Component-based architecture patterns",
      "Modern build tooling and optimization",
    ],
  },
  {
    version: "1.0.0",
    type: "major",
    title: "Initial Release",
    changes: [
      "Initial project setup and architecture planning",
      "Basic networking tool framework implementation",
      "Core UI components and design system establishment",
      "Development environment and tooling configuration",
    ],
    technical: ["Project initialization and setup", "Basic component framework", "Development tooling configuration"],
  },
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
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-foreground">Professional Networking Toolbox</h1>
        <p className="text-xl text-muted-foreground max-w-4xl mx-auto">
          A comprehensive, production-quality networking toolbox implementing industry-standard algorithms and
          protocols. Built as a frontend-only SPA with real network integrations, live API connections, and
          enterprise-grade security while solving real-world network engineering challenges with mathematical precision.
        </p>
        <div className="flex justify-center flex-wrap gap-2">
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
          <CardTitle className="flex items-center gap-2">
            <GitCommit className="w-5 h-5" />
            Technical Changelog
          </CardTitle>
          <CardDescription>
            Complete development history across {changelog.length} revisions - from v1.0.0 to v{changelog[0].version}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Badge variant="default" className="flex items-center gap-1">
                <Star className="w-3 h-3" />
                Major
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1">
                <Plus className="w-3 h-3" />
                Minor
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <Bug className="w-3 h-3" />
                Patch
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">Latest: v{changelog[0].version}</div>
          </div>

          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-6">
              {changelog.map((release, index) => {
                const VersionIcon = getVersionIcon(release.type)
                return (
                  <div key={release.version} className="relative">
                    {index < changelog.length - 1 && <div className="absolute left-4 top-8 bottom-0 w-px bg-border" />}

                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-background border-2 border-border rounded-full flex items-center justify-center">
                        <VersionIcon className="w-4 h-4 text-muted-foreground" />
                      </div>

                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-lg">v{release.version}</h3>
                          <Badge variant={getVersionBadgeVariant(release.type)}>{release.type}</Badge>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {release.date}
                          </div>
                        </div>

                        <h4 className="font-medium text-foreground">{release.title}</h4>

                        <div className="space-y-3">
                          <div>
                            <h5 className="text-sm font-medium mb-2">Features & Changes</h5>
                            <ul className="space-y-1">
                              {release.changes.map((change, changeIndex) => (
                                <li key={changeIndex} className="flex items-start gap-2 text-sm">
                                  <div className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0 mt-2" />
                                  <span className="text-muted-foreground leading-relaxed">{change}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {release.technical && release.technical.length > 0 && (
                            <div>
                              <h5 className="text-sm font-medium mb-2">Technical Implementation</h5>
                              <ul className="space-y-1">
                                {release.technical.map((tech, techIndex) => (
                                  <li key={techIndex} className="flex items-start gap-2 text-sm">
                                    <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full flex-shrink-0 mt-2" />
                                    <span className="text-muted-foreground leading-relaxed font-mono text-xs">
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

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">{changelog.length}</div>
              <div className="text-sm text-muted-foreground">Total Revisions</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {changelog.filter((r) => r.type === "major").length}
              </div>
              <div className="text-sm text-muted-foreground">Major Releases</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {changelog.filter((r) => r.type === "minor").length}
              </div>
              <div className="text-sm text-muted-foreground">Minor Updates</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">
                {changelog.filter((r) => r.type === "patch").length}
              </div>
              <div className="text-sm text-muted-foreground">Patch Fixes</div>
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
