---
title: DNS over HTTPS
description: How NetDash Toolkit resolves DNS from a browser, which resolvers it uses in which wire format, and why the DNSSEC indicator is a resolver claim rather than a validation.
---

A browser cannot open a UDP socket to port 53, so the DNS tools speak DNS over HTTPS. That works well, and it changes who sees your queries and what you can trust about the answers.

## Why DoH at all

Classic DNS is UDP or TCP on port 53, registered as service name `domain` in the [IANA Service Name and Transport Protocol Port Number Registry](https://www.iana.org/assignments/service-names-port-numbers/service-names-port-numbers.xhtml) and specified in [RFC 1035 section 4.2](https://www.rfc-editor.org/rfc/rfc1035#section-4.2). A page has no way to send either. DoH ([RFC 8484](https://www.rfc-editor.org/rfc/rfc8484#section-1)) carries the same DNS message inside an HTTPS request, which a page can make. That is the entire trick, and it is why DNS lookups are the one diagnostic that works about as well in the browser as on the desktop.

## The resolvers, and the two wire formats

Five providers are configured in [`lib/network-testing.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-testing.ts#L645-L659). Two speak the DNS wire format defined in [RFC 8484 section 4.1](https://www.rfc-editor.org/rfc/rfc8484#section-4.1); three speak a JSON dialect that is not in any RFC.

| Provider   | Endpoint                               | Format                    | Notes                                               |
| ---------- | -------------------------------------- | ------------------------- | --------------------------------------------------- |
| Cloudflare | `https://cloudflare-dns.com/dns-query` | JSON                      | default provider                                    |
| Google     | `https://dns.google/resolve`           | JSON                      | note the path is `/resolve`, not `/dns-query`       |
| Quad9      | `https://dns.quad9.net/dns-query`      | `application/dns-message` | standards-track path                                |
| OpenDNS    | `https://doh.opendns.com/dns-query`    | `application/dns-message` | standards-track path                                |
| AdGuard    | `https://dns.adguard-dns.com/resolve`  | JSON                      | filtering resolver, so answers may differ by design |

The last row matters more than it looks. AdGuard is a filtering resolver, so a blocked domain returns a real, valid DNS answer that is not the authoritative one. If a lookup disagrees across providers, provider policy is the first thing to check, not a bug.

An unrecognised provider key silently falls back to Cloudflare. There is no local resolver in the list, because a browser cannot reach one.

### What the JSON dialect costs you

The JSON form is a convention popularised by Google and Cloudflare, not a standard. It is convenient, and it means the resolver has already parsed the message for you, so you inherit its interpretation of everything. The wire-format path is the one where the app builds and parses the DNS message itself, in [`buildDnsQueryMessage`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-testing.ts#L888-L911):

```ts
dnsPacket.encode({
  type: "query",
  id: Math.floor(Math.random() * 0xffff),
  flags: dnsPacket.RECURSION_DESIRED,
  questions: [{ type: wireTypeToString(recordType), name }],
  additionals: [{ type: "OPT", name: ".", udpPayloadSize: 4096, flags: dnsPacket.DNSSEC_OK }],
})
```

### Walking the bytes

Every field there maps to something in [RFC 1035 section 4.1](https://www.rfc-editor.org/rfc/rfc1035#section-4.1). This is the actual 40-byte encoding of `AAAA example.com`, produced by running the encoder above with the ID pinned to `0xa37f`:

```text
offset  bytes                    field                        spec
------  -----------------------  ---------------------------  -----------------
0x00    a3 7f                    ID                           RFC 1035 4.1.1
0x02    01 00                    flags: RD set (0x0100)       RFC 1035 4.1.1
0x04    00 01                    QDCOUNT = 1
0x06    00 00                    ANCOUNT = 0
0x08    00 00                    NSCOUNT = 0
0x0a    00 01                    ARCOUNT = 1, the OPT RR      RFC 6891 6.1.1
0x0c    07 65 78 61 6d 70 6c 65  label: len 7, "example"      RFC 1035 4.1.2
0x14    03 63 6f 6d              label: len 3, "com"
0x18    00                       root label, name ends
0x19    00 1c                    QTYPE = 28 (AAAA)            IANA DNS RR TYPEs
0x1b    00 01                    QCLASS = 1 (IN)              RFC 1035 3.2.4
0x1d    00                       OPT NAME = "." (root)        RFC 6891 6.1.2
0x1e    00 29                    TYPE = 41 (OPT)
0x20    10 00                    CLASS = 4096 payload size    RFC 6891 6.2.3
0x22    00 00 80 00              TTL field, DO bit set        RFC 6891 6.1.3
0x26    00 00                    RDLENGTH = 0, no options
```

Four things in that dump are worth dwelling on:

- **The name is a length-prefixed label sequence, not a dotted string.** `07 example 03 com 00` is [RFC 1035 section 4.1.2](https://www.rfc-editor.org/rfc/rfc1035#section-4.1.2). That single-byte length is also where the 63-character label limit comes from: the top two bits are reserved for compression pointers, which leaves six bits, and `2^6 - 1 = 63`.
- **QTYPE 28 is `AAAA`.** The mapping from keyword to number is the [IANA DNS Resource Record TYPEs registry](https://www.iana.org/assignments/dns-parameters/dns-parameters.xhtml#dns-parameters-4), where the registered keywords are `AAAA` = 28, `OPT` = 41, `SVCB` = 64 and `HTTPS` = 65. The app hardcodes the last two because the wire library's type tables predate that family.
- **The OPT record is a pseudo-RR that reuses CLASS and TTL for other things.** [RFC 6891 section 6.1.2](https://www.rfc-editor.org/rfc/rfc6891#section-6.1.2) redefines CLASS as the requestor's UDP payload size, so `10 00` is 4096 bytes ([section 6.2.3](https://www.rfc-editor.org/rfc/rfc6891#section-6.2.3)). Nothing in this record is a real class or a real TTL.
- **The DO bit is NOT the first bit of the TTL field.** [RFC 6891 section 6.1.3](https://www.rfc-editor.org/rfc/rfc6891#section-6.1.3) lays that 32-bit field out as EXTENDED-RCODE, then VERSION, then a 16-bit flags word whose top bit is DO ([RFC 3225 section 3](https://www.rfc-editor.org/rfc/rfc3225#section-3)). So the bytes are `00 00 80 00`, with `0x8000` sitting in the low half. I wrote `80 00 00 00` in the first draft of this page and caught it by encoding a real message and dumping the bytes, which is the only reason the table above is right.

The whole message is then base64url-encoded into the `dns` query parameter, which is what [RFC 8484 section 4.1](https://www.rfc-editor.org/rfc/rfc8484#section-4.1) prescribes for `GET`, with padding stripped:

```ts
// bytesToBase64 then base64 -> base64url
base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
```

The `=` padding is dropped because RFC 8484 section 4.1 requires it, and the padding characters would otherwise need percent-encoding in a URL. Both `buildDnsQueryMessage` and [`parseDnsMessage`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-testing.ts#L934-L956) are exported specifically so they can be tested against hand-assembled wire bytes, which [`tests/unit/network-testing.test.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/tests/unit/network-testing.test.ts) does for the query encoder, the AAAA answer path, and the rdata formatters.

### Two parsing traps

```ts
const status = (decoded.flags ?? 0) & 0x000f // rcode nibble
const truncated = decoded.flag_tc === true
```

- The RCODE is the low four bits of the flags word ([RFC 1035 section 4.1.1](https://www.rfc-editor.org/rfc/rfc1035#section-4.1.1)), and the decoder strips only the QR bit, so the nibble is still in place and has to be masked out rather than read from a dedicated field. Values are the [IANA DNS RCODEs registry](https://www.iana.org/assignments/dns-parameters/dns-parameters.xhtml#dns-parameters-6): `0` NoError, `2` ServFail, `3` NXDomain.
- The TC bit is surfaced as `truncated`, because a truncated answer means the answer section was cut off. A caller that treats a truncated response as complete reports a partial record set as the whole record set, which for an SPF or DKIM check is a wrong answer rather than a short one.

## What DoH does NOT give you

This is the section that matters.

| What people assume                                 | What is actually true                                                                         |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| DoH means the answer is authenticated              | it means the transport is encrypted; the answer's authenticity is a separate problem          |
| The DNSSEC badge means the app validated the chain | the badge is the resolver's AD bit, which is the resolver's claim about its own validation    |
| Nobody sees my queries                             | your chosen resolver sees every query, including the domain name                              |
| I can query my internal DNS server                 | you cannot; DoH goes to a public HTTPS endpoint                                               |
| DoH bypasses my corporate resolver                 | it bypasses the resolver, and your proxy or firewall may still see or block the HTTPS request |

Row two deserves its own paragraph. The AD bit ([RFC 4035 section 3.2.3](https://www.rfc-editor.org/rfc/rfc4035#section-3.2.3), as updated by [RFC 6840 section 5.8](https://www.rfc-editor.org/rfc/rfc6840#section-5.8)) is set by a validating resolver to say "I checked this". A stub client that trusts the AD bit is trusting the resolver and the path to it, not the DNSSEC chain. This app sets the DO bit and reports the AD bit; it performs **NO** local DNSSEC validation, and it cannot, because validating a chain from a browser would mean shipping a trust anchor and a full validator.

Row three is the honest privacy cost of DoH. Sending a lookup for `internal-jira.example.com` to Cloudflare tells Cloudflare that name exists and that someone at your address is interested in it. That is the trade you make in exchange for being able to do DNS from a web page at all. [What leaves your device](/docs/privacy/what-leaves-your-device/) lists it alongside every other outbound request.

## Record types

The UI offers nine keywords from the [IANA DNS Resource Record TYPEs registry](https://www.iana.org/assignments/dns-parameters/dns-parameters.xhtml#dns-parameters-4): `A` (1), `AAAA` (28), `CNAME` (5), `MX` (15), `NS` (2), `TXT` (16), `SOA` (6), `PTR` (12) and `SRV` (33). [`getRecordTypeCode`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-testing.ts#L858-L875) accepts more: `SVCB` (64) and `HTTPS` (65), plus the [RFC 3597 section 5](https://www.rfc-editor.org/rfc/rfc3597#section-5) numeric escape form `TYPEn` for anything the tables do not know.

JSON providers take the type by name and are handed whatever you ask for, so an exotic type is the resolver's call rather than something the app rejects up front. Wire-format providers need a numeric code, so a type with no known code is rejected before a request is made.

Presentation formatting is done per type rather than dumped raw. Two cases are deliberate:

- `AAAA` answers are recompressed through the app's own [`compressIPv6`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-utils.ts#L207-L262), because the underlying codec compresses the first run of zeros rather than the longest, so its output is not canonical under [RFC 5952 section 4.2.3](https://www.rfc-editor.org/rfc/rfc5952#section-4.2.3). [Address math, walked through](/docs/diagnostics/address-math/) shows why that distinction changes the output.
- `TXT` keeps each character-string as its own quoted token instead of concatenating them ([RFC 1035 section 3.3.14](https://www.rfc-editor.org/rfc/rfc1035#section-3.3.14)), because an [SPF record](https://www.rfc-editor.org/rfc/rfc7208#section-3.3) split across strings is a different thing from one long string.

Domain input is validated before anything is sent: labels up to 63 characters, total name up to 253 ([RFC 1035 section 2.3.4](https://www.rfc-editor.org/rfc/rfc1035#section-2.3.4)), and a leading underscore is allowed because [`_dmarc`](https://www.rfc-editor.org/rfc/rfc7489#section-6.1), [`_domainkey`](https://www.rfc-editor.org/rfc/rfc6376#section-3.6.2.1) and [SRV](https://www.rfc-editor.org/rfc/rfc2782) names need it.

## Caching, timeouts and retries

All of this lives in [`queryDNSOverHTTPS`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-testing.ts#L627-L790) and the [`DNSCache`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-testing.ts#L20-L122) class above it.

| Behaviour       | Value                                               | Rationale                                                                      |
| --------------- | --------------------------------------------------- | ------------------------------------------------------------------------------ |
| Cache size      | 100 entries, LRU                                    | it was FIFO, which evicted the entry you were actively re-querying             |
| Cache TTL       | record TTL clamped to 30s minimum and 3600s maximum | a 1-second TTL would make the cache pointless, a 7-day TTL would make it wrong |
| Request timeout | 15000 ms, via `AbortController`                     | a hung resolver should not hang the tool                                       |
| Retries         | up to 3 attempts, backing off 1s then 2s            | only for transport errors and `Server Failure`, never for `NXDOMAIN`           |
| Failed results  | never cached                                        | otherwise a transient outage pins a wrong answer for an hour                   |

Cache hits are labelled: the provider name gets `(cached)` appended and `responseTime` is reported as `0` rather than a fabricated small number. That is the same rule as the rest of the app, applied to caching.

One correctness note that is only visible in [the code](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-testing.ts#L661-L731): the abort timer is now cleared in a `finally` block. Before that it only ran on the success path, which leaked a timer per failed request.

## The second, smaller DoH client

[`lib/email-auth.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/email-auth.ts#L10-L13) has its own resolver list for SPF, DKIM and DMARC lookups: Cloudflare first, Google second, tried in order. The comment explains the fallback is why a blocked or failing provider does not turn into "no record found", which for a DMARC check is a materially wrong answer rather than a missing one.

That client has no abort signal, so a hung resolver depends on the browser's own connection timeout. It is a real rough edge and it is worth naming.

:::caution[Every lookup is a disclosure]
DoH encrypts your query in transit and hands it to a resolver you chose. Do not use it to look up names you would not want that resolver to know about. For internal names, the desktop app can query a DNS server on your own network instead.
:::
