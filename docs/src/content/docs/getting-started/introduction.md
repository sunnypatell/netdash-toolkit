---
title: What NetDash Toolkit is
description: A 48-tool network engineering dashboard with no backend, shipped as both a static site and a desktop app, and honest about which tools leave your device.
---

NetDash Toolkit is a network engineering dashboard: 48 tools covering subnet math, VLSM planning, VLAN and ACL config generation, DNS and TLS inspection, and a set of developer utilities. It ships twice from one codebase, as a static website and as a desktop app.

## The shape of the project

There is no backend. `next.config.mjs` sets `output: "export"`, so `next build` emits a directory of static files and nothing runs on a server. That single decision drives most of what follows: there is no API to send your subnet to, no request log to leak, and no server-side rendering to reason about.

| Property      | Value                                          | Why it matters                                                                          |
| ------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| Framework     | Next.js 15 App Router, `output: "export"`      | no server, so no server-side data handling                                              |
| Routing       | `trailingSlash: true`                          | every URL is a directory with an `index.html`, which is what a dumb static server needs |
| Tools         | 48, enumerated in `lib/tool-registry.ts`       | one list drives the sidebar, search, routes, and these docs                             |
| Offline tools | 36 of 48                                       | the majority of the app works with no network at all                                    |
| Desktop shell | Electron 39, serving `out/` over loopback HTTP | the same static export, plus capabilities a browser lacks                               |
| Licence       | MIT                                            | fork it, self-host it, ship it                                                          |

The tool count and the offline count in that table are not hand-maintained. They are read out of the registry when these docs are built, and a unit test in `tests/unit/tool-registry.test.ts` asserts that each tool's declared `runtime.offline` matches whether the component actually performs network I/O.

## The registry is the source of truth

Every tool is one entry in `lib/tool-registry.ts` carrying its slug, label, description, category, feature list, search keywords, and a lazy component loader. The route `app/(shell)/tools/[slug]/page.tsx` enumerates those slugs in `generateStaticParams`, with `dynamicParams = false`, so an unknown slug fails the build instead of rendering an empty page.

Entries that leave the device also carry a `runtime` block:

```ts
runtime: {
  offline: false,
  thirdParty: ["cloudflare-dns.com", "dns.google"],
  desktopOnly: ["direct DNS queries"],
}
```

`thirdParty` names the hosts that receive your input. `desktopOnly` names capabilities that exist only in the Electron build. The comment above the interface is blunt about why it exists: the dashboard used to claim "100% offline ready" while a dozen tools did network I/O, and nothing in the registry could contradict it.

## What it is not

- **Not a monitoring system.** Nothing polls, nothing alerts, nothing runs while the tab is closed.
- **Not a substitute for `nmap`, `dig`, or `mtr`.** The desktop build shells out to your system's `ping`, `traceroute` and `arp` and parses their text output; it does not reimplement them.
- **Not authenticated by default.** Sign-in exists only to sync saved projects, and every tool works without it.
- **Not notarized on macOS.** Builds are ad-hoc signed because notarization needs a paid Apple Developer ID. [Releases and verification](/docs/self-hosting/releases/) covers what to run instead of trusting Gatekeeper.

## Not in scope (yet)

- **A Content-Security-Policy.** `vercel.json` sets five security headers, and none of them is a CSP. The Electron static server reproduces none of them either. This is safe to defer because the app has no backend and no user-generated content to inject, but it is a real gap and it is worth naming rather than burying.
- **Auto-update in the desktop app.** `electron-builder.json` sets `"publish": null` and there is no `electron-updater` anywhere in the tree, so updates are a manual download or a `brew upgrade`. Deferring it is defensible for a free project with signed release artifacts, since the verification path in the docs does not depend on an update channel being trustworthy.
- **A sandboxed renderer.** `webPreferences` sets `contextIsolation: true` and `nodeIntegration: false` but leaves `sandbox: false`. The navigation allowlist is what currently keeps the preload bridge away from remote origins.

:::note
Every number and behaviour on this page came from reading the code, not from a changelog. If something here contradicts what the app does, the code is right and this page is a bug; open an issue against [the repository](https://github.com/sunnypatell/netdash-toolkit).
:::
