---
title: Quick start
description: Open a tool, read its runtime badge, and save a result, in either the browser or the desktop build.
---

Nothing to install and nothing to sign up for. Pick a tool, type an address, read the result.

## 1. Open a tool

Every tool lives at `/tools/<slug>/`. The sidebar groups them into seven categories, and `cmd`+`k` (or `ctrl`+`k`) opens a command palette that searches labels, descriptions and keywords. Search is ranked rather than filtered: an exact slug match scores 100, a label prefix match scores 70, and a description hit scores 20, so typing `subnet` puts the Subnet Calculator first.

If you would rather browse, [all 48 tools](/docs/tools/) are listed by category with a note on what each one sends.

## 2. Read the runtime badge before you type

36 of the 48 tools never make a network request. The other 12 declare the hosts they contact, and the UI surfaces that before you submit anything. Treat the badge as the contract:

| What you see      | What it means                                | Why you should care                             |
| ----------------- | -------------------------------------------- | ----------------------------------------------- |
| No network note   | The tool computes locally, in your tab       | works offline, in an air-gapped lab, on a plane |
| Named hosts       | Your input is sent to those hosts            | the host operator sees what you typed           |
| Desktop-only note | The full capability needs the Electron build | the browser fallback is weaker, not equivalent  |

The third row is the one people get wrong. A browser build of the ping tool is not a degraded ICMP ping; it is a completely different measurement. [What a browser cannot do](/docs/diagnostics/browser-limits/) explains why.

## 3. Try the offline path first

The calculators need no network at all, so they are the fastest way to confirm the app is working:

```bash
# clone and run the dev server
git clone https://github.com/sunnypatell/netdash-toolkit.git
cd netdash-toolkit
pnpm install
pnpm dev
```

Then open `http://localhost:3000/tools/subnet-calculator/`. Enter `192.168.1.1` with a `/24` prefix. There is no Calculate button on purpose: the tool computes on arrival and recomputes as you type, and the current input is mirrored into the query string so a result is a shareable URL. That behaviour is pinned by `tests/components/url-state.test.tsx`, including the `?ip=10.20.30.40&prefix=22` deep-link form and the IPv6 tab reached with `?tab=ipv6`.

## 4. Save a result, if you want to

11 of the 48 tools can save output to a project. Saving needs an account, because a project syncs to Firestore. Everything else works signed out, and the registry only advertises saving on tools whose component actually renders the save control.

:::tip
Saving is the only feature that requires an account, and it is the only path by which tool output reaches a server. [Accounts and saved projects](/docs/privacy/accounts-and-projects/) covers exactly what is stored.
:::

## 5. Read a result you cannot trust

This is the step most tool directories leave out, and it is the one worth learning first: several results carry a qualifier, and the qualifier is the result.

| What you see                     | Where                                     | What it actually means                                                                                                      |
| -------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `unknown` on a port              | Port scanner, browser                     | The probe did not complete. Closed, filtered, a non-HTTP service, a TLS mismatch and a content blocker all fail identically |
| `browser-blocked` on a port      | Port scanner, browser                     | Nothing was sent. The Fetch Standard refuses that port outright, so its real state is unmeasurable here                     |
| "unverified, via relay"          | HTTP headers, security headers, redirects | A third party fetched it, not you. That party can add, drop or rewrite anything, and you cannot tell                        |
| A DNSSEC badge                   | DNS tools                                 | The resolver's AD bit, which is the resolver's claim about its own validation. Nothing was validated locally                |
| `HTTPS request` as the transport | Ping, RTT panel                           | An HTTP round trip including DNS, TCP and TLS. Do not compare it to an ICMP figure                                          |
| A Certificate Transparency date  | SSL checker                               | What was **issued** for the domain, from a CT log. Not what the server is presenting right now                              |

The rule underneath all six: if the app cannot measure something, it says so rather than picking the plausible answer. Two of these exist because the plausible answer used to be picked. [What a browser cannot do](/docs/diagnostics/browser-limits/) has the mechanism for each.

## 6. Install the desktop build if you need real ICMP

The browser cannot send an ICMP echo request, so the desktop build exists for the four diagnostics that need OS-level networking: ICMP ping, system traceroute, TCP connect scanning, and ARP-based local discovery.

```bash
# macos, via the project's own tap
brew tap sunnypatell/netdash https://github.com/sunnypatell/netdash-toolkit
brew install --cask --no-quarantine netdash
```

Windows and Linux builds are attached to each [GitHub release](https://github.com/sunnypatell/netdash-toolkit/releases). Verify what you download; the commands are in [releases and verification](/docs/self-hosting/releases/).

:::caution
The desktop app runs `ping`, `traceroute` and `arp` and scans TCP ports against whatever host you type. Port scanning hosts you do not own is, depending on where you are, somewhere between rude and illegal. The app validates and quotes your input so it cannot become shell injection, but it will not tell you whether you are allowed to scan the target.
:::
