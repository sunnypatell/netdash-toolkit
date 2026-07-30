---
title: What a browser cannot do
description: Why an HTTPS page cannot fetch http, why a cross-origin response exposes only seven headers, why the Fetch Standard refuses 83 ports outright, and why browser ping is an HTTPS round trip rather than ICMP.
---

:::caution[Before You Read]
Several tools produce a number in the browser and a different, better number in the desktop build. That is not a quality gap, it is a category difference. A browser has no raw socket API, cannot set an IP TTL, and cannot read most cross-origin response headers. Everything below names the mechanism, links the spec text that makes it so, and links the code that obeys it.
:::

The web platform gives a page exactly one way to talk to the network: HTTP, through [`fetch`](https://fetch.spec.whatwg.org/#fetch-method) or something built on it. There is no ICMP, no raw TCP, no control over IP headers. Every browser-mode diagnostic in this app is an HTTP request wearing a networking costume, and the UI says so at the point of use.

Four of those limits are collected as data in [`lib/browser-limits.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/browser-limits.ts) rather than scattered through components, so a tool can say what it could not measure instead of reporting the limit as a finding: the CORS-safelisted response-header names, the Fetch Standard's blocked-port table, whether the page can address the `http:` scheme at all, and the sentence that explains the last one to a user.

## An HTTPS page cannot fetch `http://`

The Mixed Content specification defines [should fetching request be blocked as mixed content?](https://w3c.github.io/webappsec-mixed-content/#should-block-fetch). If the client is a secure context and the request URL is not [a priori authenticated](https://w3c.github.io/webappsec-mixed-content/#a-priori-authenticated-url), the request returns `blocked`. `fetch` does not fail slowly with a timeout; it rejects, and no packet is sent.

Whether a URL counts as trustworthy is decided by [is url potentially trustworthy?](https://w3c.github.io/webappsec-secure-contexts/#is-url-trustworthy) in Secure Contexts, which admits `https:`, `wss:`, `file:`, and loopback hosts, and rejects plain `http:` to a routable address.

Three places in the code act on this directly:

- [`canFetchHttpScheme`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/browser-limits.ts) is the one-line predicate (`!pageIsHttps()`), and `HTTP_FROM_HTTPS_EXPLANATION` beside it is the sentence a tool shows instead of a timeout: "This page is served over HTTPS, so the browser blocks plain `http://` requests as mixed content before they leave. Use an `https://` target, or the desktop app."
- [`isMixedContentBlocked`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-testing.ts#L308-L318) returns true when the target is `http:` and `window.location.protocol` is `https:`, and [`testRTT`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-testing.ts#L190-L215) refuses before sending: "Browsers block HTTP endpoints when the app is served over HTTPS. Use an HTTPS test URL."
- [`parsePingTarget`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/browser-ping.ts) gives a bare host **the page's own scheme** instead of defaulting to `http`. The comment records the bug it fixed: defaulting to `http` meant every probe on the deployed HTTPS site was blocked as mixed content before it left the browser, while `localhost` over plain HTTP worked fine, so the failure was invisible in development.

`parsePingTarget` also carries the more interesting half of that fix. It returns `insecureDropped: true` when you explicitly typed an `http://` target from an HTTPS page, so only the `https://` candidate ran. The old code dropped the `http://` probe silently and then labelled the surviving result "https", which is a different measurement presented as the one you asked for. Two tests in [`tests/unit/browser-ping.test.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/tests/unit/browser-ping.test.ts) hold the line in both directions: "says so when it had to drop the http probe the user asked for", and "does not claim a drop when the user never asked for http".

The [browser port probe](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/port-probe.ts) does the same for the same reason: an HTTPS page cannot probe `http://host:8080` at all, so `probePortOverHttp` defaults its scheme to `pageIsHttps() ? "https" : "http"` rather than firing requests the browser refuses.

:::note[A Limit I Did Not Test]
The desktop build serves the app from `http://localhost:17890`. Loopback hosts **are** potentially trustworthy under [Secure Contexts section 3.1](https://w3c.github.io/webappsec-secure-contexts/#is-origin-trustworthy), so that renderer is a secure context, and by the letter of the spec mixed-content blocking should still apply to an `http://` target from it. I did not verify Chromium's actual behaviour here. It does not affect the capabilities that matter, because the desktop diagnostics go through IPC to the main process rather than through `fetch`.
:::

## A cross-origin response exposes seven headers, and no more

When a page reads a cross-origin response, the `Headers` object does not contain what the server sent. Under the [CORS protocol](https://fetch.spec.whatwg.org/#http-cors-protocol), a [CORS filtered response](https://fetch.spec.whatwg.org/#concept-filtered-response-cors) excludes every header name that is not a [CORS-safelisted response-header name](https://fetch.spec.whatwg.org/#cors-safelisted-response-header-name). The Fetch Standard defines that set as exactly seven names, and the app hardcodes those seven as [`CORS_SAFELISTED_RESPONSE_HEADERS`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/browser-limits.ts) so the UI can print the list rather than paraphrase it:

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

Now run it against the seven headers [`gradeBlock`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/security-header-grade.ts) actually scores. Their weights sum to 100:

| Header                       | Weight | Spec clause the code cites, linked to the clause itself                                                                                                                                         |
| ---------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`    | 25     | [CSP Level 3 section 3.1](https://www.w3.org/TR/CSP3/#framework-policy)                                                                                                                         |
| `Strict-Transport-Security`  | 20     | [RFC 6797 section 6.1](https://www.rfc-editor.org/rfc/rfc6797#section-6.1)                                                                                                                      |
| `X-Frame-Options`            | 15     | [RFC 7034 section 2.1](https://www.rfc-editor.org/rfc/rfc7034#section-2.1)                                                                                                                      |
| `X-Content-Type-Options`     | 10     | [Fetch Standard, "determine nosniff"](https://fetch.spec.whatwg.org/#determine-nosniff)                                                                                                         |
| `Referrer-Policy`            | 10     | [Referrer Policy, header parsing](https://www.w3.org/TR/referrer-policy/#parse-referrer-policy-from-header)                                                                                     |
| `Permissions-Policy`         | 10     | [Permissions Policy header field](https://www.w3.org/TR/permissions-policy/#permissions-policy-http-header-field), an [RFC 8941](https://www.rfc-editor.org/rfc/rfc8941#section-3.2) dictionary |
| `Cross-Origin-Opener-Policy` | 10     | [HTML, cross-origin opener policy](https://html.spec.whatwg.org/multipage/browsers.html#cross-origin-opener-policies)                                                                           |

`X-XSS-Protection` is assessed at weight `0` and reported as `not-scored`, so a site is neither rewarded for shipping a header no current browser implements nor penalised for having dropped it. That is the "does not count the deprecated xss filter either way" case in [`tests/unit/security-header-grade.test.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/tests/unit/security-header-grade.test.ts).

Take a server that sets all seven correctly, and read them with a direct cross-origin `fetch`:

```text
present    = { Content-Security-Policy, Strict-Transport-Security, X-Frame-Options,
               X-Content-Type-Options, Referrer-Policy, Permissions-Policy,
               Cross-Origin-Opener-Policy, Server, Date }
safelisted = { Cache-Control, Content-Language, Content-Length, Content-Type,
               Expires, Last-Modified, Pragma }
exposed    = { }

visible    = present ∩ (safelisted ∪ exposed)
           = { }          # no scored header is safelisted, and none was exposed

score      = 0 of 100     # for a server that set every one of them
grade      = F
```

A checker built on a direct cross-origin `fetch` therefore returns **F, 0 of 100, for every site on the internet**, including the ones that got everything right. That is not a conservative result, it is a wrong one, and it is why the grade has to come from somewhere else.

The app's answer is to not do the direct fetch. [`components/tools/security-headers.tsx`](https://github.com/sunnypatell/netdash-toolkit/blob/main/components/tools/security-headers.tsx) and [`components/tools/http-headers.tsx`](https://github.com/sunnypatell/netdash-toolkit/blob/main/components/tools/http-headers.tsx) each offer a paste panel that parses `curl` output, and a relay panel that asks a third party not subject to CORS, and both print the safelist inline so the reason is on screen rather than in these docs. Every relayed result is badged "unverified, via relay" rather than presented as first-hand, and the first-party command is printed for you:

```bash
# get the real headers yourself, following redirects
curl -sS -o /dev/null -D - -L https://example.com
```

### Presence is not effectiveness

The grader is worth one more paragraph, because reading a header is only half the problem. [`assessBlock`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/security-header-grade.ts) scores a header `effective` only when its value does something, and the file comment names the three cases that used to score full marks for nothing:

| Header value                                      | Verdict       | Why                                                                                                            |
| ------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------- |
| `Strict-Transport-Security: max-age=0`            | `ineffective` | [RFC 6797 section 6.1.1](https://www.rfc-editor.org/rfc/rfc6797#section-6.1.1): zero deletes the stored policy |
| `Content-Security-Policy-Report-Only: ...`        | `ineffective` | a report-only policy is monitored, never enforced                                                              |
| `X-Content-Type-Options: sniff`                   | `ineffective` | only the exact token `nosniff` has an effect                                                                   |
| `X-Frame-Options: ALLOW-FROM https://example.com` | `ineffective` | no current browser implements `ALLOW-FROM`                                                                     |
| Any HSTS header on a cleartext `http://` response | not honoured  | [RFC 6797 section 8.1](https://www.rfc-editor.org/rfc/rfc6797#section-8.1): the browser ignores it outright    |

The last row is a separate function, `hstsIsHonoured`, because a grade taken from an `http://` response would otherwise overstate what a browser will actually do with it.

Historically the safelist had six entries; `Content-Length` was added later. If you see "six CORS-safelisted headers" in older material, that is why. The current normative list is the one linked above.

## The browser refuses 83 ports before a packet leaves

This is the limit most browser-based port scanners never mention, and it is the one that quietly invents results.

[Fetch Standard section 2.9, port blocking](https://fetch.spec.whatwg.org/#port-blocking) defines a [bad port](https://fetch.spec.whatwg.org/#bad-port) as any port listed in its table, and [should fetching request be blocked due to a bad port?](https://fetch.spec.whatwg.org/#block-bad-port) returns `blocked` for those. The table is there because a browser can be tricked into speaking almost-HTTP at a non-HTTP service, so the platform removes the classic service ports from reach entirely. The count as of this writing is **83 entries**, including `22` ssh, `25` smtp, `53` domain, `110` pop3, `143` imap, `445` is notably absent, and `6667` ircu.

A `fetch` to a bad port rejects with a `TypeError` that is indistinguishable from a connection failure. So a naive probe sees the same exception for "port 22 is firewalled", "port 22 is closed", and "your own browser refused to send anything", and a scanner that maps rejection to `closed` will confidently report `closed` for an SSH port that is wide open.

[`lib/browser-limits.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/browser-limits.ts) carries the table as `BLOCKED_PORT_SERVICES`, keyed by port with the service keyword as the value, and [`probePortOverHttp`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/port-probe.ts) checks it **before** constructing a request:

```ts
if (isBlockedPort(port)) {
  return {
    port,
    service,
    state: "browser-blocked",
    method: "http-probe",
    detail: `The Fetch Standard's port blocking list refuses any fetch to port ${port} (${blockedPortService(port)}), so nothing was sent and the port's real state is unmeasurable here.`,
  }
}
```

`"browser-blocked"` is its own member of [`PortState`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/port-probe.ts) rather than a flavour of `"unknown"`, and the type's own comment says why: this is the one negative case the app can prove without sending anything, so folding it into `unknown` would throw away the only certainty available.

### Worked example: scanning 22, 80 and 8080

```text
scan target = example.internal, ports 22, 80, 8080
page scheme = https:, so probes go to https://example.internal:<port>

port 22   -> isBlockedPort(22) is true   -> browser-blocked
             nothing sent. real state unmeasurable in a browser.
port 80   -> not blocked, probe sent, transport resolves
             -> open   "something accepted an HTTPS request on this port.
                        the response is opaque, so its status and identity
                        are unknown."
port 8080 -> not blocked, probe sent, transport throws
             -> unknown "closed, filtered, non-HTTP service, TLS mismatch
                         and content blocker all fail identically here."

summarizeStates -> { open: 1, closed: 0, filtered: 0, unknown: 1, browser-blocked: 1 }
```

Read the `closed: 0` carefully. The browser probe can **never** produce `closed`; that counter exists only so the same summary shape serves the desktop connect scan, which can. Four `it` cases in [`tests/unit/port-probe.test.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/tests/unit/port-probe.test.ts) pin this: "knows the fetch standard blocks the classic service ports", "reports a blocked port as unmeasurable without sending anything", "reports open only when the request actually completed", and "reports unknown, never closed, when the probe fails".

:::caution[A Gap I Found Writing This Page]
`BLOCKED_PORT_SERVICES` holds 80 entries against the Fetch Standard's 83. It omits port `0`, which is not addressable anyway, and ports `4190` (sieve) and `6679` (ircs-u). A probe of 4190 or 6679 is therefore reported as `unknown` rather than `browser-blocked`. That direction is the safe one, since `unknown` claims nothing, but it is still a less precise answer than the platform makes available, and it is worth closing.
:::

## `no-cors` mode buys reachability, not information

A request can set [request mode](https://fetch.spec.whatwg.org/#concept-request-mode) to `no-cors`, which skips the CORS check and returns an [opaque filtered response](https://fetch.spec.whatwg.org/#concept-filtered-response-opaque): [type](https://developer.mozilla.org/en-US/docs/Web/API/Response/type) `"opaque"`, status forced to `0`, header list empty, body unreadable. [`response.ok`](https://developer.mozilla.org/en-US/docs/Web/API/Response/ok) is `false` even for a real `200`.

An opaque response is still evidence of exactly one thing: something completed a TCP connection, spoke HTTP, and answered. The app uses that, and only that:

| Tool                   | What `no-cors` proves                                       | What it cannot distinguish                                           |
| ---------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| Port probe (browser)   | the port is `open`, because something answered              | closed, filtered, non-HTTP service, TLS mismatch and content blocker |
| Ping (browser)         | the host answered an HTTP request, and how long it took     | DNS versus TCP versus TLS versus server think-time                   |
| TLS reachability probe | the chain is trusted, because the browser refused otherwise | an untrusted chain from a DNS or routing failure                     |

Every row loses information going right, and the app reports that loss instead of guessing. The failure branch of [`probePortOverHttp`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/port-probe.ts) returns `"unknown"` and carries the comment `// never guess: this branch used to report Math.random() > 0.8 as "open"`. That is the single most important line in this app's history: a scanner that returned a random result for four fifths of its probes looked, on a screen, exactly like one that worked.

[`components/tools/ssl-checker.tsx`](https://github.com/sunnypatell/netdash-toolkit/blob/main/components/tools/ssl-checker.tsx) is equally direct: a browser still refuses an opaque fetch when the certificate chain is untrusted, so a completed opaque request is the only real TLS signal a page can get, and it cannot be told apart from a DNS or network failure.

Note also what the TLS tool reads instead. Certificate Transparency logs ([RFC 9162 section 4](https://www.rfc-editor.org/rfc/rfc9162#section-4)) record what was **issued** for a domain, which is not the same as what the server is presenting right now. The tool says so rather than implying it inspected a live chain.

## "Ping" in a browser is an HTTPS round trip

There is no ICMP in the browser. [RFC 792](https://www.rfc-editor.org/rfc/rfc792) Echo (type 8) and Echo Reply (type 0), and [RFC 4443 section 4.1](https://www.rfc-editor.org/rfc/rfc4443#section-4.1) for ICMPv6 Echo Request (type 128), describe messages below the transport layer; the type numbers live in the [IANA ICMP Type Numbers registry](https://www.iana.org/assignments/icmp-parameters/icmp-parameters.xhtml#icmp-parameters-types). Sending one needs a raw socket, and the web platform exposes none.

So browser-mode ping does this instead, in [`timedFetch`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-testing.ts#L413-L450):

```ts
const startTime = performance.now()
const response = await fetch(target.toString(), {
  method,
  mode,
  cache: "no-store",
  signal: controller.signal,
  credentials: "omit",
  /* ... */
})
const endTime = performance.now()
return { duration: endTime - startTime, response }
```

That is wall-clock time from just before `fetch` to the moment the fetch promise settles. Two details in that boundary are worth being exact about, because they cut in opposite directions:

- The response **body is never read**, so the number stops at the response headers rather than at the last byte. For a `HEAD` request there is no body anyway; for the `GET` fallback the transfer time of the body is excluded.
- Everything before the first byte **is** included: DNS, the TCP handshake, the TLS handshake, and the origin's own think time. That is the part that makes the figure incomparable to ICMP.

Two independent labels enforce that in the UI rather than in prose. The [RTT panel](https://github.com/sunnypatell/netdash-toolkit/blob/main/components/tools/network-tester/rtt-panel.tsx) carries a `transport` field typed as exactly `"ICMP echo" | "HTTPS request"`, with the comment "the shared result type has no ICMP slot; transport carries the truth". The ping tool uses the newer [`ProbeTransport`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/browser-ping.ts) union, `"icmp" | "https-round-trip" | "http-round-trip"`, and `describeTransport` turns each into a sentence rather than a badge. The test that keeps them apart is titled, in full, "never calls an http round trip an icmp round trip".

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

[`calculateMedian`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-testing.ts#L173-L180) averages the two middle values on even counts, and [`calculatePercentile`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/network-testing.ts#L182-L188) uses nearest rank, `sorted[ceil(p / 100 * n) - 1]`, so p95 of 10 samples is the 10th value rather than an interpolation between the 9th and 10th. Both are covered in [`tests/unit/network-testing.test.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/tests/unit/network-testing.test.ts), including "averages the two middle elements for even counts" and "uses nearest-rank for p95 on a full range".

## Traceroute is not approximated at all

Traceroute works by sending packets with an increasing [IP time-to-live field](https://www.rfc-editor.org/rfc/rfc791#section-3.1) and collecting the ICMP Time Exceeded messages routers return when the TTL reaches zero, which [RFC 1812 section 5.3.1](https://www.rfc-editor.org/rfc/rfc1812#section-5.3.1) requires a router to do. A browser cannot set a TTL on anything, so it cannot discover a single intermediate hop.

The browser build therefore refuses, with a toast reading "Traceroute needs the desktop app". The [comment in the source](https://github.com/sunnypatell/netdash-toolkit/blob/main/components/tools/ping-traceroute.tsx) says what it replaced: this used to return five hardcoded hops with random jitter. A refusal is a better answer than a plausible fiction.

## The browser will not compute MD5, and the tool says so instead of shipping one

The hash generator is a pure-computation tool, so it is easy to assume it can do anything. It cannot, and the reason is the same shape as everything else on this page: the platform registers a fixed set of algorithms and rejects the rest.

[Web Crypto section 18.4.4, normalizing an algorithm](https://w3c.github.io/webcrypto/#algorithm-normalization-normalize-an-algorithm) looks the requested name up in the registered algorithms for that operation and, on a miss, returns a `NotSupportedError`. For `digest`, the [SHA registration](https://w3c.github.io/webcrypto/#sha-registration) supplies exactly four names:

| Name passed to `crypto.subtle.digest` | Registration                                          | Offered | Status in the app                           |
| ------------------------------------- | ----------------------------------------------------- | ------- | ------------------------------------------- |
| `SHA-256`                             | [18.11](https://w3c.github.io/webcrypto/#alg-sha-256) | yes     | `secure`, the default                       |
| `SHA-384`                             | [18.11](https://w3c.github.io/webcrypto/#alg-sha-384) | yes     | `secure`                                    |
| `SHA-512`                             | [18.11](https://w3c.github.io/webcrypto/#alg-sha-512) | yes     | `secure`                                    |
| `SHA-1`                               | [18.11](https://w3c.github.io/webcrypto/#alg-sha-1)   | yes     | `deprecated`, kept because it is registered |
| `MD5`                                 | never registered                                      | no      | listed as unavailable, with the reason      |
| `SHA-3`, Keccak                       | never registered                                      | no      | listed as unavailable, with the reason      |

[`lib/hash.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/hash.ts) encodes both halves of that table. `HASH_ALGORITHMS` holds the four that work, each entry's `name` being "the exact string `SubtleCrypto.digest` accepts". `UNAVAILABLE_ALGORITHMS` holds MD5, SHA-3 and CRC32 with a sentence each, so the UI can show why a name is missing rather than leaving a user to guess whether it was an oversight.

The distinction the file comment draws is the one worth carrying away: **SHA-1 is broken but specified; MD5 was never specified.** SHA-1 stays, marked deprecated with the SHAttered collision cited, because you sometimes need it to check a checksum somebody else published. MD5 is absent because computing it would mean shipping a hand-written JavaScript implementation, and a hash the platform refuses to vouch for is not a capability this app wants to claim.

Four tests in [`tests/unit/hash.test.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/tests/unit/hash.test.ts) make that a gate rather than an intention, and the last of them is the interesting one because it tests the platform rather than the code:

- "lists exactly the four WebCryptoAPI digest algorithms"
- "offers no algorithm `crypto.subtle` would reject"
- "names MD5 as unavailable with the reason, rather than claiming it"
- "confirms `crypto.subtle` really does reject the unavailable names"

A separate block hashes the empty string and compares against the published digests for each algorithm, so a refactor that silently changed the encoding of the input would fail rather than produce plausible hex.

## What this means in practice

| You want                           | Browser gives you               | You need the desktop app for                           |
| ---------------------------------- | ------------------------------- | ------------------------------------------------------ |
| Subnet, VLSM, MTU, ACL, VLAN math  | the real answer, offline        | nothing                                                |
| DNS records                        | full answers over DoH           | queries against a DNS server on your LAN               |
| Latency to a public HTTPS endpoint | a usable HTTP round trip figure | an ICMP RTT comparable to `ping`                       |
| Is this port open                  | `open` when something answers   | `closed` and `filtered` told apart                     |
| Is this port open, on port 22      | `browser-blocked`, nothing sent | any answer at all                                      |
| Path to a host                     | nothing                         | traceroute                                             |
| What is on my LAN                  | nothing                         | ARP cache and interface enumeration                    |
| SHA-256, SHA-384, SHA-512, SHA-1   | the real digest, offline        | nothing                                                |
| MD5 of the same input              | nothing, and it says why        | nothing; the desktop renderer runs the same Web Crypto |

The pattern in that table is worth naming: everything a browser does well is computation, and everything it does badly needs control below HTTP. That is the whole reason [the desktop build](/docs/diagnostics/desktop-capabilities/) exists.

:::tip[The Rule This Page Follows]
Never report a capability you do not have as a result you do have. If the platform cannot answer, say `unknown`, or refuse. Every number this app shows should be traceable to something it actually did.
:::
