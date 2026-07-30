import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing"
import { AuthProvider } from "@/contexts/auth-context"
import { ProjectProvider } from "@/contexts/project-context"
import { SubnetCalculator } from "@/components/tools/subnet-calculator"

// tool inputs live in the query string so a result is a shareable link. these
// tests cover the two halves of that claim: a link with params produces the
// right answer on arrival, and editing an input rewrites the link.

function mount(searchParams = "", onUrlUpdate?: OnUrlUpdateFunction) {
  return render(
    <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate}>
      <AuthProvider>
        <ProjectProvider>
          <SubnetCalculator />
        </ProjectProvider>
      </AuthProvider>
    </NuqsTestingAdapter>
  )
}

afterEach(cleanup)

describe("subnet calculator url state", () => {
  it("computes on arrival with no interaction at all", async () => {
    mount()
    // the defaults are 192.168.1.1/24, so the network and broadcast follow
    expect(await screen.findByText("192.168.1.0")).toBeTruthy()
    expect(screen.getByText("192.168.1.255")).toBeTruthy()
    expect(screen.getByText("255.255.255.0")).toBeTruthy()
  })

  it("has no Calculate button, because there is nothing for it to do", () => {
    mount()
    expect(screen.queryByRole("button", { name: /^calculate$/i })).toBeNull()
  })

  it("honours a shared link's parameters", async () => {
    mount("?ip=10.20.30.40&prefix=22")
    expect(await screen.findByText("10.20.28.0")).toBeTruthy()
    expect(screen.getByText("10.20.31.255")).toBeTruthy()
    expect(screen.getByText("255.255.252.0")).toBeTruthy()
  })

  it("opens on the ipv6 tab and computes it when the link says so", async () => {
    mount("?tab=ipv6&ip6=2001%3Adb8%3A%3A1&prefix6=48")
    // rfc 5952 compressed form of the /48 network
    expect(await screen.findByText("2001:db8::")).toBeTruthy()
  })

  it("writes edits back to the query string", async () => {
    const onUrlUpdate = vi.fn()
    mount("?ip=192.168.1.1&prefix=24", onUrlUpdate)

    const prefix = screen.getByLabelText(/prefix length/i)
    await userEvent.clear(prefix)
    await userEvent.type(prefix, "30")

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
    const last = onUrlUpdate.mock.calls.at(-1)?.[0]
    expect(last.searchParams.get("prefix")).toBe("30")
  })

  it("recomputes from a bad input to a good one without a stale result", async () => {
    mount("?ip=192.168.1.1&prefix=24")
    expect(await screen.findByText("192.168.1.0")).toBeTruthy()

    const address = screen.getByLabelText(/^ip address$/i)
    await userEvent.clear(address)
    await userEvent.type(address, "not-an-ip")

    // the old answer must not linger next to invalid input
    await waitFor(() => expect(screen.queryByText("192.168.1.0")).toBeNull())
    expect(screen.getByText(/invalid ipv4 address/i)).toBeTruthy()
  })
})
