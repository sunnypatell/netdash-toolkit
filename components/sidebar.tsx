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
  { id: "wireless-tools", label: "Wireless Tools", icon: Wifi }, // Added wireless tools to navigation
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
        "bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out",
        "fixed inset-y-0 left-0 z-50 lg:relative lg:z-auto",
        isOpen ? "w-64" : "w-16 -translate-x-full lg:translate-x-0",
        isOpen && "translate-x-0",
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          {isOpen && (
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Network className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-sidebar-foreground">NetDash</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <ChevronLeft className={cn("w-4 h-4 transition-transform", !isOpen && "rotate-180")} />
          </Button>
        </div>

        <ScrollArea className="flex-1 px-2 py-4">
          <nav className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon
              return (
                <Button
                  key={item.id}
                  variant={activeView === item.id ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent",
                    !isOpen && "justify-center px-2",
                    activeView === item.id && "bg-sidebar-accent text-sidebar-accent-foreground",
                  )}
                  onClick={() => {
                    onNavigate(item.id)
                    if (window.innerWidth < 1024) {
                      onToggle()
                    }
                  }}
                >
                  <Icon className={cn("w-4 h-4", isOpen && "mr-2")} />
                  {isOpen && <span className="text-sm">{item.label}</span>}
                </Button>
              )
            })}
          </nav>
        </ScrollArea>
      </div>
    </div>
  )
}
