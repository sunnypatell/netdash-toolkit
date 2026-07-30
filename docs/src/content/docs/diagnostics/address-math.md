---
title: Address math, walked through
description: The RFC 5952 compression rule, modified EUI-64, solicited-node multicast, RFC 3021 point-to-point subnets, and MTU and MSS arithmetic, each worked with real numbers against the code that implements it.
---

The 36 offline tools are all arithmetic, which means every answer they give is checkable by hand. This page walks the five pieces that are easy to get subtly wrong, with the rule, the code, and a worked example.

Every number in the worked examples below was produced by calling the function it illustrates and reading the result, not by doing the arithmetic in prose. If one of them is wrong, the code is wrong too, which is the point.

## IPv4 subnetting, and the `/31` and `/32` special cases

[`calculateIPv4Subnet`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-utils.ts#L85-L148) does the whole thing in 32-bit integer space:

```ts
const ipInt = ipv4ToInt(ip)
const maskInt = prefixToMaskInt(prefix)
const networkInt = (ipInt & maskInt) >>> 0
const broadcastInt = (networkInt | (~maskInt >>> 0)) >>> 0
```

The `>>> 0` on every line is not decoration. JavaScript bitwise operators produce signed 32-bit results, so without the unsigned shift a mask with the high bit set comes back negative and every subsequent comparison is wrong.

Worked, for `192.168.1.130/26`:

```text
ip        = 192.168.1.130 -> 11000000 10101000 00000001 10000010
mask /26  = 255.255.255.192 -> 11111111 11111111 11111111 11000000

network   = ip AND mask     -> 11000000 10101000 00000001 10000000 = 192.168.1.128
wildcard  = NOT mask        -> 00000000 00000000 00000000 00111111 = 0.0.0.63
broadcast = network OR wc   -> 11000000 10101000 00000001 10111111 = 192.168.1.191

firstHost = network + 1   = 192.168.1.129
lastHost  = broadcast - 1 = 192.168.1.190
hostCount = 2^(32-26) - 2 = 64 - 2 = 62
```

The `- 2` is the network and broadcast addresses. That subtraction is exactly what breaks at long prefixes, and the code special-cases both:

| Prefix | `firstHost`   | `lastHost`      | `hostCount`     | Why                                                                        |
| ------ | ------------- | --------------- | --------------- | -------------------------------------------------------------------------- |
| `/24`  | `network + 1` | `broadcast - 1` | `2^8 - 2` = 254 | the general case                                                           |
| `/31`  | `network`     | `broadcast`     | 2               | [RFC 3021 section 2.1](https://www.rfc-editor.org/rfc/rfc3021#section-2.1) |
| `/32`  | `network`     | `network`       | 1               | a host route, not a subnet                                                 |

[RFC 3021](https://www.rfc-editor.org/rfc/rfc3021#section-2.1) is the interesting one. On a point-to-point link there is nobody to broadcast to: a packet sent by one end can only reach the other. So the two addresses in a `/31` are both usable, and the general formula would return `2 - 2 = 0` usable hosts for a prefix that router vendors have supported for two decades. Worked out completely:

```text
address   192.0.2.4/31
network   192.0.2.4          # 2 addresses total
broadcast 192.0.2.5

general formula   2^(32-31) - 2 = 2 - 2 = 0 usable   # wrong, and a /31 is legal
rfc 3021 s2.1     both addresses are host addresses  = 2 usable
                  the "broadcast" address is just the peer

so firstHost = network   = 192.0.2.4
   lastHost  = broadcast = 192.0.2.5
```

Getting this wrong is the classic subnet-calculator bug. Three cases in [`tests/unit/network-utils.test.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/tests/unit/network-utils.test.ts) pin the boundary from all sides: "handles /31 per rfc 3021", "handles /32 as a single host", and "handles /0 as the whole address space". The same rule is enforced independently for address enumeration by "treats a /31 as a point-to-point link per rfc 3021" in [`tests/unit/ip-enumerate.test.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/tests/unit/ip-enumerate.test.ts), because two code paths agreeing by accident is not the same as two code paths being tested.

One deliberate choice worth flagging: address classification runs against the **host** address, not the network address. `192.168.1.5/8` has network `192.0.0.0`, which is not private, but the address you typed is still [RFC 1918 section 3](https://www.rfc-editor.org/rfc/rfc1918#section-3) space. The comment in the code says so. The classifier covers `10/8`, `172.16/12`, `192.168/16`, loopback, link-local and multicast; it does **NOT** cover `100.64.0.0/10` shared address space ([RFC 6598](https://www.rfc-editor.org/rfc/rfc6598#section-7)) or the documentation ranges in the [IANA IPv4 Special-Purpose Address Registry](https://www.iana.org/assignments/iana-ipv4-special-registry/iana-ipv4-special-registry.xhtml), so a CGNAT address is reported as public.

## RFC 5952 compression, and why the leftmost longest run wins

[RFC 5952 section 4.2](https://www.rfc-editor.org/rfc/rfc5952#section-4.2) gives three rules that together make IPv6 text canonical, and they matter because two spellings of the same address must compare equal:

| Rule                         | Section                                                       | Requirement                                      |
| ---------------------------- | ------------------------------------------------------------- | ------------------------------------------------ |
| Shorten as much as possible  | [4.2.1](https://www.rfc-editor.org/rfc/rfc5952#section-4.2.1) | `::` must be used wherever it can be             |
| Never shorten a single group | [4.2.2](https://www.rfc-editor.org/rfc/rfc5952#section-4.2.2) | `2001:db8:0:1::1` keeps that lone `0`            |
| Longest run, then leftmost   | [4.2.3](https://www.rfc-editor.org/rfc/rfc5952#section-4.2.3) | on a tie, the **first** run is the one shortened |
| Lowercase hex                | [4.3](https://www.rfc-editor.org/rfc/rfc5952#section-4.3)     | `2001:db8` not `2001:DB8`                        |

[`compressIPv6`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-utils.ts#L217-L273) implements all four. The tie-break is one character:

```ts
if (currentZeroLength > longestZeroLength) {
  longestZeroStart = currentZeroStart
  longestZeroLength = currentZeroLength
}
```

Strictly greater, not greater-or-equal. Scanning left to right, a later run of **equal** length therefore never displaces the one already recorded, which is precisely rule 4.2.3. Change that `>` to `>=` and the function silently starts producing non-canonical output that still looks plausible.

Worked, on the classic ambiguous address:

```text
input     2001:0db8:0000:0000:0001:0000:0000:0001
groups    [2001][0db8][0000][0000][0001][0000][0000][0001]
                       ^^^^^^^^^^        ^^^^^^^^^^
runs      run A at index 2, length 2     run B at index 5, length 2

tie on length -> rule 4.2.3 keeps the leftmost -> compress run A

output    2001:db8::1:0:0:1        # correct
not       2001:db8:0:0:1::1        # what >= would have produced
```

And rule 4.2.2 in action:

```text
input     2001:0db8:0000:0001:0000:0000:0000:0001
runs      length 1 at index 2, length 3 at index 4
longest   the length-3 run wins outright, no tie
output    2001:db8:0:1::1          # the lone zero stays spelled out
```

The `>= 2` guard on the compression branch is what enforces 4.2.2: a run of one is never eligible. The behaviour is pinned by four cases in [`tests/unit/network-utils.test.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/tests/unit/network-utils.test.ts), each named after the rule it defends: "compresses the leftmost longest zero run on ties", "never compresses a single zero group", "lowercases hex per rfc 5952 4.3", and "throws a clear error instead of RangeError past 8 groups".

Three more details in the same file.

[`splitIPv6Zone`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-utils.ts#L155-L161) peels off the `%eth0` scope identifier before parsing and reattaches it after, because a zone ID is part of the textual form under [RFC 4007 section 11](https://www.rfc-editor.org/rfc/rfc4007#section-11) and not part of the address.

[`expandIPv6`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-utils.ts#L163-L207) converts the IPv4-embedded form of [RFC 4291 section 2.5.5](https://www.rfc-editor.org/rfc/rfc4291#section-2.5.5), so `::ffff:192.168.1.1` becomes eight hex groups rather than failing to parse.

And `compressIPv6` starts with an early return through `ipv4MappedText`, which implements the rule the other three rules do not cover. [RFC 5952 section 5](https://www.rfc-editor.org/rfc/rfc5952#section-5) says an address with an embedded IPv4 address keeps the dotted quad in the text form, so the canonical spelling is `::ffff:192.0.2.1` and not `::ffff:c000:201`. The subtlety is the scope: that rule applies to the IPv4-mapped block `::ffff:0:0/96`, not to every address whose last 32 bits could be read as a dotted quad. Two tests draw exactly that line, "keeps the dotted quad for ipv4-mapped addresses (rfc 5952 5)" and "applies the dotted quad only to `::ffff:0:0/96`".

This also explains a note in the DNS code. The `AAAA` answers coming back from a resolver are recompressed through this function, because the underlying codec compresses the first zero run rather than the longest, and its output is therefore not canonical. The test that catches a regression there is "compresses the leftmost longest run, not the first one" in [`tests/unit/network-testing.test.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/tests/unit/network-testing.test.ts).

## Modified EUI-64, and the bit that gets flipped

[RFC 4291 Appendix A](https://www.rfc-editor.org/rfc/rfc4291#appendix-A) derives a 64-bit interface identifier from a 48-bit MAC address. Two steps: insert `FFFE` in the middle, and invert the universal/local bit.

There are two implementations, and it is worth knowing which you are looking at. [`eui64InterfaceId`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/ipv6-address.ts) in `lib/ipv6-address.ts` is the one behind the IPv6 tools; [`generateEUI64FromMAC`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-testing.ts#L1324-L1345) is the older one still wired to the Network Tester's IPv6 panel. They agree, and the duplication is a real rough edge rather than a design. The second one is quoted here because it does the prefix assembly too:

```ts
const firstOctet = Number.parseInt(firstHalf.slice(0, 2), 16)
const flippedOctet = (firstOctet ^ 0x02).toString(16).padStart(2, "0")
const eui64 = (flippedOctet + firstHalf.slice(2) + "FFFE" + secondHalf).toLowerCase()
```

`^ 0x02` is the whole story, and it is worth understanding why it is `0x02` and not `0x40`. In IEEE 802 MAC transmission order the universal/local bit is the second-least-significant bit of the first octet, so as a hex byte it is mask `0x02`. In the IPv6 interface identifier that same bit is defined by [RFC 4291 section 2.5.1](https://www.rfc-editor.org/rfc/rfc4291#section-2.5.1) with **inverted** meaning: `1` means globally unique. Hence an XOR rather than a set or a clear, so the transform is its own inverse.

Worked, for `00:1A:2B:3C:4D:5E` under prefix `2001:db8::/64`:

```text
mac          00 1a 2b 3c 4d 5e
first octet  0x00 = 0000 0000
xor 0x02     0x02 = 0000 0010      # u/l bit flipped: locally scoped MAC -> global IID
insert fffe  02 1a 2b ff fe 3c 4d 5e
as groups    021a:2bff:fe3c:4d5e

prefix       2001:db8:: -> expand -> 2001:0db8:0000:0000
first 4      2001:0db8:0000:0000
address      2001:0db8:0000:0000:021a:2bff:fe3c:4d5e
compress     2001:db8::21a:2bff:fe3c:4d5e
```

A counter-example, because the flip goes both ways. `02:1A:2B:3C:4D:5E` already has the bit set, so `0x02 ^ 0x02 = 0x00` and the identifier becomes `001a:2bff:fe3c:4d5e`. If you see an identifier starting `00` you are looking at a MAC that was locally administered.

The prefix is run through `expandIPv6` before its first four groups are taken, which is why a compressed input like `2001:db8::` contributes the right number of zero groups instead of three groups and a gap.

The test names here are unusually specific on purpose, because "it produces an address" would pass for several wrong implementations. [`tests/unit/ipv6-address.test.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/tests/unit/ipv6-address.test.ts) asserts "inverts the u/l bit, not some other bit", and "refuses a prefix longer than /64, which leaves no room for the iid", which is the constraint that follows from an interface identifier being 64 bits wide. [`tests/unit/network-testing.test.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/tests/unit/network-testing.test.ts) covers the older copy with "flips the universal/local bit and inserts ff:fe" and "expands compressed prefixes and builds the modified eui-64 address".

## Solicited-node multicast

[RFC 4291 section 2.7.1](https://www.rfc-editor.org/rfc/rfc4291#section-2.7.1) defines the solicited-node address as `ff02::1:ff00:0/104` with the low 24 bits of the target address appended. Neighbour Discovery uses it so a neighbour solicitation reaches one host instead of every host on the link ([RFC 4861 section 7.2.1](https://www.rfc-editor.org/rfc/rfc4861#section-7.2.1)).

[`solicitedNodeMulticast`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-utils.ts#L281-L294) takes the last two groups of the expanded address and masks them:

```ts
const upper = Number.parseInt(groups[6], 16) & 0xff // low byte of group 7
const lower = Number.parseInt(groups[7], 16) & 0xffff // all of group 8
// upper is padded because it is the low byte of the group "ff" + XX, not a
// leading zero; lower is a whole group, so rfc 5952 4.1 forbids padding it
return `ff02::1:ff${upper.toString(16).padStart(2, "0")}:${lower.toString(16)}`
```

`0xff` on the upper group plus `0xffff` on the lower is 8 + 16 = 24 bits, which is the `/104` remainder exactly. Worked:

```text
target       2001:db8::21a:2bff:fe3c:4d5e
expanded     2001:0db8:0000:0000:021a:2bff:fe3c:4d5e
groups[6]    fe3c  -> & 0xff   -> 0x3c
groups[7]    4d5e  -> & 0xffff -> 0x4d5e
result       ff02::1:ff3c:4d5e
```

### The two `padStart` calls are not the same decision

This looks like inconsistency and is not, and the asymmetry is the most easily-broken line in the file.

`upper` is padded to two hex digits because it is **not a group**. It is the low byte of a group whose high byte is the literal `ff` that makes the address solicited-node. Writing `ff` + `3` instead of `ff` + `03` shifts every subsequent nibble and produces a different address.

`lower` is **not** padded, because it is a whole 16-bit group, and [RFC 5952 section 4.1](https://www.rfc-editor.org/rfc/rfc5952#section-4.1) requires leading zeros in a group to be suppressed. Padding it would emit a legal-but-non-canonical spelling that fails a string comparison against the same address written correctly.

Worked, on an address that exercises both:

```text
target       2001:db8::1:2:34:5
expanded     2001:0db8:0000:0000:0001:0002:0034:0005
groups[6]    0034  -> & 0xff   -> 0x34     -> "34"    # already two digits
groups[7]    0005  -> & 0xffff -> 0x5      -> "5"     # NOT "0005"
result       ff02::1:ff34:5

and one where the upper byte needs its pad:
target       2001:db8::1:2:3:4567
groups[6]    0003  -> & 0xff   -> 0x3      -> "03"    # padded, or "ff3" is wrong
groups[7]    4567  -> & 0xffff -> 0x4567   -> "4567"
result       ff02::1:ff03:4567
```

Both directions are held by named tests in [`tests/unit/ipv6-address.test.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/tests/unit/ipv6-address.test.ts): "sits inside `ff02::1:ff00:0/104` and carries the low 24 bits", and "suppresses leading zeros as rfc 5952 4.1 requires".

There was also a real bug here. The comment in `lib/network-testing.ts` records that a second copy of this function mis-sliced unpadded groups, so an address whose group 7 rendered as `3c` instead of `003c` produced the wrong multicast address. There is now one implementation in `lib/network-utils.ts`, `generateSolicitedNodeMulticast` in `lib/network-testing.ts` is a re-export shim under the old name, and "delegates to the shared network-utils implementation" in [`tests/unit/network-testing.test.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/tests/unit/network-testing.test.ts) asserts the shim stays a shim.

## MTU, MSS, and the three floors

The MTU Calculator runs on [`lib/mtu.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/mtu.ts). Its opening comment states the design rule: every byte count is decomposed and cited, "because a flat 'overhead' number hides which layer and which cipher it assumed."

:::note[Two MTU implementations, and which one you are using]
`lib/mtu.ts` is what [`/tools/mtu-calculator/`](/tools/mtu-calculator/) uses. An older `calculateMTU` with a different signature still lives in [`lib/network-testing.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-testing.ts#L1085-L1098) with a flat `PROTOCOL_OVERHEADS` map, and it backs the MTU panel inside the Network Tester. The two are not interchangeable and the older one has no MSS output and no RFC 791 floors. That duplication is a defect, not a design, and it is named here rather than hidden.
:::

### The formula

```text
effectiveMTU = linkMTU - SUM(encapsulation bytes)
payloadBytes = effectiveMTU - ipHeader - transportHeader
tcpMSS       = effectiveMTU - ipHeader - TCP_HEADER

where:
  linkMTU        = the layer-2 MTU of the path, 1500 on standard Ethernet
  encapsulation  = every outer layer wrapped around the inner IP packet
  effectiveMTU   = what the inner IP layer sees; the RFC floors apply HERE
  ipHeader       = 20 for IPv4 (RFC 791 s3.1), 40 for IPv6 (RFC 8200 s3)
  transportHeader= 20 for TCP (RFC 9293 s3.1), 8 for UDP (RFC 768), 0 for none
  TCP_HEADER     = always 20, even when the selected transport is UDP
```

The last line is deliberate. `tcpMSS` is reported whatever transport you picked, because the question "what MSS should I clamp to on this path" is the one an operator actually has, and it does not stop being relevant because the tool is currently set to UDP. The test is titled "still reports a TCP MSS when the selected transport is UDP".

The comparison target for the floors is `effectiveMTU`, not `payloadBytes`. That is the correction most calculators get wrong: [RFC 8200 section 5](https://www.rfc-editor.org/rfc/rfc8200#section-5) is a statement about the **link**, so subtracting TCP before comparing would fire the error on paths that are perfectly legal. Two tests draw that line explicitly: "errors only once the effective MTU itself drops below 1280", and "does not fire on a link that is legal but leaves a payload under 1280".

### The three floors

| Constant              | Value | Severity | Source                                                                                                                                                                                            |
| --------------------- | ----- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IPV6_MIN_LINK_MTU`   | 1280  | error    | [RFC 8200 section 5](https://www.rfc-editor.org/rfc/rfc8200#section-5): every link must carry 1280 octets                                                                                         |
| `IPV4_MIN_MTU`        | 68    | error    | [RFC 791 section 3.2](https://www.rfc-editor.org/rfc/rfc791#section-3.2): 60-octet maximum header plus an 8-octet minimum fragment                                                                |
| `IPV4_MIN_REASSEMBLY` | 576   | warning  | [RFC 791 section 3.2](https://www.rfc-editor.org/rfc/rfc791#section-3.2) and [RFC 1122 section 3.3.2](https://www.rfc-editor.org/rfc/rfc1122#section-3.3.2): every host must reassemble this much |

576 is a warning rather than an error because it is a statement about what a host must be able to accept, not about what a link may carry. A 300-byte IPv4 link is legal and works; it is just a place where something will eventually surprise you. "stays silent at exactly 576 even though the payload is smaller" is the boundary test.

The default MSS values are carried too, from [RFC 9293 section 3.7.1](https://www.rfc-editor.org/rfc/rfc9293#section-3.7.1): 536 for IPv4 and 1220 for IPv6. Those are what a peer assumes when no MSS option is exchanged, so they are the floor your path is being compared against.

### The encapsulation table

`ENCAPSULATIONS` holds nine profiles. Each `detail` string names its own components, so the number is auditable rather than folded:

| Id        | Label                                  | Bytes | Decomposition, from the `detail` string                                                                                                                                                                                                          |
| --------- | -------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dot1q`   | 802.1Q VLAN tag                        | 4     | 2-byte TPID plus 2-byte TCI. Costs MTU only on gear that cannot carry a 1522-byte baby-giant frame                                                                                                                                               |
| `qinq`    | 802.1ad QinQ double tag                | 8     | S-TAG plus C-TAG, 4 bytes each                                                                                                                                                                                                                   |
| `pppoe`   | PPPoE                                  | 8     | 6-byte PPPoE header plus 2-byte PPP protocol id ([RFC 2516 section 7](https://www.rfc-editor.org/rfc/rfc2516#section-7))                                                                                                                         |
| `gre`     | GRE over IPv4                          | 24    | 20-byte delivery IPv4 header plus 4-byte GRE ([RFC 2784 section 2.1](https://www.rfc-editor.org/rfc/rfc2784#section-2.1)); add 4 per optional key or sequence field, 44 for an IPv6 delivery header                                              |
| `vxlan`   | VXLAN over IPv4                        | 50    | 20 outer IPv4 + 8 outer UDP + 8 VXLAN + 14 inner Ethernet ([RFC 7348 section 5](https://www.rfc-editor.org/rfc/rfc7348#section-5)); an IPv6 outer costs 70                                                                                       |
| `esp-gcm` | IPsec ESP tunnel, AES-GCM              | 57    | 20 outer IPv4 + 8 ESP + 8 IV ([RFC 4106 section 3](https://www.rfc-editor.org/rfc/rfc4106#section-3)) + 2 trailer + 16 ICV ([section 6](https://www.rfc-editor.org/rfc/rfc4106#section-6)) + up to 3 padding                                     |
| `esp-cbc` | IPsec ESP tunnel, AES-CBC HMAC-SHA1-96 | 73    | 20 outer IPv4 + 8 ESP + 16 IV ([RFC 3602 section 3](https://www.rfc-editor.org/rfc/rfc3602#section-3)) + 2 trailer + 12 ICV + up to 15 padding to the 16-byte block ([RFC 4303 section 2.3](https://www.rfc-editor.org/rfc/rfc4303#section-2.3)) |
| `nat-t`   | IPsec NAT-T UDP encapsulation          | 8     | 8-byte UDP header wrapping ESP ([RFC 3948](https://www.rfc-editor.org/rfc/rfc3948#section-2))                                                                                                                                                    |
| `mpls`    | MPLS label                             | 4     | one 4-byte label stack entry ([RFC 3032 section 2.1](https://www.rfc-editor.org/rfc/rfc3032#section-2.1)); add 4 per extra label                                                                                                                 |

Two things that table gets right and a flat "IPsec = 50" does not. The ESP figures are **split by cipher**, because AES-GCM and AES-CBC genuinely differ by 16 bytes, and both are labelled worst case because the padding is variable. And the encapsulation figure is the reduction in the **inner IP MTU** for a given outer layer-3 MTU, which is the number you type into a tunnel interface, rather than a frame-size delta you then have to convert.

### Worked, on a real tunnel stack

Every figure below was produced by calling `calculateMTU` and reading its output, not by adding up the table by hand:

```text
1500-byte Ethernet, IPv6 over TCP, no encapsulation
  effectiveMTU 1500 - 0   = 1500
  payloadBytes 1500 - 40 - 20 = 1440
  tcpMSS       1440                       # the classic IPv6 number
                                          # the IPv4 equivalent is 1460

VXLAN overlay on the same path
  encapsulation 50
  effectiveMTU  1450                      # >= 1280, no error
  payloadBytes  1450 - 40 - 20 = 1390
  tcpMSS        1390

Same overlay over a PPPoE access link
  linkMTU       1492                      # 1500 - 8, which is why DSL is 1492
  effectiveMTU  1442
  payloadBytes  1382                      # still clear of the floor

Now add an AES-GCM IPsec tunnel underneath the overlay
  encapsulation 50 + 57 = 107
  effectiveMTU  1500 - 107 = 1393         # 113 bytes of headroom left
  payloadBytes  1333
  tcpMSS        1333
```

The last stack is the point. It is a completely ordinary design, and it has 113 bytes of margin above the IPv6 floor. Add a single VLAN tag and a NAT-T header, and `effectiveMTU` reaches 1381; add an IPv6 outer header on the VXLAN instead of an IPv4 one, and the extra 20 bytes take you to 1361. Keep going and IPv6 stops passing inside the tunnel while IPv4 keeps limping along fragmenting, which is the failure mode that presents as "the VPN is slow for some sites" and takes a week to find. That transition is what the error exists to catch, and it is why the threshold is an IPv6 constant rather than a percentage.

:::tip[Check the Arithmetic Yourself]
Every worked example above can be reproduced by hand from the linked RFC section, which is the point. If the app and the RFC disagree, the RFC wins and the app has a bug worth [filing](https://github.com/sunnypatell/netdash-toolkit/issues).
:::
