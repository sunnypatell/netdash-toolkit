import { describe, expect, it } from "vitest"
import {
  classifyIPv6,
  eui64Address,
  eui64InterfaceId,
  linkLocalFromMac,
  solicitedNode,
} from "@/lib/ipv6-address"
import { compressIPv6, expandIPv6, ipv6NetworkPrefix } from "@/lib/network-utils"

describe("rfc 4291 address types", () => {
  it.each([
    ["::", "Unspecified"],
    ["::1", "Loopback"],
    ["::ffff:192.0.2.1", "IPv4-Mapped"],
    ["::192.0.2.1", "IPv4-Compatible (deprecated)"],
    ["64:ff9b::192.0.2.33", "NAT64 Well-Known Prefix"],
    ["ff02::1", "Multicast"],
    ["ff02::1:ff00:1", "Multicast"],
    ["fe80::1", "Link-Local Unicast"],
    // fe80::/10 runs to febf, so febf::1 is still link-local
    ["febf::1", "Link-Local Unicast"],
    ["fec0::1", "Reserved by IETF"],
    ["fc00::1", "Unique Local"],
    ["fd12:3456::1", "Unique Local"],
    ["2001:db8::1", "Documentation"],
    ["2002:c000:204::1", "6to4 (deprecated)"],
    ["2001:4860:4860::8888", "Global Unicast"],
    ["3fff::1", "Global Unicast"],
    // outside 2000::/3 and unnamed: rfc 4291 leaves it reserved
    ["4000::1", "Reserved by IETF"],
    ["100::1", "Reserved by IETF"],
  ])("%s is %s", (address, type) => {
    expect(classifyIPv6(address).type).toBe(type)
  })
})

describe("eui-64 interface identifiers", () => {
  it("inverts the u/l bit, not some other bit", () => {
    // rfc 4291 appendix a: 00:11:22:33:44:55 -> 0211:22ff:fe33:4455
    expect(eui64InterfaceId("00:11:22:33:44:55")).toBe("0211:22ff:fe33:4455")
    // a locally administered mac has u/l already set, so it clears
    expect(eui64InterfaceId("02:11:22:33:44:55")).toBe("0011:22ff:fe33:4455")
    // only 0x02 changes: 0x34 -> 0x36, and the other bits survive
    expect(eui64InterfaceId("34:ab:cd:ef:01:23")).toBe("36ab:cdff:feef:0123")
  })

  it("accepts the mac spellings the rest of the toolkit parses", () => {
    const expected = "0211:22ff:fe33:4455"
    expect(eui64InterfaceId("00-11-22-33-44-55")).toBe(expected)
    expect(eui64InterfaceId("0011.2233.4455")).toBe(expected)
    expect(eui64InterfaceId("001122334455")).toBe(expected)
    expect(eui64InterfaceId("0:11:22:33:44:55")).toBe(expected)
  })

  it("rejects a mac that is not 48 bits", () => {
    expect(() => eui64InterfaceId("00:11:22:33:44")).toThrow()
    expect(() => eui64InterfaceId("")).toThrow()
  })

  it("builds a link-local address from a mac", () => {
    expect(linkLocalFromMac("00:11:22:33:44:55")).toBe("fe80::211:22ff:fe33:4455")
    expect(linkLocalFromMac("00:50:56:12:34:56")).toBe("fe80::250:56ff:fe12:3456")
  })

  it("combines a prefix with the interface identifier", () => {
    expect(eui64Address("2001:db8::", "00:11:22:33:44:55", 64)).toBe("2001:db8::211:22ff:fe33:4455")
    expect(eui64Address("2001:db8:abcd:1234::", "00:11:22:33:44:55", 64)).toBe(
      "2001:db8:abcd:1234:211:22ff:fe33:4455"
    )
  })

  it("refuses a prefix longer than /64, which leaves no room for the iid", () => {
    expect(() => eui64Address("2001:db8::", "00:11:22:33:44:55", 96)).toThrow(/64/)
  })
})

describe("network prefix masking", () => {
  it.each([
    ["2001:db8:abcd:1234::1", 64, "2001:0db8:abcd:1234:0000:0000:0000:0000"],
    ["2001:db8:abcd:1234::1", 48, "2001:0db8:abcd:0000:0000:0000:0000:0000"],
    ["2001:db8:abcd:1234::1", 56, "2001:0db8:abcd:1200:0000:0000:0000:0000"],
    ["2001:db8:abcd:1234::1", 0, "0000:0000:0000:0000:0000:0000:0000:0000"],
    ["2001:db8:abcd:1234::1", 128, "2001:0db8:abcd:1234:0000:0000:0000:0001"],
    ["2001:db8:abcd:1234::1", 3, "2000:0000:0000:0000:0000:0000:0000:0000"],
  ])("%s /%i", (address, prefix, expected) => {
    expect(ipv6NetworkPrefix(address, prefix)).toBe(expected)
  })

  it("rejects a prefix outside 0-128", () => {
    expect(() => ipv6NetworkPrefix("2001:db8::1", 129)).toThrow()
    expect(() => ipv6NetworkPrefix("2001:db8::1", -1)).toThrow()
  })
})

describe("solicited-node multicast per rfc 4291 2.7.1", () => {
  it.each([
    ["2001:db8::1", "ff02::1:ff00:1"],
    ["fe80::211:22ff:fe33:4455", "ff02::1:ff33:4455"],
    ["2001:db8::", "ff02::1:ff00:0"],
    ["2001:db8::ff00:0", "ff02::1:ff00:0"],
    ["2001:db8:0:0:0:0:abcd:ef01", "ff02::1:ffcd:ef01"],
  ])("%s -> %s", (address, expected) => {
    expect(solicitedNode(address)).toBe(expected)
  })

  it("sits inside ff02::1:ff00:0/104 and carries the low 24 bits", () => {
    const address = "2001:db8::a1b2:c3d4"
    const groups = expandIPv6(solicitedNode(address)).split(":")
    expect(groups.slice(0, 6).join(":")).toBe("ff02:0000:0000:0000:0000:0001")
    expect(groups[6].slice(0, 2)).toBe("ff")

    const target = expandIPv6(address).split(":")
    expect(groups[6].slice(2)).toBe(target[6].slice(2))
    expect(groups[7]).toBe(target[7])
  })

  it("suppresses leading zeros as rfc 5952 4.1 requires", () => {
    // ff02::1:ff00:0001 is the same address but the wrong text form
    expect(solicitedNode("2001:db8::1")).not.toContain("0001")
    expect(solicitedNode("2001:db8::1")).toBe(compressIPv6("ff02:0:0:0:0:1:ff00:1"))
  })
})

describe("rfc 5952 compression rules the reference panel documents", () => {
  it("uses :: for the longest run and only once", () => {
    expect(compressIPv6("2001:0db8:0000:0000:0001:0000:0000:0001")).toBe("2001:db8::1:0:0:1")
  })

  it("shortens the first run when two runs tie, per 4.2.3", () => {
    expect(compressIPv6("2001:0db8:0000:0000:0001:0000:0000:0002")).toBe("2001:db8::1:0:0:2")
  })

  it("never uses :: for a single zero group, per 4.2.2", () => {
    expect(compressIPv6("2001:0db8:0000:0001:0001:0001:0001:0001")).toBe("2001:db8:0:1:1:1:1:1")
  })

  it("emits lowercase hex, per 4.3", () => {
    expect(compressIPv6("2001:0DB8:AAAA:0000:0000:0000:0000:00FF")).toBe("2001:db8:aaaa::ff")
  })
})
