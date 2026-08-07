---
title: What leaves your device
description: Every outbound request NetDash Toolkit can make, which capability makes it, and what the receiving host learns, derived from the tool registry.
---

There is no backend, so the app has nowhere of its own to send your input. 36 of the 48 tools make no network request at all. This page covers the 12 networked tools, plus the two things that run on every page.

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

| Guard                                                                                                                           | What it actually checks                                                                                                      | What it does NOT check                                           |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [`tests/unit/tool-registry.test.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/tests/unit/tool-registry.test.ts) | `runtime.offline === false` is set for exactly the tools whose source does network I/O                                       | that the host names listed are the host names actually requested |
| The same test                                                                                                                   | every non-offline tool discloses at least one destination, counting either a `thirdParty` host or a `desktopOnly` capability | that the list is complete                                        |
| The same test                                                                                                                   | the reported offline count matches the registry                                                                              | anything about request bodies                                    |

Read the right-hand column as the honest scope limit. The test catches a tool that starts making requests without declaring it, which was the original failure mode; it does not diff the host list against the URLs in the component. So treat `thirdParty` as a declaration the project holds itself to, verified for existence rather than for accuracy. If you need certainty for a specific tool, read its source, or watch your own network.

One tool uses the second half of that rule. The conflict checker declares `offline: false` with no `thirdParty` entry at all, and only `desktopOnly: ["reading the local ARP cache"]`. That is accurate rather than a loophole: its browser path parses text you paste and contacts nobody, and its one piece of I/O is the desktop build shelling out to `arp -a` on your own machine. There is no third party to name, so naming one would be worse than naming none.

:::caution
That declaration is currently rendered wrong in the app, and it is recorded here rather than left for you to find. [`RuntimeDisclosure`](https://github.com/sunnypatell/netdash-toolkit/blob/main/components/ui/runtime-badge.tsx) gates its "what you enter is sent to" sentence on `runtime.offline === false` alone, without also requiring a non-empty `thirdParty`, so on the conflict checker that sentence renders with an empty host list. The registry is right and the screen is wrong: nothing you paste into the conflict checker is sent anywhere, in either build. The desktop-only sentence beneath it renders correctly.
:::

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

Three hosts belong to sign-in rather than to any tool, and they are listed separately because they are reached only if you sign in, or only if this deployment was built with a Google client id:

| Host                              | Reached when                                                                             | What it receives                                    |
| --------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `accounts.google.com`             | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set, and not on localhost                              | the One Tap prompt loads; Google sees the page view |
| `apis.google.com`                 | Firebase Auth has been loaded and reaches for its `gapi` helper, which is a sign-in path | the same                                            |
| Your project's Firebase endpoints | you are signed in and sync is enabled                                                    | your auth token and your project documents          |

The second row moved recently. The Firebase SDK is no longer imported at module scope anywhere: `lib/firebase.ts` holds only type-only imports and three dynamic `import()` calls, so `initializeApp` runs the first time something asks for auth or Firestore rather than on page load. A visitor who has never signed in is detected from a `localStorage` hint rather than from the SDK, so nothing on this row is reached. [Accounts and saved projects](/docs/privacy/accounts-and-projects/) walks the decision, including the one browser case where the auth chunk is fetched anyway to prove a negative.

The third row is deliberately not a literal hostname. Firebase derives its endpoints from the `authDomain` and `projectId` in the build's environment, so the exact names depend on whose deployment you are using. On the official deployment they are Google's. On your own fork they are yours, and with no Firebase environment variables at all there are no such requests, because `initializeApp` is never called. [Accounts and saved projects](/docs/privacy/accounts-and-projects/) has the detail.

The first two are also visible in the Content-Security-Policy rather than only in the code: `script-src` names `https://apis.google.com` and `https://accounts.google.com`, and `frame-src` names `https://*.firebaseapp.com` and `https://accounts.google.com`. A policy is a testable artifact, which is why `tests/unit/csp.test.ts` derives the expected egress list from the source tree and fails if the two disagree.

RDAP is worth one note: it is the [RFC 9082](https://www.rfc-editor.org/rfc/rfc9082#section-3.1) and [RFC 9083](https://www.rfc-editor.org/rfc/rfc9083#section-1) replacement for WHOIS, and `rdap.org` is a bootstrap redirector, so your query is forwarded to the authoritative registry for that object. Two parties see it, not one.

## The two relays, and why they exist

Two hosts in that table are relays rather than authorities, and the code labels them that way at every layer.

`api.hackertarget.com` is used because of the CORS restriction described in [what a browser cannot do](/docs/diagnostics/browser-limits/): a page cannot read another site's security headers, so the only alternatives are a relay or nothing. It is reached from exactly one module, [`lib/http-relay.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/http-relay.ts), whose comment records that the endpoint was verified by `curl` to send `Access-Control-Allow-Origin: *` and to return one header block per redirect hop, that it "can add, drop or rewrite anything", and that "every caller labels its output unverified". Three tools call it, each behind its own explicitly-chosen relay panel: HTTP headers, security headers, and the redirect checker.

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
- **Password and key generation is local, and unbiased.** [`lib/password-gen.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/password-gen.ts) draws from [`crypto.getRandomValues`](https://w3c.github.io/webcrypto/#Crypto-method-getRandomValues) and rejects draws that land in the biased tail rather than folding them with `%`, which would over-represent the first `2^32 mod n` characters of the charset. [`tests/unit/password-gen.test.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/tests/unit/password-gen.test.ts) asserts that directly in "discards draws in the biased tail", and [`tests/unit/random-gen.test.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/tests/unit/random-gen.test.ts) checks the statistical consequence in "shows no low-bucket skew, which is what modulo folding looks like". Output is never transmitted.
- **The desktop build adds no telemetry.** It makes the same requests the web build makes, plus whichever diagnostic you run.
- **No GeoIP.** There is no IP geolocation provider anywhere in the codebase.
- **Nothing is stored on your device beyond five `localStorage` keys.** `netdash-projects` holds your saved projects; `netdash-deleted-projects` holds the ids of projects you deleted until the cloud confirms they are gone; `netdash-auth-session` holds a single `"1"` or `"0"` so a page load can tell whether to load the auth SDK; `netdash-recent-tools` and `netdash-sidebar-groups` hold command-palette history and which sidebar groups you left open. The app sets no cookies of its own, and creates no `IndexedDB` database; the only one that appears is the store Firebase Auth creates after you sign in.
- **No encryption, anywhere, of anything.** This is stated as a limitation rather than omitted. A repository-wide search for `subtle.encrypt`, `subtle.decrypt`, `deriveKey`, `deriveBits`, `PBKDF2`, `importKey` and `generateKey` returns nothing. The only Web Crypto the app uses is `crypto.subtle.digest` in [`lib/hash.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/hash.ts) and `crypto.getRandomValues` in `lib/password-gen.ts`. Saved projects are plain JSON in `localStorage` and plain documents in Firestore. If you have read a claim anywhere that this app encrypts project storage with AES-GCM and PBKDF2, that claim is false and no code has ever backed it.

:::caution[A claim in the source that is not true]
The comment at the top of `lib/password-gen.ts` reads "crypto.getRandomValues only. no `Math.random` anywhere in this repo." The first sentence is true of that file. The second is not true of the repository: `Math.random` is used for placeholder prose in `lib/lorem.ts` (deliberately, and documented as decorative), for the cache-busting query parameter and the DNS query ID in `lib/network-testing.ts`, and for project id generation in `contexts/project-context.tsx`. None of those is a security-relevant draw, so the practical claim holds; the sentence as written does not, and it is recorded here rather than quietly dropped.
:::

## Not in scope (yet)

- **Analytics as an opt-in.** Vercel Analytics is unconditional. Making it a preference would be better, and would need a consent surface the app does not have yet.
- **A `runtime.thirdParty` list checked against the code.** The registry test proves a host list exists and is non-empty; it does not diff those names against the URLs the component actually requests. `tests/unit/csp.test.ts` closes half of this from the other direction, since it extracts request-target literals from `lib/`, `components/`, `app/` and `contexts/` and fails if the CSP does not permit them, so a **new** egress host cannot appear unnoticed. What is still missing is the per-tool attribution: nothing asserts that the host a given tool declares is the host that tool calls.
- **Self-service account deletion.** Covered on [accounts and saved projects](/docs/privacy/accounts-and-projects/); it is an email request today.

:::caution[The one rule worth remembering]
If a tool shows no host warning, it made no request. If it shows hosts, assume those operators saw exactly what you typed. Do not paste an internal hostname into a DoH lookup and expect it to stay internal.
:::
