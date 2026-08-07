import type { ComponentType } from "react"

// kept out of tool-registry: a server module reaching "use client" targets through import()
// thunks makes next hoist all 48 tools into every route's client entry
export type ToolLoader = () => Promise<{ default: ComponentType }>

export const toolLoaders: Record<string, ToolLoader> = {
  "subnet-calculator": () =>
    import("@/components/tools/subnet-calculator").then((m) => ({ default: m.SubnetCalculator })),
  "vlsm-planner": () =>
    import("@/components/tools/vlsm-planner").then((m) => ({ default: m.VLSMPlanner })),
  "mtu-calculator": () =>
    import("@/components/tools/mtu-calculator").then((m) => ({ default: m.MTUCalculator })),
  "bandwidth-calculator": () =>
    import("@/components/tools/bandwidth-calculator").then((m) => ({
      default: m.BandwidthCalculator,
    })),
  "cable-calculator": () =>
    import("@/components/tools/cable-calculator").then((m) => ({ default: m.CableCalculator })),
  "ip-converter": () =>
    import("@/components/tools/ip-converter").then((m) => ({ default: m.IPConverter })),
  "ip-enumerator": () =>
    import("@/components/tools/ip-enumerator").then((m) => ({ default: m.IPEnumerator })),
  "ipv6-tools": () =>
    import("@/components/tools/ipv6-tools").then((m) => ({ default: m.IPv6Tools })),
  "conflict-checker": () =>
    import("@/components/tools/conflict-checker").then((m) => ({ default: m.ConflictChecker })),
  "vlan-manager": () =>
    import("@/components/tools/vlan-manager").then((m) => ({ default: m.VLANManager })),
  "routing-tools": () =>
    import("@/components/tools/routing-tools").then((m) => ({ default: m.RoutingTools })),
  "acl-generator": () =>
    import("@/components/tools/acl-generator").then((m) => ({ default: m.ACLGenerator })),
  "wireless-tools": () =>
    import("@/components/tools/wireless-tools").then((m) => ({ default: m.WirelessTools })),
  "network-tester": () =>
    import("@/components/tools/network-tester").then((m) => ({ default: m.NetworkTester })),
  "dns-tools": () => import("@/components/tools/dns-tools").then((m) => ({ default: m.DNSTools })),
  "ping-traceroute": () =>
    import("@/components/tools/ping-traceroute").then((m) => ({ default: m.PingTraceroute })),
  "port-scanner": () =>
    import("@/components/tools/port-scanner").then((m) => ({ default: m.PortScanner })),
  "ssl-checker": () =>
    import("@/components/tools/ssl-checker").then((m) => ({ default: m.SSLChecker })),
  "whois-lookup": () =>
    import("@/components/tools/whois-lookup").then((m) => ({ default: m.WhoisLookup })),
  "email-diagnostics": () =>
    import("@/components/tools/email-diagnostics").then((m) => ({ default: m.EmailDiagnostics })),
  "random-generator": () =>
    import("@/components/tools/random-generator").then((m) => ({ default: m.RandomGenerator })),
  "wifi-qr": () =>
    import("@/components/tools/wifi-qr-generator").then((m) => ({ default: m.WifiQRGenerator })),
  "reference-hub": () =>
    import("@/components/tools/reference-hub").then((m) => ({ default: m.ReferenceHub })),
  "oui-lookup": () =>
    import("@/components/tools/oui-lookup").then((m) => ({ default: m.OUILookup })),
  "http-headers": () =>
    import("@/components/tools/http-headers").then((m) => ({ default: m.HTTPHeaders })),
  "security-headers": () =>
    import("@/components/tools/security-headers").then((m) => ({ default: m.SecurityHeaders })),
  "redirect-checker": () =>
    import("@/components/tools/redirect-checker").then((m) => ({ default: m.RedirectChecker })),
  "user-agent-parser": () =>
    import("@/components/tools/user-agent-parser").then((m) => ({ default: m.UserAgentParser })),
  "hash-generator": () =>
    import("@/components/tools/hash-generator").then((m) => ({ default: m.HashGenerator })),
  "password-generator": () =>
    import("@/components/tools/password-generator").then((m) => ({
      default: m.PasswordGenerator,
    })),
  "base64-encoder": () =>
    import("@/components/tools/base64-encoder").then((m) => ({ default: m.Base64Encoder })),
  "url-encoder": () =>
    import("@/components/tools/url-encoder").then((m) => ({ default: m.URLEncoder })),
  "json-formatter": () =>
    import("@/components/tools/json-formatter").then((m) => ({ default: m.JSONFormatter })),
  "jwt-decoder": () =>
    import("@/components/tools/jwt-decoder").then((m) => ({ default: m.JWTDecoder })),
  "timestamp-converter": () =>
    import("@/components/tools/timestamp-converter").then((m) => ({
      default: m.TimestampConverter,
    })),
  "cron-parser": () =>
    import("@/components/tools/cron-parser").then((m) => ({ default: m.CronParser })),
  "regex-tester": () =>
    import("@/components/tools/regex-tester").then((m) => ({ default: m.RegexTester })),
  "color-converter": () =>
    import("@/components/tools/color-converter").then((m) => ({ default: m.ColorConverter })),
  "lorem-generator": () =>
    import("@/components/tools/lorem-generator").then((m) => ({ default: m.LoremGenerator })),
  "data-unit-converter": () =>
    import("@/components/tools/data-unit-converter").then((m) => ({
      default: m.DataUnitConverter,
    })),
  "uptime-calculator": () =>
    import("@/components/tools/uptime-calculator").then((m) => ({ default: m.UptimeCalculator })),
  "network-calculator": () =>
    import("@/components/tools/network-calculator").then((m) => ({
      default: m.NetworkCalculator,
    })),
  "mac-formatter": () =>
    import("@/components/tools/mac-formatter").then((m) => ({ default: m.MACFormatter })),
  "subnet-mask-converter": () =>
    import("@/components/tools/subnet-mask-converter").then((m) => ({
      default: m.SubnetMaskConverter,
    })),
  "port-reference": () =>
    import("@/components/tools/port-reference").then((m) => ({ default: m.PortReference })),
  "cidr-reference": () =>
    import("@/components/tools/cidr-reference").then((m) => ({ default: m.CIDRReference })),
  "protocol-reference": () =>
    import("@/components/tools/protocol-reference").then((m) => ({
      default: m.ProtocolReference,
    })),
  "ipv6-reference": () =>
    import("@/components/tools/ipv6-reference").then((m) => ({ default: m.IPv6Reference })),
}

export function loadTool(slug: string): Promise<{ default: ComponentType }> {
  const loader = toolLoaders[slug]
  if (!loader) throw new Error(`No loader registered for tool "${slug}"`)
  return loader()
}
