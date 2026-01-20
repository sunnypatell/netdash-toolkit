"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Calculator,
  Network,
  Layers,
  AlertTriangle,
  Activity,
  FolderOpen,
  Home,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Wifi,
  Globe,
  Shield,
  Zap,
  Search,
  Info,
  Navigation,
  Scan,
  Route,
  Cable,
  QrCode,
  ArrowRightLeft,
  List,
  Shuffle,
  Gauge,
  Lock,
  Mail,
  BookOpen,
  Wrench,
  Server,
  TestTube,
  Binary,
} from "lucide-react"

interface SidebarProps {
  activeView: string
  onNavigate: (view: string) => void
  isOpen: boolean
  onToggle: () => void
}

interface NavItem {
  id: string
  label: string
  icon: typeof Home
}

interface NavCategory {
  id: string
  label: string
  icon: typeof Home
  items: NavItem[]
}

const navigationCategories: NavCategory[] = [
  {
    id: "calculators",
    label: "Calculators",
    icon: Calculator,
    items: [
      { id: "subnet-calculator", label: "Subnet Calculator", icon: Calculator },
      { id: "vlsm-planner", label: "VLSM Planner", icon: Network },
      { id: "mtu-calculator", label: "MTU Calculator", icon: Wifi },
      { id: "bandwidth-calculator", label: "Bandwidth Calculator", icon: Gauge },
      { id: "cable-calculator", label: "Cable Calculator", icon: Cable },
    ],
  },
  {
    id: "ip-tools",
    label: "IP Tools",
    icon: Binary,
    items: [
      { id: "ip-converter", label: "IP Converter", icon: ArrowRightLeft },
      { id: "ip-enumerator", label: "IP Enumerator", icon: List },
      { id: "ipv6-tools", label: "IPv6 Tools", icon: Zap },
      { id: "conflict-checker", label: "Conflict Checker", icon: AlertTriangle },
    ],
  },
  {
    id: "network",
    label: "Network Config",
    icon: Server,
    items: [
      { id: "vlan-manager", label: "VLAN Manager", icon: Layers },
      { id: "routing-tools", label: "Routing Tools", icon: Route },
      { id: "acl-generator", label: "ACL Generator", icon: Shield },
      { id: "wireless-tools", label: "Wireless Tools", icon: Wifi },
    ],
  },
  {
    id: "diagnostics",
    label: "Diagnostics",
    icon: TestTube,
    items: [
      { id: "network-tester", label: "Network Tester", icon: Activity },
      { id: "dns-tools", label: "DNS Tools", icon: Globe },
      { id: "ping-traceroute", label: "Ping & Traceroute", icon: Navigation },
      { id: "port-scanner", label: "Port Scanner", icon: Scan },
      { id: "ssl-checker", label: "SSL/TLS Checker", icon: Lock },
      { id: "whois-lookup", label: "WHOIS Lookup", icon: Search },
      { id: "email-diagnostics", label: "Email Diagnostics", icon: Mail },
    ],
  },
  {
    id: "generators",
    label: "Generators",
    icon: Wrench,
    items: [
      { id: "random-generator", label: "Random Generator", icon: Shuffle },
      { id: "wifi-qr", label: "WiFi QR Generator", icon: QrCode },
    ],
  },
  {
    id: "reference",
    label: "Reference",
    icon: BookOpen,
    items: [
      { id: "reference-hub", label: "Reference Hub", icon: BookOpen },
      { id: "oui-lookup", label: "OUI Lookup", icon: Search },
    ],
  },
]

const standaloneItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "project-manager", label: "Projects", icon: FolderOpen },
  { id: "about", label: "About", icon: Info },
]

export function Sidebar({ activeView, onNavigate, isOpen, onToggle }: SidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(navigationCategories.map((c) => c.id)) // All expanded by default
  )

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  // Check if current view is in a category
  const isViewInCategory = (category: NavCategory) => {
    return category.items.some((item) => item.id === activeView)
  }

  const handleNavigate = (id: string) => {
    onNavigate(id)
    if (window.innerWidth < 1024) {
      onToggle()
    }
  }

  const renderNavItem = (item: NavItem, indented: boolean = false) => {
    const Icon = item.icon
    return (
      <Button
        key={item.id}
        variant={activeView === item.id ? "secondary" : "ghost"}
        className={cn(
          "text-sidebar-foreground hover:bg-sidebar-accent w-full justify-start",
          !isOpen && "justify-center px-2",
          activeView === item.id && "bg-sidebar-accent text-sidebar-accent-foreground",
          indented && isOpen && "pl-8"
        )}
        onClick={() => handleNavigate(item.id)}
        aria-label={!isOpen ? item.label : undefined}
        aria-current={activeView === item.id ? "page" : undefined}
      >
        <Icon className={cn("h-4 w-4", isOpen && "mr-2")} aria-hidden="true" />
        {isOpen && <span className="text-sm">{item.label}</span>}
      </Button>
    )
  }

  return (
    <div
      className={cn(
        "bg-sidebar border-sidebar-border border-r transition-all duration-300 ease-in-out",
        "fixed inset-y-0 left-0 z-50 lg:relative lg:z-auto",
        isOpen ? "w-64 translate-x-0" : "w-16 -translate-x-full lg:translate-x-0"
      )}
    >
      <div className="flex h-full flex-col">
        <div className="border-sidebar-border flex items-center justify-between border-b p-4">
          {isOpen && (
            <div className="flex items-center space-x-2">
              <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg">
                <Network className="text-primary-foreground h-5 w-5" />
              </div>
              <span className="text-sidebar-foreground font-semibold">NetDash</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
            aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={isOpen}
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", !isOpen && "rotate-180")} />
          </Button>
        </div>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full px-2 py-4">
            <nav className="space-y-1" aria-label="Main navigation">
              {/* Dashboard */}
              {renderNavItem(standaloneItems[0])}

              {/* Categorized navigation */}
              {navigationCategories.map((category) => {
                const CategoryIcon = category.icon
                const isExpanded = expandedCategories.has(category.id)
                const hasActiveItem = isViewInCategory(category)

                return (
                  <div key={category.id} className="space-y-1">
                    {isOpen ? (
                      <>
                        <Button
                          variant="ghost"
                          className={cn(
                            "text-sidebar-foreground hover:bg-sidebar-accent w-full justify-between",
                            hasActiveItem && "text-sidebar-accent-foreground font-medium"
                          )}
                          onClick={() => toggleCategory(category.id)}
                        >
                          <div className="flex items-center">
                            <CategoryIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                            <span className="text-sm">{category.label}</span>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                        {isExpanded && (
                          <div className="space-y-1">
                            {category.items.map((item) => renderNavItem(item, true))}
                          </div>
                        )}
                      </>
                    ) : (
                      // Collapsed view - show category icon, clicking shows items
                      <div className="space-y-1">
                        {category.items.map((item) => renderNavItem(item, false))}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Projects and About */}
              <div className="border-sidebar-border mt-4 border-t pt-4">
                {standaloneItems.slice(1).map((item) => renderNavItem(item))}
              </div>
            </nav>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
