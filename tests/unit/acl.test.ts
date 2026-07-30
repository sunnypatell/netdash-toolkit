import { describe, expect, it } from "vitest"
import {
  SAMPLE_EXTENDED_RULES,
  SAMPLE_STANDARD_RULES,
  checkACLName,
  generateACL,
  parseACLNetwork,
  parsePortRange,
  validateExtendedRule,
  validateStandardRule,
  wildcardToPrefix,
} from "@/lib/acl"
import type { ACLPlatform, ACLSpec, ExtendedACLRule, StandardACLRule } from "@/lib/acl"

const TIMESTAMP = "2026-01-01T00:00:00.000Z"

const std = (extra: Partial<StandardACLRule> = {}): StandardACLRule => ({
  id: "1",
  action: "permit",
  sourceNetwork: "any",
  ...extra,
})

const ext = (extra: Partial<ExtendedACLRule> = {}): ExtendedACLRule => ({
  id: "1",
  action: "permit",
  protocol: "tcp",
  sourceNetwork: "any",
  destNetwork: "any",
  ...extra,
})

const gen = (
  spec: Partial<ACLSpec> & { platform?: ACLPlatform } = {},
  rules: { standard?: StandardACLRule[]; extended?: ExtendedACLRule[] } = {}
): string =>
  generateACL({
    aclType: "extended",
    aclName: "101",
    platform: "cisco-ios",
    standardRules: rules.standard ?? [],
    extendedRules: rules.extended ?? [],
    timestamp: TIMESTAMP,
    ...spec,
  })

const lines = (output: string): string[] =>
  output.split("\n").filter((line) => line.trim().length > 0)

describe("parseACLNetwork", () => {
  it("emits a wildcard mask, never a subnet mask", () => {
    const parsed = parseACLNetwork("10.0.0.0/24")
    expect(parsed.wildcard).toBe("0.0.0.255")
    expect(parsed.wildcard).not.toBe("255.255.255.0")
  })

  it("treats /32 and host syntax as a host entry", () => {
    expect(parseACLNetwork("10.0.0.1/32").kind).toBe("host")
    expect(parseACLNetwork("host 10.0.0.1")).toMatchObject({ kind: "host", host: "10.0.0.1" })
  })

  it("normalizes a host bit into the network address and says so", () => {
    const parsed = parseACLNetwork("192.168.1.5/24")
    expect(parsed.network).toBe("192.168.1.0")
    expect(parsed.warnings).toContain("Normalized network to 192.168.1.0/24")
  })

  it("rejects an out-of-range prefix and junk input", () => {
    // renamed: none of these is a mask at all, so none of them ever reached a
    // contiguity check. parseACLNetwork takes a prefix length, so it cannot
    // receive a non-contiguous mask in the first place
    expect(() => parseACLNetwork("10.0.0.0/33")).toThrow()
    expect(() => parseACLNetwork("999.1.1.1")).toThrow()
    expect(() => parseACLNetwork("")).toThrow()
  })

  it("converts a wildcard to a prefix and refuses a non-contiguous one", () => {
    // the contiguity logic lives here, and nothing called it: its only in-repo
    // call site is unreachable because parseACLNetwork always sets prefix
    expect(wildcardToPrefix("0.0.0.255")).toBe(24)
    expect(wildcardToPrefix("0.0.0.0")).toBe(32)
    expect(wildcardToPrefix("255.255.255.255")).toBe(0)
    expect(wildcardToPrefix("0.0.15.255")).toBe(20)
    // 0.255.0.255 inverts to 255.0.255.0, which is not a run of leading 1 bits
    expect(() => wildcardToPrefix("0.255.0.255")).toThrow(/contiguous/i)
  })
})

describe("cisco ios acl numbering", () => {
  it("accepts the documented standard and extended ranges", () => {
    for (const n of ["1", "99", "1300", "1999"]) {
      expect(checkACLName(n, "standard").errors).toEqual([])
    }
    for (const n of ["100", "199", "2000", "2699"]) {
      expect(checkACLName(n, "extended").errors).toEqual([])
    }
  })

  it("rejects a number that belongs to the other acl type", () => {
    expect(checkACLName("101", "standard").errors[0]).toMatch(/extended ACL number/)
    expect(checkACLName("10", "extended").errors[0]).toMatch(/standard ACL number/)
  })

  it("rejects numbers outside every valid range", () => {
    expect(checkACLName("100000", "extended").errors[0]).toMatch(/not a valid extended/)
    expect(checkACLName("700", "extended").errors[0]).toMatch(/not a valid extended/)
  })

  it("treats non-numeric input as a named acl and enforces the name rules", () => {
    expect(checkACLName("WEB-ACL", "extended")).toMatchObject({ kind: "named", errors: [] })
    expect(checkACLName("1web", "extended").errors).not.toEqual([])
    expect(checkACLName("web acl", "extended").errors).not.toEqual([])
  })

  it("warns inside the generated config when the number cannot work", () => {
    const output = gen({ aclType: "standard", aclName: "101" }, { standard: [std()] })
    expect(output).toContain("! WARNING: 101 is an extended ACL number")
  })
})

describe("cisco ios standard acl", () => {
  it("emits network plus wildcard, host, and any forms", () => {
    const output = gen(
      { aclType: "standard", aclName: "10" },
      {
        standard: [
          std({ id: "a", sourceNetwork: "192.168.1.0/24", description: "Allow internal network" }),
          std({ id: "b", sourceNetwork: "host 10.0.0.100" }),
          std({ id: "c", action: "deny", sourceNetwork: "any", log: true }),
        ],
      }
    )

    expect(output).toContain("access-list 10 permit 192.168.1.0 0.0.0.255")
    expect(output).toContain("access-list 10 permit host 10.0.0.100")
    expect(output).toContain("access-list 10 deny any log")
    expect(output).toContain("! Rule 1: Allow internal network")
  })

  it("closes with an explicit deny any and an access-group hint", () => {
    const output = gen({ aclType: "standard", aclName: "10" }, { standard: SAMPLE_STANDARD_RULES })
    // whole line, not a prefix substring: toContain also accepted
    // "access-list 10 deny any log" and "deny any any", neither of which is
    // valid standard-acl syntax
    expect(output.split("\n").map((l) => l.trim())).toContain("access-list 10 deny any")
    expect(output).not.toContain("access-list 10 deny ip any any")
    expect(output).toContain("!  ip access-group 10 in")
  })
})

describe("cisco ios extended acl", () => {
  it("emits protocol, wildcards, and the port operator in ios order", () => {
    const output = gen({}, { extended: SAMPLE_EXTENDED_RULES })
    expect(output).toContain("access-list 101 permit tcp 10.0.0.0 0.0.0.255 any eq 443")
    expect(output).toContain(
      "access-list 101 permit tcp 192.168.1.0 0.0.0.255 10.0.10.0 0.0.0.255 eq 22 established"
    )
    expect(output).toContain("access-list 101 deny tcp any 10.0.10.0 0.0.0.255 eq 22 log")
    expect(output).toContain("access-list 101 deny ip any any")
  })

  it("emits a port range even when only the range field is filled in", () => {
    const output = gen(
      {},
      { extended: [ext({ destPortOperator: "range", destPortRange: "8000-8080" })] }
    )
    expect(output).toContain("access-list 101 permit tcp any any range 8000 8080")
  })

  it("keeps source and destination port clauses on the correct side", () => {
    const output = gen(
      {},
      {
        extended: [
          ext({
            sourceNetwork: "10.0.0.0/8",
            sourcePortOperator: "gt",
            sourcePort: "1023",
            destNetwork: "host 8.8.8.8",
            destPortOperator: "eq",
            destPort: "53",
            protocol: "udp",
          }),
        ],
      }
    )
    expect(output).toContain(
      "access-list 101 permit udp 10.0.0.0 0.255.255.255 gt 1023 host 8.8.8.8 eq 53"
    )
  })

  it("maps the legacy any protocol to the ios ip keyword", () => {
    const output = gen({}, { extended: [ext({ protocol: "any" })] })
    expect(output).toContain("access-list 101 permit ip any any")
    expect(output).not.toMatch(/permit any any any/)
  })

  it("places icmp type and code after the destination and drops port clauses", () => {
    const output = gen(
      {},
      { extended: [ext({ protocol: "icmp", icmpType: "8", icmpCode: "0", destPort: "443" })] }
    )
    expect(output).toContain("access-list 101 permit icmp any any 8 0")
    expect(output).not.toContain("eq 443")
  })

  it("omits established for non-tcp protocols", () => {
    const output = gen({}, { extended: [ext({ protocol: "udp", established: true })] })
    expect(output).not.toContain("established")
  })
})

describe("cisco ios named acl", () => {
  const output = gen(
    { aclName: "WEB-ACL" },
    { extended: [ext({ destPortOperator: "eq", destPort: "443", description: "Allow HTTPS" })] }
  )

  it("uses the ip access-list block form, not numbered syntax", () => {
    expect(output).toContain("ip access-list extended WEB-ACL")
    expect(output).not.toContain("access-list WEB-ACL permit")
  })

  it("indents entries inside the block and documents them with remark", () => {
    expect(lines(output)).toContain(" remark Allow HTTPS")
    expect(lines(output)).toContain(" permit tcp any any eq 443")
    expect(lines(output)).toContain(" deny ip any any")
  })

  it("uses the standard keyword for a standard named acl", () => {
    const standard = gen(
      { aclType: "standard", aclName: "MGMT" },
      { standard: [std({ sourceNetwork: "192.168.1.0/24" })] }
    )
    expect(standard).toContain("ip access-list standard MGMT")
    expect(lines(standard)).toContain(" permit 192.168.1.0 0.0.0.255")
    expect(lines(standard)).toContain(" deny any")
  })
})

describe("juniper junos firewall filter", () => {
  it("uses prefix lengths, never wildcard masks", () => {
    const output = gen(
      { platform: "juniper-junos" },
      {
        extended: [
          ext({
            sourceNetwork: "10.0.0.0/24",
            destNetwork: "host 192.0.2.10",
            destPortOperator: "eq",
            destPort: "443",
          }),
        ],
      }
    )
    expect(output).toContain("source-address 10.0.0.0/24;")
    expect(output).toContain("destination-address 192.0.2.10/32;")
    expect(output).toContain("destination-port 443;")
    expect(output).not.toContain("0.0.0.255")
  })

  it("omits the from block entirely when a term matches everything", () => {
    const output = gen(
      { platform: "juniper-junos", aclType: "standard" },
      { standard: [std({ sourceNetwork: "any" })] }
    )
    expect(output).not.toContain("from {")
    expect(output).toContain("accept;")
  })

  it("carries log through on permit terms, not only on discard", () => {
    const output = gen(
      { platform: "juniper-junos" },
      { extended: [ext({ action: "permit", log: true })] }
    )
    expect(output).toMatch(/accept;\n\s+log;/)
  })

  it("translates gt into an explicit port range and flags neq", () => {
    const gt = gen(
      { platform: "juniper-junos" },
      { extended: [ext({ destPortOperator: "gt", destPort: "1023" })] }
    )
    expect(gt).toContain("destination-port 1024-65535;")

    const neq = gen(
      { platform: "juniper-junos" },
      { extended: [ext({ destPortOperator: "neq", destPort: "25" })] }
    )
    expect(neq).not.toMatch(/destination-port \d/)
    expect(neq).toContain("neq 25 has no single junos port match")
  })

  it("keeps tcp-established, icmp-type, and a trailing discard term", () => {
    const output = gen(
      { platform: "juniper-junos" },
      {
        extended: [
          ext({ established: true }),
          ext({ id: "2", protocol: "icmp", icmpType: "8", icmpCode: "0" }),
        ],
      }
    )
    expect(output).toContain("tcp-established;")
    expect(output).toContain("icmp-type 8;")
    expect(output).toContain("icmp-code 0;")
    expect(output).toMatch(/term deny-all \{\n\s+then \{\n\s+discard;/)
  })
})

describe("palo alto pan-os security rules", () => {
  it("defines the service object it references instead of inventing a name", () => {
    const output = gen(
      { platform: "paloalto-panos" },
      { extended: [ext({ destPortOperator: "eq", destPort: "443" })] }
    )
    expect(output).toContain("set service service-tcp-443 protocol tcp port 443")
    expect(output).toContain("service [ service-tcp-443 ]")
    const serviceLine = output.indexOf("set service service-tcp-443")
    const ruleLine = output.indexOf("service [ service-tcp-443 ]")
    expect(serviceLine).toBeGreaterThan(-1)
    expect(serviceLine).toBeLessThan(ruleLine)
  })

  it("sets an application on every rule, which pan-os requires", () => {
    const output = gen(
      { platform: "paloalto-panos" },
      { extended: [ext({ destPortOperator: "eq", destPort: "443" })] }
    )
    const applications = output.match(/application any/g) ?? []
    // one for the rule, one for the trailing implicit deny
    expect(applications.length).toBe(2)
  })

  it("never references a service object for an operator it cannot express", () => {
    const output = gen(
      { platform: "paloalto-panos" },
      { extended: [ext({ destPortOperator: "gt", destPort: "1023" })] }
    )
    expect(output).not.toContain("service-tcp-")
    expect(output).toContain("PAN-OS service objects cannot express")
    expect(output).toContain("service any")
  })

  it("uses prefixes for addresses and allow/deny for actions", () => {
    const output = gen(
      { platform: "paloalto-panos" },
      { extended: [ext({ action: "deny", sourceNetwork: "10.0.0.0/24", log: true })] }
    )
    expect(output).toContain("source 10.0.0.0/24")
    expect(output).toContain("action deny")
    expect(output).toContain("log-start yes")
    expect(output).toContain('"101-deny-all" action deny')
  })
})

describe("rule validation", () => {
  it("accepts the shipped sample rules", () => {
    for (const rule of SAMPLE_STANDARD_RULES) {
      expect(validateStandardRule(rule).isValid).toBe(true)
    }
    for (const rule of SAMPLE_EXTENDED_RULES) {
      expect(validateExtendedRule(rule).isValid).toBe(true)
    }
  })

  it("flags a range operator with no usable range", () => {
    expect(validateExtendedRule(ext({ destPortOperator: "range" })).errors).toContain(
      "Invalid destination port range (1-65535)"
    )
    expect(
      validateExtendedRule(ext({ destPortOperator: "range", destPortRange: "90-80" })).errors
    ).toContain("Destination port range start must be lower than its end")
  })

  it("rejects out of range ports and icmp values", () => {
    expect(validateExtendedRule(ext({ destPort: "70000" })).isValid).toBe(false)
    expect(validateExtendedRule(ext({ protocol: "icmp", icmpType: "300" })).isValid).toBe(false)
  })

  it("warns when a field will be dropped from the generated config", () => {
    expect(validateExtendedRule(ext({ protocol: "icmp", destPort: "443" })).warnings).toContain(
      "Ports do not apply to icmp; they will be omitted"
    )
    expect(validateExtendedRule(ext({ protocol: "udp", established: true })).warnings).toContain(
      "established applies to TCP only; it will be omitted"
    )
    expect(validateExtendedRule(ext({ protocol: "tcp", icmpType: "8" })).warnings).toContain(
      "ICMP type and code apply to ICMP only; they will be omitted"
    )
  })

  it("surfaces the normalization warning from the network parser", () => {
    expect(validateStandardRule(std({ sourceNetwork: "192.168.1.5/24" })).warnings).toContain(
      "Normalized network to 192.168.1.0/24"
    )
  })
})

describe("parsePortRange", () => {
  it("accepts dash and space separated ranges and rejects the rest", () => {
    expect(parsePortRange("80-90")).toEqual([80, 90])
    expect(parsePortRange(" 80 - 90 ")).toEqual([80, 90])
    expect(parsePortRange("80")).toBeNull()
    expect(parsePortRange("80-70000")).toBeNull()
    expect(parsePortRange(undefined)).toBeNull()
  })
})
