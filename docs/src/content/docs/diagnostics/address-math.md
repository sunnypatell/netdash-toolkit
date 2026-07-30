---
title: Address math, walked through
description: The RFC 5952 compression rule, modified EUI-64, solicited-node multicast, RFC 3021 point-to-point subnets and MTU overhead, each worked with real numbers against the code that implements it.
---

The 36 offline tools are all arithmetic, which means every answer they give is checkable by hand. This page walks the five pieces that are easy to get subtly wrong, with the rule, the code, and a worked example.

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

[RFC 3021](https://www.rfc-editor.org/rfc/rfc3021#section-2.1) is the interesting one. On a point-to-point link there is nobody to broadcast to: a packet sent by one end can only reach the other. So the two addresses in a `/31` are both usable, and the general formula would return `2 - 2 = 0` usable hosts for a prefix that router vendors have supported for two decades. Getting this wrong is the classic subnet-calculator bug, and it is [covered in `tests/unit/network-utils.test.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/tests/unit/network-utils.test.ts).

One deliberate choice worth flagging: address classification runs against the **host** address, not the network address. `192.168.1.5/8` has network `192.0.0.0`, which is not private, but the address you typed is still [RFC 1918 section 3](https://www.rfc-editor.org/rfc/rfc1918#section-3) space. The comment in the code says so. The classifier covers `10/8`, `172.16/12`, `192.168/16`, loopback, link-local and multicast; it does **NOT** cover `100.64.0.0/10` shared address space ([RFC 6598](https://www.rfc-editor.org/rfc/rfc6598#section-7)) or the documentation ranges in the [IANA IPv4 Special-Purpose Address Registry](https://www.iana.org/assignments/iana-ipv4-special-registry/iana-ipv4-special-registry.xhtml), so a CGNAT address is reported as public.

## RFC 5952 compression, and why the leftmost longest run wins

[RFC 5952 section 4.2](https://www.rfc-editor.org/rfc/rfc5952#section-4.2) gives three rules that together make IPv6 text canonical, and they matter because two spellings of the same address must compare equal:

| Rule                         | Section                                                       | Requirement                                      |
| ---------------------------- | ------------------------------------------------------------- | ------------------------------------------------ |
| Shorten as much as possible  | [4.2.1](https://www.rfc-editor.org/rfc/rfc5952#section-4.2.1) | `::` must be used wherever it can be             |
| Never shorten a single group | [4.2.2](https://www.rfc-editor.org/rfc/rfc5952#section-4.2.2) | `2001:db8:0:1::1` keeps that lone `0`            |
| Longest run, then leftmost   | [4.2.3](https://www.rfc-editor.org/rfc/rfc5952#section-4.2.3) | on a tie, the **first** run is the one shortened |
| Lowercase hex                | [4.3](https://www.rfc-editor.org/rfc/rfc5952#section-4.3)     | `2001:db8` not `2001:DB8`                        |

[`compressIPv6`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-utils.ts#L207-L262) implements all four. The tie-break is one character:

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

The `>= 2` guard on the compression branch is what enforces 4.2.2: a run of one is never eligible.

Two more details in the same file. [`splitIPv6Zone`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-utils.ts#L153-L161) peels off the `%eth0` scope identifier before parsing and reattaches it after, because a zone ID is part of the textual form under [RFC 4007 section 11](https://www.rfc-editor.org/rfc/rfc4007#section-11) and not part of the address. And [`expandIPv6`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-utils.ts#L163-L204) converts the IPv4-embedded form of [RFC 4291 section 2.5.5](https://www.rfc-editor.org/rfc/rfc4291#section-2.5.5), so `::ffff:192.168.1.1` becomes eight hex groups rather than failing to parse.

This also explains a note in the DNS code. The `AAAA` answers coming back from a resolver are recompressed through this function, because the underlying codec compresses the first zero run rather than the longest, and its output is therefore not canonical.

## Modified EUI-64, and the bit that gets flipped

[RFC 4291 Appendix A](https://www.rfc-editor.org/rfc/rfc4291#appendix-A) derives a 64-bit interface identifier from a 48-bit MAC address. Two steps: insert `FFFE` in the middle, and invert the universal/local bit.

[`generateEUI64FromMAC`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-testing.ts#L1324-L1348):

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

## Solicited-node multicast

[RFC 4291 section 2.7.1](https://www.rfc-editor.org/rfc/rfc4291#section-2.7.1) defines the solicited-node address as `ff02::1:ff00:0/104` with the low 24 bits of the target address appended. Neighbour Discovery uses it so a neighbour solicitation reaches one host instead of every host on the link ([RFC 4861 section 7.2.1](https://www.rfc-editor.org/rfc/rfc4861#section-7.2.1)).

[`solicitedNodeMulticast`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-utils.ts#L264-L280) takes the last two groups of the expanded address and masks them:

```ts
const upper = Number.parseInt(groups[6], 16) & 0xff // low byte of group 7
const lower = Number.parseInt(groups[7], 16) & 0xffff // all of group 8
return `ff02::1:ff${upper.toString(16).padStart(2, "0")}:${lower.toString(16).padStart(4, "0")}`
```

`0xff` on the upper group plus `0xffff` on the lower is 8 + 16 = 24 bits, which is the `/104` remainder exactly. Worked:

```text
target       2001:db8::21a:2bff:fe3c:4d5e
expanded     2001:0db8:0000:0000:021a:2bff:fe3c:4d5e
groups[6]    fe3c  -> & 0xff   -> 0x3c
groups[7]    4d5e  -> & 0xffff -> 0x4d5e
result       ff02::1:ff3c:4d5e
```

The `padStart` calls are the part that was actually broken once. The comment in `lib/network-testing.ts` records that a second copy of this function mis-sliced unpadded groups, so an address whose group 7 rendered as `3c` instead of `003c` produced the wrong multicast address. There is now one implementation in `lib/network-utils.ts` and a re-export shim under the old name, and the behaviour is pinned in [`tests/unit/network-utils.test.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/tests/unit/network-utils.test.ts).

## MTU overhead, and the 1280 floor

[`calculateMTU`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-testing.ts#L1085-L1099) is a subtraction, and the interesting part is the header table and the warning threshold:

```ts
const totalOverhead = protocols.reduce((sum, protocol) => sum + protocol.size, 0)
const payloadMTU = linkMTU - totalOverhead
return {
  linkMTU,
  headers: protocols,
  totalOverhead,
  payloadMTU,
  fragmentationWarning: payloadMTU < 1280,
}
```

1280 is not a round number someone liked. It is the minimum link MTU every IPv6 link must support, from [RFC 8200 section 5](https://www.rfc-editor.org/rfc/rfc8200#section-5). Drop below it and IPv6 cannot pass at all, so the flag means "this path is broken for IPv6", not "this path is slow".

The overhead figures in [`PROTOCOL_OVERHEADS`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-testing.ts#L1101-L1115), in bytes:

| Layer       | Bytes | Notes                                                    |
| ----------- | ----- | -------------------------------------------------------- |
| Ethernet II | 14    | destination, source, type; the 4-byte FCS is not counted |
| 802.1Q      | 4     | one VLAN tag                                             |
| QinQ        | 8     | the full 802.1ad double tag, so two 4-byte tags          |
| IPv4        | 20    | minimum header, no options                               |
| IPv6        | 40    | fixed header, no extension headers                       |
| TCP         | 20    | minimum header, no options, so no timestamps or SACK     |
| UDP         | 8     | the whole header                                         |
| GRE         | 24    | including the delivery IPv4 header                       |
| VXLAN       | 50    | outer Ethernet, IP, UDP and VXLAN together               |
| PPPoE       | 8     | PPPoE plus PPP                                           |
| IPsec ESP   | 50    | tunnel mode, a typical figure rather than an exact one   |
| MPLS        | 4     | one label                                                |

Read the Notes column as a list of things the figure does **not** include. IPv4 is 20 because options are rare, TCP is 20 because the calculator cannot know whether timestamps are negotiated, and IPsec ESP is a typical tunnel-mode figure because the real number depends on the cipher, the IV and the padding. If you need the exact number for a production tunnel, measure it; this table gets you to the right order of magnitude and to the fragmentation warning.

Worked, for a VXLAN overlay on a standard 1500-byte Ethernet path:

```text
linkMTU        1500
VXLAN            50   # outer Ethernet + IP + UDP + VXLAN
inner IPv6       40
inner TCP        20
totalOverhead   110
payloadMTU     1390   # >= 1280, so no warning
```

And the same overlay on a PPPoE access link, which is where this stops being academic:

```text
linkMTU        1492   # 1500 - 8 for PPPoE
VXLAN            50
inner IPv6       40
inner TCP        20
totalOverhead   110
payloadMTU     1382   # still fine
```

Add one more encapsulation, say IPsec ESP at 50 bytes, and the payload drops to 1332. Add a second, and you are through the floor and IPv6 stops working inside the tunnel while IPv4 keeps limping. That transition is what the warning exists to catch, and it is why the threshold is an IPv6 constant rather than a percentage.

:::tip[Check the Arithmetic Yourself]
Every worked example above can be reproduced by hand from the linked RFC section, which is the point. If the app and the RFC disagree, the RFC wins and the app has a bug worth [filing](https://github.com/sunnypatell/netdash-toolkit/issues).
:::
