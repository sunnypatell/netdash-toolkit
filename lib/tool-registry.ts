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
  Home,
  FolderOpen,
  Info,
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
} from "lucide-react"

// Tool category definitions
export type ToolCategory =
  | "calculators"
  | "ip-tools"
  | "network"
  | "diagnostics"
  | "generators"
  | "reference"
  | "devtools"

// Project item types for saving to projects
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

// Complete tool definition
export interface ToolDefinition {
  id: string
  label: string
  title: string // Full title for dashboard/about
  description: string
  icon: LucideIcon
  category: ToolCategory
  categoryLabel: string // Human readable category
  features: string[]
  popular?: boolean
  projectItemType?: ProjectItemType
  componentName: string // For dynamic imports
  keywords: string[] // For search
}

// Category metadata
export interface CategoryDefinition {
  id: ToolCategory
  label: string
  icon: LucideIcon
  description: string
}

// All categories
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

// All tools - single source of truth
export const tools: ToolDefinition[] = [
  // === CALCULATORS ===
  {
    id: "subnet-calculator",
    label: "Subnet Calculator",
    title: "Subnet Calculator",
    description:
      "Calculate network addresses, broadcast addresses, and host ranges for IPv4 and IPv6",
    icon: Calculator,
    category: "calculators",
    categoryLabel: "Core Tools",
    features: ["IPv4 & IPv6 support", "CIDR notation", "Wildcard masks"],
    popular: true,
    projectItemType: "subnet",
    componentName: "SubnetCalculator",
    keywords: ["subnet", "cidr", "network", "ip", "mask", "calculate"],
  },
  {
    id: "vlsm-planner",
    label: "VLSM Planner",
    title: "VLSM Planner",
    description: "Plan Variable Length Subnet Masking with optimal allocation and minimal waste",
    icon: Network,
    category: "calculators",
    categoryLabel: "Planning",
    features: ["Optimal allocation", "Fragmentation analysis", "Export plans"],
    popular: true,
    projectItemType: "vlsm",
    componentName: "VLSMPlanner",
    keywords: ["vlsm", "subnet", "planning", "allocation", "network design"],
  },
  {
    id: "mtu-calculator",
    label: "MTU Calculator",
    title: "MTU Calculator",
    description: "Calculate MTU and header overhead for various network stacks",
    icon: Wifi,
    category: "calculators",
    categoryLabel: "Analysis",
    features: ["Protocol stacks", "Overhead calculation", "Fragmentation warnings"],
    projectItemType: "mtu",
    componentName: "MTUCalculator",
    keywords: ["mtu", "packet", "fragmentation", "overhead", "header"],
  },
  {
    id: "bandwidth-calculator",
    label: "Bandwidth Calculator",
    title: "Bandwidth Calculator",
    description: "Calculate transfer times, throughput, and bandwidth requirements",
    icon: Gauge,
    category: "calculators",
    categoryLabel: "Analysis",
    features: ["Transfer time", "Throughput calc", "Unit conversion"],
    popular: true,
    projectItemType: "bandwidth",
    componentName: "BandwidthCalculator",
    keywords: ["bandwidth", "transfer", "speed", "throughput", "download"],
  },
  {
    id: "cable-calculator",
    label: "Cable Calculator",
    title: "Cable Calculator",
    description:
      "Calculate signal loss for fiber optic and copper cables with TIA standards compliance",
    icon: Cable,
    category: "calculators",
    categoryLabel: "Analysis",
    features: ["Fiber & copper", "TIA-568 compliant", "Power budget"],
    popular: true,
    projectItemType: "cable",
    componentName: "CableCalculator",
    keywords: ["cable", "fiber", "copper", "signal loss", "attenuation"],
  },

  // === IP TOOLS ===
  {
    id: "ip-converter",
    label: "IP Converter",
    title: "IP Address Converter",
    description:
      "Convert IPv4 addresses between binary, decimal, hexadecimal, and dotted-decimal formats",
    icon: ArrowRightLeft,
    category: "ip-tools",
    categoryLabel: "Converters",
    features: ["Binary/Hex/Decimal", "IPv6 mapped", "All formats"],
    projectItemType: "ip-converter",
    componentName: "IPConverter",
    keywords: ["ip", "convert", "binary", "hex", "decimal", "ipv4"],
  },
  {
    id: "ip-enumerator",
    label: "IP Enumerator",
    title: "IP Range Enumerator",
    description: "List all IP addresses within a CIDR block with network details",
    icon: List,
    category: "ip-tools",
    categoryLabel: "Converters",
    features: ["CIDR to list", "Export CSV/JSON", "Network details"],
    projectItemType: "ip-range",
    componentName: "IPEnumerator",
    keywords: ["ip", "range", "list", "enumerate", "cidr", "hosts"],
  },
  {
    id: "ipv6-tools",
    label: "IPv6 Tools",
    title: "IPv6 Tools",
    description: "IPv6 address manipulation, compression, and EUI-64 generation",
    icon: Zap,
    category: "ip-tools",
    categoryLabel: "IPv6",
    features: ["Address compression", "EUI-64 generation", "Solicited-node multicast"],
    projectItemType: "ipv6",
    componentName: "IPv6Tools",
    keywords: ["ipv6", "eui64", "compression", "address", "multicast"],
  },
  {
    id: "conflict-checker",
    label: "Conflict Checker",
    title: "IP Conflict Checker",
    description: "Detect IP and MAC conflicts from ARP tables, DHCP leases, and inventories",
    icon: AlertTriangle,
    category: "ip-tools",
    categoryLabel: "Troubleshooting",
    features: ["Multi-source parsing", "Conflict detection", "Remediation tips"],
    projectItemType: "conflict",
    componentName: "ConflictChecker",
    keywords: ["ip", "mac", "conflict", "duplicate", "arp", "dhcp"],
  },

  // === NETWORK CONFIG ===
  {
    id: "vlan-manager",
    label: "VLAN Manager",
    title: "VLAN Manager",
    description: "Design and manage VLANs with switch configuration templates",
    icon: Layers,
    category: "network",
    categoryLabel: "Configuration",
    features: ["Switch templates", "Trunk planning", "Cisco & Aruba"],
    projectItemType: "vlan",
    componentName: "VLANManager",
    keywords: ["vlan", "switch", "trunk", "tagging", "802.1q"],
  },
  {
    id: "routing-tools",
    label: "Routing Tools",
    title: "Routing Tools",
    description: "Configure OSPF, EIGRP, static routes, and administrative distances",
    icon: Route,
    category: "network",
    categoryLabel: "Configuration",
    features: ["OSPF & EIGRP", "Static routes", "Admin distances"],
    popular: true,
    projectItemType: "routing",
    componentName: "RoutingTools",
    keywords: ["routing", "ospf", "eigrp", "static", "route", "gateway"],
  },
  {
    id: "acl-generator",
    label: "ACL Generator",
    title: "ACL Generator",
    description: "Generate standard and extended access control lists with validation",
    icon: Shield,
    category: "network",
    categoryLabel: "Security",
    features: ["Standard & Extended", "Multi-vendor", "Rule validation"],
    projectItemType: "acl",
    componentName: "ACLGenerator",
    keywords: ["acl", "firewall", "access list", "security", "rules"],
  },
  {
    id: "wireless-tools",
    label: "Wireless Tools",
    title: "Wireless Tools",
    description: "Channel planning, interference analysis, and WiFi configuration",
    icon: Radio,
    category: "network",
    categoryLabel: "Wireless",
    features: ["Channel planning", "Interference analysis", "WiFi config"],
    popular: true,
    projectItemType: "wireless",
    componentName: "WirelessTools",
    keywords: ["wifi", "wireless", "channel", "interference", "2.4ghz", "5ghz"],
  },

  // === DIAGNOSTICS ===
  {
    id: "network-tester",
    label: "Network Tester",
    title: "Network Tester",
    description: "Test RTT, throughput, and connectivity to user-defined endpoints",
    icon: Activity,
    category: "diagnostics",
    categoryLabel: "Testing",
    features: ["RTT measurement", "Throughput tests", "CORS-enabled"],
    popular: true,
    projectItemType: "other",
    componentName: "NetworkTester",
    keywords: ["test", "connectivity", "rtt", "latency", "throughput"],
  },
  {
    id: "dns-tools",
    label: "DNS Tools",
    title: "DNS Tools",
    description: "DNS over HTTPS client with multiple provider support and caching",
    icon: Globe,
    category: "diagnostics",
    categoryLabel: "Network Services",
    features: ["DoH support", "Multiple providers", "DNSSEC validation"],
    projectItemType: "dns",
    componentName: "DNSTools",
    keywords: ["dns", "lookup", "doh", "resolver", "records"],
  },
  {
    id: "ping-traceroute",
    label: "Ping & Traceroute",
    title: "Ping & Traceroute",
    description: "Test network connectivity and trace packet paths to destinations",
    icon: Navigation,
    category: "diagnostics",
    categoryLabel: "Testing",
    features: ["Connectivity tests", "Path tracing", "Latency measurement"],
    popular: true,
    projectItemType: "other",
    componentName: "PingTraceroute",
    keywords: ["ping", "traceroute", "tracert", "icmp", "path"],
  },
  {
    id: "port-scanner",
    label: "Port Scanner",
    title: "Port Scanner",
    description: "Scan network hosts for open ports and running services",
    icon: Scan,
    category: "diagnostics",
    categoryLabel: "Security",
    features: ["Common ports", "Custom ranges", "Service detection"],
    projectItemType: "port-scan",
    componentName: "PortScanner",
    keywords: ["port", "scan", "service", "open", "tcp"],
  },
  {
    id: "ssl-checker",
    label: "SSL/TLS Checker",
    title: "SSL/TLS Checker",
    description: "Analyze SSL certificates, expiry dates, and TLS configuration",
    icon: Lock,
    category: "diagnostics",
    categoryLabel: "Security",
    features: ["Certificate info", "Expiry check", "Chain validation"],
    projectItemType: "ssl-check",
    componentName: "SSLChecker",
    keywords: ["ssl", "tls", "certificate", "https", "security"],
  },
  {
    id: "whois-lookup",
    label: "WHOIS Lookup",
    title: "WHOIS Lookup",
    description: "Look up domain registration and IP block ownership information",
    icon: Search,
    category: "diagnostics",
    categoryLabel: "Lookup",
    features: ["Domain info", "IP ownership", "Registrar data"],
    projectItemType: "whois",
    componentName: "WhoisLookup",
    keywords: ["whois", "domain", "registration", "ownership", "registrar"],
  },
  {
    id: "email-diagnostics",
    label: "Email Diagnostics",
    title: "Email Diagnostics",
    description: "Check MX records, SPF, DKIM, and DMARC configurations",
    icon: Mail,
    category: "diagnostics",
    categoryLabel: "Email",
    features: ["MX records", "SPF/DKIM/DMARC", "Deliverability"],
    projectItemType: "email-diag",
    componentName: "EmailDiagnostics",
    keywords: ["email", "mx", "spf", "dkim", "dmarc", "smtp"],
  },

  // === GENERATORS ===
  {
    id: "random-generator",
    label: "Random Generator",
    title: "Random Generator",
    description: "Generate random IP addresses, MAC addresses, and network values",
    icon: Shuffle,
    category: "generators",
    categoryLabel: "Utilities",
    features: ["Random IPs", "Random MACs", "Bulk generation"],
    projectItemType: "random-gen",
    componentName: "RandomGenerator",
    keywords: ["random", "generate", "ip", "mac", "uuid"],
  },
  {
    id: "wifi-qr",
    label: "WiFi QR Generator",
    title: "WiFi QR Generator",
    description: "Generate QR codes for instant WiFi connection on smartphones",
    icon: QrCode,
    category: "generators",
    categoryLabel: "Utilities",
    features: ["WPA2/WPA3/WEP", "PNG/SVG export", "Project saving"],
    popular: true,
    projectItemType: "wifi-qr",
    componentName: "WifiQRGenerator",
    keywords: ["wifi", "qr", "code", "wireless", "connect"],
  },

  // === REFERENCE ===
  {
    id: "reference-hub",
    label: "Reference Hub",
    title: "Reference Hub",
    description: "Comprehensive networking reference including ports, protocols, and standards",
    icon: BookOpen,
    category: "reference",
    categoryLabel: "Reference",
    features: ["Port numbers", "Protocols", "Quick reference"],
    componentName: "ReferenceHub",
    keywords: ["reference", "ports", "protocols", "standards", "cheatsheet"],
  },
  {
    id: "oui-lookup",
    label: "OUI Lookup",
    title: "OUI Lookup",
    description: "Look up MAC address vendor information using IEEE OUI database",
    icon: Search,
    category: "reference",
    categoryLabel: "Lookup",
    features: ["IEEE OUI database", "Vendor identification", "MAC analysis"],
    projectItemType: "oui",
    componentName: "OUILookup",
    keywords: ["oui", "mac", "vendor", "manufacturer", "ieee"],
  },

  // === DIAGNOSTICS (continued) ===
  {
    id: "http-headers",
    label: "HTTP Headers",
    title: "HTTP Headers Analyzer",
    description: "Analyze HTTP response headers and security configuration",
    icon: FileText,
    category: "diagnostics",
    categoryLabel: "Web Analysis",
    features: ["Header analysis", "Security score", "Category sorting"],
    componentName: "HTTPHeaders",
    keywords: ["http", "headers", "response", "security", "web"],
  },
  {
    id: "security-headers",
    label: "Security Headers",
    title: "Security Headers Checker",
    description: "Analyze HTTP security headers and get recommendations",
    icon: Shield,
    category: "diagnostics",
    categoryLabel: "Security",
    features: ["HSTS check", "CSP analysis", "Security grade"],
    popular: true,
    componentName: "SecurityHeaders",
    keywords: ["security", "headers", "hsts", "csp", "xss"],
  },
  {
    id: "redirect-checker",
    label: "Redirect Checker",
    title: "Redirect Checker",
    description: "Trace HTTP redirect chains and analyze URL redirections",
    icon: Globe,
    category: "diagnostics",
    categoryLabel: "Web Analysis",
    features: ["Redirect chain", "HTTPS upgrade", "Loop detection"],
    componentName: "RedirectChecker",
    keywords: ["redirect", "301", "302", "url", "chain"],
  },
  {
    id: "user-agent-parser",
    label: "User Agent Parser",
    title: "User Agent Parser",
    description: "Parse and analyze browser user agent strings",
    icon: Monitor,
    category: "diagnostics",
    categoryLabel: "Web Analysis",
    features: ["Browser detection", "OS detection", "Device type"],
    componentName: "UserAgentParser",
    keywords: ["user agent", "browser", "device", "mobile", "desktop"],
  },

  // === DEV TOOLS ===
  {
    id: "hash-generator",
    label: "Hash Generator",
    title: "Hash Generator",
    description: "Generate and verify cryptographic hashes (SHA-256, SHA-384, SHA-512, SHA-1)",
    icon: Hash,
    category: "devtools",
    categoryLabel: "Security",
    features: ["Multiple algorithms", "File hashing", "Hash verification"],
    popular: true,
    componentName: "HashGenerator",
    keywords: ["hash", "sha256", "sha512", "md5", "checksum"],
  },
  {
    id: "password-generator",
    label: "Password Generator",
    title: "Password Generator",
    description: "Generate cryptographically secure random passwords",
    icon: Key,
    category: "devtools",
    categoryLabel: "Security",
    features: ["Customizable", "Strength meter", "Secure random"],
    popular: true,
    componentName: "PasswordGenerator",
    keywords: ["password", "generator", "secure", "random", "strong"],
  },
  {
    id: "base64-encoder",
    label: "Base64 Encoder",
    title: "Base64 Encoder/Decoder",
    description: "Encode and decode Base64 strings and files",
    icon: FileCode,
    category: "devtools",
    categoryLabel: "Encoding",
    features: ["Text encoding", "File encoding", "URL-safe"],
    componentName: "Base64Encoder",
    keywords: ["base64", "encode", "decode", "binary", "text"],
  },
  {
    id: "url-encoder",
    label: "URL Encoder",
    title: "URL Encoder/Decoder",
    description: "Encode, decode, and build URLs with query parameters",
    icon: Link2,
    category: "devtools",
    categoryLabel: "Encoding",
    features: ["URL encoding", "Query builder", "Percent encoding"],
    componentName: "URLEncoder",
    keywords: ["url", "encode", "decode", "query", "percent"],
  },
  {
    id: "json-formatter",
    label: "JSON Formatter",
    title: "JSON Formatter",
    description: "Format, validate, and minify JSON data",
    icon: Braces,
    category: "devtools",
    categoryLabel: "Data",
    features: ["Pretty print", "Validation", "Minify"],
    popular: true,
    componentName: "JSONFormatter",
    keywords: ["json", "format", "validate", "minify", "pretty"],
  },
  {
    id: "jwt-decoder",
    label: "JWT Decoder",
    title: "JWT Decoder",
    description: "Decode and inspect JSON Web Tokens",
    icon: Key,
    category: "devtools",
    categoryLabel: "Security",
    features: ["Decode payload", "Expiry check", "Claim inspection"],
    componentName: "JWTDecoder",
    keywords: ["jwt", "token", "decode", "auth", "bearer"],
  },
  {
    id: "timestamp-converter",
    label: "Timestamp Converter",
    title: "Unix Timestamp Converter",
    description: "Convert between Unix timestamps and human-readable dates",
    icon: Clock,
    category: "devtools",
    categoryLabel: "Time",
    features: ["Unix to date", "Date to Unix", "Timezone support"],
    componentName: "TimestampConverter",
    keywords: ["timestamp", "unix", "epoch", "date", "time"],
  },
  {
    id: "cron-parser",
    label: "Cron Parser",
    title: "Cron Expression Parser",
    description: "Parse and understand cron expressions",
    icon: Timer,
    category: "devtools",
    categoryLabel: "Time",
    features: ["Cron syntax", "Next runs", "Human readable"],
    componentName: "CronParser",
    keywords: ["cron", "schedule", "job", "timer", "expression"],
  },
  {
    id: "regex-tester",
    label: "Regex Tester",
    title: "Regex Tester",
    description: "Test and debug regular expressions with live highlighting",
    icon: FileSearch,
    category: "devtools",
    categoryLabel: "Text",
    features: ["Live matching", "Capture groups", "Common patterns"],
    popular: true,
    componentName: "RegexTester",
    keywords: ["regex", "regexp", "pattern", "match", "search"],
  },
  {
    id: "color-converter",
    label: "Color Converter",
    title: "Color Converter",
    description: "Convert colors between HEX, RGB, HSL, and CMYK formats",
    icon: Palette,
    category: "devtools",
    categoryLabel: "Design",
    features: ["HEX/RGB/HSL", "Color picker", "CMYK support"],
    componentName: "ColorConverter",
    keywords: ["color", "hex", "rgb", "hsl", "convert"],
  },
  {
    id: "lorem-generator",
    label: "Lorem Generator",
    title: "Lorem Ipsum Generator",
    description: "Generate placeholder text for designs and mockups",
    icon: FileText,
    category: "devtools",
    categoryLabel: "Text",
    features: ["Paragraphs", "Sentences", "Word count"],
    componentName: "LoremGenerator",
    keywords: ["lorem", "ipsum", "placeholder", "text", "dummy"],
  },
]

// Standalone navigation items (not tools)
export const standaloneItems = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "project-manager", label: "Projects", icon: FolderOpen },
  { id: "about", label: "About", icon: Info },
]

// === HELPER FUNCTIONS ===

/**
 * Get all tools
 */
export function getAllTools(): ToolDefinition[] {
  return tools
}

/**
 * Get tool by ID
 */
export function getToolById(id: string): ToolDefinition | undefined {
  return tools.find((t) => t.id === id)
}

/**
 * Get tools by category
 */
export function getToolsByCategory(category: ToolCategory): ToolDefinition[] {
  return tools.filter((t) => t.category === category)
}

/**
 * Get popular tools
 */
export function getPopularTools(): ToolDefinition[] {
  return tools.filter((t) => t.popular)
}

/**
 * Get all categories with their tools
 */
export function getCategoriesWithTools(): Array<CategoryDefinition & { tools: ToolDefinition[] }> {
  return categories.map((cat) => ({
    ...cat,
    tools: getToolsByCategory(cat.id),
  }))
}

/**
 * Search tools by keyword
 */
export function searchTools(query: string): ToolDefinition[] {
  const q = query.toLowerCase()
  return tools.filter(
    (t) =>
      t.label.toLowerCase().includes(q) ||
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.keywords.some((k) => k.includes(q))
  )
}

/**
 * Get tool count
 */
export function getToolCount(): number {
  return tools.length
}

/**
 * Get category count
 */
export function getCategoryCount(): number {
  return categories.length
}

/**
 * Get project item type label for display
 */
export function getProjectItemLabel(type: ProjectItemType): string {
  const labels: Record<ProjectItemType, string> = {
    subnet: "Subnet Calculation",
    vlsm: "VLSM Plan",
    vlan: "VLAN Configuration",
    acl: "Access Control List",
    dns: "DNS Lookup",
    route: "Route Entry",
    routing: "Routing Configuration",
    mtu: "MTU Calculation",
    ipv6: "IPv6 Address",
    conflict: "Conflict Check",
    oui: "OUI Lookup",
    "port-scan": "Port Scan",
    wireless: "Wireless Config",
    cable: "Cable Calculation",
    "wifi-qr": "WiFi QR Code",
    "ip-converter": "IP Conversion",
    "ip-range": "IP Range",
    "random-gen": "Random Generation",
    bandwidth: "Bandwidth Calculation",
    "ssl-check": "SSL/TLS Check",
    whois: "WHOIS Lookup",
    "email-diag": "Email Diagnostics",
    other: "Other",
  }
  return labels[type] || "Unknown"
}

/**
 * Get icon for project item type
 */
export function getProjectItemIcon(type: ProjectItemType): LucideIcon {
  const tool = tools.find((t) => t.projectItemType === type)
  return tool?.icon || Info
}
