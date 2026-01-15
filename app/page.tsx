"use client"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Dashboard } from "@/components/dashboard"
import { SubnetCalculator } from "@/components/tools/subnet-calculator"
import { VLSMPlanner } from "@/components/tools/vlsm-planner"
import { VLANManager } from "@/components/tools/vlan-manager"
import { ConflictChecker } from "@/components/tools/conflict-checker"
import { NetworkTester } from "@/components/tools/network-tester"
import { DNSTools } from "@/components/tools/dns-tools"
import { ProjectManager } from "@/components/project-manager"
import { About } from "@/components/about"
import { MTUCalculator } from "@/components/tools/mtu-calculator"
import { ACLGenerator } from "@/components/tools/acl-generator"
import { IPv6Tools } from "@/components/tools/ipv6-tools"
import { OUILookup } from "@/components/tools/oui-lookup"
import { Footer } from "@/components/footer"
import { PingTraceroute } from "@/components/tools/ping-traceroute"
import { PortScanner } from "@/components/tools/port-scanner"
import { RoutingTools } from "@/components/tools/routing-tools"
import { WirelessTools } from "@/components/tools/wireless-tools"

export default function HomePage() {
  const [activeView, setActiveView] = useState("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    const mediaQuery = window.matchMedia("(min-width: 1024px)")
    const handleChange = (event: MediaQueryListEvent) => {
      setSidebarOpen(event.matches)
    }

    setSidebarOpen(mediaQuery.matches)

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange)
      return () => mediaQuery.removeEventListener("change", handleChange)
    }

    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [])

  const renderContent = () => {
    switch (activeView) {
      case "dashboard":
        return <Dashboard onNavigate={setActiveView} />
      case "subnet-calculator":
        return <SubnetCalculator />
      case "vlsm-planner":
        return <VLSMPlanner />
      case "vlan-manager":
        return <VLANManager />
      case "routing-tools":
        return <RoutingTools />
      case "wireless-tools":
        return <WirelessTools />
      case "conflict-checker":
        return <ConflictChecker />
      case "network-tester":
        return <NetworkTester />
      case "dns-tools":
        return <DNSTools />
      case "mtu-calculator":
        return <MTUCalculator />
      case "acl-generator":
        return <ACLGenerator />
      case "ipv6-tools":
        return <IPv6Tools />
      case "oui-lookup":
        return <OUILookup />
      case "ping-traceroute":
        return <PingTraceroute />
      case "port-scanner":
        return <PortScanner />
      case "about":
        return <About />
      case "project-manager":
        return <ProjectManager />
      default:
        return <Dashboard onNavigate={setActiveView} />
    }
  }

  return (
    <div className="bg-background flex h-screen">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          onTouchStart={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        activeView={activeView}
        onNavigate={setActiveView}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          sidebarOpen={sidebarOpen}
          onNavigate={setActiveView}
        />
        <main className="flex-1 overflow-auto">
          <div className="p-3 sm:p-4 lg:p-6">{renderContent()}</div>
          <Footer />
        </main>
      </div>
    </div>
  )
}
