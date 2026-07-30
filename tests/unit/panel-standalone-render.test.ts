// @vitest-environment happy-dom
import { createElement, type ReactElement } from "react"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import axe from "axe-core"
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing"
import { AuthProvider } from "@/contexts/auth-context"
import { ProjectProvider } from "@/contexts/project-context"

import TransferTimePanel from "@/components/tools/bandwidth-calculator/transfer-time"
import DownloadSizePanel from "@/components/tools/bandwidth-calculator/download-size"
import SpeedConverterPanel from "@/components/tools/bandwidth-calculator/converter"
import FiberPanel from "@/components/tools/cable-calculator/fiber"
import CopperPanel from "@/components/tools/cable-calculator/copper"
import CommonCIDRs from "@/components/tools/cidr-reference/common"
import AllCIDRs from "@/components/tools/cidr-reference/all"
import IPv6AddressTypes from "@/components/tools/ipv6-reference/types"
import IPv6SpecialAddresses from "@/components/tools/ipv6-reference/special"
import IPv6FormatRules from "@/components/tools/ipv6-reference/format"
import IPv6Calculator from "@/components/tools/ipv6-tools/calculator"
import IPv6ToolsReference from "@/components/tools/ipv6-tools/reference"
import ConflictInputPanel from "@/components/tools/conflict-checker/input"
import ConflictAnalysisPanel from "@/components/tools/conflict-checker/analysis"
import ConflictRemediationPanel from "@/components/tools/conflict-checker/remediation"
import { IPConverter } from "@/components/tools/ip-converter"
import { IPEnumerator } from "@/components/tools/ip-enumerator"

// each of these tools used to hide two or three panels behind a tab strip, so
// the tool level suites in tests/components only ever exercised the default tab.
// these mount every panel on its own, with no shell handing it state, and assert
// the value it derives from the query string.

vi.mock("@/lib/firebase", () => ({
  isFirebaseConfigured: () => false,
  auth: null,
  db: null,
  googleProvider: null,
}))

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

function mount(element: ReactElement, searchParams = "", onUrlUpdate?: OnUrlUpdateFunction) {
  return render(
    createElement(NuqsTestingAdapter, {
      searchParams,
      onUrlUpdate,
      children: createElement(AuthProvider, {
        children: createElement(ProjectProvider, { children: element }),
      }),
    })
  )
}

async function violationsOf(container: HTMLElement) {
  const results = await axe.run(container, AXE_OPTIONS)
  return results.violations.map((violation) => ({
    id: violation.id,
    nodes: violation.nodes.slice(0, 3).map((node) => node.html.slice(0, 160)),
  }))
}

const panels = [
  ["transfer time", () => createElement(TransferTimePanel)],
  ["download size", () => createElement(DownloadSizePanel)],
  ["speed converter", () => createElement(SpeedConverterPanel)],
  ["fiber", () => createElement(FiberPanel)],
  ["copper", () => createElement(CopperPanel)],
  ["common cidrs", () => createElement(CommonCIDRs)],
  ["all cidrs", () => createElement(AllCIDRs)],
  ["ipv6 address types", () => createElement(IPv6AddressTypes)],
  ["ipv6 special addresses", () => createElement(IPv6SpecialAddresses)],
  ["ipv6 format rules", () => createElement(IPv6FormatRules)],
  ["ipv6 calculator", () => createElement(IPv6Calculator)],
  ["ipv6 tools reference", () => createElement(IPv6ToolsReference)],
  [
    "conflict input",
    () => createElement(ConflictInputPanel, { analysis: null, onDataParsed() {} }),
  ],
  ["conflict analysis", () => createElement(ConflictAnalysisPanel, { analysis: null })],
  ["conflict remediation", () => createElement(ConflictRemediationPanel, { analysis: null })],
] as const

afterEach(cleanup)

describe("panels render standalone", () => {
  it.each(panels)("%s mounts on its own with no axe violations", async (name, element) => {
    const { container } = mount(element())
    expect(container.textContent?.trim().length ?? 0, `${name} rendered nothing`).toBeGreaterThan(0)
    const violations = await violationsOf(container)
    expect(violations, `${name}:\n${JSON.stringify(violations, null, 2)}`).toEqual([])
  })

  it.each(panels.filter(([name]) => !name.startsWith("conflict")))(
    "%s renders its own heading, so it works at its own url",
    (_name, element) => {
      mount(element())
      expect(screen.getAllByRole("heading").length).toBeGreaterThan(0)
    }
  )
})

describe("no panel keeps a calculate button, because nothing needs a trigger", () => {
  it.each(panels)("%s", (_name, element) => {
    mount(element())
    expect(screen.queryByRole("button", { name: /^calculate/i })).toBeNull()
  })
})

describe("results arrive from the query string", () => {
  it("transfer time computes with no interaction at all", () => {
    mount(createElement(TransferTimePanel))
    // 1 GB over 100 Mbit/s with 10% overhead is 88.9 s
    expect(screen.getByText("1m 28s")).toBeTruthy()
  })

  it("does not confuse GB with GiB", () => {
    mount(createElement(TransferTimePanel), "?size=1&sizeUnit=GB&speed=1&speedUnit=Gbps&overhead=0")
    expect(screen.getByText("8s")).toBeTruthy()
    cleanup()

    mount(
      createElement(TransferTimePanel),
      "?size=1&sizeUnit=GiB&speed=1&speedUnit=Gbps&overhead=0"
    )
    // 1 GiB is 1073741824 bytes, so it takes 8.59 s not 8 s
    expect(screen.getByText("8.59s")).toBeTruthy()
  })

  it("refuses to show a stale answer beside unusable input", async () => {
    mount(
      createElement(TransferTimePanel),
      "?size=1&sizeUnit=GB&speed=100&speedUnit=Mbps&overhead=0"
    )
    expect(screen.getByText("1m 20s")).toBeTruthy()

    const speed = screen.getByLabelText("Line Rate", { selector: "input" })
    await userEvent.clear(speed)

    await waitFor(() => expect(screen.queryByText("1m 20s")).toBeNull())
  })

  it("download size reports both unit ladders", () => {
    mount(createElement(DownloadSizePanel))
    // 100 Mbit/s for an hour is 45e9 bytes, which is 41.91 GiB
    expect(screen.getByText("45.00 GB")).toBeTruthy()
    expect(screen.getByText("41.91 GiB")).toBeTruthy()
  })

  it("the converter is exact at 100 Mbit/s", () => {
    mount(createElement(SpeedConverterPanel))
    expect(screen.getByText("100,000,000")).toBeTruthy()
    expect(screen.getByText("12.5")).toBeTruthy()
  })

  it("fiber loss follows the link", () => {
    mount(createElement(FiberPanel))
    // os2 at 1310 nm is 0.4 dB/km, so 500 m is 0.2 dB plus 2 x 0.75 dB connectors
    expect(screen.getByText("1.7 dB")).toBeTruthy()
    expect(screen.getByText("8.3 dB")).toBeTruthy()
    cleanup()

    mount(createElement(FiberPanel), "?grade=om3&wavelength=850&length=350&lengthUnit=m")
    expect(screen.getByText(/10GBASE-SR is specified only to 300 m/)).toBeTruthy()
  })

  it("copper limits follow the category", () => {
    mount(createElement(CopperPanel), "?category=cat5e&permanentLink=90&patchCord=10")
    // 2.5GBASE-T reaches 100 m on cat5e per ieee 802.3 clause 126
    expect(screen.getByText("2.5GBASE-T")).toBeTruthy()
    expect(screen.getByText(/does not support 10GBASE-T at any length/)).toBeTruthy()
    cleanup()

    mount(createElement(CopperPanel), "?category=cat6&permanentLink=90&patchCord=10")
    expect(screen.getByText(/10GBASE-T is specified only to 55 m/)).toBeTruthy()
  })

  it("ipv6 derivations follow the address", () => {
    mount(createElement(IPv6Calculator))
    expect(screen.getByText("2001:0db8:0000:0000:0000:0000:0000:0001")).toBeTruthy()
    // rfc 5952 4.1: no leading zeros, so not ff02::1:ff00:0001
    expect(screen.getByText("ff02::1:ff00:1")).toBeTruthy()
    expect(screen.queryByText("ff02::1:ff00:0001")).toBeNull()
    expect(screen.getByText("2001:db8::211:22ff:fe33:4455")).toBeTruthy()
    expect(screen.getByText("fe80::211:22ff:fe33:4455")).toBeTruthy()
    cleanup()

    mount(createElement(IPv6Calculator), "?ip6=fe80%3A%3A1")
    expect(screen.getByText("Link-Local Unicast")).toBeTruthy()
  })

  it("clears the ipv6 result when the address stops being valid", async () => {
    mount(createElement(IPv6Calculator))
    expect(screen.getByText("ff02::1:ff00:1")).toBeTruthy()

    const address = screen.getByLabelText(/ipv6 address/i)
    await userEvent.clear(address)
    await userEvent.type(address, "not-an-address")

    await waitFor(() => expect(screen.queryByText("ff02::1:ff00:1")).toBeNull())
    expect(screen.getByText(/invalid ipv6 address/i)).toBeTruthy()
  })

  it("cidr tables print masks that match their own prefix", () => {
    mount(createElement(CommonCIDRs))
    expect(screen.getByText("255.255.255.192")).toBeTruthy()
    expect(screen.getByText("0.0.0.63")).toBeTruthy()
  })

  it("the ip converter round-trips a high address from a link", () => {
    // 3232235777 is above the signed 32-bit ceiling, so a `<<` would wrap it
    mount(createElement(IPConverter), "?format=decimal&value=3232235777")
    expect(screen.getAllByText("192.168.1.1").length).toBeGreaterThan(0)
    expect(screen.getAllByText("0xC0A80101").length).toBeGreaterThan(0)
    expect(screen.getAllByText("0o30052000401").length).toBeGreaterThan(0)
    cleanup()

    mount(createElement(IPConverter), "?format=hex&value=0xFFFFFFFF")
    expect(screen.getByText("255.255.255.255")).toBeTruthy()
    expect(screen.getByText("4294967295")).toBeTruthy()
  })

  it("the enumerator handles a /31 as a point-to-point link", () => {
    mount(createElement(IPEnumerator), "?cidr=192.0.2.10%2F31")
    expect(screen.getAllByText(/RFC 3021/).length).toBeGreaterThan(0)
    expect(screen.getAllByText("192.0.2.10").length).toBeGreaterThan(0)
    expect(screen.getAllByText("192.0.2.11").length).toBeGreaterThan(0)
    // neither address is reserved, so the include toggles cannot apply
    expect(screen.getByLabelText(/include network address/i)).toHaveProperty("disabled", true)
  })

  it("the enumerator excludes network and broadcast on a /28 by default", () => {
    mount(createElement(IPEnumerator), "?cidr=192.168.1.0%2F28")
    const items = screen.getAllByRole("listitem").map((node) => node.textContent?.trim())
    expect(items).toHaveLength(14)
    expect(items[0]).toContain("192.168.1.1")
    expect(items.some((text) => text?.startsWith("192.168.1.0"))).toBe(false)
  })
})

describe("edits are written back to the query string", () => {
  it("transfer time writes the file size", async () => {
    const onUrlUpdate = vi.fn()
    mount(createElement(TransferTimePanel), "?size=1&sizeUnit=GB", onUrlUpdate)

    const size = screen.getByLabelText("File Size", { selector: "input" })
    await userEvent.clear(size)
    await userEvent.type(size, "5")

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get("size")).toBe("5")
  })

  it("fiber writes the cable length", async () => {
    const onUrlUpdate = vi.fn()
    mount(createElement(FiberPanel), "?length=500&lengthUnit=m", onUrlUpdate)

    const length = screen.getByLabelText("Cable Length", { selector: "input" })
    await userEvent.clear(length)
    await userEvent.type(length, "800")

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get("length")).toBe("800")
  })

  it("the ipv6 calculator writes the address", async () => {
    const onUrlUpdate = vi.fn()
    mount(createElement(IPv6Calculator), "?ip6=2001%3Adb8%3A%3A1", onUrlUpdate)

    const address = screen.getByLabelText(/ipv6 address/i)
    await userEvent.clear(address)
    await userEvent.type(address, "fe80::1")

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get("ip6")).toBe("fe80::1")
  })

  it("the enumerator writes the cidr", async () => {
    const onUrlUpdate = vi.fn()
    mount(createElement(IPEnumerator), "?cidr=192.168.1.0%2F28", onUrlUpdate)

    const cidr = screen.getByLabelText(/network cidr/i)
    await userEvent.clear(cidr)
    await userEvent.type(cidr, "10.0.0.0/30")

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get("cidr")).toBe("10.0.0.0/30")
  })
})
