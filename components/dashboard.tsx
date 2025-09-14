"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  ArrowRight,
  Search,
  Navigation,
  Scan,
  TrendingUp,
  Route,
  Radio,
} from "lucide-react"

interface DashboardProps {
  onNavigate: (view: string) => void
}

const tools = [
  {
    id: "subnet-calculator",
    title: "Subnet Calculator",
    description: "Calculate network addresses, broadcast addresses, and host ranges for IPv4 and IPv6",
    icon: Calculator,
    category: "Core Tools",
    features: ["IPv4 & IPv6 support", "CIDR notation", "Wildcard masks"],
    popular: true,
  },
  {
    id: "vlsm-planner",
    title: "VLSM Planner",
    description: "Plan Variable Length Subnet Masking with optimal allocation and minimal waste",
    icon: Network,
    category: "Planning",
    features: ["Optimal allocation", "Fragmentation analysis", "Export plans"],
    popular: true,
  },
  {
    id: "vlan-manager",
    title: "VLAN Manager",
    description: "Design and manage VLANs with switch configuration templates",
    icon: Layers,
    category: "Configuration",
    features: ["Switch templates", "Trunk planning", "Cisco & Aruba"],
  },
  {
    id: "routing-tools",
    title: "Routing Tools",
    description: "Configure OSPF, EIGRP, static routes, and administrative distances",
    icon: Route,
    category: "Configuration",
    features: ["OSPF & EIGRP", "Static routes", "Admin distances"],
    popular: true,
  },
  {
    id: "wireless-tools",
    title: "Wireless Tools",
    description: "Channel planning, interference analysis, and WiFi configuration",
    icon: Radio,
    category: "Wireless",
    features: ["Channel planning", "Interference analysis", "WiFi config"],
    popular: true,
  },
  {
    id: "conflict-checker",
    title: "IP Conflict Checker",
    description: "Detect IP and MAC conflicts from ARP tables, DHCP leases, and inventories",
    icon: AlertTriangle,
    category: "Troubleshooting",
    features: ["Multi-source parsing", "Conflict detection", "Remediation tips"],
  },
  {
    id: "network-tester",
    title: "Network Tester",
    description: "Test RTT, throughput, and connectivity to user-defined endpoints",
    icon: Activity,
    category: "Testing",
    features: ["RTT measurement", "Throughput tests", "CORS-enabled"],
    popular: true,
  },
  {
    id: "dns-tools",
    title: "DNS Tools",
    description: "DNS over HTTPS client with multiple provider support and caching",
    icon: Globe,
    category: "Network Services",
    features: ["DoH support", "Multiple providers", "DNSSEC validation"],
  },
  {
    id: "ping-traceroute",
    title: "Ping & Traceroute",
    description: "Test network connectivity and trace packet paths to destinations",
    icon: Navigation,
    category: "Testing",
    features: ["Connectivity tests", "Path tracing", "Latency measurement"],
    popular: true,
  },
  {
    id: "port-scanner",
    title: "Port Scanner",
    description: "Scan network hosts for open ports and running services",
    icon: Scan,
    category: "Security",
    features: ["Common ports", "Custom ranges", "Service detection"],
  },
  {
    id: "mtu-calculator",
    title: "MTU Calculator",
    description: "Calculate MTU and header overhead for various network stacks",
    icon: Wifi,
    category: "Analysis",
    features: ["Protocol stacks", "Overhead calculation", "Fragmentation warnings"],
  },
  {
    id: "acl-generator",
    title: "ACL Generator",
    description: "Generate standard and extended access control lists with validation",
    icon: Shield,
    category: "Security",
    features: ["Standard & Extended", "Multi-vendor", "Rule validation"],
  },
  {
    id: "ipv6-tools",
    title: "IPv6 Tools",
    description: "IPv6 address manipulation, compression, and EUI-64 generation",
    icon: Zap,
    category: "IPv6",
    features: ["Address compression", "EUI-64 generation", "Solicited-node multicast"],
  },
  {
    id: "oui-lookup",
    title: "OUI Lookup",
    description: "Look up MAC address vendor information using IEEE OUI database",
    icon: Search,
    category: "Lookup",
    features: ["IEEE OUI database", "Vendor identification", "MAC analysis"],
  },
]

const stats = [
  {
    title: "Available Tools",
    value: tools.length.toString(), // Updated to reflect actual tool count
    description: "Professional networking utilities",
    icon: Network,
  },
  {
    title: "Categories",
    value: [...new Set(tools.map((tool) => tool.category))].length.toString(),
    description: "Organized tool categories",
    icon: Layers,
  },
  {
    title: "Popular Tools",
    value: tools.filter((tool) => tool.popular).length.toString(),
    description: "Most frequently used",
    icon: TrendingUp,
  },
  {
    title: "Offline Ready",
    value: "100%",
    description: "Works without internet",
    icon: Shield,
  },
]

export function Dashboard({ onNavigate }: DashboardProps) {
  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
            <Network className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-balance">Network Engineering Toolbox</h1>
            <p className="text-sm sm:text-base lg:text-lg text-muted-foreground text-pretty">
              Professional networking tools and utilities for network engineers and IT professionals
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card key={index} className="bg-gradient-to-br from-card to-muted/20">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-xl sm:text-2xl font-bold text-primary">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1 hidden sm:block">{stat.description}</p>
                  </div>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
          <h2 className="text-xl sm:text-2xl font-semibold">Available Tools</h2>
          <Badge variant="secondary" className="text-sm w-fit">
            {tools.length} tools available
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {tools.map((tool) => {
            const Icon = tool.icon
            return (
              <Card
                key={tool.id}
                className={`group hover:shadow-lg transition-all duration-200 cursor-pointer border-border hover:border-primary/30 ${
                  tool.popular ? "ring-2 ring-primary/20 bg-gradient-to-br from-card to-primary/5" : ""
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div
                        className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0 ${
                          tool.popular ? "bg-primary/20" : "bg-primary/10"
                        } group-hover:bg-primary/30`}
                      >
                        <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2">
                          <CardTitle className="text-base sm:text-lg leading-tight">{tool.title}</CardTitle>
                          {tool.popular && (
                            <Badge
                              variant="default"
                              className="text-xs bg-primary text-primary-foreground border-primary w-fit"
                            >
                              Popular
                            </Badge>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs mt-1 w-fit">
                          {tool.category}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <CardDescription className="text-sm leading-relaxed mt-2">{tool.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex flex-wrap gap-1">
                      {tool.features.map((feature, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                    <Button
                      onClick={() => onNavigate(tool.id)}
                      className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                      variant="outline"
                    >
                      Launch Tool
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      <Card className="bg-gradient-to-r from-primary/10 via-secondary/5 to-accent/10 border-primary/30">
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="text-lg sm:text-xl">Privacy & Security First</span>
              <p className="text-sm text-muted-foreground font-normal mt-1">
                Built with privacy and security as core principles
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="flex items-start space-x-3">
              <div className="w-3 h-3 bg-emerald-500 rounded-full mt-1 flex-shrink-0"></div>
              <div>
                <h4 className="font-medium text-sm">No Telemetry</h4>
                <p className="text-xs text-muted-foreground mt-1">Zero tracking or data collection</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-3 h-3 bg-emerald-500 rounded-full mt-1 flex-shrink-0"></div>
              <div>
                <h4 className="font-medium text-sm">Offline First</h4>
                <p className="text-xs text-muted-foreground mt-1">Works completely offline by default</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-3 h-3 bg-emerald-500 rounded-full mt-1 flex-shrink-0"></div>
              <div>
                <h4 className="font-medium text-sm">WCAG Compliant</h4>
                <p className="text-xs text-muted-foreground mt-1">Accessible to all users (AA standard)</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
