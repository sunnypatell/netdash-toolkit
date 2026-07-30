// @vitest-environment happy-dom
import { createElement } from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import axe from "axe-core"
import { LatencyPanel } from "@/components/tools/network-calculator/latency"
import { ThroughputPanel } from "@/components/tools/network-calculator/throughput"
import { IPMathPanel } from "@/components/tools/network-calculator/ipmath"
import { PlanningPanel } from "@/components/tools/vlsm-planner/planning"
import { ResultsPanel } from "@/components/tools/vlsm-planner/results"
import { VisualizationPanel } from "@/components/tools/vlsm-planner/visualization"
import { VlansPanel } from "@/components/tools/vlan-manager/vlans"
import { PortsPanel } from "@/components/tools/vlan-manager/ports"
import { ConfigPanel } from "@/components/tools/vlan-manager/config"
import { ValidationPanel } from "@/components/tools/vlan-manager/validation"
import { ProtocolsPanel } from "@/components/tools/protocol-reference/protocols"
import { ICMPPanel } from "@/components/tools/protocol-reference/icmp"
import { UnreachablePanel } from "@/components/tools/protocol-reference/unreachable"
import { calculateVLSM } from "@/lib/vlsm-utils"

// network-calculator, vlsm-planner, vlan-manager and protocol-reference are now
// directories of panels behind a tabbed index. these mount each panel alone,
// with no parent, no Tabs root and no nuqs adapter, so a panel that still
// reached for the old shared state blob fails here rather than in review. the
// tool level suites in tests/components only ever exercise the default tab.

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

const noop = () => {}

const REQUIREMENTS = [
  { id: "a", name: "Main", hostsRequired: 120 },
  { id: "b", name: "Branch", hostsRequired: 50 },
]

const VLANS = [
  { rowId: "v1", id: 10, name: "Management", subnets: ["192.168.10.0/24"] },
  { rowId: "v2", id: 20, name: "Users", subnets: ["192.168.20.0/24"] },
]

const PORTS = [
  { rowId: "p1", name: "Gi1/0/1", mode: "access" as const, accessVlan: 20 },
  {
    rowId: "p2",
    name: "Gi1/0/24",
    mode: "trunk" as const,
    nativeVlan: 10,
    allowedVlans: "10,20",
  },
]

const GOOD_PLAN = calculateVLSM("10.0.0.0", 20, REQUIREMENTS)
const FAILED_PLAN = calculateVLSM("10.0.0.0", 28, REQUIREMENTS)

const panels = [
  [
    "latency",
    () =>
      createElement(LatencyPanel, {
        distance: "1000",
        unit: "km" as const,
        medium: "fiber" as const,
        onDistanceChange: noop,
        onUnitChange: noop,
        onMediumChange: noop,
      }),
  ],
  [
    "throughput",
    () =>
      createElement(ThroughputPanel, {
        bandwidth: "1000",
        rtt: "50",
        windowSize: "65535",
        onBandwidthChange: noop,
        onRttChange: noop,
        onWindowSizeChange: noop,
      }),
  ],
  [
    "ipmath",
    () =>
      createElement(IPMathPanel, {
        first: "192.168.1.0",
        second: "192.168.1.255",
        onFirstChange: noop,
        onSecondChange: noop,
      }),
  ],
  [
    "vlsm planning",
    () =>
      createElement(PlanningPanel, {
        baseNetwork: "10.0.0.0",
        basePrefix: "20",
        requirements: REQUIREMENTS,
        onBaseNetworkChange: noop,
        onBasePrefixChange: noop,
        onRequirementsChange: noop,
      }),
  ],
  ["vlsm results", () => createElement(ResultsPanel, { plan: GOOD_PLAN })],
  ["vlsm results (failed plan)", () => createElement(ResultsPanel, { plan: FAILED_PLAN })],
  ["vlsm results (no plan)", () => createElement(ResultsPanel, { plan: null })],
  ["vlsm visualization", () => createElement(VisualizationPanel, { plan: GOOD_PLAN })],
  ["vlsm visualization (no plan)", () => createElement(VisualizationPanel, { plan: null })],
  ["vlans", () => createElement(VlansPanel, { vlans: VLANS, onVlansChange: noop })],
  ["ports", () => createElement(PortsPanel, { ports: PORTS, vlans: VLANS, onPortsChange: noop })],
  [
    "config",
    () =>
      createElement(ConfigPanel, {
        vlans: VLANS,
        ports: PORTS,
        vendor: "cisco-ios" as const,
        onVendorChange: noop,
      }),
  ],
  ["validation", () => createElement(ValidationPanel, { vlans: VLANS, ports: PORTS })],
  ["protocols", () => createElement(ProtocolsPanel, { searchTerm: "" })],
  ["icmp", () => createElement(ICMPPanel, { searchTerm: "" })],
  ["unreachable", () => createElement(UnreachablePanel, { searchTerm: "" })],
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

describe("panels compute from props alone", () => {
  it("derives latency from the props, with no calculate step", () => {
    render(
      createElement(LatencyPanel, {
        distance: "1000",
        unit: "km" as const,
        medium: "fiber" as const,
        onDistanceChange: noop,
        onUnitChange: noop,
        onMediumChange: noop,
      })
    )
    expect(screen.getByText("4.979 ms")).toBeTruthy()
    expect(screen.getByText("9.957 ms")).toBeTruthy()
    expect(screen.queryByRole("button", { name: /^calculate$/i })).toBeNull()
  })

  it("derives the covering supernet in the ip math panel", () => {
    render(
      createElement(IPMathPanel, {
        first: "10.0.0.5",
        second: "10.0.3.200",
        onFirstChange: noop,
        onSecondChange: noop,
      })
    )
    expect(screen.getByText("10.0.0.0/22")).toBeTruthy()
  })

  it("shows nothing but a prompt when the ip math inputs are invalid", () => {
    render(
      createElement(IPMathPanel, {
        first: "not-an-ip",
        second: "10.0.0.1",
        onFirstChange: noop,
        onSecondChange: noop,
      })
    )
    expect(screen.getByText(/Enter two valid IPv4 addresses/)).toBeTruthy()
  })

  it("renders the failure message rather than an empty allocation list", () => {
    render(createElement(ResultsPanel, { plan: FAILED_PLAN }))
    expect(FAILED_PLAN.success).toBe(false)
    expect(screen.getByText(/Cannot fit requirement/)).toBeTruthy()
    expect(screen.queryByText("Subnet Allocations")).toBeNull()
  })

  it("renders each allocation of a successful plan", () => {
    render(createElement(ResultsPanel, { plan: GOOD_PLAN }))
    expect(screen.getByText("10.0.0.0/25")).toBeTruthy()
    expect(screen.getByText("10.0.0.128/26")).toBeTruthy()
  })

  it("generates the switch config with no generate button", () => {
    render(
      createElement(ConfigPanel, {
        vlans: VLANS,
        ports: PORTS,
        vendor: "cisco-ios" as const,
        onVendorChange: noop,
      })
    )
    const textarea = screen.getByLabelText("Configuration") as HTMLTextAreaElement
    expect(textarea.value).toMatch(/switchport access vlan 20/)
    expect(textarea.value).toMatch(/switchport trunk native vlan 10/)
    expect(screen.queryByRole("button", { name: /generate/i })).toBeNull()
  })

  it("switches vendor dialect from the prop, not from internal state", () => {
    const { rerender } = render(
      createElement(ConfigPanel, {
        vlans: VLANS,
        ports: PORTS,
        vendor: "cisco-ios" as const,
        onVendorChange: noop,
      })
    )
    expect((screen.getByLabelText("Configuration") as HTMLTextAreaElement).value).toMatch(
      /switchport mode trunk/
    )

    rerender(
      createElement(ConfigPanel, {
        vlans: VLANS,
        ports: PORTS,
        vendor: "aruba-cx" as const,
        onVendorChange: noop,
      })
    )
    const value = (screen.getByLabelText("Configuration") as HTMLTextAreaElement).value
    expect(value).toMatch(/no routing/)
    expect(value).not.toMatch(/switchport/)
  })

  it("lists the validation messages beside each row instead of only an icon", () => {
    render(
      createElement(ValidationPanel, {
        vlans: [{ rowId: "bad", id: 4095, name: "Reserved", subnets: [] }],
        ports: [],
      })
    )
    expect(screen.getByText(/reserved by IEEE 802\.1Q/)).toBeTruthy()
  })

  it("filters reference rows from the searchTerm prop alone", () => {
    render(createElement(ProtocolsPanel, { searchTerm: "EIGRP" }))
    expect(screen.getByText("EIGRP")).toBeTruthy()
    expect(screen.queryByText("OSPFIGP")).toBeNull()
  })

  it("says so instead of showing an empty table when nothing matches", () => {
    render(createElement(ICMPPanel, { searchTerm: "zzzz" }))
    expect(screen.getByText(/No ICMP types match your search/)).toBeTruthy()
  })
})

describe("panels report edits upward rather than owning them", () => {
  it("hands a new requirement list to the parent", () => {
    const onRequirementsChange = vi.fn()
    render(
      createElement(PlanningPanel, {
        baseNetwork: "10.0.0.0",
        basePrefix: "20",
        requirements: REQUIREMENTS,
        onBaseNetworkChange: noop,
        onBasePrefixChange: noop,
        onRequirementsChange,
      })
    )

    fireEvent.change(screen.getByLabelText("New subnet name"), { target: { value: "DMZ" } })
    fireEvent.change(screen.getByLabelText("New subnet hosts needed"), { target: { value: "10" } })
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }))

    expect(onRequirementsChange).toHaveBeenCalledTimes(1)
    const next = onRequirementsChange.mock.calls[0][0]
    expect(next).toHaveLength(3)
    expect(next[2].name).toBe("DMZ")
    // nextId, never Date.now(): two rows added in the same millisecond collided
    expect(next[2].id).toMatch(/^vlsm-\d+$/)
    expect(new Set(next.map((row: { id: string }) => row.id)).size).toBe(3)
  })

  it("hands a shortened list up when a row is removed", () => {
    const onVlansChange = vi.fn()
    render(createElement(VlansPanel, { vlans: VLANS, onVlansChange }))
    fireEvent.click(screen.getByRole("button", { name: "Delete VLAN 10 Management" }))
    expect(onVlansChange).toHaveBeenCalledWith([VLANS[1]])
  })

  it("reports the base prefix edit upward", () => {
    const onBasePrefixChange = vi.fn()
    render(
      createElement(PlanningPanel, {
        baseNetwork: "10.0.0.0",
        basePrefix: "20",
        requirements: REQUIREMENTS,
        onBaseNetworkChange: noop,
        onBasePrefixChange,
        onRequirementsChange: noop,
      })
    )
    fireEvent.change(screen.getByLabelText("Prefix Length"), { target: { value: "22" } })
    expect(onBasePrefixChange).toHaveBeenCalledWith("22")
  })
})
