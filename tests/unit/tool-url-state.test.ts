// @vitest-environment happy-dom
import { createElement, useState, type ReactElement } from "react"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import axe from "axe-core"
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing"
import { AuthProvider } from "@/contexts/auth-context"
import { ProjectProvider } from "@/contexts/project-context"
import { DataUnitConverter } from "@/components/tools/data-unit-converter"
import { UptimeCalculator } from "@/components/tools/uptime-calculator"
import { CronParser } from "@/components/tools/cron-parser"
import { TimestampConverter } from "@/components/tools/timestamp-converter"
import { LoremGenerator } from "@/components/tools/lorem-generator"
import { PasswordGenerator } from "@/components/tools/password-generator"
import { WifiQRGenerator } from "@/components/tools/wifi-qr-generator"
import { RandomGenerator } from "@/components/tools/random-generator"
import { OUILookup } from "@/components/tools/oui-lookup"
import { Ipv4Panel } from "@/components/tools/random-generator/ipv4"
import { MacPanel } from "@/components/tools/random-generator/mac"
import { Ipv6Panel } from "@/components/tools/random-generator/ipv6"
import { SingleLookupPanel } from "@/components/tools/oui-lookup/single"
import { BulkLookupPanel } from "@/components/tools/oui-lookup/bulk"
import { ResultsPanel } from "@/components/tools/oui-lookup/results"
import type { IPv4Kind, IPv6Kind, MacFormat, MacScope } from "@/lib/random-gen"

// two claims are under test here. first, tool inputs live in the query string,
// so a link reproduces a result and no Convert button is needed. second, the
// exceptions: a generated secret or random value must never reach the url.
// random-generator and oui-lookup are now directories of panels, so each panel
// also gets mounted alone, with no parent, to prove it runs on props only.

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

const AXE_OPTIONS: axe.RunOptions = {
  runOnly: {
    type: "tag",
    values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
  },
  // no layout engine here, so contrast is asserted from tokens elsewhere
  rules: { "color-contrast": { enabled: false } },
}

async function violationsOf(container: HTMLElement) {
  const results = await axe.run(container, AXE_OPTIONS)
  return results.violations.map((v) => ({
    id: v.id,
    nodes: v.nodes.slice(0, 3).map((n) => n.html.slice(0, 160)),
  }))
}

function mount(
  Tool: () => ReactElement | null,
  searchParams = "",
  onUrlUpdate?: OnUrlUpdateFunction
) {
  // children go in the props object: createElement's variadic form does not
  // satisfy a component whose props type requires children
  return render(
    createElement(NuqsTestingAdapter, {
      searchParams,
      onUrlUpdate,
      children: createElement(AuthProvider, {
        children: createElement(ProjectProvider, { children: createElement(Tool) }),
      }),
    })
  )
}

/** every value any url update carried, so a secret leak cannot hide in one call */
function allUrlValues(onUrlUpdate: ReturnType<typeof vi.fn>): string[] {
  return onUrlUpdate.mock.calls.flatMap((call) => [...call[0].searchParams.values()] as string[])
}

afterEach(cleanup)

describe("results arrive from the link, with no Convert button", () => {
  it("data unit converter computes 1 GB on arrival", () => {
    mount(DataUnitConverter, "?value=1&unit=GB")
    // 1 GB = 1000 MB decimal, 953.674316 MiB binary: distinct figures
    expect(screen.getByText("1,000")).toBeTruthy()
    expect(screen.getByText("953.674316")).toBeTruthy()
    expect(screen.queryByRole("button", { name: /^convert$/i })).toBeNull()
  })

  it("uptime calculator computes four nines per year on arrival", () => {
    mount(UptimeCalculator, "?uptime=99.99&period=year")
    expect(screen.getAllByText("52m 34s").length).toBeGreaterThan(0)
    // once in the level badge, once in the reference table row
    expect(screen.getAllByText("Four Nines").length).toBe(2)
    expect(screen.queryByRole("button", { name: /^calculate$/i })).toBeNull()
  })

  it("cron parser describes and projects from the link", async () => {
    mount(CronParser, "?cron=0+0+1+*+*&tz=UTC")
    expect(screen.getByText(/day 1 of the month/i)).toBeTruthy()
    await waitFor(() => expect(screen.getByText("Next")).toBeTruthy())
    expect(screen.queryByRole("button", { name: /^parse$/i })).toBeNull()
  })

  it("timestamp converter resolves the unix epoch from the link", () => {
    mount(TimestampConverter, "?ts=0&tz=UTC")
    expect(screen.getByText("1970-01-01T00:00:00.000Z")).toBeTruthy()
    expect(screen.queryByRole("button", { name: /^convert$/i })).toBeNull()
  })

  it("oui lookup reads the prefix out of the link with no request", async () => {
    mount(OUILookup, "?mac=00%3A0C%3A29%3A11%3A22%3A33")
    // the panel is a lazy chunk, so the first query has to wait for it
    expect(await screen.findByText(/Full MAC - prefix 00:0C:29/)).toBeTruthy()
    expect(screen.getByText(/Answered from the bundled database/)).toBeTruthy()
  })

  it("writes an edit back to the query string", async () => {
    const onUrlUpdate = vi.fn()
    mount(DataUnitConverter, "?value=1&unit=GB", onUrlUpdate)
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "2" } })
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get("value")).toBe("2")
  })

  it("does not leave a stale figure next to invalid input", () => {
    mount(DataUnitConverter, "?value=-5&unit=GB")
    expect(screen.queryByText("1,000")).toBeNull()
    expect(screen.getByText(/Enter a value of zero or more/)).toBeTruthy()
  })
})

describe("the active tab is in the url", () => {
  it("opens random generator on the MAC panel", async () => {
    mount(RandomGenerator, "?tab=mac&macFormat=dot")
    expect(await screen.findByText("Random MAC addresses")).toBeTruthy()
    expect(screen.queryByText("Random IPv4 addresses")).toBeNull()
  })

  it("opens oui lookup on the bulk panel", async () => {
    mount(OUILookup, "?tab=bulk")
    expect(await screen.findByLabelText("MAC addresses")).toBeTruthy()
    expect(screen.queryByLabelText("MAC address or OUI")).toBeNull()
  })

  it("opens lorem generator on the words panel and honours the count", () => {
    mount(LoremGenerator, "?mode=words&count=5")
    expect(screen.getByText("Words to generate")).toBeTruthy()
    expect(screen.getByText("5")).toBeTruthy()
  })
})

describe("generated values never reach the url", () => {
  it("keeps a generated password out of every url update", async () => {
    const onUrlUpdate = vi.fn()
    mount(PasswordGenerator, "?length=24", onUrlUpdate)

    fireEvent.click(screen.getByRole("button", { name: /generate password/i }))
    const field = screen.getByLabelText("Generated password") as HTMLInputElement
    await waitFor(() => expect(field.value.length).toBe(24))
    const password = field.value

    // the options are shareable, the secret is not
    for (const value of allUrlValues(onUrlUpdate)) expect(value).not.toContain(password)
    expect(window.location.search).not.toContain(password)
  })

  it("puts password options in the url but needs an explicit Generate", () => {
    mount(PasswordGenerator, "?length=32&symbols=false")
    expect(screen.getByText(/32 characters drawn from/)).toBeTruthy()
    const field = screen.getByLabelText("Generated password") as HTMLInputElement
    // nothing is generated on arrival: a link cannot promise the same secret twice
    expect(field.value).toBe("")
    expect(screen.getByRole("button", { name: /generate password/i })).toBeTruthy()
  })

  it("keeps a wifi passphrase out of every url update", async () => {
    const onUrlUpdate = vi.fn()
    mount(WifiQRGenerator, "?ssid=Lab-Net", onUrlUpdate)

    fireEvent.change(screen.getByLabelText("Passphrase"), {
      target: { value: "not-a-real-passphrase" },
    })
    fireEvent.change(screen.getByLabelText("Network Name (SSID)"), { target: { value: "Lab-2" } })

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
    const values = allUrlValues(onUrlUpdate)
    expect(values.some((v) => v.includes("Lab-2"))).toBe(true)
    for (const value of values) expect(value).not.toContain("not-a-real-passphrase")
  })

  it("keeps generated lorem text out of the url and honours the exact count", async () => {
    const onUrlUpdate = vi.fn()
    mount(LoremGenerator, "?mode=words&count=7&classic=true", onUrlUpdate)

    fireEvent.click(screen.getByRole("button", { name: /^generate$/i }))
    await waitFor(() => expect(screen.getByText(/7 words/)).toBeTruthy())
    for (const value of allUrlValues(onUrlUpdate)) expect(value.split(/\s+/).length).toBeLessThan(7)
  })

  it("keeps generated addresses out of the url", async () => {
    const onUrlUpdate = vi.fn()
    mount(RandomGenerator, "?tab=ipv4&ip4=private-c&count=5", onUrlUpdate)

    fireEvent.click(await screen.findByRole("button", { name: /generate ipv4 addresses/i }))
    await waitFor(() => expect(screen.getByText(/5 IPv4 addresses generated/)).toBeTruthy())

    const addresses = screen
      .getAllByText(/^192\.168\.\d+\.\d+$/)
      .map((node) => node.textContent ?? "")
    expect(addresses.length).toBe(5)
    for (const value of allUrlValues(onUrlUpdate)) {
      for (const address of addresses) expect(value).not.toContain(address)
    }
  })
})

// each host supplies exactly what a standalone route would have to
function Ipv4Host() {
  const [kind, setKind] = useState<IPv4Kind>("public")
  const [count, setCount] = useState(3)
  const [values, setValues] = useState<string[]>([])
  return createElement(Ipv4Panel, {
    kind,
    count,
    values,
    onKindChange: setKind,
    onCountChange: setCount,
    onGenerate: () => setValues(Array.from({ length: count }, () => "203.0.113.9")),
    onExport: () => undefined,
    onClear: () => setValues([]),
  })
}

function MacHost() {
  const [scope, setScope] = useState<MacScope>("unicast-local")
  const [format, setFormat] = useState<MacFormat>("colon")
  const [uppercase, setUppercase] = useState(true)
  return createElement(MacPanel, {
    scope,
    format,
    uppercase,
    count: 2,
    values: ["02:00:00:11:22:33"],
    onScopeChange: setScope,
    onFormatChange: setFormat,
    onUppercaseChange: setUppercase,
    onCountChange: () => undefined,
    onGenerate: () => undefined,
    onExport: () => undefined,
    onClear: () => undefined,
  })
}

function Ipv6Host() {
  const [kind, setKind] = useState<IPv6Kind>("global")
  return createElement(Ipv6Panel, {
    kind,
    count: 4,
    values: [],
    onKindChange: setKind,
    onCountChange: () => undefined,
    onGenerate: () => undefined,
    onExport: () => undefined,
    onClear: () => undefined,
  })
}

function SingleHost() {
  const [value, setValue] = useState("00:50:56:aa:bb:cc")
  return createElement(SingleLookupPanel, {
    value,
    busy: false,
    willGoRemote: false,
    onChange: setValue,
    onLookup: () => undefined,
  })
}

function BulkHost() {
  const [value, setValue] = useState("00:50:56:aa:bb:cc\n08:00:27:11:22:33")
  return createElement(BulkLookupPanel, {
    value,
    busy: false,
    progress: null,
    offlineOnly: false,
    cached: () => false,
    onChange: setValue,
    onLookup: () => undefined,
  })
}

function ResultsHost() {
  return createElement(ResultsPanel, {
    rows: [
      {
        input: "00:50:56:aa:bb:cc",
        mac: "00:50:56:aa:bb:cc",
        oui: "005056",
        ouiFormatted: "00:50:56",
        vendor: "VMware",
        found: true,
        source: "offline" as const,
        locallyAdministered: false,
        multicast: false,
        timestamp: 0,
      },
    ],
    onExportJson: () => undefined,
    onExportCsv: () => undefined,
  })
}

const panels = [
  ["random ipv4", Ipv4Host],
  ["random mac", MacHost],
  ["random ipv6", Ipv6Host],
  ["oui single", SingleHost],
  ["oui bulk", BulkHost],
  ["oui results", ResultsHost],
] as const

describe("split panels render standalone", () => {
  it.each(panels)("%s mounts alone with no axe violations", async (name, Panel) => {
    const { container } = render(createElement(Panel))
    expect(container.textContent?.trim().length ?? 0, `${name} rendered nothing`).toBeGreaterThan(0)
    const violations = await violationsOf(container)
    expect(violations, `${name}:\n${JSON.stringify(violations, null, 2)}`).toEqual([])
  })

  it("drives the ipv4 panel from its props alone, with no tool around it", () => {
    render(createElement(Ipv4Host))
    fireEvent.click(screen.getByRole("button", { name: /generate ipv4 addresses/i }))
    expect(screen.getByText(/3 IPv4 addresses generated/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: /clear/i }))
    expect(screen.getByText(/Press Generate to draw new values/)).toBeTruthy()
  })

  it("plans the bulk lookup from the pasted lines alone", () => {
    render(createElement(BulkHost))
    expect(screen.getByText(/2 lines, 2 unique prefixes/)).toBeTruthy()
    expect(screen.getByText(/all answered offline, instantly/)).toBeTruthy()
  })

  it("renders a result row without the tool that fetched it", () => {
    render(createElement(ResultsHost))
    // once as the vendor of the row, once in the distribution summary
    expect(screen.getAllByText("VMware").length).toBe(2)
    expect(screen.getByText("Bundled database")).toBeTruthy()
  })
})
