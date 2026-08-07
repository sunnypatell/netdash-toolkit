import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import axe from "axe-core"
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing"
import { AuthProvider } from "@/contexts/auth-context"
import { ProjectProvider } from "@/contexts/project-context"

// the split's two claims: a panel runs on props alone, and the shell fires nothing on arrival

function Providers({
  children,
  searchParams = "",
  onUrlUpdate,
}: {
  children: React.ReactNode
  searchParams?: string
  onUrlUpdate?: OnUrlUpdateFunction
}) {
  return (
    <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate}>
      <AuthProvider>
        <ProjectProvider>{children}</ProjectProvider>
      </AuthProvider>
    </NuqsTestingAdapter>
  )
}

const fetchSpy = vi.fn()

beforeEach(() => {
  fetchSpy.mockReset()
  fetchSpy.mockRejectedValue(new Error("no test may reach the network"))
  vi.stubGlobal("fetch", fetchSpy)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("panels render independently of their shell", () => {
  it("http-headers paste panel works from props alone", async () => {
    const { default: PastePanel } = await import("@/components/tools/http-headers/paste")
    const onAnalysis = vi.fn()
    render(
      <PastePanel target="https://example.com" hostLabel="example.com" onAnalysis={onAnalysis} />
    )

    expect(screen.getByText(/curl -sS -o \/dev\/null -D - -L https:\/\/example\.com/)).toBeTruthy()

    await userEvent.type(
      screen.getByLabelText(/raw response headers/i),
      "HTTP/2 200{enter}x-frame-options: DENY"
    )
    await userEvent.click(screen.getByRole("button", { name: /analyze pasted headers/i }))

    expect(onAnalysis).toHaveBeenCalledTimes(1)
    const analysis = onAnalysis.mock.calls[0][0]
    expect(analysis.source).toBe("pasted")
    expect(analysis.blocks[0].status).toBe(200)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("security-headers grade report renders a verdict from a block, with no shell", async () => {
    const { GradeReport } = await import("@/components/tools/security-headers/grade-report")
    const { parseResponseBlocks } = await import("@/lib/http-header-parse")
    render(
      <GradeReport
        input={{
          label: "example.com",
          source: "pasted",
          url: "https://example.com",
          blocks: parseResponseBlocks("HTTP/2 200\nstrict-transport-security: max-age=0"),
        }}
      />
    )
    // present but inert has to read differently from missing
    expect(await screen.findByText(/Sent, but does nothing/)).toBeTruthy()
    expect(screen.getByText(/max-age=0 signals the user agent/)).toBeTruthy()
  })

  it("port-scanner custom panel parses ranges and warns about blocked ports", async () => {
    const { default: CustomPortsPanel } = await import("@/components/tools/port-scanner/custom")
    const onScan = vi.fn()
    render(
      <CustomPortsPanel
        value="22,80,8000-8002"
        onValueChange={vi.fn()}
        disabled={false}
        browserMode
        onScan={onScan}
      />
    )
    expect(screen.getByText("5 ports selected")).toBeTruthy()
    expect(screen.getByText(/port blocking list/)).toBeTruthy()

    await userEvent.click(screen.getByRole("button", { name: /scan custom ports/i }))
    expect(onScan).toHaveBeenCalledWith([22, 80, 8000, 8001, 8002])
  })

  it("whois contacts panel finds a nested entity and names redactions", async () => {
    const { default: ContactsPanel } = await import("@/components/tools/whois-lookup/contacts")
    render(
      <ContactsPanel
        domain={{
          ldhName: "example.com",
          entities: [
            {
              handle: "REG",
              roles: ["registrar"],
              entities: [{ handle: "ABUSE", roles: ["abuse"] }],
            },
          ],
          redacted: [{ name: { description: "Registrant Name" } }],
        }}
      />
    )
    expect(screen.getByText("REG")).toBeTruthy()
    expect(screen.getByText("ABUSE")).toBeTruthy()
    expect(screen.getByText(/Registrant Name/)).toBeTruthy()
  })

  it("ping panel labels an https round trip as an https round trip", async () => {
    const { default: PingPanel } = await import("@/components/tools/ping-traceroute/ping")
    render(<PingPanel host="example.com" onHostChange={vi.fn()} isNative={false} />)
    expect(screen.getByText(/DNS, TCP handshake, TLS handshake/)).toBeTruthy()
    expect(screen.queryByText(/ICMP echo/)).toBeNull()
  })

  it("traceroute panel refuses to invent hops in a browser", async () => {
    const { default: TraceroutePanel } =
      await import("@/components/tools/ping-traceroute/traceroute")
    render(<TraceroutePanel host="example.com" onHostChange={vi.fn()} isNative={false} />)
    await userEvent.click(screen.getByRole("button", { name: /traceroute/i }))
    expect(await screen.findByText(/Nothing was sent/)).toBeTruthy()
    expect(screen.queryByText(/^Route to/)).toBeNull()
  })
})

describe("shells put inputs in the url and nothing on the wire", () => {
  it("security-headers honours a shared link and does not scan on arrival", async () => {
    const { SecurityHeaders } = await import("@/components/tools/security-headers")
    render(
      <Providers searchParams="?tab=relay&url=https%3A%2F%2Fexample.com">
        <SecurityHeaders />
      </Providers>
    )
    expect(await screen.findByRole("button", { name: /fetch headers via relay/i })).toBeTruthy()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("port-scanner writes its host back to the query string", async () => {
    const { PortScanner } = await import("@/components/tools/port-scanner")
    const onUrlUpdate = vi.fn()
    render(
      <Providers searchParams="?host=example.com" onUrlUpdate={onUrlUpdate}>
        <PortScanner />
      </Providers>
    )
    await userEvent.type(screen.getByLabelText(/target host/i), "x")
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get("host")).toBe("example.comx")
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("whois opens on the tab a link names once a result exists", async () => {
    const { WhoisLookup } = await import("@/components/tools/whois-lookup")
    render(
      <Providers searchParams="?q=example.com&tab=nameservers">
        <WhoisLookup />
      </Providers>
    )
    expect((screen.getByLabelText(/query/i) as HTMLInputElement).value).toBe("example.com")
    // a shared link must not trigger a third-party rdap request by itself
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("keeps the lazily loaded panels free of axe violations", async () => {
    const { HTTPHeaders } = await import("@/components/tools/http-headers")
    const { container } = render(
      <Providers searchParams="?tab=relay">
        <HTTPHeaders />
      </Providers>
    )
    await screen.findByRole("button", { name: /fetch headers via relay/i })
    const results = await axe.run(container, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
      },
      rules: { "color-contrast": { enabled: false } },
    })
    expect(results.violations.map((v) => v.id)).toEqual([])
  })
})
