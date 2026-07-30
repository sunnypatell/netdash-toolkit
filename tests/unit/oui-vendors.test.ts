import { describe, expect, it, vi } from "vitest"
import {
  dedupeByOui,
  lookupLocal,
  lookupOui,
  lookupRemote,
  macFlags,
  parseMacInput,
  OUI_PREFIX_COUNT,
  OUI_VENDORS,
  OUI_VENDOR_COUNT,
  type FetchLike,
} from "@/lib/oui-vendors"

// typed as FetchLike so vi.fn records the (url, init) tuple; a zero-arg
// implementation makes mock.calls a zero-length tuple and unindexable
const notFound: FetchLike = () =>
  Promise.resolve(
    new Response(JSON.stringify({ success: true, found: false }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  )

describe("input normalization happens before the prefix is taken", () => {
  it("handles an unseparated MAC", () => {
    const parsed = parseMacInput("001122334455")
    expect(parsed?.oui).toBe("001122")
    expect(parsed?.ouiFormatted).toBe("00:11:22")
    expect(parsed?.mac).toBe("00:11:22:33:44:55")
  })

  it("handles colon, dash, cisco-dotted and hp forms identically", () => {
    for (const input of [
      "00:11:22:33:44:55",
      "00-11-22-33-44-55",
      "0011.2233.4455",
      "001122-334455",
      "001122334455",
    ]) {
      expect(parseMacInput(input)?.oui, input).toBe("001122")
    }
  })

  it("pads bsd-style dropped leading zeros", () => {
    expect(parseMacInput("8:0:27:1a:2b:3c")?.oui).toBe("080027")
  })

  it("accepts an OUI on its own", () => {
    expect(parseMacInput("00:50:56")).toMatchObject({
      oui: "005056",
      isFullMac: false,
      mac: null,
    })
    expect(parseMacInput("005056")?.oui).toBe("005056")
    expect(parseMacInput("0:50:56")?.oui).toBe("005056")
  })

  it("rejects junk and wrong lengths", () => {
    for (const input of ["", "  ", "zz:zz:zz", "0011223344", "00112233445566"]) {
      expect(parseMacInput(input), input).toBeNull()
    }
  })

  it("reads the locally-administered and multicast bits", () => {
    expect(macFlags("021122")).toMatchObject({ locallyAdministered: true, multicast: false })
    expect(macFlags("011122")).toMatchObject({ locallyAdministered: false, multicast: true })
    expect(macFlags("001122")).toMatchObject({ locallyAdministered: false, multicast: false })
  })
})

describe("offline-first lookup", () => {
  it("answers a bundled prefix without touching the network", async () => {
    const fetchImpl = vi.fn()
    const result = await lookupOui("00:50:56:aa:bb:cc", { offlineOnly: false, fetchImpl })
    expect(result).toMatchObject({ vendor: "VMware", found: true, source: "offline" })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("still resolves offline when the remote says found:false", async () => {
    // the previous implementation only reached the local map from a catch block,
    // so an http 200 with found:false returned "Unknown vendor" instead.
    const fetchImpl = vi.fn(notFound)
    const result = await lookupOui("080027aabbcc", { offlineOnly: false, fetchImpl })
    expect(result.vendor).toBe("Oracle VirtualBox")
    expect(result.source).toBe("offline")
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("consults the remote only for an unbundled prefix", async () => {
    const fetchImpl = vi.fn<FetchLike>(() =>
      Promise.resolve(
        new Response(JSON.stringify({ found: true, company: "Example Corp" }), { status: 200 })
      )
    )
    const result = await lookupOui("AA:BB:CC:11:22:33", { offlineOnly: false, fetchImpl })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0][0]).toBe("https://api.maclookup.app/v2/macs/AABBCC")
    expect(result).toMatchObject({ vendor: "Example Corp", found: true, source: "remote" })
  })

  it("sends only the 6-digit prefix, never the device half", async () => {
    const fetchImpl = vi.fn(notFound)
    await lookupOui("AA:BB:CC:DE:AD:BE", { offlineOnly: false, fetchImpl })
    const url = String(fetchImpl.mock.calls[0][0])
    expect(url).toContain("AABBCC")
    expect(url).not.toMatch(/DEADBE/i)
  })

  it("offlineOnly never issues a request", async () => {
    const fetchImpl = vi.fn(notFound)
    const result = await lookupOui("AA:BB:CC:11:22:33", { offlineOnly: true, fetchImpl })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(result).toMatchObject({ found: false, source: "offline" })
    expect(result.error).toMatch(/no lookup was sent/)
  })

  it("caches remote misses and hits so a prefix is fetched once", async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ found: true, company: "Once Ltd" }), { status: 200 })
      )
    )
    const cache = new Map<string, string | null>()
    const first = await lookupOui("AA:BB:CD:00:00:01", { offlineOnly: false, fetchImpl, cache })
    const second = await lookupOui("AA:BB:CD:00:00:02", { offlineOnly: false, fetchImpl, cache })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(first.source).toBe("remote")
    expect(second.source).toBe("cache")
    expect(second.vendor).toBe("Once Ltd")
  })

  it("reports an unparseable line without throwing", async () => {
    const result = await lookupOui("not-a-mac", { offlineOnly: true })
    expect(result.found).toBe(false)
    expect(result.error).toMatch(/Not a MAC address/)
  })

  it("surfaces a transport failure as a note, not a crash", async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error("network down")))
    const result = await lookupOui("AA:BB:CE:00:00:01", { offlineOnly: false, fetchImpl })
    expect(result.found).toBe(false)
    expect(result.error).toBe("network down")
  })

  it("lookupRemote reports a non-2xx status", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response("", { status: 429 })))
    expect(await lookupRemote("AABBCF", fetchImpl)).toEqual({
      vendor: null,
      error: "maclookup.app returned 429",
    })
  })
})

describe("bulk dedup", () => {
  it("collapses repeated prefixes into one group", () => {
    const groups = dedupeByOui(["00:50:56:aa:bb:cc", "005056112233", "00:0C:29:11:22:33", "", "  "])
    expect(groups).toHaveLength(2)
    expect(groups[0].oui).toBe("005056")
    expect(groups[0].inputs).toHaveLength(2)
    expect(groups[1].oui).toBe("000C29")
  })

  it("keeps unparseable lines as their own entries", () => {
    const groups = dedupeByOui(["00:50:56:aa:bb:cc", "garbage"])
    expect(groups).toHaveLength(2)
    expect(groups[1]).toMatchObject({ oui: "", inputs: ["garbage"] })
  })
})

describe("the bundled database is described honestly", () => {
  it("counts match the data, and are nowhere near 50,000", () => {
    expect(OUI_PREFIX_COUNT).toBe(Object.keys(OUI_VENDORS).length)
    expect(OUI_PREFIX_COUNT).toBe(172)
    expect(OUI_VENDOR_COUNT).toBe(33)
    expect(OUI_PREFIX_COUNT).toBeLessThan(1000)
  })

  it("every key is 6 uppercase hex digits so lookups cannot miss on case", () => {
    for (const key of Object.keys(OUI_VENDORS)) {
      expect(key, key).toMatch(/^[0-9A-F]{6}$/)
    }
  })

  it("lookupLocal is case-insensitive", () => {
    expect(lookupLocal("005056")).toBe("VMware")
    expect(lookupLocal("005056".toLowerCase())).toBe("VMware")
    expect(lookupLocal("FFFFFF")).toBeNull()
  })
})
