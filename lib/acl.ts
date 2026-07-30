// ACL rule modelling, validation, and vendor config generation.

import {
  calculateIPv4Subnet,
  intToIpv4,
  ipv4ToInt,
  isValidIPv4,
  netmaskToPrefix,
} from "@/lib/network-utils"

export type ACLType = "standard" | "extended"
export type ACLPlatform = "cisco-ios" | "juniper-junos" | "paloalto-panos"
export type ACLAction = "permit" | "deny"
export type ACLProtocol = "any" | "tcp" | "udp" | "icmp" | "ip"
export type PortOperator = "eq" | "gt" | "lt" | "neq" | "range"

export const MIN_PORT = 1
export const MAX_PORT = 65535
export const PORT_RANGE_LABEL = `${MIN_PORT}-${MAX_PORT}`

// cisco ios numbered acl ranges, per the "ip access-list" command reference
export const STANDARD_ACL_RANGES: readonly [number, number][] = [
  [1, 99],
  [1300, 1999],
]
export const EXTENDED_ACL_RANGES: readonly [number, number][] = [
  [100, 199],
  [2000, 2699],
]

export interface StandardACLRule {
  id: string
  action: ACLAction
  sourceNetwork: string
  sourceWildcard?: string
  description?: string
  log?: boolean
}

export interface ExtendedACLRule {
  id: string
  action: ACLAction
  protocol: ACLProtocol
  sourceNetwork: string
  sourceWildcard?: string
  destNetwork: string
  destWildcard?: string
  sourcePort?: string
  sourcePortOperator?: PortOperator
  destPort?: string
  destPortOperator?: PortOperator
  destPortRange?: string
  sourcePortRange?: string
  tcpFlags?: string[]
  icmpType?: string
  icmpCode?: string
  established?: boolean
  log?: boolean
  description?: string
}

export type ACLRule = StandardACLRule | ExtendedACLRule

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface ACLSpec {
  aclType: ACLType
  aclName: string
  platform: ACLPlatform
  standardRules: StandardACLRule[]
  extendedRules: ExtendedACLRule[]
  // injectable so generated output is deterministic in tests
  timestamp?: string
}

export const isValidPort = (value: number): boolean =>
  Number.isInteger(value) && value >= MIN_PORT && value <= MAX_PORT

// a wildcard is the bitwise inverse of a netmask; going through netmaskToPrefix
// also rejects the non-contiguous masks a raw popcount would silently accept
export const wildcardToPrefix = (wildcard: string): number =>
  netmaskToPrefix(intToIpv4(~ipv4ToInt(wildcard) >>> 0))

export type ParsedACLNetwork = {
  kind: "any" | "host" | "network"
  network: string
  wildcard: string
  host?: string
  prefix?: number
  warnings: string[]
}

export function parseACLNetwork(input: string): ParsedACLNetwork {
  const trimmed = input.trim()

  if (!trimmed) {
    throw new Error("Network value is required")
  }

  if (trimmed.toLowerCase() === "any") {
    return { kind: "any", network: "any", wildcard: "", warnings: [] }
  }

  if (trimmed.toLowerCase().startsWith("host ")) {
    const hostIp = trimmed.slice(5).trim()
    if (!isValidIPv4(hostIp)) {
      throw new Error("Invalid host address")
    }
    return {
      kind: "host",
      network: hostIp,
      wildcard: "0.0.0.0",
      host: hostIp,
      prefix: 32,
      warnings: [],
    }
  }

  const [address, prefixStr] = trimmed.split("/")
  const normalizedAddress = address.trim()

  if (!isValidIPv4(normalizedAddress)) {
    throw new Error("Invalid IPv4 address")
  }

  if (prefixStr !== undefined) {
    const prefix = Number.parseInt(prefixStr, 10)
    if (isNaN(prefix) || prefix < 0 || prefix > 32) {
      throw new Error("Invalid prefix length")
    }

    const subnet = calculateIPv4Subnet(normalizedAddress, prefix)
    const warnings: string[] = []

    if (subnet.network !== normalizedAddress) {
      warnings.push(`Normalized network to ${subnet.network}/${prefix}`)
    }

    return {
      kind: prefix === 32 ? "host" : "network",
      network: subnet.network,
      wildcard: subnet.wildcardMask,
      host: prefix === 32 ? subnet.network : undefined,
      prefix,
      warnings,
    }
  }

  // no prefix provided, treat as host with implicit wildcard
  return {
    kind: "host",
    network: normalizedAddress,
    wildcard: "0.0.0.0",
    host: normalizedAddress,
    prefix: 32,
    warnings: ["No prefix provided; treating value as a host entry"],
  }
}

export interface ACLNameCheck {
  kind: "numbered" | "named"
  number?: number
  errors: string[]
  warnings: string[]
}

const inAnyRange = (n: number, ranges: readonly [number, number][]): boolean =>
  ranges.some(([lo, hi]) => n >= lo && n <= hi)

const describeRanges = (ranges: readonly [number, number][]): string =>
  ranges.map(([lo, hi]) => `${lo}-${hi}`).join(", ")

// a number outside its type's range silently produces a config the device
// rejects, so the name is validated as its own concern
export function checkACLName(name: string, aclType: ACLType): ACLNameCheck {
  const trimmed = name.trim()
  const errors: string[] = []
  const warnings: string[] = []

  if (!trimmed) {
    return { kind: "named", errors: ["ACL name or number is required"], warnings }
  }

  if (/^\d+$/.test(trimmed)) {
    const number = Number.parseInt(trimmed, 10)
    const own = aclType === "standard" ? STANDARD_ACL_RANGES : EXTENDED_ACL_RANGES
    const other = aclType === "standard" ? EXTENDED_ACL_RANGES : STANDARD_ACL_RANGES

    if (!inAnyRange(number, own)) {
      const otherType = aclType === "standard" ? "extended" : "standard"
      errors.push(
        inAnyRange(number, other)
          ? `${number} is an ${otherType} ACL number; ${aclType} ACLs use ${describeRanges(own)}`
          : `${number} is not a valid ${aclType} ACL number (${describeRanges(own)})`
      )
    }

    return { kind: "numbered", number, errors, warnings }
  }

  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(trimmed)) {
    errors.push("Named ACLs must start with a letter and contain only letters, digits, - and _")
  }

  return { kind: "named", errors, warnings }
}

// null when the operator has no usable value, so callers can omit the clause
// instead of emitting a half-written match
function portClause(
  operator: PortOperator | undefined,
  port: string | undefined,
  range: string | undefined
): string | null {
  const op = operator ?? "eq"

  if (op === "range") {
    const bounds = parsePortRange(range)
    return bounds ? `range ${bounds[0]} ${bounds[1]}` : null
  }

  const value = port?.trim()
  return value ? `${op} ${value}` : null
}

export function parsePortRange(range: string | undefined): [number, number] | null {
  if (!range) return null
  const parts = range
    .split(/[-\s]+/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length !== 2) return null
  const start = Number.parseInt(parts[0], 10)
  const end = Number.parseInt(parts[1], 10)
  if (!isValidPort(start) || !isValidPort(end)) return null
  return [start, end]
}

// "ip" is the ios keyword for any ip protocol; "any" is not a protocol keyword
const ciscoProtocol = (protocol: ACLProtocol): string => (protocol === "any" ? "ip" : protocol)

const hasPorts = (protocol: ACLProtocol): boolean => protocol === "tcp" || protocol === "udp"

function networkClause(parsed: ParsedACLNetwork): string {
  if (parsed.kind === "any") return "any"
  if (parsed.kind === "host") return `host ${parsed.host ?? parsed.network}`
  return `${parsed.network} ${parsed.wildcard}`
}

function toCidr(parsed: ParsedACLNetwork): string | null {
  if (parsed.kind === "any") return null
  if (parsed.kind === "host") return `${parsed.host ?? parsed.network}/32`
  return `${parsed.network}/${parsed.prefix ?? wildcardToPrefix(parsed.wildcard)}`
}

export function validateStandardRule(rule: StandardACLRule): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (rule.sourceNetwork !== "any") {
    try {
      const parsed = parseACLNetwork(rule.sourceNetwork)
      warnings.push(...parsed.warnings)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Invalid source network format")
    }
  }

  if (!rule.description) {
    warnings.push("Consider adding a description for documentation")
  }

  return { isValid: errors.length === 0, errors, warnings }
}

export function validateExtendedRule(rule: ExtendedACLRule): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (rule.sourceNetwork !== "any") {
    try {
      const parsed = parseACLNetwork(rule.sourceNetwork)
      warnings.push(...parsed.warnings)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Invalid source network format")
    }
  }

  if (rule.destNetwork !== "any") {
    try {
      const parsed = parseACLNetwork(rule.destNetwork)
      warnings.push(...parsed.warnings)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Invalid destination network format")
    }
  }

  if (hasPorts(rule.protocol)) {
    if (rule.sourcePortOperator === "range") {
      const bounds = parsePortRange(rule.sourcePortRange)
      if (!bounds) {
        errors.push(`Invalid source port range (${PORT_RANGE_LABEL})`)
      } else if (bounds[0] >= bounds[1]) {
        errors.push("Source port range start must be lower than its end")
      }
    } else if (rule.sourcePort && !isValidPort(Number.parseInt(rule.sourcePort, 10))) {
      errors.push(`Invalid source port (${PORT_RANGE_LABEL})`)
    }

    if (rule.destPortOperator === "range") {
      const bounds = parsePortRange(rule.destPortRange)
      if (!bounds) {
        errors.push(`Invalid destination port range (${PORT_RANGE_LABEL})`)
      } else if (bounds[0] >= bounds[1]) {
        errors.push("Destination port range start must be lower than its end")
      }
    } else if (rule.destPort && !isValidPort(Number.parseInt(rule.destPort, 10))) {
      errors.push(`Invalid destination port (${PORT_RANGE_LABEL})`)
    }
  } else if (rule.sourcePort || rule.destPort || rule.sourcePortRange || rule.destPortRange) {
    warnings.push(`Ports do not apply to ${ciscoProtocol(rule.protocol)}; they will be omitted`)
  }

  if (rule.protocol === "icmp") {
    if (rule.icmpType) {
      const type = Number.parseInt(rule.icmpType, 10)
      if (isNaN(type) || type < 0 || type > 255) {
        errors.push("Invalid ICMP type (0-255)")
      }
    }
    if (rule.icmpCode) {
      const code = Number.parseInt(rule.icmpCode, 10)
      if (isNaN(code) || code < 0 || code > 255) {
        errors.push("Invalid ICMP code (0-255)")
      }
      if (!rule.icmpType) {
        warnings.push("ICMP code is ignored without an ICMP type")
      }
    }
  } else if (rule.icmpType || rule.icmpCode) {
    warnings.push("ICMP type and code apply to ICMP only; they will be omitted")
  }

  if (rule.established && rule.protocol !== "tcp") {
    warnings.push("established applies to TCP only; it will be omitted")
  }

  if (rule.action === "permit" && rule.sourceNetwork === "any" && rule.destNetwork === "any") {
    warnings.push("Overly permissive rule - consider restricting source or destination")
  }

  if (rule.protocol === "tcp" && rule.destPort === "22" && rule.sourceNetwork === "any") {
    warnings.push("SSH access from any source may be a security risk")
  }

  if (!rule.description) {
    warnings.push("Consider adding a description for documentation")
  }

  return { isValid: errors.length === 0, errors, warnings }
}

export function validateRules(spec: Pick<ACLSpec, "aclType" | "standardRules" | "extendedRules">) {
  return spec.aclType === "standard"
    ? spec.standardRules.map(validateStandardRule)
    : spec.extendedRules.map(validateExtendedRule)
}

interface ClauseResult {
  text: string
  warnings: string[]
}

// everything after the permit/deny keyword, shared by numbered and named ios forms
function ciscoStandardBody(rule: StandardACLRule): ClauseResult {
  const parsed = parseACLNetwork(rule.sourceNetwork)
  let text = networkClause(parsed)
  if (rule.log) text += " log"
  return { text, warnings: parsed.warnings }
}

function ciscoExtendedBody(rule: ExtendedACLRule): ClauseResult {
  const source = parseACLNetwork(rule.sourceNetwork)
  const dest = parseACLNetwork(rule.destNetwork)

  let text = `${ciscoProtocol(rule.protocol)} ${networkClause(source)}`

  if (hasPorts(rule.protocol)) {
    const sourcePort = portClause(rule.sourcePortOperator, rule.sourcePort, rule.sourcePortRange)
    if (sourcePort) text += ` ${sourcePort}`
  }

  text += ` ${networkClause(dest)}`

  if (hasPorts(rule.protocol)) {
    const destPort = portClause(rule.destPortOperator, rule.destPort, rule.destPortRange)
    if (destPort) text += ` ${destPort}`
  }

  if (rule.protocol === "icmp" && rule.icmpType) {
    text += ` ${rule.icmpType}`
    if (rule.icmpCode) text += ` ${rule.icmpCode}`
  }

  if (rule.protocol === "tcp" && rule.established) text += " established"
  if (rule.log) text += " log"

  return { text, warnings: [...source.warnings, ...dest.warnings] }
}

function ciscoBody(rule: ACLRule, aclType: ACLType): ClauseResult {
  return aclType === "standard"
    ? ciscoStandardBody(rule as StandardACLRule)
    : ciscoExtendedBody(rule as ExtendedACLRule)
}

const ciscoDenyAll = (aclType: ACLType): string =>
  aclType === "standard" ? "deny any" : "deny ip any any"

function generateCiscoACL(spec: ACLSpec, timestamp: string): string {
  const { aclType, aclName, standardRules, extendedRules } = spec
  const rules: ACLRule[] = aclType === "standard" ? standardRules : extendedRules
  const nameCheck = checkACLName(aclName, aclType)
  const lines: string[] = []

  lines.push(`! ${aclType.toUpperCase()} ACL ${aclName} - Generated by Network Toolbox`)
  lines.push(`! Generated on: ${timestamp}`)
  lines.push(`! Total rules: ${rules.length}`)
  for (const error of nameCheck.errors) {
    lines.push(`! WARNING: ${error}`)
  }
  lines.push("!")

  const named = nameCheck.kind === "named"
  if (named) {
    lines.push(`ip access-list ${aclType} ${aclName}`)
  }

  rules.forEach((rule, index) => {
    try {
      const { text, warnings } = ciscoBody(rule, aclType)
      if (named) {
        if (rule.description) lines.push(` remark ${rule.description}`)
        for (const warning of warnings) lines.push(` remark ${warning}`)
        lines.push(` ${rule.action} ${text}`)
      } else {
        if (rule.description) lines.push(`! Rule ${index + 1}: ${rule.description}`)
        for (const warning of warnings) lines.push(`! ${warning}`)
        lines.push(`access-list ${aclName} ${rule.action} ${text}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      lines.push(`${named ? " remark" : "!"} Error in rule ${index + 1}: ${message}`)
    }
  })

  // ios already denies implicitly; stated explicitly so the config documents it
  lines.push(
    named ? ` ${ciscoDenyAll(aclType)}` : `access-list ${aclName} ${ciscoDenyAll(aclType)}`
  )

  lines.push("!")
  lines.push("! Apply to interface:")
  lines.push("! interface GigabitEthernet0/1")
  lines.push(`!  ip access-group ${aclName} in`)
  lines.push(`!  ip access-group ${aclName} out`)

  return lines.join("\n") + "\n"
}

function generateJuniperFilter(spec: ACLSpec, timestamp: string): string {
  const { aclType, aclName, standardRules, extendedRules } = spec
  const rules: ACLRule[] = aclType === "standard" ? standardRules : extendedRules
  const lines: string[] = []

  lines.push(
    `/* ${aclType.toUpperCase()} Firewall Filter ${aclName} - Generated by Network Toolbox */`
  )
  lines.push(`/* Generated on: ${timestamp} */`)
  lines.push(`/* Total terms: ${rules.length} */`)
  lines.push("")
  lines.push("firewall {")
  lines.push("    family inet {")
  lines.push(`        filter ${aclName} {`)

  rules.forEach((rule, index) => {
    const matches: string[] = []
    const notes: string[] = []

    const addAddress = (keyword: string, value: string) => {
      if (value === "any") return
      try {
        const cidr = toCidr(parseACLNetwork(value))
        if (cidr) matches.push(`${keyword} ${cidr};`)
      } catch {
        notes.push(`Error: invalid ${keyword.replace("-address", "")} network "${value}"`)
      }
    }

    addAddress("source-address", rule.sourceNetwork)

    if (aclType === "extended") {
      const ext = rule as ExtendedACLRule
      addAddress("destination-address", ext.destNetwork)

      if (ext.protocol !== "ip" && ext.protocol !== "any") {
        matches.push(`protocol ${ext.protocol};`)
      }

      if (hasPorts(ext.protocol)) {
        const source = junosPort(ext.sourcePortOperator, ext.sourcePort, ext.sourcePortRange)
        if (source.note) notes.push(`source-port: ${source.note}`)
        if (source.value) matches.push(`source-port ${source.value};`)
        const dest = junosPort(ext.destPortOperator, ext.destPort, ext.destPortRange)
        if (dest.note) notes.push(`destination-port: ${dest.note}`)
        if (dest.value) matches.push(`destination-port ${dest.value};`)
      }

      if (ext.protocol === "icmp" && ext.icmpType) {
        matches.push(`icmp-type ${ext.icmpType};`)
        if (ext.icmpCode) matches.push(`icmp-code ${ext.icmpCode};`)
      }

      if (ext.protocol === "tcp" && ext.established) {
        matches.push("tcp-established;")
      }
    }

    lines.push(`            /* ${rule.description || `Rule ${index + 1}`} */`)
    for (const note of notes) lines.push(`            /* ${note} */`)
    lines.push(`            term rule-${index + 1} {`)

    // an empty from block matches nothing useful; omit it so the term is a
    // deliberate match-all instead of invalid syntax
    if (matches.length > 0) {
      lines.push("                from {")
      for (const match of matches) lines.push(`                    ${match}`)
      lines.push("                }")
    }

    lines.push("                then {")
    lines.push(`                    ${rule.action === "permit" ? "accept" : "discard"};`)
    if (rule.log) lines.push("                    log;")
    lines.push("                }")
    lines.push("            }")
  })

  lines.push("            term deny-all {")
  lines.push("                then {")
  lines.push("                    discard;")
  lines.push("                }")
  lines.push("            }")
  lines.push("        }")
  lines.push("    }")
  lines.push("}")
  lines.push("")
  lines.push("/* Apply to interface: */")
  lines.push(`/* set interfaces ge-0/0/0 unit 0 family inet filter input ${aclName} */`)
  lines.push(`/* set interfaces ge-0/0/0 unit 0 family inet filter output ${aclName} */`)

  return lines.join("\n") + "\n"
}

// junos matches ports by value or range only, so gt/lt become explicit ranges
// and neq is reported rather than silently widened to a match-all
function junosPort(
  operator: PortOperator | undefined,
  port: string | undefined,
  range: string | undefined
): { value: string | null; note?: string } {
  const op = operator ?? "eq"
  if (op === "range") {
    const bounds = parsePortRange(range)
    return { value: bounds ? `${bounds[0]}-${bounds[1]}` : null }
  }
  const raw = port?.trim()
  if (!raw) return { value: null }
  const parsed = Number.parseInt(raw, 10)
  if (!isValidPort(parsed)) return { value: null }
  if (op === "gt") {
    return parsed < MAX_PORT ? { value: `${parsed + 1}-${MAX_PORT}` } : { value: null }
  }
  if (op === "lt") {
    return parsed > MIN_PORT ? { value: `${MIN_PORT}-${parsed - 1}` } : { value: null }
  }
  if (op === "neq") {
    return {
      value: null,
      note: `neq ${parsed} has no single junos port match; invert it with a second term`,
    }
  }
  return { value: `${parsed}` }
}

interface PanServiceObject {
  name: string
  protocol: "tcp" | "udp"
  port: string
  sourcePort?: string
}

function panService(rule: ExtendedACLRule): {
  object: PanServiceObject | null
  notes: string[]
} {
  const notes: string[] = []
  if (!hasPorts(rule.protocol)) return { object: null, notes }

  const operator = rule.destPortOperator ?? "eq"
  let port: string | null = null

  if (operator === "range") {
    const bounds = parsePortRange(rule.destPortRange)
    if (bounds) port = `${bounds[0]}-${bounds[1]}`
  } else if (operator === "eq") {
    const value = rule.destPort?.trim()
    if (value && isValidPort(Number.parseInt(value, 10))) port = value
  } else {
    notes.push(
      `PAN-OS service objects cannot express "${operator} ${rule.destPort ?? ""}"; using service any`
    )
  }

  if (!port) return { object: null, notes }

  const protocol = rule.protocol as "tcp" | "udp"
  let sourcePort: string | undefined
  const sourceOperator = rule.sourcePortOperator ?? "eq"
  if (sourceOperator === "range") {
    const bounds = parsePortRange(rule.sourcePortRange)
    if (bounds) sourcePort = `${bounds[0]}-${bounds[1]}`
  } else if (sourceOperator === "eq") {
    const value = rule.sourcePort?.trim()
    if (value && isValidPort(Number.parseInt(value, 10))) sourcePort = value
  }

  const name = `service-${protocol}-${port}${sourcePort ? `-src-${sourcePort}` : ""}`
  return { object: { name, protocol, port, sourcePort }, notes }
}

function generatePaloAltoRules(spec: ACLSpec, timestamp: string): string {
  const { aclType, aclName, standardRules, extendedRules } = spec
  const rules: ACLRule[] = aclType === "standard" ? standardRules : extendedRules
  const rulebase = "set rulebase security rules"
  const lines: string[] = []
  const services: PanServiceObject[] = []

  lines.push(`# ${aclType.toUpperCase()} Security Policy ${aclName} - Generated by Network Toolbox`)
  lines.push(`# Generated on: ${timestamp}`)
  lines.push(`# Total rules: ${rules.length}`)
  lines.push("# Format: PAN-OS CLI set commands")
  lines.push("")

  const ruleLines: string[] = []

  rules.forEach((rule, index) => {
    const ruleName = `${aclName}-rule-${index + 1}`
    const description = rule.description || `Rule ${index + 1}`
    const emit = (fragment: string) => ruleLines.push(`${rulebase} "${ruleName}" ${fragment}`)

    ruleLines.push(`# ${description}`)
    emit("from any")
    emit("to any")

    const address = (keyword: "source" | "destination", value: string) => {
      if (value === "any") {
        emit(`${keyword} any`)
        return
      }
      try {
        const cidr = toCidr(parseACLNetwork(value))
        emit(`${keyword} ${cidr ?? "any"}`)
      } catch {
        ruleLines.push(`# Error: Invalid ${keyword} network`)
      }
    }

    address("source", rule.sourceNetwork)

    if (aclType === "standard") {
      emit("destination any")
      emit("application any")
      emit("service any")
    } else {
      const ext = rule as ExtendedACLRule
      address("destination", ext.destNetwork)

      // pan-os requires an application on every security rule
      emit(ext.protocol === "icmp" ? "application [ ping ]" : "application any")

      if (ext.protocol === "icmp") {
        emit("service application-default")
      } else {
        const { object, notes } = panService(ext)
        for (const note of notes) ruleLines.push(`# ${note}`)
        if (object) {
          services.push(object)
          emit(`service [ ${object.name} ]`)
        } else {
          emit("service any")
        }
      }
    }

    emit(`action ${rule.action === "permit" ? "allow" : "deny"}`)

    if (rule.log) {
      emit("log-start yes")
      emit("log-end yes")
    }

    emit(`description "${description}"`)
    ruleLines.push("")
  })

  if (services.length > 0) {
    lines.push("# Service objects referenced by the rules below")
    const seen = new Set<string>()
    for (const service of services) {
      if (seen.has(service.name)) continue
      seen.add(service.name)
      lines.push(
        `set service ${service.name} protocol ${service.protocol} port ${service.port}` +
          (service.sourcePort ? ` source-port ${service.sourcePort}` : "")
      )
    }
    lines.push("")
  }

  lines.push(...ruleLines)

  lines.push("# Implicit Deny Rule")
  const denyName = `${aclName}-deny-all`
  for (const fragment of [
    "from any",
    "to any",
    "source any",
    "destination any",
    "application any",
    "service any",
    "action deny",
    "log-end yes",
    'description "Implicit deny all"',
  ]) {
    lines.push(`${rulebase} "${denyName}" ${fragment}`)
  }
  lines.push("")
  lines.push("# Don't forget to commit: commit")

  return lines.join("\n") + "\n"
}

export function generateACL(spec: ACLSpec): string {
  const timestamp = spec.timestamp ?? new Date().toISOString()

  switch (spec.platform) {
    case "juniper-junos":
      return generateJuniperFilter(spec, timestamp)
    case "paloalto-panos":
      return generatePaloAltoRules(spec, timestamp)
    default:
      return generateCiscoACL(spec, timestamp)
  }
}

export const SAMPLE_STANDARD_RULES: StandardACLRule[] = [
  {
    id: "1",
    action: "permit",
    sourceNetwork: "192.168.1.0/24",
    description: "Allow internal network",
  },
  {
    id: "2",
    action: "permit",
    sourceNetwork: "host 10.0.0.100",
    description: "Allow specific admin host",
  },
  {
    id: "3",
    action: "deny",
    sourceNetwork: "10.0.0.0/8",
    description: "Block other private networks",
  },
]

export const SAMPLE_EXTENDED_RULES: ExtendedACLRule[] = [
  {
    id: "1",
    action: "permit",
    protocol: "tcp",
    sourceNetwork: "10.0.0.0/24",
    destNetwork: "any",
    destPort: "443",
    destPortOperator: "eq",
    description: "Allow HTTPS from internal network",
  },
  {
    id: "2",
    action: "permit",
    protocol: "tcp",
    sourceNetwork: "192.168.1.0/24",
    destNetwork: "10.0.10.0/24",
    destPort: "22",
    destPortOperator: "eq",
    established: true,
    description: "Allow established SSH from admin network",
  },
  {
    id: "3",
    action: "deny",
    protocol: "tcp",
    sourceNetwork: "any",
    destNetwork: "10.0.10.0/24",
    destPort: "22",
    destPortOperator: "eq",
    log: true,
    description: "Block and log SSH attempts to servers",
  },
]
