"use client"

import { useState } from "react"
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
import { CableCalculator } from "@/components/tools/cable-calculator"
import { WifiQRGenerator } from "@/components/tools/wifi-qr-generator"
import { IPConverter } from "@/components/tools/ip-converter"
import { IPEnumerator } from "@/components/tools/ip-enumerator"
import { RandomGenerator } from "@/components/tools/random-generator"
import { BandwidthCalculator } from "@/components/tools/bandwidth-calculator"
import { SSLChecker } from "@/components/tools/ssl-checker"
import { WhoisLookup } from "@/components/tools/whois-lookup"
import { EmailDiagnostics } from "@/components/tools/email-diagnostics"
import { ReferenceHub } from "@/components/tools/reference-hub"
import { HTTPHeaders } from "@/components/tools/http-headers"
import { SecurityHeaders } from "@/components/tools/security-headers"
import { RedirectChecker } from "@/components/tools/redirect-checker"
import { UserAgentParser } from "@/components/tools/user-agent-parser"
import { HashGenerator } from "@/components/tools/hash-generator"
import { PasswordGenerator } from "@/components/tools/password-generator"
import { Base64Encoder } from "@/components/tools/base64-encoder"
import { URLEncoder } from "@/components/tools/url-encoder"
import { JSONFormatter } from "@/components/tools/json-formatter"
import { JWTDecoder } from "@/components/tools/jwt-decoder"
import { TimestampConverter } from "@/components/tools/timestamp-converter"
import { CronParser } from "@/components/tools/cron-parser"
import { RegexTester } from "@/components/tools/regex-tester"
import { ColorConverter } from "@/components/tools/color-converter"
import { LoremGenerator } from "@/components/tools/lorem-generator"

export default function HomePage() {
  const [activeView, setActiveView] = useState("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
      case "cable-calculator":
        return <CableCalculator />
      case "wifi-qr":
        return <WifiQRGenerator />
      case "ip-converter":
        return <IPConverter />
      case "ip-enumerator":
        return <IPEnumerator />
      case "random-generator":
        return <RandomGenerator />
      case "bandwidth-calculator":
        return <BandwidthCalculator />
      case "ssl-checker":
        return <SSLChecker />
      case "whois-lookup":
        return <WhoisLookup />
      case "email-diagnostics":
        return <EmailDiagnostics />
      case "reference-hub":
        return <ReferenceHub />
      case "http-headers":
        return <HTTPHeaders />
      case "security-headers":
        return <SecurityHeaders />
      case "redirect-checker":
        return <RedirectChecker />
      case "user-agent-parser":
        return <UserAgentParser />
      case "hash-generator":
        return <HashGenerator />
      case "password-generator":
        return <PasswordGenerator />
      case "base64-encoder":
        return <Base64Encoder />
      case "url-encoder":
        return <URLEncoder />
      case "json-formatter":
        return <JSONFormatter />
      case "jwt-decoder":
        return <JWTDecoder />
      case "timestamp-converter":
        return <TimestampConverter />
      case "cron-parser":
        return <CronParser />
      case "regex-tester":
        return <RegexTester />
      case "color-converter":
        return <ColorConverter />
      case "lorem-generator":
        return <LoremGenerator />
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
      {/* Skip to main content link for keyboard navigation (WCAG 2.4.1) */}
      <a
        href="#main-content"
        className="bg-primary text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:px-4 focus:py-2 focus:ring-2 focus:ring-offset-2 focus:outline-none"
      >
        Skip to main content
      </a>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setSidebarOpen(false)}
          role="button"
          tabIndex={0}
          aria-label="Close sidebar overlay"
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
        <main id="main-content" className="flex-1 overflow-auto" tabIndex={-1}>
          <div className="p-3 sm:p-4 lg:p-6">{renderContent()}</div>
          <Footer />
        </main>
      </div>
    </div>
  )
}
