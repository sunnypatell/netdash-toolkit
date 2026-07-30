import { describe, expect, it, vi } from "vitest"
import { BLOCKED_PORT_SERVICES, isBlockedPort } from "@/lib/browser-limits"
import {
  MAX_PORTS_PER_SCAN,
  parsePortList,
  probePortOverHttp,
  serviceNameFor,
  summarizeStates,
} from "@/lib/port-probe"

// no socket is opened anywhere in here: the transport is injected

describe("parsePortList", () => {
  it("accepts a flat list", () => {
    expect(parsePortList("80,443, 22").ports).toEqual([22, 80, 443])
  })

  it("accepts ranges, which the ui has advertised all along", () => {
    expect(parsePortList("8000-8004").ports).toEqual([8000, 8001, 8002, 8003, 8004])
    expect(parsePortList("80,8000-8002,443").ports).toEqual([80, 443, 8000, 8001, 8002])
  })

  it("de-duplicates overlapping input", () => {
    expect(parsePortList("80,80,79-81").ports).toEqual([79, 80, 81])
  })

  it("reports what it rejected instead of dropping it silently", () => {
    const parsed = parsePortList("80,0,70000,abc,90-80")
    expect(parsed.ports).toEqual([80])
    expect(parsed.errors).toHaveLength(4)
    expect(parsed.errors.join(" ")).toMatch(/ends before it starts/)
  })

  it("caps a scan and says it capped it", () => {
    const parsed = parsePortList("1-2000")
    expect(parsed.ports).toHaveLength(MAX_PORTS_PER_SCAN)
    expect(parsed.errors.join(" ")).toMatch(/only the first/)
  })

  it("ignores empty segments", () => {
    expect(parsePortList("80,,443,").ports).toEqual([80, 443])
    expect(parsePortList("").ports).toEqual([])
  })
})

describe("browser port blocking", () => {
  it("knows the fetch standard blocks the classic service ports", () => {
    for (const port of [21, 22, 23, 25, 53, 110, 143, 993, 995]) {
      expect(isBlockedPort(port), `${port} should be blocked`).toBe(true)
    }
  })

  it("does not block the ports a browser can actually reach", () => {
    for (const port of [80, 443, 3306, 3389, 5432, 8080, 27017]) {
      expect(isBlockedPort(port), `${port} should not be blocked`).toBe(false)
    }
  })

  it("names the service behind each blocked port", () => {
    expect(BLOCKED_PORT_SERVICES[22]).toBe("ssh")
    expect(serviceNameFor(6667)).toBe("ircu")
  })
})

describe("probePortOverHttp", () => {
  it("reports a blocked port as unmeasurable without sending anything", async () => {
    const transport = vi.fn()
    const result = await probePortOverHttp("example.com", 22, { transport, scheme: "https" })
    expect(transport).not.toHaveBeenCalled()
    expect(result.state).toBe("browser-blocked")
    expect(result.detail).toMatch(/port blocking list/)
  })

  it("reports open only when the request actually completed", async () => {
    let ticks = 0
    const result = await probePortOverHttp("example.com", 443, {
      transport: async () => undefined,
      scheme: "https",
      now: () => (ticks += 5),
    })
    expect(result.state).toBe("open")
    expect(result.responseTime).toBe(5)
    expect(result.detail).toMatch(/opaque/)
  })

  it("reports unknown, never closed, when the probe fails", async () => {
    const result = await probePortOverHttp("example.com", 8080, {
      transport: async () => {
        throw new TypeError("Failed to fetch")
      },
      scheme: "https",
    })
    expect(result.state).toBe("unknown")
    expect(result.detail).toMatch(/undeterminable/)
  })

  it("probes over the scheme it was given", async () => {
    const seen: string[] = []
    await probePortOverHttp("example.com", 8080, {
      transport: async (url) => void seen.push(url),
      scheme: "https",
    })
    expect(seen).toEqual(["https://example.com:8080"])
  })
})

describe("summarizeStates", () => {
  it("counts every state, including the browser-blocked ones", async () => {
    const results = await Promise.all(
      [22, 443, 8080].map((port) =>
        probePortOverHttp("example.com", port, {
          transport: async (url) => {
            if (url.endsWith("8080")) throw new Error("nope")
          },
          scheme: "https",
        })
      )
    )
    expect(summarizeStates(results)).toEqual({
      open: 1,
      closed: 0,
      filtered: 0,
      unknown: 1,
      "browser-blocked": 1,
    })
  })
})
