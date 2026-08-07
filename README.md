<div align="center">

# NetDash Toolkit

### _The Ultimate Network Engineering Workbench_

<br />

<img src="public/favicon.svg" alt="NetDash Logo" width="120" height="120" />

<br />
<br />

[![Live Demo](https://img.shields.io/badge/LIVE-DEMO-10b981?style=for-the-badge&logo=vercel&logoColor=white)](https://netdash-toolkit.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

[![CI](https://img.shields.io/github/actions/workflow/status/sunnypatell/netdash-toolkit/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/sunnypatell/netdash-toolkit/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/sunnypatell/netdash-toolkit?style=flat-square&label=release)](https://github.com/sunnypatell/netdash-toolkit/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/sunnypatell/netdash-toolkit/total?style=flat-square&label=downloads)](https://github.com/sunnypatell/netdash-toolkit/releases)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/sunnypatell/netdash-toolkit/badge?style=flat-square)](https://scorecard.dev/viewer/?uri=github.com/sunnypatell/netdash-toolkit)
[![SLSA 3](https://slsa.dev/images/gh-badge-level3.svg)](https://slsa.dev/spec/v1.0/levels)
[![License](https://img.shields.io/badge/License-MIT-emerald?style=flat-square)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](CONTRIBUTING.md)
[![Maintenance](https://img.shields.io/badge/Maintained-yes-green?style=flat-square)](https://github.com/sunnypatell/netdash-toolkit/graphs/commit-activity)

<br />

**[Features](#features) • [Quick Start](#quick-start) • [Tools](#tool-suite) • [Tech Stack](#tech-stack) • [Roadmap](#roadmap) • [Desktop App](#electron-desktop-app)**

<br />

---

<br />

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="rainbow line" />

</div>

<br />

## What is NetDash?

**NetDash Toolkit** is a browser-based network engineering workbench that consolidates **48 networking tools** into a single interface. Built for network engineers, system administrators, and IT professionals who need these utilities without installing an application for each one. The tool list, its categories, and the network disclosure below are all read out of [`lib/tool-registry.ts`](lib/tool-registry.ts), so they cannot drift from what ships.

<br />

<div align="center">
<table>
<tr>
<td align="center" width="25%">

### No backend

36 of the 48 tools make no network request at all. The 12 networked tools name the exact hosts they contact before they contact them.

</td>
<td align="center" width="25%">

### Optional cloud sync

Sign in with Google or Email to sync saved projects across devices with Firebase. Every tool works signed out, the SDK is imported on demand rather than at page load, and projects are stored as plaintext documents, not encrypted.

</td>
<td align="center" width="25%">

### Zero install

The web build needs nothing but a browser. The desktop build exists only for the four things a browser cannot do: ICMP, traceroute, TCP connect scanning, and reading the ARP cache.

</td>
<td align="center" width="25%">

### Accessible

WCAG 2.2 AA, held by axe-core over every tool plus a contrast test that parses the shipped design tokens. Light and dark themes carry different primaries because one value cannot clear 4.5:1 on both.

</td>
</tr>
</table>
</div>

<br />

---

<br />

## Features

<div align="center">

|      Category      | Tools |                       Examples                       | What they do, and what leaves your device                                                                                                                             |
| :----------------: | :---: | :--------------------------------------------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  **Calculators**   |   8   |     Subnet, VLSM, MTU, Bandwidth, Cable, Uptime      | IPv4/IPv6 subnetting with RFC 3021 `/31` support, MTU and TCP MSS with cited per-layer overhead, TIA fiber and copper loss. All offline                               |
|    **IP Tools**    |   6   | IP Converter, Enumerator, IPv6 Tools, Conflict Check | Base conversion, range expansion, modified EUI-64, ARP and DHCP correlation. Offline; the conflict checker's only I/O is the desktop build reading your own ARP cache |
| **Network Config** |   4   | VLAN Manager, Routing Tools, ACL Generator, Wireless | Cisco IOS and Aruba CX VLANs, OSPF/EIGRP/static routes, ACLs for Cisco IOS, Juniper JunOS and Palo Alto PAN-OS. All offline                                           |
|  **Diagnostics**   |  11   |  Ping & Traceroute, DNS, SSL, WHOIS, Email, Headers  | DoH lookups, Certificate Transparency history, RDAP, SPF/DKIM/DMARC, header and redirect audit. Ten of the twelve networked tools are here                            |
|   **Generators**   |   2   |              Random Generator, WiFi QR               | Random IPv4/IPv6/MAC from `crypto.getRandomValues` with rejection sampling, WPA2/WPA3 QR payloads. Offline                                                            |
|   **Reference**    |   6   |   Reference Hub, OUI, Ports, CIDR, Protocols, IPv6   | Searchable port and protocol tables, CIDR cheat sheet, MAC vendor prefixes. Offline, except an optional remote OUI lookup                                             |
|   **Dev Tools**    |  11   |    JSON, Regex, JWT, Hash, Base64, Cron, Password    | Formatting, decoding, SHA-1/256/384/512 digests (Web Crypto registers no MD5), cron and timestamp parsing. All offline                                                |

</div>

Counts come from the registry. `pnpm test` fails if a tool's declared `runtime.offline` disagrees with whether its source actually performs network I/O, which is the gate that exists because the dashboard once advertised "100% offline ready" while twelve tools were making requests.

<br />

---

<br />

## Quick Start

### Prerequisites

- **Node.js** 20, the major pinned in `.nvmrc`, so `nvm use` picks it up
- **pnpm** 10 or later; the exact version is pinned in `packageManager`, so `corepack enable` is enough

### Installation

```bash
# Clone the repository
git clone https://github.com/sunnypatell/netdash-toolkit.git

# Navigate to the project directory
cd netdash-toolkit

# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to access NetDash.

### Production Build

```bash
# Create optimized production build (builds the docs site first)
pnpm build

# App only, skipping the docs build
pnpm build:app

# Serve the static export locally. `next start` does not work with
# output: "export", so there is no server to start.
npx serve@latest out
```

<br />

---

<br />

## Documentation

Full documentation lives at **[netdash-toolkit.vercel.app/docs](https://netdash-toolkit.vercel.app/docs/)**, and ships inside the desktop app too, so it works with no network connection.

| Guide                                                                                                 | What it covers                                                                               |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [Getting started](https://netdash-toolkit.vercel.app/docs/getting-started/introduction/)              | what the project is, the browser vs desktop split, quick start                               |
| [Tools](https://netdash-toolkit.vercel.app/docs/tools/)                                               | all 48 tools by category, generated from `lib/tool-registry.ts`                              |
| [How the diagnostics work](https://netdash-toolkit.vercel.app/docs/diagnostics/browser-limits/)       | why browser "ping" is an HTTPS round trip, what CORS hides, what DoH does and does not prove |
| [Privacy and data handling](https://netdash-toolkit.vercel.app/docs/privacy/what-leaves-your-device/) | every outbound request, per capability                                                       |
| [Self-hosting and desktop](https://netdash-toolkit.vercel.app/docs/self-hosting/releases/)            | local dev, the Electron build, and how to verify a download                                  |
| [Contributing](https://netdash-toolkit.vercel.app/docs/contributing/tests-and-gates/)                 | the two vitest projects, the axe gate, the contrast gate                                     |

The docs are an [Astro Starlight](https://starlight.astro.build/) site in `docs/`, a separate pnpm project with its own lockfile. `pnpm build:docs` builds it into `public/docs/`, which `next build` then emits to `out/docs/`.

```bash
# work on the docs with live reload at http://localhost:4321/docs/
cd docs
pnpm install
pnpm dev
```

<br />

---

<br />

## Tool Suite

<details>
<summary><b>Subnet Calculator</b> - Dual-stack IPv4/IPv6 calculations</summary>

<br />

- Full IPv4 and IPv6 subnet calculations
- Network, broadcast, and host range computation
- CIDR notation with netmask conversion
- Special address detection (private, loopback, multicast, link-local)
- RFC3021 /31 point-to-point link support
- Export results to CSV/JSON

</details>

<details>
<summary><b>VLSM Planner</b> - Variable Length Subnet Masking optimization</summary>

<br />

- Optimal subnet allocation algorithm
- Host requirement-based planning
- Visual heatmap of network utilization
- Support for /31 and /32 prefixes
- Utilization statistics and waste analysis
- Export to CSV, JSON, or text

</details>

<details>
<summary><b>VLAN Manager</b> - Enterprise VLAN design and configuration</summary>

<br />

- VLAN database management with validation
- Switch port configuration (access/trunk modes)
- IPv4/IPv6 subnet overlap detection
- Multi-vendor configuration generation:
  - Cisco IOS
  - Aruba CX
- Native VLAN and trunk allowed VLAN validation
- CSV export of VLAN database

</details>

<details>
<summary><b>Routing Tools</b> - Configuration builders for routing protocols</summary>

<br />

- **OSPF**: Area configuration, network statements, process ID management
- **EIGRP**: AS configuration, network statements, wildcard masks
- **Static Routes**: Next-hop and exit-interface support, tracking options
- CIDR normalization and validation
- Discontiguous mask rejection
- Administrative distance reference

</details>

<details>
<summary><b>Wireless Tools</b> - WiFi planning and configuration</summary>

<br />

- 2.4 GHz and 5 GHz channel planning
- Channel interference analysis
- Capacity calculator with real-world throughput estimates
- Per-client bandwidth calculations
- Cisco wireless configuration templates
- Security best practices checklist

</details>

<details>
<summary><b>ACL Generator</b> - Access Control List builder</summary>

<br />

- Standard and Extended ACL support
- Host/CIDR/wildcard mask parsing
- TCP/UDP port specification with operators (eq, gt, lt, neq, range)
- ICMP type and code support
- TCP flags and "established" keyword
- Security warnings for dangerous rules
- Cisco IOS, Juniper JunOS and Palo Alto PAN-OS configuration output

</details>

<details>
<summary><b>IP Conflict Checker</b> - Network conflict detection</summary>

<br />

- Multi-format input parsing:
  - Windows ARP tables
  - Linux `ip neigh` output
  - Cisco ARP/MAC tables
  - DHCP lease files
- IP and MAC duplicate detection
- Conflict severity classification
- Remediation recommendations
- Export to CSV or remediation report

</details>

<details>
<summary><b>Network Tester</b> - Connectivity and performance testing</summary>

<br />

- HTTP-based RTT measurement with jitter analysis
- Throughput testing (download/upload)
- DNS-over-HTTPS queries (Cloudflare, Google, Quad9, OpenDNS, AdGuard)
- DNSSEC validation
- MTU calculator with protocol overhead
- OUI/MAC vendor lookup

</details>

<details>
<summary><b>DNS Tools</b> - DNS query and analysis</summary>

<br />

- Multiple DoH providers
- Record type support: A, AAAA, CNAME, MX, NS, TXT, SOA, PTR, SRV
- DNSSEC validation indicator
- Response time measurement
- Detailed record information display

</details>

<details>
<summary><b>MTU Calculator</b> - Protocol overhead analysis</summary>

<br />

- Link MTU configuration
- IPv4/IPv6 protocol selection
- Transport layer overhead (TCP/UDP)
- Encapsulation protocols:
  - Ethernet II, 802.1Q VLAN, QinQ
  - PPPoE, GRE, VXLAN, IPsec ESP
- Fragmentation warnings
- Maximum payload calculation

</details>

<details>
<summary><b>Cable Calculator</b> - Fiber and copper signal loss analysis</summary>

<br />

- **Fiber Optic** (TIA-568.3-D compliant):
  - Single-mode: OS1, OS2 at 1310nm/1550nm
  - Multi-mode: OM1, OM2, OM3, OM4, OM5 at 850nm
  - Connector loss calculation (0.75 dB per mated pair)
  - Splice loss: fusion (0.1 dB) and mechanical (0.5 dB)
  - Power budget analysis with link margin warnings
- **Copper Ethernet** (TIA-568-D compliant):
  - Cat5e through Cat8 distance validation
  - Permanent link and channel model support
  - 10GBASE-T distance limits
  - Patch cord length validation
- Export to JSON and save to project

</details>

<details>
<summary><b>WiFi QR Generator</b> - Instant WiFi connection QR codes</summary>

<br />

- Standard WIFI:// QR code format
- Security type support:
  - WPA2-Personal (recommended)
  - WPA3-Personal (SAE)
  - WEP (legacy with warning)
  - Open networks
- Hidden network support
- Special character escaping (`;`, `:`, `,`, `\`, `"`)
- Download as PNG or SVG
- Copy QR string to clipboard
- Save configuration to project

</details>

<br />

---

<br />

## Tech Stack

<div align="center">

|     Layer      | Technology                                                                                                                        |
| :------------: | :-------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**  | [Next.js 15](https://nextjs.org/) App Router, `output: "export"`                                                                  |
|  **Language**  | [TypeScript 5](https://www.typescriptlang.org/)                                                                                   |
|  **Styling**   | [Tailwind CSS 4](https://tailwindcss.com/)                                                                                        |
| **Components** | [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/)                                                       |
|  **Backend**   | none. [Firebase](https://firebase.google.com/) Auth + Firestore are optional, and only for saved projects                         |
|   **Icons**    | [Lucide React](https://lucide.dev/)                                                                                               |
|   **Toasts**   | [Sonner](https://sonner.emilkowal.ski/), the one toast system in the app                                                          |
| **URL state**  | [nuqs](https://nuqs.47ng.com/), so a tool result is a shareable link                                                              |
|  **Testing**   | [Vitest](https://vitest.dev/), [Testing Library](https://testing-library.com/), [axe-core](https://github.com/dequelabs/axe-core) |
|  **Theming**   | [next-themes](https://github.com/pacocoursey/next-themes)                                                                         |
|    **Docs**    | [Astro Starlight](https://starlight.astro.build/), a separate pnpm project                                                        |
|  **Desktop**   | [Electron 39](https://www.electronjs.org/) + [electron-builder](https://www.electron.build/)                                      |
| **Deployment** | [Vercel](https://vercel.com/)                                                                                                     |

</div>

<br />

---

<br />

## Project Structure

```
netdash-toolkit/
├── app/                    # Next.js App Router, static export
│   ├── layout.tsx         # root layout, theme provider, Sonner toaster
│   ├── globals.css        # design tokens; tests/unit/contrast.test.ts parses this file
│   ├── (shell)/           # dashboard, /tools/[slug], /about, /projects
│   └── auth/action/       # Firebase email-action handler, outside the shell
├── components/
│   ├── ui/                # shadcn/ui primitives plus ip-input, tool-header, result-card
│   └── tools/             # one file per simple tool, one directory per multi-panel tool
├── lib/                    # every piece of logic worth testing lives here
│   ├── tool-registry.ts   # the single source of truth: 48 tools, categories, runtime disclosure
│   ├── firebase.ts        # no static SDK import: auth and firestore load on demand
│   ├── browser-limits.ts  # CORS safelist, the fetch standard's blocked ports, mixed-content
│   ├── network-utils.ts   # IPv4/IPv6 address math
│   ├── mtu.ts             # MTU and MSS arithmetic, every byte cited
│   ├── port-probe.ts      # browser port probe; never reports a state it cannot prove
│   ├── browser-ping.ts    # HTTPS round trip, labelled as one
│   ├── hash.ts            # the four digests Web Crypto registers, and why MD5 is not one
│   ├── reference/         # static datasets: ports, protocol numbers, address ranges
│   └── ...                # one module per concern
├── contexts/              # auth and project React contexts
├── electron/              # main process, preload bridge, CSP, navigation policy, IPC handlers
├── tests/
│   ├── unit/              # node-environment tests over lib/ and electron/
│   ├── components/        # happy-dom mounts, plus the axe WCAG 2.2 AA gate
│   └── fixtures/          # real captured ping / traceroute / arp output
├── docs/                   # Astro Starlight site, its own pnpm project and lockfile
├── data/changelog.json    # release history rendered by /about and the header badge
└── public/                # static assets, plus the built docs at public/docs/
```

<br />

---

<br />

## Roadmap

<div align="center">

| Status  | Feature              | Description                                       |
| :-----: | :------------------- | :------------------------------------------------ |
|  Done   | Core Tools           | Subnet, VLSM, VLAN, Routing, ACL, Wireless        |
|  Done   | Network Testing      | RTT, Throughput, DNS-over-HTTPS                   |
|  Done   | Dark Mode            | System-aware theming                              |
|  Done   | Cloud Sync           | Firebase auth, project sync across devices        |
|  Done   | Project Sharing      | Share projects with collaborators via email       |
|  Done   | Electron App         | Desktop version with native networking            |
|  Done   | Real ICMP Ping       | Native ping with Electron                         |
|  Done   | Real Traceroute      | TTL-based hop discovery                           |
|  Done   | Port Scanner         | TCP connect scanning, desktop only                |
|  Done   | ARP Cache Read       | Parses `arp -a` on the desktop build; not a sweep |
|  Done   | Cable Calculator     | TIA-compliant fiber/copper signal loss            |
|  Done   | WiFi QR Generator    | WPA2/WPA3/WEP QR codes for instant connection     |
|  Done   | SSL/TLS Checker      | Certificate analysis and security scoring         |
|  Done   | WHOIS Lookup         | Domain and IP registration data                   |
|  Done   | Email Diagnostics    | SPF, DKIM, DMARC validation                       |
|  Done   | Developer Tools      | JSON, Regex, JWT, SHA digests, Password gen       |
|  Done   | Reference Pages      | Port numbers, CIDR, protocols, IPv6               |
| Planned | Configuration Backup | SSH-based device config backup                    |
| Planned | SNMP Polling         | Device monitoring via SNMP                        |
| Planned | Network Topology     | Visual network mapping                            |

</div>

<br />

---

<br />

## Browser Limitations

The web platform gives a page one way to reach the network: HTTP, through `fetch`. Everything below follows from that, and none of it is worked around with a simulation. Where the platform cannot answer, the tool says so.

| Feature              | The limit, and where it comes from                                | What the app does instead                                                                          |
| :------------------- | :---------------------------------------------------------------- | :------------------------------------------------------------------------------------------------- |
| **ICMP ping**        | No web API emits ICMP; it needs a raw socket                      | Times one HTTPS round trip and labels the transport `https-round-trip`, never `icmp`               |
| **Traceroute**       | No web API sets a per-packet IP TTL                               | Refuses, and explains why. Nothing is sent                                                         |
| **Port scanning**    | No raw sockets, and the Fetch Standard blocks 83 ports outright   | HTTP probe reporting `open`, `unknown` or `browser-blocked`. Never `closed`, which it cannot prove |
| **Response headers** | A cross-origin response exposes exactly 7 CORS-safelisted headers | Names the headers it could not read, rather than reporting them absent                             |
| **Direct DNS**       | No UDP socket to port 53                                          | DNS over HTTPS across 5 providers, 2 of them in the RFC 8484 wire format                           |
| **MD5**              | Web Crypto registers 4 digest algorithms and MD5 is not one       | Offers SHA-1/256/384/512 and lists MD5 as unavailable with the reason                              |

Two of those rows are the reason this section exists. Traceroute used to return five hardcoded hops with random jitter added to look measured, and the port scanner used to report `Math.random() > 0.8` as "open". Both were deleted rather than improved. A refusal is a better answer than a plausible fiction.

> **Available now:** the Electron desktop build adds real ICMP ping, system traceroute, TCP connect scanning and direct DNS queries. It is the same UI, with a Node process behind an IPC bridge.

<br />

---

<br />

## Electron Desktop App

The desktop build is the same static export inside an Electron shell. It adds exactly four capabilities, each by driving a tool your machine already has rather than reimplementing it.

### What the desktop build adds

| Capability           | Browser                             | Desktop                                        | Mechanism                                                                                            |
| :------------------- | :---------------------------------- | :--------------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| **ICMP ping**        | HTTPS round trip, labelled as one   | Real ICMP echo                                 | Spawns your system `ping` binary                                                                     |
| **Traceroute**       | Refused                             | Full path discovery                            | Spawns `traceroute`, `tracert` on Windows                                                            |
| **Port scanning**    | `open` or `unknown`, never `closed` | `open`, `closed` and `filtered` told apart     | Node `net.Socket` connect, TCP only, no UDP                                                          |
| **Local neighbours** | Not available                       | Reads the system ARP cache                     | Runs `arp -a` and parses it. Not a sweep, so it only shows hosts this machine has recently talked to |
| **DNS queries**      | DoH to a public resolver            | Any DNS server you name, including on your LAN | Node `dns.promises.Resolver`                                                                         |

Nothing here asks for elevation. The Windows installer requests `asInvoker`, which is also why ICMP goes through the system `ping` binary instead of a raw socket.

### Install Desktop App

**macOS (Homebrew):** _(supports Apple Silicon & Intel)_

```bash
brew tap sunnypatell/netdash https://github.com/sunnypatell/netdash-toolkit
brew install --cask --no-quarantine netdash
```

> **Note:** `--no-quarantine` skips Gatekeeper's quarantine flag - the app is ad-hoc signed, not notarized (notarization requires a paid Apple Developer ID). If you installed without the flag or downloaded the DMG directly, run `xattr -cr "/Applications/NetDash Toolkit.app"` instead. Every release ships SHA-256 checksums and [SLSA Build L3 provenance](https://github.com/sunnypatell/netdash-toolkit/attestations) so you can verify exactly what you're running - see the release notes for copy-paste verification commands.

### Building from Source

```bash
# Install dependencies
pnpm install

# Development mode (with hot reload)
pnpm electron:dev

# Build for macOS
pnpm dist:mac

# Build for Windows
pnpm dist:win

# Build for Linux
pnpm dist:linux
```

### System Requirements

| Platform    | Requirements                                                                                                                                 |
| :---------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| **macOS**   | macOS 12.0+ (Monterey or later), x64 or Apple Silicon. Electron 39 declares `LSMinimumSystemVersion 12.0`, so older releases will not launch |
| **Windows** | Windows 10+, x64                                                                                                                             |
| **Linux**   | Ubuntu 22.04+, Debian 12+, or equivalent (glibc 2.31+)                                                                                       |

<br />

---

<br />

## Available Scripts

| Command                 | Description                                                                            |
| :---------------------- | :------------------------------------------------------------------------------------- |
| `pnpm dev`              | Development server with hot reload                                                     |
| `pnpm validate`         | format:check, lint, typecheck, electron:compile, test. Exactly the CI `Quality` job    |
| `pnpm validate:full`    | `validate` plus the full build. Run it if you touched anything the build consumes      |
| `pnpm build`            | Build the docs site, then the app. This is what Vercel and CI run                      |
| `pnpm build:app`        | The app only, leaving `public/docs/` alone                                             |
| `pnpm build:docs`       | Build `docs/` and copy the output into `public/docs/`                                  |
| `pnpm test`             | Vitest, both projects. `test:unit` and `test:components` run one each                  |
| `pnpm typecheck`        | `tsc --noEmit`. A passing build does not check types, see below                        |
| `pnpm lint`             | ESLint. Note `next lint` is deprecated and is removed in Next.js 16                    |
| `pnpm format:check`     | Prettier in check mode. CI fails on this                                               |
| `pnpm electron:compile` | Typecheck and emit the Electron main process, which has its own `tsconfig.json`        |
| `pnpm electron:pack`    | Pack an unpacked app directory for this platform, which is the CI packaging smoke test |
| `pnpm dist:mac`         | Build macOS app (DMG + ZIP). Also `dist:win`, `dist:linux`, `dist:all`                 |

There is no `pnpm start`. `next start` refuses to serve an `output: "export"` build, so serve `out/` with any static file server instead.

`next.config.mjs` sets `eslint.ignoreDuringBuilds` and `typescript.ignoreBuildErrors` to `true`, so a green build proves nothing about types or lint. `pnpm typecheck` and `pnpm lint` are the real gates, and CI runs them as separate steps.

<br />

---

<br />

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first, because CI enforces more than a review does.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Put logic in `lib/` and write a test for it in `tests/unit/`. Anything that mounts a component goes in `tests/components/`
4. Run `pnpm validate` and `pnpm electron:compile`. That is the exact chain CI runs, so a green run locally is a green run there
5. Commit your changes (`git commit -m 'feat(scope): add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

Adding a tool means one entry in [`lib/tool-registry.ts`](lib/tool-registry.ts) and nothing else: the sidebar, the command palette, the static route, the docs pages and the network disclosure all read from it. If the tool makes any network request, set `runtime.offline: false` and list the hosts, or the registry test fails.

<br />

---

<br />

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

<br />

---

<br />

<div align="center">

### Star this repo if you find it useful!

<br />

**Made with love by [Sunny Patel](https://github.com/sunnypatell)**

<br />

[![GitHub stars](https://img.shields.io/github/stars/sunnypatell/netdash-toolkit?style=social)](https://github.com/sunnypatell/netdash-toolkit/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/sunnypatell/netdash-toolkit?style=social)](https://github.com/sunnypatell/netdash-toolkit/network/members)
[![GitHub watchers](https://img.shields.io/github/watchers/sunnypatell/netdash-toolkit?style=social)](https://github.com/sunnypatell/netdash-toolkit/watchers)

</div>
