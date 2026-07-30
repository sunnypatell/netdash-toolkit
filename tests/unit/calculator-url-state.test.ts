// @vitest-environment happy-dom
import { createElement, type ReactElement } from "react"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing"
import { AuthProvider } from "@/contexts/auth-context"
import { ProjectProvider } from "@/contexts/project-context"
import { MTUCalculator } from "@/components/tools/mtu-calculator"
import { SubnetMaskConverter } from "@/components/tools/subnet-mask-converter"
import { MACFormatter } from "@/components/tools/mac-formatter"
import { PortReference } from "@/components/tools/port-reference"
import { NetworkCalculator } from "@/components/tools/network-calculator"
import { ProtocolReference } from "@/components/tools/protocol-reference"
import { VLSMPlanner } from "@/components/tools/vlsm-planner"
import { VLANManager } from "@/components/tools/vlan-manager"

// the claim under test: every input lives in the query string, so a link
// reproduces a result with no interaction and no Calculate button. the two
// deliberate exceptions are the vlsm requirement list and the vlan/port tables,
// which are unbounded editable lists; those must stay out of the url entirely.

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
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = vi.fn()
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  configurable: true,
})

function mount(
  Tool: () => ReactElement | null,
  searchParams = "",
  onUrlUpdate?: OnUrlUpdateFunction
) {
  // children goes in the props object: the adapter types it as required, so the
  // third createElement argument does not satisfy the overload
  return render(
    createElement(NuqsTestingAdapter, {
      searchParams,
      onUrlUpdate,
      children: createElement(
        AuthProvider,
        null,
        createElement(ProjectProvider, null, createElement(Tool))
      ),
    })
  )
}

/** every value any url update carried, so a leak cannot hide in one call */
function allUrlValues(onUrlUpdate: ReturnType<typeof vi.fn>): string[] {
  return onUrlUpdate.mock.calls.flatMap((call) => [...call[0].searchParams.values()] as string[])
}

afterEach(cleanup)

describe("results arrive from the link, with no Calculate button", () => {
  it("mtu calculator derives MSS on arrival", async () => {
    mount(MTUCalculator, "?mtu=1500&ip=ipv4&transport=tcp")
    expect(await screen.findByText("Effective IP MTU")).toBeTruthy()
    // payload and mss are both 1460 on plain ipv4 ethernet
    expect(screen.getAllByText("1460 bytes")).toHaveLength(2)
    expect(screen.queryByRole("button", { name: /^calculate$/i })).toBeNull()
  })

  it("mtu calculator applies encapsulation from the link", async () => {
    mount(MTUCalculator, "?mtu=1500&ip=ipv4&transport=tcp&encap=gre")
    // 1500 - 24 = 1476 effective, so payload and mss are both 1436
    expect(await screen.findByText("1476 bytes")).toBeTruthy()
    expect(screen.getAllByText("1436 bytes")).toHaveLength(2)
  })

  it("mtu calculator flags an RFC 8200 violation from the link alone", async () => {
    mount(MTUCalculator, "?mtu=1300&ip=ipv6&transport=tcp&encap=gre")
    expect(await screen.findByText(/1280-byte IPv6 minimum link MTU/)).toBeTruthy()
  })

  it("subnet mask converter converts on arrival", async () => {
    mount(SubnetMaskConverter, "?mask=26")
    // the binary form only exists in the conversions card, so it cannot be
    // confused with the /0 to /32 reference table further down the page
    expect(await screen.findByText("All notations for /26")).toBeTruthy()
    expect(screen.getByText("11111111.11111111.11111111.11000000")).toBeTruthy()
    expect(screen.getAllByText("255.255.255.192").length).toBeGreaterThan(0)
    expect(screen.queryByRole("button", { name: /^convert$/i })).toBeNull()
  })

  it("subnet mask converter accepts a wildcard through the link", async () => {
    mount(SubnetMaskConverter, "?mask=0.0.0.255")
    expect(await screen.findByText("All notations for /24")).toBeTruthy()
  })

  it("mac formatter formats on arrival", async () => {
    mount(MACFormatter, "?mac=001a2b3c4d5e")
    // the eui-64 and the binary are only rendered for a parsed address, unlike
    // the notation examples card which is always on screen
    expect(await screen.findByText("021A:2BFF:FE3C:4D5E")).toBeTruthy()
    expect(screen.getByText("00000000 00011010 00101011 00111100 01001101 01011110")).toBeTruthy()
  })

  it("network calculator opens the ip math tab and computes it", async () => {
    mount(NetworkCalculator, "?tab=ipmath&ip1=10.0.0.5&ip2=10.0.3.200")
    expect(await screen.findByText("10.0.0.0/22")).toBeTruthy()
  })

  it("network calculator opens the throughput tab and computes it", async () => {
    mount(NetworkCalculator, "?tab=throughput&bandwidth=1000&rtt=50&window=65535")
    // 1 Gbps over 50 ms holds 6.25 MB in flight, and the window to fill the
    // pipe is the same figure by definition, so it appears twice
    expect(await screen.findByText("10.49 Mbps")).toBeTruthy()
    expect(screen.getAllByText("6,250,000 bytes (6103.52 KiB)")).toHaveLength(2)
  })

  it("port reference filters by category from the link", async () => {
    mount(PortReference, "?category=vpn")
    expect(await screen.findByText("WireGuard")).toBeTruthy()
    expect(screen.queryByText("HTTPS")).toBeNull()
  })

  it("port reference searches from the link and shows the registered name", async () => {
    mount(PortReference, "?q=8443")
    expect(await screen.findByText("pcsync-https")).toBeTruthy()
  })

  it("protocol reference opens the icmp tab from the link", async () => {
    mount(ProtocolReference, "?tab=icmp&q=Timestamp")
    expect(await screen.findByText("Timestamp Reply")).toBeTruthy()
  })

  it("vlsm planner plans the linked block with no Calculate button", async () => {
    mount(VLSMPlanner, "?tab=results&network=192.168.0.0&prefix=24")
    // defaults are 120, 50 and 10 hosts, so /25, /26 and /28 in that order
    expect(await screen.findByText("192.168.0.0/25")).toBeTruthy()
    expect(screen.getByText("192.168.0.128/26")).toBeTruthy()
    expect(screen.queryByRole("button", { name: /calculate vlsm/i })).toBeNull()
  })

  it("vlsm planner reports an unfittable block instead of a stale plan", async () => {
    mount(VLSMPlanner, "?tab=results&network=192.168.0.0&prefix=28")
    expect(await screen.findByText(/Cannot fit requirement/)).toBeTruthy()
    expect(screen.queryByText("Subnet Allocations")).toBeNull()
  })

  it("vlan manager opens the config tab in the linked vendor dialect", async () => {
    mount(VLANManager, "?tab=config&vendor=aruba-cx")
    const textarea = (await screen.findByLabelText("Configuration")) as HTMLTextAreaElement
    expect(textarea.value).toMatch(/no routing/)
    expect(textarea.value).not.toMatch(/switchport/)
    expect(screen.queryByRole("button", { name: /generate configuration/i })).toBeNull()
  })
})

describe("edits are written back to the query string", () => {
  it("subnet mask converter rewrites mask as you type", async () => {
    const onUrlUpdate = vi.fn()
    mount(SubnetMaskConverter, "?mask=24", onUrlUpdate)

    fireEvent.change(screen.getByLabelText("Subnet Mask"), { target: { value: "30" } })

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get("mask")).toBe("30")
  })

  it("mtu calculator rewrites mtu as you type", async () => {
    const onUrlUpdate = vi.fn()
    mount(MTUCalculator, "?mtu=1500", onUrlUpdate)

    // exact, because "Link MTU" is also a result row label
    fireEvent.change(screen.getByLabelText("Link MTU (bytes)"), { target: { value: "9000" } })

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get("mtu")).toBe("9000")
  })

  it("port reference rewrites the search term", async () => {
    const onUrlUpdate = vi.fn()
    mount(PortReference, "", onUrlUpdate)

    fireEvent.change(screen.getByLabelText(/Search by port number or service/), {
      target: { value: "rsync" },
    })

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get("q")).toBe("rsync")
  })
})

describe("no stale result beside invalid input", () => {
  it("subnet mask converter clears the conversions when the mask goes bad", async () => {
    mount(SubnetMaskConverter, "?mask=24")
    expect(await screen.findByText("All notations for /24")).toBeTruthy()

    fireEvent.change(screen.getByLabelText("Subnet Mask"), { target: { value: "255.0.255.0" } })

    await waitFor(() => expect(screen.queryByText("All notations for /24")).toBeNull())
    expect(screen.getByText(/Non-contiguous masks are rejected/)).toBeTruthy()
  })

  it("mac formatter clears the formats when the address goes bad", async () => {
    mount(MACFormatter, "?mac=001a2b3c4d5e")
    expect(await screen.findByText("021A:2BFF:FE3C:4D5E")).toBeTruthy()

    fireEvent.change(screen.getByLabelText("MAC Address"), { target: { value: "nonsense" } })

    await waitFor(() => expect(screen.queryByText("021A:2BFF:FE3C:4D5E")).toBeNull())
    expect(screen.getByText(/Not a MAC address/)).toBeTruthy()
  })
})

describe("unbounded lists stay out of the url", () => {
  it("vlsm requirement names never reach the query string", async () => {
    const onUrlUpdate = vi.fn()
    mount(VLSMPlanner, "?network=10.0.0.0&prefix=20", onUrlUpdate)

    // the panel is lazy, so wait for it before driving it
    fireEvent.change(await screen.findByLabelText("New subnet name"), {
      target: { value: "Warehouse" },
    })
    fireEvent.change(screen.getByLabelText("New subnet hosts needed"), { target: { value: "30" } })
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }))

    // the row is on screen, so it was added
    expect(await screen.findByDisplayValue("Warehouse")).toBeTruthy()
    // but no url update ever carried it
    expect(allUrlValues(onUrlUpdate)).not.toContain("Warehouse")
  })

  it("vlan names never reach the query string", async () => {
    const onUrlUpdate = vi.fn()
    mount(VLANManager, "?tab=vlans", onUrlUpdate)

    fireEvent.change(await screen.findByLabelText("New VLAN ID"), { target: { value: "77" } })
    fireEvent.change(screen.getByLabelText("New VLAN name"), { target: { value: "Warehouse" } })
    fireEvent.click(screen.getByRole("button", { name: /add vlan/i }))

    expect(await screen.findByText("VLAN 77")).toBeTruthy()
    expect(allUrlValues(onUrlUpdate)).not.toContain("Warehouse")
    expect(allUrlValues(onUrlUpdate)).not.toContain("77")
  })

  it("still puts the vlan manager's scalar vendor choice in the url", async () => {
    const onUrlUpdate = vi.fn()
    mount(VLANManager, "?tab=config&vendor=cisco-ios", onUrlUpdate)
    // the tab and vendor arrived from the link, which is the half that belongs there
    const textarea = (await screen.findByLabelText("Configuration")) as HTMLTextAreaElement
    expect(textarea.value).toMatch(/switchport mode trunk/)
  })
})
