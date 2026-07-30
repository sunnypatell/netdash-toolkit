---
title: Browser versus desktop
description: The capability split between the NetDash Toolkit web app and the Electron desktop build, and the sandbox rules that create it.
---

Same UI, same 48 tools, same code. The difference is that the desktop build has a process outside the web sandbox, and that process can do four things a page cannot.

## The split

| Capability              | Browser                                       | Desktop                                    | Mechanism the desktop uses                      |
| ----------------------- | --------------------------------------------- | ------------------------------------------ | ----------------------------------------------- |
| All 36 offline tools    | full                                          | full                                       | pure computation, no difference                 |
| DNS lookups             | DoH to a public resolver                      | DoH, or any DNS server you name            | Node `dns.promises.Resolver`                    |
| Latency                 | HTTPS round trip via `fetch`                  | real ICMP RTT                              | spawns the system `ping` binary                 |
| Traceroute              | refused                                       | full path discovery                        | spawns `traceroute` or `tracert`                |
| Port scan               | `open` when something answers, else `unknown` | `open`, `closed` and `filtered` told apart | Node `net.Socket` connect attempts              |
| Local network discovery | nothing                                       | ARP cache plus interface enumeration       | spawns `arp -a`, reads `os.networkInterfaces()` |
| Docs                    | served from the CDN                           | served from the local HTTP server, offline | `serve-handler` over `out/`                     |

Read the "Browser" column as a list of things the web platform forbids, not things the app failed to implement. A page has no raw socket API, cannot set an IP TTL, and cannot read most cross-origin response headers. [What a browser cannot do](/docs/diagnostics/browser-limits/) walks through each restriction with the spec text behind it.

## Why the desktop build can do more

The desktop build is Electron: a Chromium renderer showing the same static export, plus a Node main process that is not sandboxed by web rules. The renderer still cannot open a socket. What it can do is ask the main process, over an IPC channel, and the main process does the work.

That boundary is the whole security model, so it is narrow on purpose. `electron/preload.ts` exposes exactly ten methods on `window.electronAPI` and nothing else. There is no generic "run this command" channel.

```ts
// how a tool asks for something only the desktop build can do
const native = isElectron()
const result = native
  ? await electronNetwork.ping(host, { count: 4, timeout: 5000 })
  : await httpTimingFallback(host)
```

Detection is a presence check on `window.electronAPI`, guarded by `typeof window !== "undefined"` because Next prerenders during the static export. There is no user-agent sniffing.

## What the desktop build does NOT add

- **No elevated privileges.** The Windows installer requests `asInvoker`. Nothing prompts for admin or root.
- **No auto-update.** `electron-builder.json` sets `"publish": null`, so updates are a manual download or `brew upgrade`.
- **No extra telemetry.** The desktop build makes the same outbound requests the web build makes, plus whichever diagnostic you run.
- **No notarization on macOS.** Builds are ad-hoc signed. [Releases and verification](/docs/self-hosting/releases/) covers what to check instead.
- **No CSP.** The web deployment sets five security headers through `vercel.json`; the Electron static server reproduces none of them, and neither sets a Content-Security-Policy.

## The offline story, in full

This is the part that is genuinely nice, so it is worth stating precisely. `next build` copies everything in `public/` verbatim into `out/`. The docs are built into `public/docs/`, so they land at `out/docs/`. The desktop app serves `out/` from a Node HTTP server bound to `127.0.0.1:17890`.

Put together: with no network connection at all, you get 36 fully working tools, the complete documentation, and the search index, all from one loopback origin. Nothing in the docs loads a remote font, script, or stylesheet, which is a constraint the docs build holds to deliberately rather than by luck.

The 12 networked tools fail cleanly rather than hanging, because every outbound request in the app carries an abort signal or a spawn timeout. The one exception worth naming is the secondary DoH client in `lib/email-auth.ts`, which has no abort signal and falls back to the browser's own connection timeout.

:::tip[Which One Should You Install]
If you do subnet math, config generation and reference lookups, the website is the whole product and installing anything is a waste of your time. Install the desktop app when you need ICMP, traceroute, a real port scan, or your LAN's ARP table.
:::
