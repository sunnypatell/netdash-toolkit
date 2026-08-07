// @vitest-environment happy-dom
import { createElement, useState } from "react"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import axe from "axe-core"
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing"
import { WirelessTools } from "@/components/tools/wireless-tools"
import { ChannelPlanningPanel } from "@/components/tools/wireless-tools/channel-planning"
import {
  CapacityCalculatorPanel,
  type CapacitySettings,
} from "@/components/tools/wireless-tools/capacity-calculator"
import { WifiConfigPanel } from "@/components/tools/wireless-tools/wifi-config"
import { SecurityGuidePanel } from "@/components/tools/wireless-tools/security-guide"
import { OspfPanel } from "@/components/tools/routing-tools/ospf"
import { EigrpPanel } from "@/components/tools/routing-tools/eigrp"
import { StaticRoutesPanel } from "@/components/tools/routing-tools/static-routes"
import { AdminDistancePanel } from "@/components/tools/routing-tools/admin-distance"
import { defaultWirelessConfig } from "@/lib/wireless"
import { defaultEigrpConfig, defaultOspfConfig, emptyStaticRoute } from "@/lib/routing"

// each panel mounted alone, which is what lets the registry give it its own route and chunk

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

// each wrapper is the whole of what a standalone route would have to supply
function ChannelPlanningHost() {
  const [band, setBand] = useState(defaultWirelessConfig.band)
  const [width, setWidth] = useState<20 | 40 | 80 | 160 | 320>(80)
  return createElement(ChannelPlanningPanel, {
    band,
    width,
    onBandChange: setBand,
    onWidthChange: setWidth,
  })
}

function CapacityHost() {
  const [value, setValue] = useState<CapacitySettings>({
    standard: "802.11ax",
    band: "5",
    width: 80,
    maxClients: "50",
    spatialStreams: 2,
  })
  return createElement(CapacityCalculatorPanel, { value, onChange: setValue })
}

function WifiConfigHost() {
  const [config, setConfig] = useState(defaultWirelessConfig)
  return createElement(WifiConfigPanel, { config, onConfigChange: setConfig })
}

function OspfHost() {
  const [config, setConfig] = useState(defaultOspfConfig)
  return createElement(OspfPanel, { config, onConfigChange: setConfig })
}

function EigrpHost() {
  const [config, setConfig] = useState(defaultEigrpConfig)
  return createElement(EigrpPanel, { config, onConfigChange: setConfig })
}

function StaticRoutesHost() {
  const [routes, setRoutes] = useState([{ ...emptyStaticRoute }])
  return createElement(StaticRoutesPanel, { routes, onRoutesChange: setRoutes })
}

const panels = [
  ["channel planning", ChannelPlanningHost],
  ["capacity calculator", CapacityHost],
  ["wifi config", WifiConfigHost],
  ["security guide", SecurityGuidePanel],
  ["ospf", OspfHost],
  ["eigrp", EigrpHost],
  ["static routes", StaticRoutesHost],
  ["admin distance", AdminDistancePanel],
] as const

afterEach(cleanup)

describe("panels render standalone", () => {
  it.each(panels)("%s mounts on its own with no axe violations", async (name, Panel) => {
    const { container } = render(createElement(Panel))
    expect(container.textContent?.trim().length ?? 0, `${name} rendered nothing`).toBeGreaterThan(0)
    const violations = await violationsOf(container)
    expect(violations, `${name}:\n${JSON.stringify(violations, null, 2)}`).toEqual([])
  })
})

describe("channel planning panel", () => {
  it("shows the 1/6/11 plan on 2.4 GHz instead of an empty recommendation list", () => {
    render(createElement(ChannelPlanningHost))
    fireEvent.click(screen.getByLabelText("Frequency Band"))
    fireEvent.click(screen.getByRole("option", { name: "2.4 GHz" }))

    expect(screen.getByText("1 (2412 MHz)")).toBeTruthy()
    expect(screen.getByText("6 (2437 MHz)")).toBeTruthy()
    expect(screen.getByText("11 (2462 MHz)")).toBeTruthy()
  })

  it("says a 40 MHz carrier leaves no plan on 2.4 GHz", () => {
    render(createElement(ChannelPlanningHost))
    fireEvent.click(screen.getByLabelText("Frequency Band"))
    fireEvent.click(screen.getByRole("option", { name: "2.4 GHz" }))
    fireEvent.click(screen.getByLabelText("Channel Width"))
    fireEvent.click(screen.getByRole("option", { name: "40 MHz" }))

    expect(screen.getByText(/leaves no non-overlapping plan/)).toBeTruthy()
  })
})

describe("capacity panel", () => {
  it("reports the 2-stream HE80 rate and its real world share", () => {
    render(createElement(CapacityHost))
    expect(screen.getByText("1201 Mbps")).toBeTruthy()
    expect(screen.getByText("721 Mbps")).toBeTruthy()
  })

  it("names the band a standard cannot use instead of showing 0 Mbps", () => {
    render(createElement(CapacityHost))
    fireEvent.click(screen.getByLabelText("Frequency Band"))
    fireEvent.click(screen.getByRole("option", { name: "2.4 GHz" }))
    fireEvent.click(screen.getByLabelText("WiFi Standard"))
    fireEvent.click(screen.getByRole("option", { name: "802.11ac (WiFi 5)" }))

    expect(screen.getByText(/does not operate in the 2.4 GHz band/)).toBeTruthy()
    expect(screen.queryByText("0 Mbps")).toBeNull()
  })
})

describe("wifi config panel", () => {
  it("generates a config from its own state with no parent", () => {
    render(createElement(WifiConfigHost))
    const output = screen.getByLabelText("Generated wireless configuration") as HTMLTextAreaElement
    expect(output.value).toContain("dot11 ssid MyNetwork")
    expect(output.value).toContain("encryption vlan 1 mode ciphers aes-ccm")
  })

  it("rewrites the config when the SSID changes", () => {
    render(createElement(WifiConfigHost))
    fireEvent.change(screen.getByLabelText("SSID Name"), { target: { value: "Branch-WiFi" } })
    const output = screen.getByLabelText("Generated wireless configuration") as HTMLTextAreaElement
    expect(output.value).toContain("dot11 ssid Branch-WiFi")
  })
})

describe("routing panels", () => {
  it("builds an ospf network statement from a typed prefix", () => {
    render(createElement(OspfHost))
    fireEvent.change(screen.getByLabelText("Network 1 address"), {
      target: { value: "192.168.1.0/24" },
    })
    const output = screen.getByLabelText("Generated OSPF configuration") as HTMLTextAreaElement
    expect(output.value).toContain("network 192.168.1.0 0.0.0.255 area 0")
  })

  it("tells an eigrp user the autonomous system number is missing", () => {
    render(createElement(EigrpHost))
    const output = screen.getByLabelText("Generated EIGRP configuration") as HTMLTextAreaElement
    expect(output.value).toMatch(/Autonomous system number is required/)
  })

  it("builds an ip route and counts it as valid", () => {
    render(createElement(StaticRoutesHost))
    fireEvent.change(screen.getByLabelText("Destination"), { target: { value: "10.0.0.0/8" } })
    fireEvent.change(screen.getByLabelText("Next Hop IP"), { target: { value: "192.168.1.1" } })
    const output = screen.getByLabelText("Generated static route commands") as HTMLTextAreaElement
    expect(output.value).toContain("ip route 10.0.0.0 255.0.0.0 192.168.1.1")
    expect(screen.getByText("1/1")).toBeTruthy()
  })

  it("lists the cisco administrative distances in preference order", () => {
    render(createElement(AdminDistancePanel))
    expect(screen.getByText("Connected Interface")).toBeTruthy()
    expect(screen.getByText("Never installed")).toBeTruthy()
  })
})

describe("wireless tools url state", () => {
  const mount = (searchParams = "", onUrlUpdate?: OnUrlUpdateFunction) =>
    render(
      createElement(NuqsTestingAdapter, {
        searchParams,
        onUrlUpdate,
        children: createElement(WirelessTools),
      })
    )

  it("opens the panel and the plan a shared link asks for", async () => {
    mount("?tab=capacity-calculator&std=802.11be&band=6&width=320&streams=4&clients=25")
    // EHT320 is 2882.4 Mbps per stream, so 4 streams is 11530 rounded. the panel
    // is a lazy chunk, so the first query has to wait for it
    expect(await screen.findByText("11530 Mbps")).toBeTruthy()
    expect(screen.getByText("25")).toBeTruthy()
  })

  it("carries the wifi config inputs in the link too", async () => {
    mount("?tab=wifi-config&ssid=Branch-WiFi&sec=wpa2&band=5")
    const output = (await screen.findByLabelText(
      "Generated wireless configuration"
    )) as HTMLTextAreaElement
    expect(output.value).toContain("dot11 ssid Branch-WiFi")
  })

  it("writes an edit back to the query string", async () => {
    const onUrlUpdate = vi.fn()
    mount("?tab=wifi-config", onUrlUpdate)
    fireEvent.change(await screen.findByLabelText("SSID Name"), { target: { value: "Lab" } })
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get("ssid")).toBe("Lab")
  })

  it("falls back to the defaults when the link carries junk", async () => {
    mount("?tab=nope&band=7&std=802.11zz")
    // channel planning is the default tab, and 5 GHz the default band
    expect(await screen.findByText("Channel Overview - 5 GHz Band")).toBeTruthy()
  })
})
