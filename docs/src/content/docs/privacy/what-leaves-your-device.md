---
title: What leaves your device
description: Every outbound request NetDash Toolkit can make, which capability makes it, and what the receiving host learns, derived from the tool registry.
---

There is no backend, so the app has nowhere of its own to send your input. 36 of the 48 tools make no network request at all. This page covers the other 12, plus the two things that run on every page.

## How the declaration works

Each tool in [`lib/tool-registry.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/tool-registry.ts) carries an optional `runtime` block, and omitting it means the tool is fully offline:

```ts
export interface ToolRuntime {
  // false when the tool performs network i/o of any kind
  offline: boolean
  // hosts that receive user input, so the ui can say so before a request
  thirdParty?: string[]
  // capabilities that only exist in the desktop build, named honestly
  desktopOnly?: string[]
}
```

That block is what the UI reads to warn you before a request, and it is what the [tools pages](/docs/tools/) in these docs are generated from. So the disclosure in the app, the disclosure in the docs, and the routing table all come from one declaration.

| Guard                                                                                                                           | What it actually checks                                                                | What it does NOT check                                           |
| ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [`tests/unit/tool-registry.test.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/tests/unit/tool-registry.test.ts) | `runtime.offline === false` is set for exactly the tools whose source does network I/O | that the host names listed are the host names actually requested |
| The same test                                                                                                                   | every non-offline tool names at least one third-party host                             | that the list is complete                                        |
| The same test                                                                                                                   | the reported offline count matches the registry                                        | anything about request bodies                                    |

Read the right-hand column as the honest scope limit. The test catches a tool that starts making requests without declaring it, which was the original failure mode; it does not diff the host list against the URLs in the component. So treat `thirdParty` as a declaration the project holds itself to, verified for existence rather than for accuracy. If you need certainty for a specific tool, read its source, or watch your own network.

## The hosts, by capability

Grouped by what they are for rather than by tool, because the same resolver serves several tools.

| Host                              | Capability                                           | What it receives                          | Operator                 |
| --------------------------------- | ---------------------------------------------------- | ----------------------------------------- | ------------------------ |
| `cloudflare-dns.com`              | DNS over HTTPS, default resolver                     | the domain you look up, your IP           | Cloudflare               |
| `dns.google`                      | DNS over HTTPS                                       | the domain you look up, your IP           | Google                   |
| `dns.quad9.net`                   | DNS over HTTPS, wire format                          | the domain you look up, your IP           | Quad9                    |
| `doh.opendns.com`                 | DNS over HTTPS, wire format                          | the domain you look up, your IP           | Cisco                    |
| `dns.adguard-dns.com`             | DNS over HTTPS, filtering                            | the domain you look up, your IP           | AdGuard                  |
| `api.hackertarget.com`            | HTTP header, security header and redirect inspection | the URL you enter                         | unaffiliated third party |
| `observatory-api.mdn.mozilla.net` | security-header grade                                | the hostname you enter                    | Mozilla                  |
| `api.certspotter.com`             | Certificate Transparency issuance history            | the domain you enter                      | SSLMate                  |
| `rdap.org`                        | WHOIS replacement lookups for domains, IPs and ASNs  | the query you enter                       | RDAP bootstrap service   |
| `api.maclookup.app`               | MAC vendor lookup                                    | the OUI prefix, so the first three octets | maclookup.app            |
| The host or URL you type          | ping, RTT, throughput, port probe, TLS reachability  | the request itself, plus your IP          | whoever you targeted     |

The last row is the one people forget. When you ping or scan a target, that target sees a connection from your address. That is inherent to the measurement, not something the app adds.

RDAP is worth one note: it is the [RFC 9082](https://www.rfc-editor.org/rfc/rfc9082#section-3.1) and [RFC 9083](https://www.rfc-editor.org/rfc/rfc9083#section-1) replacement for WHOIS, and `rdap.org` is a bootstrap redirector, so your query is forwarded to the authoritative registry for that object. Two parties see it, not one.

## The two relays, and why they exist

Two hosts in that table are relays rather than authorities, and the code labels them that way at every layer.

`api.hackertarget.com` is used because of the CORS restriction described in [what a browser cannot do](/docs/diagnostics/browser-limits/): a page cannot read another site's security headers, so the only alternatives are a relay or nothing. The comment in [`components/tools/http-headers.tsx`](https://github.com/sunnypatell/netdash-toolkit/blob/main/components/tools/http-headers.tsx) records that the endpoint was verified by `curl` to send `Access-Control-Allow-Origin: *` and to return one header block per redirect hop, and that it is still an unaffiliated relay, so everything it returns is labelled as such.

What that means for you, stated plainly:

- The relay operator sees every URL you check.
- The relay could rewrite what it returns, and you would not be able to tell.
- Results are badged "unverified, via relay" in the UI and carry `api.hackertarget.com relay (unverified third party)` in the export.
- The security score is described as indicative, not as a verified assessment of the server.
- You can avoid the relay entirely by pasting `curl -sS -o /dev/null -D - -L <url>` output into the same tool.

`api.maclookup.app` is the single remote OUI provider. The comment in [`lib/oui-vendors.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/oui-vendors.ts) records that an earlier version also routed through a third-party proxy, which meant one more party seeing the address for no added coverage. Lookups try the bundled database first, and there is an `offlineOnly` mode in which nothing ever leaves the device.

## What runs on every page

Two things are not tool-specific.

| Thing                           | Scope                                                                   | Notes                                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Vercel Analytics                | every page of the web build                                             | mounted unconditionally in [`app/layout.tsx`](https://github.com/sunnypatell/netdash-toolkit/blob/main/app/layout.tsx) |
| Google Identity Services script | only when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set, and never on localhost | loaded from `accounts.google.com` for the One Tap sign-in prompt                                                       |
| Google Fonts                    | build time only                                                         | `next/font` self-hosts Inter and JetBrains Mono into the bundle, so no request reaches Google at runtime               |

I checked the third row rather than assuming it: the static export contains 13 `woff2` files under `out/_next/static/media/`, and a recursive grep of `out/` for `fonts.gstatic.com` and `fonts.googleapis.com` returns nothing. The docs go further and load no webfont at all, matching Inter and JetBrains Mono by name with a system fallback, because the docs also have to render inside the offline desktop app.

Vercel Analytics is the one thing on this page that is not a diagnostic and not opt-in. It ships in the web build. The desktop build serves the same bundle, so the component is present there too; whether its requests succeed from a loopback origin with no network is not something I verified.

## What the app does NOT do

We do not run advertising trackers, marketing pixels, or session-replay tools. We do not have a server that could log your input, because `output: "export"` means there is no server. We do not send tool input anywhere except the hosts named above, and every one of them is named in the UI before the request.

Specifically:

- **Nothing you type into an offline tool leaves the browser.** Subnet math, VLSM plans, VLAN and ACL configs, MTU calculations, hashes, password generation, JSON formatting, regex testing, timestamp conversion, colour conversion: all local.
- **Password and key generation is local.** [`lib/password-gen.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/password-gen.ts) calls [`crypto.getRandomValues`](https://w3c.github.io/webcrypto/#Crypto-method-getRandomValues) and nothing else; the file comment states "no `Math.random` anywhere in this repo", and [`tests/unit/password-gen.test.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/tests/unit/password-gen.test.ts) asserts that an empty charset raises rather than silently falling back. Output is never transmitted.
- **The desktop build adds no telemetry.** It makes the same requests the web build makes, plus whichever diagnostic you run.
- **No GeoIP.** There is no IP geolocation provider anywhere in the codebase.

## Not in scope (yet)

- **A Content-Security-Policy.** `vercel.json` sets five headers and no CSP, and the Electron static server sets none at all. Safe to defer because there is no backend and no user-generated content rendered as markup, but it is a gap.
- **Analytics as an opt-in.** Vercel Analytics is unconditional. Making it a preference would be better, and would need a consent surface the app does not have yet.
- **Host-list verification in CI.** The registry test proves a host list exists, not that it matches the code. Closing that gap means statically extracting URLs per component, which is worth doing and is not done.

:::caution[The One Rule Worth Remembering]
If a tool shows no host warning, it made no request. If it shows hosts, assume those operators saw exactly what you typed. Do not paste an internal hostname into a DoH lookup and expect it to stay internal.
:::
