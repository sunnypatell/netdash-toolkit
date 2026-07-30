// @vitest-environment happy-dom
import { createElement } from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import axe from "axe-core"
import { CIDRPanel } from "@/components/tools/reference-hub/cidr-panel"
import { IPv4RangesPanel } from "@/components/tools/reference-hub/ipv4-ranges-panel"
import { IPv6RangesPanel } from "@/components/tools/reference-hub/ipv6-ranges-panel"
import { PortsPanel } from "@/components/tools/reference-hub/ports-panel"
import { ProtocolsPanel } from "@/components/tools/reference-hub/protocols-panel"
import { SubnetsPanel } from "@/components/tools/reference-hub/subnets-panel"
import { DNSPanel } from "@/components/tools/network-tester/dns-panel"
import { IPv6Panel } from "@/components/tools/network-tester/ipv6-panel"
import { MTUPanel } from "@/components/tools/network-tester/mtu-panel"
import { OUIPanel } from "@/components/tools/network-tester/oui-panel"
import { RTTPanel } from "@/components/tools/network-tester/rtt-panel"
import { ThroughputPanel } from "@/components/tools/network-tester/throughput-panel"

// reference-hub and network-tester are now a directory of panels behind a tabbed
// index. these mount each panel on its own, with no parent and no provider, so a
// panel that secretly depended on the old shared state blob fails here. the tool
// level suites in tests/components only ever see the default tab.

// happy-dom lacks the browser apis radix touches on mount
for (const name of ["ResizeObserver", "IntersectionObserver"] as const) {
  if (!(name in window)) {
    // @ts-expect-error assigning a test double onto the global
    window[name] = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn()
}

const AXE_OPTIONS: axe.RunOptions = {
  // the same wcag 2.2 aa tag set the tool level gate runs
  runOnly: {
    type: "tag",
    values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
  },
  // no layout engine here, so contrast is asserted from tokens elsewhere
  rules: { "color-contrast": { enabled: false } },
}

async function violationsOf(container: HTMLElement) {
  const results = await axe.run(container, AXE_OPTIONS)
  return results.violations.map((violation) => ({
    id: violation.id,
    nodes: violation.nodes.slice(0, 3).map((node) => node.html.slice(0, 160)),
  }))
}

const panels = [
  ["ports", () => createElement(PortsPanel, { searchTerm: "" })],
  ["ipv4 ranges", () => createElement(IPv4RangesPanel, { searchTerm: "" })],
  ["ipv6 ranges", () => createElement(IPv6RangesPanel, { searchTerm: "" })],
  ["cidr", () => createElement(CIDRPanel, { searchTerm: "" })],
  ["protocols", () => createElement(ProtocolsPanel, { searchTerm: "" })],
  ["subnets", () => createElement(SubnetsPanel, { searchTerm: "" })],
  ["rtt", () => createElement(RTTPanel, { isNative: false })],
  ["rtt (desktop)", () => createElement(RTTPanel, { isNative: true })],
  ["throughput", () => createElement(ThroughputPanel, {})],
  ["dns", () => createElement(DNSPanel, {})],
  ["mtu", () => createElement(MTUPanel, {})],
  ["oui", () => createElement(OUIPanel, {})],
  ["ipv6 tools", () => createElement(IPv6Panel, {})],
] as const

afterEach(cleanup)

describe("panels render standalone", () => {
  it.each(panels)("%s mounts on its own with no axe violations", async (name, element) => {
    const { container } = render(element())
    expect(container.textContent?.trim().length ?? 0, `${name} rendered nothing`).toBeGreaterThan(0)
    const violations = await violationsOf(container)
    expect(violations, `${name}:\n${JSON.stringify(violations, null, 2)}`).toEqual([])
  })
})

describe("reference panels filter and copy", () => {
  it("filters rows from the searchTerm prop alone", () => {
    render(createElement(PortsPanel, { searchTerm: "3389" }))
    expect(screen.getByText("RDP")).toBeTruthy()
    expect(screen.queryByText("SSH")).toBeNull()
    expect(screen.getByText(/1 shown/)).toBeTruthy()
  })

  it("says so instead of showing an empty table when nothing matches", () => {
    render(createElement(ProtocolsPanel, { searchTerm: "zzzz" }))
    expect(screen.getByText(/No rows match your search/)).toBeTruthy()
  })

  it("keeps a per-row accessible name on every icon-only copy button", () => {
    render(createElement(CIDRPanel, { searchTerm: "/24" }))
    expect(screen.getByRole("button", { name: "Copy subnet mask 255.255.255.0" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Copy wildcard mask 0.0.0.255" })).toBeTruthy()
  })

  it("shows the registered iana name next to the everyday one", () => {
    render(createElement(PortsPanel, { searchTerm: "8443" }))
    expect(screen.getByText("pcsync-https")).toBeTruthy()
  })
})

describe("network tester panels are honest about what they measure", () => {
  it("tells a browser user the rtt is an https round trip, not a ping", () => {
    render(createElement(RTTPanel, { isNative: false }))
    expect(screen.getByText(/Not a ping/)).toBeTruthy()
    expect(screen.getByText(/HTTPS request round trips/)).toBeTruthy()
    expect(screen.getByText(/Real ICMP needs the desktop app/)).toBeTruthy()
  })

  it("points a desktop user at the icmp option instead of claiming it is already on", () => {
    render(createElement(RTTPanel, { isNative: true }))
    // the default method is still HEAD, so the https caveat has to stay put
    expect(screen.getByText(/Not a ping/)).toBeTruthy()
    expect(screen.getByText(/This build has real ICMP/)).toBeTruthy()
  })

  it("does not sell the throughput number as a speed test", () => {
    const { container } = render(createElement(ThroughputPanel, {}))
    expect(screen.getByText(/Not a speed test/)).toBeTruthy()
    // the old panel rendered a hardcoded 50% progress bar during the fetch
    expect(container.querySelector('[role="progressbar"]')).toBeNull()
  })

  it("names the resolver that will see the query", () => {
    render(createElement(DNSPanel, {}))
    expect(screen.getByText("cloudflare-dns.com")).toBeTruthy()
  })

  it("keeps a polite live region on every async result area", () => {
    for (const element of [
      () => createElement(RTTPanel, { isNative: false }),
      () => createElement(ThroughputPanel, {}),
      () => createElement(DNSPanel, {}),
    ]) {
      const { container } = render(element())
      const live = container.querySelector('[aria-live="polite"]')
      expect(live).toBeTruthy()
      expect(live?.getAttribute("aria-busy")).toBe("false")
      cleanup()
    }
  })
})

describe("offline panels work standalone", () => {
  it("calculates a payload mtu from the default stack", () => {
    render(createElement(MTUPanel, {}))
    fireEvent.click(screen.getByRole("button", { name: /Calculate MTU/ }))
    // 1500 - 14 ethernet - 20 ipv4 - 20 tcp
    expect(screen.getByText("1446")).toBeTruthy()
    expect(screen.getByText("54")).toBeTruthy()
  })

  it("resolves a bundled oui and admits when a prefix is missing", () => {
    render(createElement(OUIPanel, {}))
    const input = screen.getByLabelText("MAC Address")
    fireEvent.change(input, { target: { value: "00:0C:29:11:22:33" } })
    fireEvent.click(screen.getByRole("button", { name: "Lookup" }))
    expect(screen.getByText("VMware")).toBeTruthy()

    fireEvent.change(input, { target: { value: "12:34:56:78:9A:BC" } })
    fireEvent.click(screen.getByRole("button", { name: "Lookup" }))
    expect(screen.getByText("Not in the bundled OUI list")).toBeTruthy()
  })

  it("derives a solicited-node multicast address and an eui-64", () => {
    render(createElement(IPv6Panel, {}))
    fireEvent.click(screen.getByRole("button", { name: "Generate" }))
    // rfc 5952 4.1: no leading zeros, so not ff02::1:ff00:0001
    expect(screen.getByText("ff02::1:ff00:1")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Generate EUI-64" }))
    expect(screen.getByText("2001:db8::211:22ff:fe33:4455")).toBeTruthy()
  })

  it("reports invalid ipv6 input inline instead of through an alert dialog", () => {
    render(createElement(IPv6Panel, {}))
    fireEvent.change(screen.getByLabelText("IPv6 Address"), { target: { value: "nope" } })
    fireEvent.click(screen.getByRole("button", { name: "Generate" }))
    expect(screen.getByText(/Not a valid IPv6 address/)).toBeTruthy()
    expect(screen.getByLabelText("IPv6 Address").getAttribute("aria-invalid")).toBe("true")
  })
})
