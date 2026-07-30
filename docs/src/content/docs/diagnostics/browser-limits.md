---
title: What a browser cannot do
description: Why an HTTPS page cannot fetch http, why a cross-origin response exposes only seven headers, and why browser ping is an HTTPS round trip rather than ICMP.
---

:::caution[Before You Read]
Several tools produce a number in the browser and a different, better number in the desktop build. That is not a quality gap, it is a category difference. A browser has no raw socket API, cannot set an IP TTL, and cannot read most cross-origin response headers. Everything below names the mechanism, links the spec text that makes it so, and links the code that obeys it.
:::

The web platform gives a page exactly one way to talk to the network: HTTP, through [`fetch`](https://fetch.spec.whatwg.org/#fetch-method) or something built on it. There is no ICMP, no raw TCP, no control over IP headers. Every browser-mode diagnostic in this app is an HTTP request wearing a networking costume, and the UI says so at the point of use.

## An HTTPS page cannot fetch `http://`

The Mixed Content specification defines [should fetching request be blocked as mixed content?](https://w3c.github.io/webappsec-mixed-content/#should-block-fetch). If the client is a secure context and the request URL is not [a priori authenticated](https://w3c.github.io/webappsec-mixed-content/#a-priori-authenticated-url), the request returns `blocked`. `fetch` does not fail slowly with a timeout; it rejects, and no packet is sent.

Whether a URL counts as trustworthy is decided by [is url potentially trustworthy?](https://w3c.github.io/webappsec-secure-contexts/#is-url-trustworthy) in Secure Contexts, which admits `https:`, `wss:`, `file:`, and loopback hosts, and rejects plain `http:` to a routable address.

Two places in the code act on this directly:

- [`isMixedContentBlocked`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-testing.ts#L308-L318) returns true when the target is `http:` and `window.location.protocol` is `https:`, and [`testRTT`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-testing.ts#L190-L215) refuses before sending: "Browsers block HTTP endpoints when the app is served over HTTPS. Use an HTTPS test URL."
- [`parseTargetInput`](https://github.com/sunnypatell/netdash-toolkit/blob/main/components/tools/ping-traceroute.tsx) in the ping tool gives a bare host **the page's own scheme** instead of defaulting to `http`. The comment records the bug it fixed: defaulting to `http` meant every ping on the deployed HTTPS site was blocked as mixed content before it left the browser, while `localhost` over plain HTTP worked fine, so the failure was invisible in development.

The [port scanner](https://github.com/sunnypatell/netdash-toolkit/blob/main/components/tools/port-scanner.tsx) does the same for the same reason: an HTTPS page cannot probe `http://host:8080` at all, so it probes over the page's own scheme rather than firing requests the browser refuses.

:::note[A Limit I Did Not Test]
The desktop build serves the app from `http://localhost:17890`. Loopback hosts **are** potentially trustworthy under [Secure Contexts section 3.1](https://w3c.github.io/webappsec-secure-contexts/#is-origin-trustworthy), so that renderer is a secure context, and by the letter of the spec mixed-content blocking should still apply to an `http://` target from it. I did not verify Chromium's actual behaviour here. It does not affect the capabilities that matter, because the desktop diagnostics go through IPC to the main process rather than through `fetch`.
:::

## A cross-origin response exposes seven headers, and no more

When a page reads a cross-origin response, the `Headers` object does not contain what the server sent. Under the [CORS protocol](https://fetch.spec.whatwg.org/#http-cors-protocol), a [CORS filtered response](https://fetch.spec.whatwg.org/#concept-filtered-response-cors) excludes every header name that is not a [CORS-safelisted response-header name](https://fetch.spec.whatwg.org/#cors-safelisted-response-header-name). The Fetch Standard defines that set as exactly seven names:

| Header                                              | Safelisted | What you actually learn |
| --------------------------------------------------- | ---------- | ----------------------- |
| `Cache-Control`                                     | yes        | caching policy          |
| `Content-Language`                                  | yes        | declared language       |
| `Content-Length`                                    | yes        | body size               |
| `Content-Type`                                      | yes        | media type and charset  |
| `Expires`                                           | yes        | legacy expiry           |
| `Last-Modified`                                     | yes        | legacy validator        |
| `Pragma`                                            | yes        | legacy no-cache         |
| `Strict-Transport-Security`                         | no         | nothing                 |
| `Content-Security-Policy`                           | no         | nothing                 |
| `Server`, `Location`, `Set-Cookie`, everything else | no         | nothing                 |

Read the bottom half of that table carefully, because it is the trap. A server can opt extra names in with [`Access-Control-Expose-Headers`](https://fetch.spec.whatwg.org/#http-access-control-expose-headers), and almost none do. So a page that fetches a site cross-origin and reports "no HSTS header" is not reporting a fact about the server. It is reporting that it was not allowed to look.

### Worked example: unknown is not absent

What a cross-origin `fetch` can see is one set intersection:

```text
visible = present ∩ (safelisted ∪ exposed)

where:
  present    = header names the server actually sent
  safelisted = the seven CORS-safelisted response-header names above
  exposed    = names listed in Access-Control-Expose-Headers, usually none
  visible    = names your JavaScript can read off the Headers object
```

Now run it for the six headers the security-header tool grades. Take a server that sets all six correctly:

```text
present    = { Strict-Transport-Security, Content-Security-Policy, X-Frame-Options,
               X-Content-Type-Options, Referrer-Policy, Permissions-Policy, Server, Date }
safelisted = { Cache-Control, Content-Language, Content-Length, Content-Type,
               Expires, Last-Modified, Pragma }
exposed    = { }

visible    = { }        # none of the six is safelisted, and none was exposed
score      = 0 / 6      # for a server that set every one of them
```

A checker built on a direct cross-origin `fetch` therefore scores **0 out of 6 for every site on the internet**, including sites that set all six correctly. That is not a conservative result, it is a wrong one, and it is why the grade has to come from somewhere else.

The app's answer is to not do the direct fetch. [`components/tools/http-headers.tsx`](https://github.com/sunnypatell/netdash-toolkit/blob/main/components/tools/http-headers.tsx) either parses `curl` output you paste in, or asks a third-party relay that is not subject to CORS, and the UI states the reason inline. Every relayed result is badged "unverified, via relay" rather than presented as first-hand, and the suggested first-party command is printed for you:

```bash
# get the real headers yourself, following redirects
curl -sS -o /dev/null -D - -L https://example.com
```

Historically the safelist had six entries; `Content-Length` was added later. If you see "six CORS-safelisted headers" in older material, that is why. The current normative list is the one linked above.

## `no-cors` mode buys reachability, not information

A request can set [request mode](https://fetch.spec.whatwg.org/#concept-request-mode) to `no-cors`, which skips the CORS check and returns an [opaque filtered response](https://fetch.spec.whatwg.org/#concept-filtered-response-opaque): [type](https://developer.mozilla.org/en-US/docs/Web/API/Response/type) `"opaque"`, status forced to `0`, header list empty, body unreadable. [`response.ok`](https://developer.mozilla.org/en-US/docs/Web/API/Response/ok) is `false` even for a real `200`.

An opaque response is still evidence of exactly one thing: something completed a TCP connection, spoke HTTP, and answered. The app uses that, and only that:

| Tool                   | What `no-cors` proves                                       | What it cannot distinguish                               |
| ---------------------- | ----------------------------------------------------------- | -------------------------------------------------------- |
| Port scanner (browser) | the port is `open`, because something answered              | closed, filtered, and browser-blocked are all one bucket |
| Ping (browser)         | the host answered an HTTP request, and how long it took     | DNS versus TCP versus TLS versus server think-time       |
| TLS reachability probe | the chain is trusted, because the browser refused otherwise | an untrusted chain from a DNS or routing failure         |

Every row loses information going right, and the app reports that loss instead of guessing. [`PortState`](https://github.com/sunnypatell/netdash-toolkit/blob/main/components/tools/port-scanner.tsx) includes `"unknown"` specifically so a failed probe is never rendered as "closed"; the comment notes this branch used to report `Math.random() > 0.8` as "open". [`components/tools/ssl-checker.tsx`](https://github.com/sunnypatell/netdash-toolkit/blob/main/components/tools/ssl-checker.tsx) is equally direct: a browser still refuses an opaque fetch when the certificate chain is untrusted, so a completed opaque request is the only real TLS signal a page can get, and it cannot be told apart from a DNS or network failure.

Note also what the TLS tool reads instead. Certificate Transparency logs ([RFC 9162 section 4](https://www.rfc-editor.org/rfc/rfc9162#section-4)) record what was **issued** for a domain, which is not the same as what the server is presenting right now. The tool says so rather than implying it inspected a live chain.

## "Ping" in a browser is an HTTPS round trip

There is no ICMP in the browser. [RFC 792](https://www.rfc-editor.org/rfc/rfc792) Echo (type 8) and Echo Reply (type 0), and [RFC 4443 section 4.1](https://www.rfc-editor.org/rfc/rfc4443#section-4.1) for ICMPv6 Echo Request (type 128), describe messages below the transport layer; the type numbers live in the [IANA ICMP Type Numbers registry](https://www.iana.org/assignments/icmp-parameters/icmp-parameters.xhtml#icmp-parameters-types). Sending one needs a raw socket, and the web platform exposes none.

So browser-mode ping does this instead, in [`timedFetch`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-testing.ts#L420-L444):

```ts
const startTime = performance.now()
const response = await fetch(url, { method, mode, cache: "no-store", signal, credentials: "omit" })
const endTime = performance.now()
const duration = endTime - startTime
```

That is wall-clock time around the whole HTTP transaction. The [RTT panel](https://github.com/sunnypatell/netdash-toolkit/blob/main/components/tools/network-tester/rtt-panel.tsx) carries a `transport` field whose value is either `"ICMP echo"` or `"HTTPS request"`, and the export labels the method `"http-timing"` rather than `"icmp"`.

### What is inside the number

```text
T_browser = t_dns + t_tcp + t_tls + t_server + t_net
T_icmp    =                                    t_net

where:
  t_dns    = name resolution, paid on the first request to a host
  t_tcp    = one round trip for the TCP handshake
  t_tls    = one or two more round trips for an HTTPS target
  t_server = the origin's own request handling
  t_net    = propagation and queuing delay, the only term both share
```

Worked with real numbers, for a host one round trip of 20 ms away:

```text
t_net    = 20 ms      # the only thing ICMP measures
t_tcp    = 20 ms      # one RTT
t_tls    = 40 ms      # TLS 1.3, one extra RTT, plus certificate work
t_server = 15 ms      # a static file from a warm origin
t_dns    =  0 ms      # cached from a previous request

T_icmp    = 20 ms
T_browser = 20 + 20 + 40 + 15 + 0 = 95 ms
ratio     = 4.75x
```

The ratio is not a constant you can divide out. It depends on TLS version, session resumption, whether the connection was already open, and how slow the origin is. That is why the two numbers are reported under different transport labels instead of being reconciled.

The measurement is still useful, and the code tries to make it honest rather than pretty:

| Behaviour          | Value                                                                                   | Rationale                                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Default method     | `HEAD` ([RFC 9110 section 9.3.2](https://www.rfc-editor.org/rfc/rfc9110#section-9.3.2)) | no body to transfer, so the number is closer to a round trip                                                                     |
| On `405`           | one retry with `GET`, warning recorded                                                  | [405 Method Not Allowed](https://www.rfc-editor.org/rfc/rfc9110#section-15.5.6) means HEAD is refused, not that the host is down |
| On a CORS failure  | one retry in `no-cors`, warning recorded                                                | timing survives; status validation does not                                                                                      |
| Cache busting      | `_netdash_ts` and `_netdash_rand` query parameters                                      | a CDN answering from cache measures the CDN, not the origin                                                                      |
| Samples            | 5 by default, capped at 50 in the RTT panel                                             | enough for a median without hammering the target                                                                                 |
| Retries per sample | 3 attempts, backing off 200 ms per attempt                                              | one dropped request should not become a lost sample                                                                              |
| Statistics         | median, p95 by nearest rank, jitter as population standard deviation                    | a mean over five samples is dominated by whichever one hit a cold connection                                                     |

[`calculateMedian`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-testing.ts#L173-L188) averages the two middle values on even counts, and [`calculatePercentile`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-testing.ts#L182-L188) uses nearest rank, `sorted[ceil(p / 100 * n) - 1]`, so p95 of 10 samples is the 10th value rather than an interpolation between the 9th and 10th. Both are covered by the `calculateMedian` and `calculatePercentile` cases in [`tests/unit/network-testing.test.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/tests/unit/network-testing.test.ts).

## Traceroute is not approximated at all

Traceroute works by sending packets with an increasing [IP time-to-live field](https://www.rfc-editor.org/rfc/rfc791#section-3.1) and collecting the ICMP Time Exceeded messages routers return when the TTL reaches zero, which [RFC 1812 section 5.3.1](https://www.rfc-editor.org/rfc/rfc1812#section-5.3.1) requires a router to do. A browser cannot set a TTL on anything, so it cannot discover a single intermediate hop.

The browser build therefore refuses, with a toast reading "Traceroute needs the desktop app". The [comment in the source](https://github.com/sunnypatell/netdash-toolkit/blob/main/components/tools/ping-traceroute.tsx) says what it replaced: this used to return five hardcoded hops with random jitter. A refusal is a better answer than a plausible fiction.

## What this means in practice

| You want                           | Browser gives you               | You need the desktop app for             |
| ---------------------------------- | ------------------------------- | ---------------------------------------- |
| Subnet, VLSM, MTU, ACL, VLAN math  | the real answer, offline        | nothing                                  |
| DNS records                        | full answers over DoH           | queries against a DNS server on your LAN |
| Latency to a public HTTPS endpoint | a usable HTTP round trip figure | an ICMP RTT comparable to `ping`         |
| Is this port open                  | `open` when something answers   | `closed` and `filtered` told apart       |
| Path to a host                     | nothing                         | traceroute                               |
| What is on my LAN                  | nothing                         | ARP cache and interface enumeration      |

The pattern in that table is worth naming: everything a browser does well is computation, and everything it does badly needs control below HTTP. That is the whole reason [the desktop build](/docs/diagnostics/desktop-capabilities/) exists.

:::tip[The Rule This Page Follows]
Never report a capability you do not have as a result you do have. If the platform cannot answer, say `unknown`, or refuse. Every number this app shows should be traceable to something it actually did.
:::
