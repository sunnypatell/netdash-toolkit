import type { ComponentType } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Calculator,
  Network,
  Layers,
  AlertTriangle,
  Activity,
  Globe,
  Wifi,
  Shield,
  Zap,
  Search,
  Navigation,
  Scan,
  Route,
  Radio,
  Cable,
  QrCode,
  ArrowRightLeft,
  List,
  Shuffle,
  Gauge,
  Lock,
  Mail,
  BookOpen,
  Server,
  Binary,
  Wrench,
  TestTube,
  FileText,
  Key,
  FileCode,
  Link2,
  Braces,
  Clock,
  Timer,
  FileSearch,
  Palette,
  Hash,
  Monitor,
  Code,
  HardDrive,
  Cpu,
  Globe2,
} from "lucide-react"

export type ToolCategory =
  "calculators" | "ip-tools" | "network" | "diagnostics" | "generators" | "reference" | "devtools"

export type ProjectItemType =
  | "subnet"
  | "vlsm"
  | "vlan"
  | "acl"
  | "dns"
  | "route"
  | "routing"
  | "mtu"
  | "ipv6"
  | "conflict"
  | "oui"
  | "port-scan"
  | "wireless"
  | "cable"
  | "wifi-qr"
  | "ip-converter"
  | "ip-range"
  | "random-gen"
  | "bandwidth"
  | "ssl-check"
  | "whois"
  | "email-diag"
  | "other"

// a lazy import thunk; each tool becomes its own chunk, loaded on navigation
export type ToolLoader = () => Promise<{ default: ComponentType }>

// the dashboard once claimed "100% offline ready" while 12 tools did network i/o; a test now
// derives these from the source so the metadata cannot drift
export interface ToolRuntime {
  // false when the tool performs network i/o of any kind
  offline: boolean
  // hosts that receive user input, so the ui can say so before a request
  thirdParty?: string[]
  // capabilities that only exist in the desktop build, named honestly
  desktopOnly?: string[]
}

export interface ToolDefinition {
  slug: string // url segment under /tools/, and the only tool id anywhere
  label: string // sidebar label
  title: string // full title for dashboard/about
  description: string
  icon: LucideIcon
  category: ToolCategory
  features: string[]
  popular?: boolean
  // set only when the component actually renders SaveToProject; the registry
  // must not promise persistence the tool doesn't implement
  projectItemType?: ProjectItemType
  keywords: string[] // drives search
  // omitted means fully offline; declare it whenever the tool leaves the device
  runtime?: ToolRuntime
}

// true when the tool never leaves the device
export function isOffline(tool: ToolDefinition): boolean {
  return tool.runtime?.offline !== false
}

export function offlineToolCount(): number {
  return tools.filter(isOffline).length
}

export interface CategoryDefinition {
  id: ToolCategory
  label: string
  icon: LucideIcon
  description: string
}

export const categories: CategoryDefinition[] = [
  {
    id: "calculators",
    label: "Calculators",
    icon: Calculator,
    description: "Network calculation tools",
  },
  {
    id: "ip-tools",
    label: "IP Tools",
    icon: Binary,
    description: "IP address manipulation and conversion",
  },
  {
    id: "network",
    label: "Network Config",
    icon: Server,
    description: "Network configuration generators",
  },
  {
    id: "diagnostics",
    label: "Diagnostics",
    icon: TestTube,
    description: "Network testing and diagnostics",
  },
  {
    id: "generators",
    label: "Generators",
    icon: Wrench,
    description: "Generate configurations and codes",
  },
  {
    id: "reference",
    label: "Reference",
    icon: BookOpen,
    description: "Reference materials and lookups",
  },
  {
    id: "devtools",
    label: "Dev Tools",
    icon: Code,
    description: "Developer and IT utilities",
  },
]

export const tools: ToolDefinition[] = [
  // === CALCULATORS ===
  {
    slug: "subnet-calculator",
    label: "Subnet Calculator",
    title: "Subnet Calculator",
    description:
      "Calculate network addresses, broadcast addresses, and host ranges for IPv4 and IPv6",
    icon: Calculator,
    category: "calculators",
    features: ["IPv4 & IPv6 support", "CIDR notation", "Wildcard masks"],
    popular: true,
    projectItemType: "subnet",
    keywords: ["subnet", "cidr", "network", "ip", "mask", "calculate"],
  },
  {
    slug: "vlsm-planner",
    label: "VLSM Planner",
    title: "VLSM Planner",
    description: "Plan Variable Length Subnet Masking with optimal allocation and minimal waste",
    icon: Network,
    category: "calculators",
    features: ["Optimal allocation", "Fragmentation analysis", "Export plans"],
    popular: true,
    projectItemType: "vlsm",
    keywords: ["vlsm", "subnet", "planning", "allocation", "network design"],
  },
  {
    slug: "mtu-calculator",
    label: "MTU Calculator",
    title: "MTU Calculator",
    description: "Calculate MTU and header overhead for various network stacks",
    icon: Wifi,
    category: "calculators",
    features: ["Protocol stacks", "Overhead calculation", "Fragmentation warnings"],
    keywords: ["mtu", "packet", "fragmentation", "overhead", "header"],
  },
  {
    slug: "bandwidth-calculator",
    label: "Bandwidth Calculator",
    title: "Bandwidth Calculator",
    description: "Calculate transfer times, throughput, and bandwidth requirements",
    icon: Gauge,
    category: "calculators",
    features: ["Transfer time", "Throughput calc", "Unit conversion"],
    popular: true,
    projectItemType: "bandwidth",
    keywords: ["bandwidth", "transfer", "speed", "throughput", "download"],
  },
  {
    slug: "cable-calculator",
    label: "Cable Calculator",
    title: "Cable Calculator",
    description:
      "Calculate signal loss for fiber optic and copper cables with TIA standards compliance",
    icon: Cable,
    category: "calculators",
    features: ["Fiber & copper", "TIA-568 compliant", "Power budget"],
    popular: true,
    projectItemType: "cable",
    keywords: ["cable", "fiber", "copper", "signal loss", "attenuation"],
  },

  // === IP TOOLS ===
  {
    slug: "ip-converter",
    label: "IP Converter",
    title: "IP Address Converter",
    description:
      "Convert IPv4 addresses between binary, decimal, hexadecimal, and dotted-decimal formats",
    icon: ArrowRightLeft,
    category: "ip-tools",
    features: ["Binary/Hex/Decimal", "IPv6 mapped", "All formats"],
    projectItemType: "ip-converter",
    keywords: ["ip", "convert", "binary", "hex", "decimal", "ipv4"],
  },
  {
    slug: "ip-enumerator",
    label: "IP Enumerator",
    title: "IP Range Enumerator",
    description: "List all IP addresses within a CIDR block with network details",
    icon: List,
    category: "ip-tools",
    features: ["CIDR to list", "Export CSV/JSON", "Network details"],
    projectItemType: "ip-range",
    keywords: ["ip", "range", "list", "enumerate", "cidr", "hosts"],
  },
  {
    slug: "ipv6-tools",
    label: "IPv6 Tools",
    title: "IPv6 Tools",
    description: "IPv6 address manipulation, compression, and EUI-64 generation",
    icon: Zap,
    category: "ip-tools",
    features: ["Address compression", "EUI-64 generation", "Solicited-node multicast"],
    keywords: ["ipv6", "eui64", "compression", "address", "multicast"],
  },
  {
    slug: "conflict-checker",
    label: "Conflict Checker",
    title: "IP Conflict Checker",
    description: "Detect IP and MAC conflicts from ARP tables, DHCP leases, and inventories",
    icon: AlertTriangle,
    category: "ip-tools",
    features: ["Multi-source parsing", "Conflict detection", "Remediation tips"],
    // does i/o, but nothing third-party receives your input: the browser path is
    // paste-only and the arp read is a local system call behind isElectron()
    runtime: {
      offline: false,
      desktopOnly: ["reading the local ARP cache"],
    },
    keywords: ["ip", "mac", "conflict", "duplicate", "arp", "dhcp"],
  },

  // === NETWORK CONFIG ===
  {
    slug: "vlan-manager",
    label: "VLAN Manager",
    title: "VLAN Manager",
    description: "Design and manage VLANs with switch configuration templates",
    icon: Layers,
    category: "network",
    features: ["Switch templates", "Trunk planning", "Cisco & Aruba"],
    projectItemType: "vlan",
    keywords: ["vlan", "switch", "trunk", "tagging", "802.1q"],
  },
  {
    slug: "routing-tools",
    label: "Routing Tools",
    title: "Routing Tools",
    description: "Configure OSPF, EIGRP, static routes, and administrative distances",
    icon: Route,
    category: "network",
    features: ["OSPF & EIGRP", "Static routes", "Admin distances"],
    popular: true,
    projectItemType: "routing",
    keywords: ["routing", "ospf", "eigrp", "static", "route", "gateway"],
  },
  {
    slug: "acl-generator",
    label: "ACL Generator",
    title: "ACL Generator",
    description: "Generate standard and extended access control lists with validation",
    icon: Shield,
    category: "network",
    features: ["Standard & Extended", "Multi-vendor", "Rule validation"],
    projectItemType: "acl",
    keywords: ["acl", "firewall", "access list", "security", "rules"],
  },
  {
    slug: "wireless-tools",
    label: "Wireless Tools",
    title: "Wireless Tools",
    description: "Channel planning, interference analysis, and WiFi configuration",
    icon: Radio,
    category: "network",
    features: ["Channel planning", "Interference analysis", "WiFi config"],
    popular: true,
    keywords: ["wifi", "wireless", "channel", "interference", "2.4ghz", "5ghz"],
  },

  // === DIAGNOSTICS ===
  {
    slug: "network-tester",
    label: "Network Tester",
    title: "Network Tester",
    description: "Test RTT, throughput, and connectivity to user-defined endpoints",
    icon: Activity,
    category: "diagnostics",
    features: ["RTT measurement", "Throughput tests", "CORS-constrained"],
    popular: true,
    runtime: {
      offline: false,
      thirdParty: [
        "the URL you enter",
        "cloudflare-dns.com",
        "dns.google",
        "dns.quad9.net",
        "doh.opendns.com",
        "dns.adguard-dns.com",
      ],
      // the dns panel is always doh over fetch; the only preload call in this
      // tool is ping, so icmp is the sole desktop-only capability
      desktopOnly: ["real ICMP ping"],
    },
    keywords: ["test", "connectivity", "rtt", "latency", "throughput"],
  },
  {
    slug: "dns-tools",
    label: "DNS Tools",
    title: "DNS Tools",
    description: "DNS over HTTPS client with multiple provider support and caching",
    icon: Globe,
    category: "diagnostics",
    features: ["DoH support", "Multiple providers", "DNSSEC validation"],
    runtime: {
      offline: false,
      thirdParty: [
        "cloudflare-dns.com",
        "dns.google",
        "dns.quad9.net",
        "doh.opendns.com",
        "dns.adguard-dns.com",
      ],
      desktopOnly: ["direct DNS queries"],
    },
    keywords: ["dns", "lookup", "doh", "resolver", "records"],
  },
  {
    slug: "ping-traceroute",
    label: "Ping & Traceroute",
    title: "Ping & Traceroute",
    description: "Test network connectivity and trace packet paths to destinations",
    icon: Navigation,
    category: "diagnostics",
    features: ["Connectivity tests", "Path tracing", "Latency measurement"],
    popular: true,
    runtime: {
      offline: false,
      thirdParty: ["the host you enter"],
      desktopOnly: ["real ICMP ping", "system traceroute", "local network interface enumeration"],
    },
    keywords: ["ping", "traceroute", "tracert", "icmp", "path"],
  },
  {
    slug: "port-scanner",
    label: "Port Scanner",
    title: "Port Scanner",
    description: "Scan network hosts for open ports and running services",
    icon: Scan,
    category: "diagnostics",
    features: ["Common ports", "Custom ranges", "Port name lookup"],
    runtime: {
      offline: false,
      thirdParty: ["the host you enter"],
      desktopOnly: ["real TCP connect scanning"],
    },
    keywords: ["port", "scan", "service", "open", "tcp"],
  },
  {
    slug: "ssl-checker",
    label: "SSL/TLS Checker",
    title: "SSL/TLS Checker",
    description: "Analyze SSL certificates, expiry dates, and TLS configuration",
    icon: Lock,
    category: "diagnostics",
    features: ["Certificate info", "Expiry check", "Chain validation"],
    runtime: {
      offline: false,
      thirdParty: ["the hostname you enter", "api.certspotter.com"],
    },
    keywords: ["ssl", "tls", "certificate", "https", "security"],
  },
  {
    slug: "whois-lookup",
    label: "WHOIS Lookup",
    title: "WHOIS Lookup",
    description: "Look up domain registration and IP block ownership information",
    icon: Search,
    category: "diagnostics",
    features: ["Domain info", "IP ownership", "Registrar data"],
    runtime: {
      offline: false,
      thirdParty: ["rdap.org", "the registry or RIR RDAP server rdap.org redirects to"],
    },
    keywords: ["whois", "domain", "registration", "ownership", "registrar"],
  },
  {
    slug: "email-diagnostics",
    label: "Email Diagnostics",
    title: "Email Diagnostics",
    description: "Check MX records, SPF, DKIM, and DMARC configurations",
    icon: Mail,
    category: "diagnostics",
    features: ["MX records", "SPF/DKIM/DMARC", "Deliverability"],
    runtime: {
      offline: false,
      thirdParty: ["cloudflare-dns.com", "dns.google"],
    },
    keywords: ["email", "mx", "spf", "dkim", "dmarc", "smtp"],
  },

  // === GENERATORS ===
  {
    slug: "random-generator",
    label: "Random Generator",
    title: "Random Generator",
    description: "Generate random IP addresses, MAC addresses, and network values",
    icon: Shuffle,
    category: "generators",
    features: ["Random IPs", "Random MACs", "Bulk generation"],
    projectItemType: "random-gen",
    keywords: ["random", "generate", "ip", "mac", "uuid"],
  },
  {
    slug: "wifi-qr",
    label: "WiFi QR Generator",
    title: "WiFi QR Generator",
    description: "Generate QR codes for instant WiFi connection on smartphones",
    icon: QrCode,
    category: "generators",
    features: ["WPA2/WPA3/WEP", "PNG/SVG export", "Project saving"],
    popular: true,
    projectItemType: "wifi-qr",
    keywords: ["wifi", "qr", "code", "wireless", "connect"],
  },

  // === REFERENCE ===
  {
    slug: "reference-hub",
    label: "Reference Hub",
    title: "Reference Hub",
    description: "Comprehensive networking reference including ports, protocols, and standards",
    icon: BookOpen,
    category: "reference",
    features: ["Port numbers", "Protocols", "Quick reference"],
    keywords: ["reference", "ports", "protocols", "standards", "cheatsheet"],
  },
  {
    slug: "oui-lookup",
    label: "OUI Lookup",
    title: "OUI Lookup",
    description: "Look up MAC address vendor information using IEEE OUI database",
    icon: Search,
    category: "reference",
    features: ["IEEE OUI database", "Vendor identification", "MAC analysis"],
    runtime: {
      offline: false,
      thirdParty: ["api.maclookup.app"],
    },
    keywords: ["oui", "mac", "vendor", "manufacturer", "ieee"],
  },

  // === DIAGNOSTICS (continued) ===
  {
    slug: "http-headers",
    label: "HTTP Headers",
    title: "HTTP Headers Analyzer",
    description: "Analyze HTTP response headers and security configuration",
    icon: FileText,
    category: "diagnostics",
    features: ["Header analysis", "Security score", "Category sorting"],
    runtime: {
      offline: false,
      thirdParty: ["api.hackertarget.com"],
    },
    keywords: ["http", "headers", "response", "security", "web"],
  },
  {
    slug: "security-headers",
    label: "Security Headers",
    title: "Security Headers Checker",
    description: "Analyze HTTP security headers and get recommendations",
    icon: Shield,
    category: "diagnostics",
    features: ["HSTS check", "CSP analysis", "Security grade"],
    popular: true,
    runtime: {
      offline: false,
      thirdParty: ["api.hackertarget.com", "observatory-api.mdn.mozilla.net"],
    },
    keywords: ["security", "headers", "hsts", "csp", "xss"],
  },
  {
    slug: "redirect-checker",
    label: "Redirect Checker",
    title: "Redirect Checker",
    description: "Trace HTTP redirect chains and analyze URL redirections",
    icon: Globe,
    category: "diagnostics",
    features: ["Redirect chain", "HTTPS upgrade", "Loop detection"],
    runtime: {
      offline: false,
      thirdParty: ["api.hackertarget.com"],
    },
    keywords: ["redirect", "301", "302", "url", "chain"],
  },
  {
    slug: "user-agent-parser",
    label: "User Agent Parser",
    title: "User Agent Parser",
    description: "Parse and analyze browser user agent strings",
    icon: Monitor,
    category: "diagnostics",
    features: ["Browser detection", "OS detection", "Device type"],
    keywords: ["user agent", "browser", "device", "mobile", "desktop"],
  },

  // === DEV TOOLS ===
  {
    slug: "hash-generator",
    label: "Hash Generator",
    title: "Hash Generator",
    description: "Generate and verify cryptographic hashes (SHA-256, SHA-384, SHA-512, SHA-1)",
    icon: Hash,
    category: "devtools",
    features: ["Multiple algorithms", "File hashing", "Hash verification"],
    popular: true,
    keywords: ["hash", "sha256", "sha512", "sha1", "sha384", "checksum", "digest"],
  },
  {
    slug: "password-generator",
    label: "Password Generator",
    title: "Password Generator",
    description: "Generate cryptographically secure random passwords",
    icon: Key,
    category: "devtools",
    features: ["Customizable", "Strength meter", "Secure random"],
    popular: true,
    keywords: ["password", "generator", "secure", "random", "strong"],
  },
  {
    slug: "base64-encoder",
    label: "Base64 Encoder",
    title: "Base64 Encoder/Decoder",
    description: "Encode and decode Base64 text and files, in both RFC 4648 alphabets",
    icon: FileCode,
    category: "devtools",
    features: ["Text encoding", "File encoding", "URL-safe (RFC 4648 §5)"],
    keywords: ["base64", "encode", "decode", "binary", "text", "url-safe", "base64url", "rfc4648"],
  },
  {
    slug: "url-encoder",
    label: "URL Encoder",
    title: "URL Encoder/Decoder",
    description: "Encode, decode, and build URLs with query parameters",
    icon: Link2,
    category: "devtools",
    features: ["URL encoding", "Query builder", "Percent encoding"],
    keywords: ["url", "encode", "decode", "query", "percent"],
  },
  {
    slug: "json-formatter",
    label: "JSON Formatter",
    title: "JSON Formatter",
    description: "Format, validate, and minify JSON data",
    icon: Braces,
    category: "devtools",
    features: ["Pretty print", "Validation", "Minify"],
    popular: true,
    keywords: ["json", "format", "validate", "minify", "pretty"],
  },
  {
    slug: "jwt-decoder",
    label: "JWT Decoder",
    title: "JWT Decoder",
    description: "Decode and inspect JSON Web Tokens",
    icon: Key,
    category: "devtools",
    features: ["Decode payload", "Expiry check", "Claim inspection"],
    keywords: ["jwt", "token", "decode", "auth", "bearer"],
  },
  {
    slug: "timestamp-converter",
    label: "Timestamp Converter",
    title: "Unix Timestamp Converter",
    description: "Convert between Unix timestamps and human-readable dates",
    icon: Clock,
    category: "devtools",
    features: ["Unix to date", "Date to Unix", "Timezone support"],
    keywords: ["timestamp", "unix", "epoch", "date", "time"],
  },
  {
    slug: "cron-parser",
    label: "Cron Parser",
    title: "Cron Expression Parser",
    description: "Parse and understand cron expressions",
    icon: Timer,
    category: "devtools",
    features: ["Cron syntax", "Next runs", "Human readable"],
    keywords: ["cron", "schedule", "job", "timer", "expression"],
  },
  {
    slug: "regex-tester",
    label: "Regex Tester",
    title: "Regex Tester",
    description: "Test and debug regular expressions with live highlighting",
    icon: FileSearch,
    category: "devtools",
    features: ["Live matching", "Capture groups", "Common patterns"],
    popular: true,
    keywords: ["regex", "regexp", "pattern", "match", "search"],
  },
  {
    slug: "color-converter",
    label: "Color Converter",
    title: "Color Converter",
    description: "Convert colors between HEX, RGB, HSL, and CMYK formats",
    icon: Palette,
    category: "devtools",
    features: ["HEX/RGB/HSL", "Color picker", "CMYK support"],
    keywords: ["color", "hex", "rgb", "hsl", "convert"],
  },
  {
    slug: "lorem-generator",
    label: "Lorem Generator",
    title: "Lorem Ipsum Generator",
    description: "Generate placeholder text for designs and mockups",
    icon: FileText,
    category: "devtools",
    features: ["Paragraphs", "Sentences", "Word count"],
    keywords: ["lorem", "ipsum", "placeholder", "text", "dummy"],
  },

  // === NETWORK CALCULATORS (New) ===
  {
    slug: "data-unit-converter",
    label: "Data Unit Converter",
    title: "Data Unit Converter",
    description: "Convert between bits, bytes, and all data size units (SI and IEC)",
    icon: HardDrive,
    category: "calculators",
    features: ["Bits/Bytes", "SI units", "IEC binary units"],
    keywords: ["data", "unit", "convert", "bytes", "bits", "mb", "gb", "kb"],
  },
  {
    slug: "uptime-calculator",
    label: "Uptime Calculator",
    title: "Uptime/SLA Calculator",
    description: "Calculate allowed downtime based on SLA uptime percentage",
    icon: Clock,
    category: "calculators",
    features: ["Nines calculation", "Downtime per period", "SLA reference"],
    keywords: ["uptime", "sla", "availability", "downtime", "nines"],
  },
  {
    slug: "network-calculator",
    label: "Network Calculator",
    title: "Network Calculator",
    description: "Calculate latency, throughput (BDP), and perform IP math operations",
    icon: Calculator,
    category: "calculators",
    features: ["Latency calc", "BDP throughput", "IP math"],
    keywords: ["latency", "throughput", "bdp", "rtt", "window", "ip math"],
  },

  // === IP TOOLS (New) ===
  {
    slug: "mac-formatter",
    label: "MAC Formatter",
    title: "MAC Address Formatter",
    description: "Convert MAC addresses between formats and analyze properties",
    icon: Cpu,
    category: "ip-tools",
    features: ["All MAC formats", "EUI-64", "Address properties"],
    keywords: ["mac", "address", "format", "eui64", "cisco", "ieee"],
  },
  {
    slug: "subnet-mask-converter",
    label: "Subnet Mask Converter",
    title: "Subnet Mask Converter",
    description: "Convert between CIDR notation, dotted decimal, and wildcard masks",
    icon: Binary,
    category: "ip-tools",
    features: ["CIDR to mask", "Wildcard calc", "Quick reference"],
    keywords: ["subnet", "mask", "cidr", "wildcard", "convert"],
  },

  // === REFERENCE (New) ===
  {
    slug: "port-reference",
    label: "Port Reference",
    title: "Port Reference",
    description: "Quick reference for common network ports and services",
    icon: Server,
    category: "reference",
    features: ["Common ports", "Service lookup", "Categorized"],
    keywords: ["port", "reference", "service", "tcp", "udp"],
  },
  {
    slug: "cidr-reference",
    label: "CIDR Reference",
    title: "CIDR Reference",
    description: "Complete CIDR notation cheat sheet with subnet masks and host counts",
    icon: Network,
    category: "reference",
    features: ["All CIDRs", "Private ranges", "Mask table"],
    keywords: ["cidr", "reference", "subnet", "mask", "cheatsheet"],
  },
  {
    slug: "protocol-reference",
    label: "Protocol Reference",
    title: "Protocol Reference",
    description: "IP protocol numbers and ICMP types reference",
    icon: FileText,
    category: "reference",
    features: ["IP protocols", "ICMP types", "Error codes"],
    keywords: ["protocol", "icmp", "tcp", "udp", "reference"],
  },
  {
    slug: "ipv6-reference",
    label: "IPv6 Reference",
    title: "IPv6 Reference",
    description: "IPv6 address types, prefixes, and format reference",
    icon: Globe2,
    category: "reference",
    features: ["Address types", "Special addresses", "Format rules"],
    keywords: ["ipv6", "reference", "address", "prefix", "multicast"],
  },
]

// standalone nav items, not tools. everything renders from this registry; there is no other list.

export function getToolBySlug(slug: string): ToolDefinition | undefined {
  return tools.find((t) => t.slug === slug)
}

export function getToolsByCategory(category: ToolCategory): ToolDefinition[] {
  return tools.filter((t) => t.category === category)
}

export function getPopularTools(): ToolDefinition[] {
  return tools.filter((t) => t.popular)
}

export function categoryLabelOf(tool: ToolDefinition): string {
  return categories.find((c) => c.id === tool.category)?.label ?? tool.category
}

// ranked, not just filtered: results used to come back in registry declaration
// order, so searching "subnet" did not put Subnet Calculator first.
function matchScore(tool: ToolDefinition, q: string): number {
  const label = tool.label.toLowerCase()
  const title = tool.title.toLowerCase()

  if (tool.slug === q) return 100
  if (label === q || title === q) return 90
  if (tool.slug.startsWith(q)) return 80
  if (label.startsWith(q) || title.startsWith(q)) return 70
  if (label.includes(q) || title.includes(q)) return 60
  if (tool.keywords.some((k) => k === q)) return 50
  if (tool.keywords.some((k) => k.startsWith(q))) return 40
  if (tool.keywords.some((k) => k.includes(q))) return 30
  if (tool.description.toLowerCase().includes(q)) return 20
  return 0
}

export function searchTools(query: string): ToolDefinition[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return tools
    .map((tool) => ({ tool, score: matchScore(tool, q) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.tool.label.localeCompare(b.tool.label))
    .map((r) => r.tool)
}
