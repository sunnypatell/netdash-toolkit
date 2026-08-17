import { describe, expect, it } from "vitest"
import {
  administrativeDistances,
  buildEigrpConfig,
  buildOspfConfig,
  buildStaticRoutesConfig,
  defaultEigrpConfig,
  defaultOspfConfig,
  emptyStaticRoute,
  evaluateNetworkStatement,
  evaluateStaticRoute,
  type StaticRoute,
} from "@/lib/routing"

const route = (overrides: Partial<StaticRoute> = {}): StaticRoute => ({
  ...emptyStaticRoute,
  ...overrides,
})

describe("ospf and eigrp network statements", () => {
  it("turns a prefix into the wildcard mask the network command wants", () => {
    const result = evaluateNetworkStatement("192.168.1.0/24")
    expect(result).toMatchObject({ isValid: true, network: "192.168.1.0", wildcard: "0.0.0.255" })
  })

  it("normalises a host address onto its network and says so", () => {
    const result = evaluateNetworkStatement("10.1.1.37/24")
    expect(result.network).toBe("10.1.1.0")
    expect(result.warnings).toContain("Normalized network to 10.1.1.0/24")
  })

  it("accepts a wildcard mask directly", () => {
    expect(evaluateNetworkStatement("172.16.0.0", "0.0.255.255")).toMatchObject({
      isValid: true,
      network: "172.16.0.0",
      wildcard: "0.0.255.255",
    })
  })

  it("rejects a wildcard that is not a contiguous run of bits", () => {
    const result = evaluateNetworkStatement("10.0.0.0", "0.255.0.255")
    expect(result.isValid).toBe(false)
    // pinned to the message: netmaskToPrefix throws, and the branch below it is unreachable
    expect(result.error).toBe("Subnet mask must have contiguous 1 bits")
  })

  it("warns when no wildcard is given rather than guessing silently", () => {
    const result = evaluateNetworkStatement("10.0.0.0")
    expect(result.wildcard).toBe("0.0.0.0")
    expect(result.warnings.join(" ")).toMatch(/host-specific/)
  })

  it("rejects junk", () => {
    expect(evaluateNetworkStatement("").isValid).toBe(false)
    expect(evaluateNetworkStatement("not-an-ip").isValid).toBe(false)
    expect(evaluateNetworkStatement("10.0.0.0/33").isValid).toBe(false)
  })
})

describe("static route validation", () => {
  it("accepts a dotted mask, a prefix, and CIDR in the destination", () => {
    expect(
      evaluateStaticRoute(
        route({ destination: "10.0.0.0", mask: "255.0.0.0", nextHop: "192.168.1.1" })
      )
    ).toMatchObject({
      isValid: true,
      destination: "10.0.0.0",
      mask: "255.0.0.0",
    })
    expect(
      evaluateStaticRoute(route({ destination: "10.0.0.0", mask: "8", nextHop: "192.168.1.1" }))
        .mask
    ).toBe("255.0.0.0")
    expect(
      evaluateStaticRoute(route({ destination: "10.0.0.0/8", nextHop: "192.168.1.1" })).mask
    ).toBe("255.0.0.0")
  })

  it("requires a next hop or an exit interface", () => {
    const result = evaluateStaticRoute(route({ destination: "10.0.0.0", mask: "255.0.0.0" }))
    expect(result.isValid).toBe(false)
    expect(result.error).toMatch(/next hop or exit interface/)
  })

  it("warns when the next hop is inside the destination prefix", () => {
    // a route whose next hop can only be resolved by itself never resolves
    const result = evaluateStaticRoute(
      route({ destination: "10.0.0.0", mask: "255.0.0.0", nextHop: "10.0.0.1" })
    )
    expect(result.isValid).toBe(true)
    expect(result.warnings.join(" ")).toMatch(/recurses through itself/)
  })

  it("does not warn about recursion on a default route", () => {
    const result = evaluateStaticRoute(
      route({ destination: "0.0.0.0", mask: "0.0.0.0", nextHop: "192.168.1.1" })
    )
    expect(result.warnings.join(" ")).not.toMatch(/recurses/)
  })

  it("warns that permanent and track cannot both apply", () => {
    const result = evaluateStaticRoute(
      route({
        destination: "10.0.0.0",
        mask: "255.0.0.0",
        nextHop: "192.168.1.1",
        permanent: true,
        track: "100",
      })
    )
    expect(result.warnings.join(" ")).toMatch(/mutually exclusive/)
  })

  it("rejects a bad next hop and a bad mask", () => {
    expect(
      evaluateStaticRoute(
        route({ destination: "10.0.0.0", mask: "255.0.0.0", nextHop: "999.1.1.1" })
      ).isValid
    ).toBe(false)
    expect(
      evaluateStaticRoute(
        route({ destination: "10.0.0.0", mask: "255.0.255.0", nextHop: "1.1.1.1" })
      ).isValid
    ).toBe(false)
  })
})

describe("ip route command generation", () => {
  const generate = (routes: StaticRoute[]) =>
    buildStaticRoutesConfig(routes, routes.map(evaluateStaticRoute))

  it("puts the exit interface before the next hop, per the ip route syntax", () => {
    const config = generate([
      route({
        destination: "10.0.0.0",
        mask: "255.0.0.0",
        interface: "GigabitEthernet0/0",
        nextHop: "192.168.1.1",
      }),
    ])
    expect(config).toContain("ip route 10.0.0.0 255.0.0.0 GigabitEthernet0/0 192.168.1.1")
  })

  it("omits the default administrative distance and writes any other", () => {
    expect(
      generate([route({ destination: "10.0.0.0", mask: "255.0.0.0", nextHop: "1.1.1.1" })])
    ).toContain("ip route 10.0.0.0 255.0.0.0 1.1.1.1\n")
    expect(
      generate([
        route({
          destination: "10.0.0.0",
          mask: "255.0.0.0",
          nextHop: "1.1.1.1",
          adminDistance: "5",
        }),
      ])
    ).toContain("ip route 10.0.0.0 255.0.0.0 1.1.1.1 5")
  })

  it("never emits permanent and track on the same line", () => {
    const config = generate([
      route({
        destination: "10.0.0.0",
        mask: "255.0.0.0",
        nextHop: "1.1.1.1",
        permanent: true,
        track: "100",
      }),
    ])
    const command = config.split("\n").find((line) => line.startsWith("ip route"))
    expect(command).toContain("track 100")
    expect(command).not.toContain("permanent")
  })

  it("still writes permanent on its own", () => {
    expect(
      generate([
        route({ destination: "10.0.0.0", mask: "255.0.0.0", nextHop: "1.1.1.1", permanent: true }),
      ])
    ).toContain("ip route 10.0.0.0 255.0.0.0 1.1.1.1 permanent")
  })

  it("comments out an invalid route instead of emitting a broken command", () => {
    const config = generate([route({ destination: "10.0.0.0", mask: "255.0.0.0" })])
    expect(config).toMatch(/^! Skipped static route 10\.0\.0\.0/m)
    expect(config).not.toMatch(/^ip route/m)
  })
})

describe("ospf config generation", () => {
  it("writes area authentication for the backbone too", () => {
    // every area statement was skipped when the id was 0, so area 0 authentication produced nothing
    const config = buildOspfConfig(
      {
        ...defaultOspfConfig,
        areas: [{ id: "0", type: "standard", authentication: true }],
        networks: [],
      },
      []
    )
    expect(config).toContain("area 0 authentication")
  })

  it("never makes the backbone a stub, which ospf forbids", () => {
    const config = buildOspfConfig(
      {
        ...defaultOspfConfig,
        areas: [{ id: "0", type: "stub", authentication: false }],
        networks: [],
      },
      []
    )
    expect(config).not.toContain("area 0 stub")
  })

  it("writes stub, totally stub and nssa for non-backbone areas", () => {
    const config = buildOspfConfig(
      {
        ...defaultOspfConfig,
        networks: [],
        areas: [
          { id: "1", type: "stub", authentication: false },
          { id: "2", type: "totally-stub", authentication: false },
          { id: "3", type: "nssa", authentication: false },
        ],
      },
      []
    )
    expect(config).toContain("area 1 stub\n")
    expect(config).toContain("area 2 stub no-summary")
    expect(config).toContain("area 3 nssa")
  })

  it("refuses to emit router ospf with no process id", () => {
    const config = buildOspfConfig({ ...defaultOspfConfig, processId: "" }, [])
    expect(config).not.toMatch(/^router ospf\s*$/m)
    expect(config).toMatch(/Process ID is required/)
  })

  it("emits validated network statements and comments the rest", () => {
    const networks = [
      { address: "192.168.1.0/24", wildcardMask: "", area: "0" },
      { address: "nope", wildcardMask: "", area: "1" },
    ]
    const config = buildOspfConfig(
      { ...defaultOspfConfig, networks },
      networks.map((n) => evaluateNetworkStatement(n.address, n.wildcardMask))
    )
    expect(config).toContain(" network 192.168.1.0 0.0.0.255 area 0")
    expect(config).toMatch(/^! Skipped network nope/m)
  })
})

describe("eigrp config generation", () => {
  it("refuses to emit router eigrp with no autonomous system number", () => {
    const config = buildEigrpConfig(defaultEigrpConfig, [])
    expect(config).not.toMatch(/^router eigrp\s*$/m)
    expect(config).toMatch(/Autonomous system number is required/)
  })

  it("turns auto-summary off by default and leaves the defaults unwritten", () => {
    const config = buildEigrpConfig({ ...defaultEigrpConfig, asNumber: "100", networks: [] }, [])
    expect(config).toContain("router eigrp 100")
    expect(config).toContain(" no auto-summary")
    expect(config).not.toContain("variance")
    expect(config).not.toContain("maximum-paths")
  })

  it("writes variance and maximum-paths when they differ from the ios defaults", () => {
    const config = buildEigrpConfig(
      { ...defaultEigrpConfig, asNumber: "100", networks: [], variance: "2", maximumPaths: "8" },
      []
    )
    expect(config).toContain(" variance 2")
    expect(config).toContain(" maximum-paths 8")
  })
})

describe("administrative distances", () => {
  it("matches the cisco defaults", () => {
    const byProtocol = new Map(administrativeDistances.map((d) => [d.protocol, d.distance]))
    expect(byProtocol.get("Connected Interface")).toBe(0)
    expect(byProtocol.get("Static Route")).toBe(1)
    expect(byProtocol.get("EIGRP Summary")).toBe(5)
    expect(byProtocol.get("External BGP")).toBe(20)
    expect(byProtocol.get("Internal EIGRP")).toBe(90)
    expect(byProtocol.get("IGRP")).toBe(100)
    expect(byProtocol.get("OSPF")).toBe(110)
    expect(byProtocol.get("IS-IS")).toBe(115)
    expect(byProtocol.get("RIP")).toBe(120)
    expect(byProtocol.get("EGP")).toBe(140)
    expect(byProtocol.get("ODR")).toBe(160)
    expect(byProtocol.get("External EIGRP")).toBe(170)
    expect(byProtocol.get("Internal BGP")).toBe(200)
    expect(byProtocol.get("Unknown")).toBe(255)
  })

  it("is listed most preferred first with no duplicate values", () => {
    const values = administrativeDistances.map((d) => d.distance)
    expect(values).toEqual([...values].sort((a, b) => a - b))
    expect(new Set(values).size).toBe(values.length)
  })
})
