// validation and config generation for the routing tools. syntax follows the
// Cisco IOS command references for router ospf, router eigrp and ip route.

import {
  calculateIPv4Subnet,
  intToIpv4,
  ipv4ToInt,
  isValidIPv4,
  netmaskToPrefix,
  parsePrefixText,
  prefixToMaskInt,
  prefixToNetmask,
} from "@/lib/network-utils"

export interface OSPFArea {
  id: string
  type: "standard" | "stub" | "nssa" | "totally-stub"
  authentication: boolean
}

export interface OSPFConfig {
  processId: string
  routerId: string
  networks: Array<{ address: string; wildcardMask: string; area: string }>
  areas: OSPFArea[]
  redistributeStatic: boolean
  redistributeConnected: boolean
  defaultOriginate: boolean
  passiveInterfaces: string[]
}

export interface EIGRPConfig {
  asNumber: string
  routerId: string
  networks: Array<{ address: string; wildcardMask: string }>
  redistributeStatic: boolean
  redistributeConnected: boolean
  autoSummary: boolean
  variance: string
  maximumPaths: string
  passiveInterfaces: string[]
}

export interface StaticRoute {
  destination: string
  mask: string
  nextHop: string
  interface: string
  adminDistance: string
  description: string
  permanent: boolean
  track: string
}

export interface NetworkStatementEvaluation {
  isValid: boolean
  network?: string
  wildcard?: string
  warnings: string[]
  error?: string
}

export interface StaticRouteEvaluation {
  isValid: boolean
  destination?: string
  mask?: string
  prefix?: number
  nextHop?: string
  exitInterface?: string
  warnings: string[]
  error?: string
}

export const defaultOspfConfig: OSPFConfig = {
  processId: "1",
  routerId: "",
  networks: [{ address: "", wildcardMask: "", area: "0" }],
  areas: [{ id: "0", type: "standard", authentication: false }],
  redistributeStatic: false,
  redistributeConnected: false,
  defaultOriginate: false,
  passiveInterfaces: [],
}

export const defaultEigrpConfig: EIGRPConfig = {
  asNumber: "",
  routerId: "",
  networks: [{ address: "", wildcardMask: "" }],
  redistributeStatic: false,
  redistributeConnected: false,
  autoSummary: false,
  variance: "1",
  maximumPaths: "4",
  passiveInterfaces: [],
}

export const emptyStaticRoute: StaticRoute = {
  destination: "",
  mask: "",
  nextHop: "",
  interface: "",
  adminDistance: "1",
  description: "",
  permanent: false,
  track: "",
}

export function evaluateNetworkStatement(
  address: string,
  wildcardMask?: string
): NetworkStatementEvaluation {
  const warnings: string[] = []
  const trimmedAddress = address.trim()

  if (!trimmedAddress) {
    return { isValid: false, warnings, error: "Network address is required" }
  }

  if (trimmedAddress.includes("/")) {
    const [ip, prefixStr] = trimmedAddress.split("/")
    const prefix = parsePrefixText(prefixStr, 32)

    if (!isValidIPv4(ip) || prefix === null) {
      return { isValid: false, warnings, error: "Invalid CIDR notation" }
    }

    const subnet = calculateIPv4Subnet(ip, prefix)
    if (subnet.network !== ip) {
      warnings.push(`Normalized network to ${subnet.network}/${prefix}`)
    }

    return { isValid: true, network: subnet.network, wildcard: subnet.wildcardMask, warnings }
  }

  if (!isValidIPv4(trimmedAddress)) {
    return { isValid: false, warnings, error: "Invalid IPv4 address" }
  }

  let wildcard = (wildcardMask ?? "").trim()
  if (!wildcard) {
    wildcard = "0.0.0.0"
    warnings.push("Wildcard mask missing; assuming host-specific statement")
  }

  if (!isValidIPv4(wildcard)) {
    return { isValid: false, warnings, error: "Invalid wildcard mask" }
  }

  const wildcardInt = ipv4ToInt(wildcard)
  const netmaskInt = ~wildcardInt >>> 0
  const netmask = intToIpv4(netmaskInt)
  let prefix: number
  try {
    prefix = netmaskToPrefix(netmask)
  } catch (error) {
    return {
      isValid: false,
      warnings,
      error:
        error instanceof Error ? error.message : "Wildcard must translate to a valid subnet mask",
    }
  }

  if (prefixToMaskInt(prefix) !== netmaskInt) {
    return { isValid: false, warnings, error: "Wildcard must map to a contiguous subnet" }
  }

  const subnet = calculateIPv4Subnet(trimmedAddress, prefix)
  if (subnet.network !== trimmedAddress) {
    warnings.push(`Normalized network to ${subnet.network}/${prefix}`)
  }

  return { isValid: true, network: subnet.network, wildcard: subnet.wildcardMask, warnings }
}

export function evaluateStaticRoute(route: StaticRoute): StaticRouteEvaluation {
  const warnings: string[] = []
  const destinationInput = route.destination.trim()
  let maskInput = route.mask.trim()
  const nextHopInput = route.nextHop.trim()
  const interfaceInput = route.interface.trim()

  if (!destinationInput) {
    return { isValid: false, warnings, error: "Destination network is required" }
  }

  let destination = destinationInput
  let prefixFromDestination: number | null = null

  if (destination.includes("/")) {
    const [ip, prefixStr] = destination.split("/")
    const prefix = parsePrefixText(prefixStr, 32)

    if (!isValidIPv4(ip) || prefix === null) {
      return { isValid: false, warnings, error: "Invalid destination CIDR" }
    }

    const subnet = calculateIPv4Subnet(ip, prefix)
    if (subnet.network !== ip) {
      warnings.push(`Destination normalized to ${subnet.network}/${prefix}`)
    }

    destination = subnet.network
    maskInput = prefixToNetmask(prefix)
    prefixFromDestination = prefix
  } else if (!isValidIPv4(destination)) {
    return { isValid: false, warnings, error: "Invalid destination address" }
  }

  if (!maskInput) {
    if (prefixFromDestination !== null) {
      maskInput = prefixToNetmask(prefixFromDestination)
    } else {
      return { isValid: false, warnings, error: "Subnet mask or prefix is required" }
    }
  }

  let prefix: number
  if (maskInput.includes(".")) {
    if (!isValidIPv4(maskInput)) {
      return { isValid: false, warnings, error: "Invalid subnet mask" }
    }
    try {
      prefix = netmaskToPrefix(maskInput)
    } catch (error) {
      return {
        isValid: false,
        warnings,
        error: error instanceof Error ? error.message : "Subnet mask must have contiguous 1 bits",
      }
    }
  } else {
    const sanitized = maskInput.startsWith("/") ? maskInput.slice(1) : maskInput
    const parsed = parsePrefixText(sanitized, 32)
    if (parsed === null) {
      return { isValid: false, warnings, error: "Invalid prefix length" }
    }
    prefix = parsed
    maskInput = prefixToNetmask(prefix)
  }

  const subnet = calculateIPv4Subnet(destination, prefix)
  if (subnet.network !== destination) {
    warnings.push(`Destination adjusted to ${subnet.network}/${prefix}`)
    destination = subnet.network
  }

  if (nextHopInput && !isValidIPv4(nextHopInput)) {
    return { isValid: false, warnings, error: "Invalid next-hop address" }
  }

  if (!nextHopInput && !interfaceInput) {
    return { isValid: false, warnings, error: "Specify a next hop or exit interface" }
  }

  // a next hop inside the destination prefix can only be resolved by the route
  // being defined, so the recursive lookup never terminates
  if (nextHopInput && prefix > 0) {
    const maskInt = prefixToMaskInt(prefix)
    if ((ipv4ToInt(nextHopInput) & maskInt) === (ipv4ToInt(destination) & maskInt)) {
      warnings.push(
        `Next hop ${nextHopInput} is inside ${destination}/${prefix}; the route recurses through itself`
      )
    }
  }

  if (route.permanent && route.track.trim()) {
    warnings.push("permanent and track are mutually exclusive; track takes precedence")
  }

  return {
    isValid: true,
    destination,
    mask: subnet.netmask,
    prefix,
    nextHop: nextHopInput || undefined,
    exitInterface: interfaceInput || undefined,
    warnings,
  }
}

export function buildOspfConfig(
  config: OSPFConfig,
  evaluations: NetworkStatementEvaluation[]
): string {
  let out = `! OSPF Configuration\n`

  if (!config.processId.trim()) {
    out += `! Process ID is required: "router ospf <1-65535>"\n`
    return out
  }

  out += `router ospf ${config.processId}\n`

  if (config.routerId) {
    out += ` router-id ${config.routerId}\n`
  }

  if (config.defaultOriginate) {
    out += ` default-information originate\n`
  }

  config.networks.forEach((raw, index) => {
    if (!raw.address) return
    const evaluation = evaluations[index]
    const label = raw.address || `entry ${index + 1}`

    if (!evaluation?.isValid || !evaluation.network || !evaluation.wildcard) {
      out += `! Skipped network ${label}: ${evaluation?.error || "Invalid definition"}\n`
      return
    }

    evaluation.warnings.forEach((warning) => {
      out += `! Warning [${label}]: ${warning}\n`
    })

    out += ` network ${evaluation.network} ${evaluation.wildcard} area ${raw.area || "0"}\n`
  })

  if (config.redistributeStatic) {
    out += ` redistribute static subnets\n`
  }

  if (config.redistributeConnected) {
    out += ` redistribute connected subnets\n`
  }

  config.passiveInterfaces.forEach((intf) => {
    if (intf) out += ` passive-interface ${intf}\n`
  })

  out += `!\n`

  config.areas.forEach((area) => {
    // area 0 is the backbone and cannot be stub or nssa, but it can and often
    // does carry authentication
    if (area.id !== "0") {
      if (area.type === "stub") {
        out += `area ${area.id} stub\n`
      } else if (area.type === "nssa") {
        out += `area ${area.id} nssa\n`
      } else if (area.type === "totally-stub") {
        out += `area ${area.id} stub no-summary\n`
      }
    }

    if (area.authentication) {
      out += `area ${area.id} authentication\n`
    }
  })

  return out
}

export function buildEigrpConfig(
  config: EIGRPConfig,
  evaluations: NetworkStatementEvaluation[]
): string {
  let out = `! EIGRP Configuration\n`

  if (!config.asNumber.trim()) {
    out += `! Autonomous system number is required: "router eigrp <1-65535>"\n`
    return out
  }

  out += `router eigrp ${config.asNumber}\n`

  if (config.routerId) {
    out += ` eigrp router-id ${config.routerId}\n`
  }

  config.networks.forEach((raw, index) => {
    if (!raw.address) return
    const evaluation = evaluations[index]
    const label = raw.address || `entry ${index + 1}`

    if (!evaluation?.isValid || !evaluation.network || !evaluation.wildcard) {
      out += `! Skipped network ${label}: ${evaluation?.error || "Invalid definition"}\n`
      return
    }

    evaluation.warnings.forEach((warning) => {
      out += `! Warning [${label}]: ${warning}\n`
    })

    out += ` network ${evaluation.network} ${evaluation.wildcard}\n`
  })

  if (!config.autoSummary) {
    out += ` no auto-summary\n`
  }

  if (config.variance !== "1") {
    out += ` variance ${config.variance}\n`
  }

  if (config.maximumPaths !== "4") {
    out += ` maximum-paths ${config.maximumPaths}\n`
  }

  if (config.redistributeStatic) {
    out += ` redistribute static\n`
  }

  if (config.redistributeConnected) {
    out += ` redistribute connected\n`
  }

  config.passiveInterfaces.forEach((intf) => {
    if (intf) out += ` passive-interface ${intf}\n`
  })

  out += `!\n`
  return out
}

export function buildStaticRoutesConfig(
  routes: StaticRoute[],
  evaluations: StaticRouteEvaluation[]
): string {
  let out = `! Static Routes Configuration\n`

  routes.forEach((route, index) => {
    const evaluation = evaluations[index]
    if (!evaluation) return

    if (!evaluation.isValid || !evaluation.destination || !evaluation.mask) {
      if (route.destination || route.mask) {
        out += `! Skipped static route ${route.destination || `entry ${index + 1}`}: ${
          evaluation.error || "Invalid definition"
        }\n`
      }
      return
    }

    evaluation.warnings.forEach((warning) => {
      out += `! Warning [${route.destination || `entry ${index + 1}`}]: ${warning}\n`
    })

    // ip route prefix mask {ip-address | interface [ip-address]} [distance]
    // [permanent | track number]
    let routeCmd = `ip route ${evaluation.destination} ${evaluation.mask}`

    if (evaluation.exitInterface) {
      routeCmd += ` ${evaluation.exitInterface}`
    }

    if (evaluation.nextHop) {
      routeCmd += ` ${evaluation.nextHop}`
    }

    const distance = Number.parseInt(route.adminDistance || "1", 10)
    if (!isNaN(distance) && distance !== 1) {
      routeCmd += ` ${distance}`
    }

    const track = route.track.trim()
    if (track) {
      routeCmd += ` track ${track}`
    } else if (route.permanent) {
      routeCmd += " permanent"
    }

    out += `${routeCmd}\n`

    if (route.description) {
      out += `! ${route.description}\n`
    }
  })

  return out
}

export interface AdministrativeDistance {
  protocol: string
  distance: number
  description: string
}

// Cisco "Route Selection in Cisco Routers" (document ID 8651), default
// administrative distances
export const administrativeDistances: AdministrativeDistance[] = [
  { protocol: "Connected Interface", distance: 0, description: "Directly connected networks" },
  { protocol: "Static Route", distance: 1, description: "Manually configured routes" },
  { protocol: "EIGRP Summary", distance: 5, description: "EIGRP summary routes" },
  { protocol: "External BGP", distance: 20, description: "Routes from external BGP peers" },
  { protocol: "Internal EIGRP", distance: 90, description: "EIGRP internal routes" },
  { protocol: "IGRP", distance: 100, description: "Interior Gateway Routing Protocol (legacy)" },
  { protocol: "OSPF", distance: 110, description: "Open Shortest Path First" },
  { protocol: "IS-IS", distance: 115, description: "Intermediate System to Intermediate System" },
  { protocol: "RIP", distance: 120, description: "Routing Information Protocol" },
  { protocol: "EGP", distance: 140, description: "Exterior Gateway Protocol (legacy)" },
  { protocol: "ODR", distance: 160, description: "On-Demand Routing" },
  { protocol: "External EIGRP", distance: 170, description: "EIGRP external routes" },
  { protocol: "Internal BGP", distance: 200, description: "Routes from internal BGP peers" },
  { protocol: "Unknown", distance: 255, description: "Never installed in the routing table" },
]
