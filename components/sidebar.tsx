"use client"

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
  Wifi,
  Globe,
  Shield,
  Zap,
  Search,
  Info,
  Navigation,
  Scan,
  Route,
} from "lucide-react"

interface SidebarProps {
  activeView: string
  onNavigate: (view: string) => void
  isOpen: boolean
  onToggle: () => void
}

const navigationItems = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "subnet-calculator", label: "Subnet Calculator", icon: Calculator },
  { id: "vlsm-planner", label: "VLSM Planner", icon: Network },
  { id: "vlan-manager", label: "VLAN Manager", icon: Layers },
  { id: "routing-tools", label: "Routing Tools", icon: Route },
  { id: "wireless-tools", label: "Wireless Tools", icon: Wifi },
  { id: "conflict-checker", label: "IP Conflict Checker", icon: AlertTriangle },
  { id: "network-tester", label: "Network Tester", icon: Activity },
  { id: "dns-tools", label: "DNS Tools", icon: Globe },
  { id: "ping-traceroute", label: "Ping & Traceroute", icon: Navigation },
  { id: "port-scanner", label: "Port Scanner", icon: Scan },
  { id: "mtu-calculator", label: "MTU Calculator", icon: Wifi },
  { id: "acl-generator", label: "ACL Generator", icon: Shield },
  { id: "ipv6-tools", label: "IPv6 Tools", icon: Zap },
  { id: "oui-lookup", label: "OUI Lookup", icon: Search },
  { id: "about", label: "About", icon: Info },
  { id: "project-manager", label: "Projects", icon: FolderOpen },
]

export function Sidebar({ activeView, onNavigate, isOpen, onToggle }: SidebarProps) {
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
              {navigationItems.map((item) => {
                const Icon = item.icon
                return (
                  <Button
                    key={item.id}
                    variant={activeView === item.id ? "secondary" : "ghost"}
                    className={cn(
                      "text-sidebar-foreground hover:bg-sidebar-accent w-full justify-start",
                      !isOpen && "justify-center px-2",
                      activeView === item.id && "bg-sidebar-accent text-sidebar-accent-foreground"
                    )}
                    onClick={() => {
                      onNavigate(item.id)
                      if (window.innerWidth < 1024) {
                        onToggle()
                      }
                    }}
                    aria-label={!isOpen ? item.label : undefined}
                    aria-current={activeView === item.id ? "page" : undefined}
                  >
                    <Icon className={cn("h-4 w-4", isOpen && "mr-2")} aria-hidden="true" />
                    {isOpen && <span className="text-sm">{item.label}</span>}
                  </Button>
                )
              })}
            </nav>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
