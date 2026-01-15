<div align="center">

# NetDash Toolkit

### _The Ultimate Network Engineering Workbench_

<br />

<img src="public/favicon.svg" alt="NetDash Logo" width="120" height="120" />

<br />
<br />

[![Live Demo](https://img.shields.io/badge/LIVE-DEMO-10b981?style=for-the-badge&logo=vercel&logoColor=white)](https://netdash-toolkit.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

[![CI](https://img.shields.io/github/actions/workflow/status/sunnypatell/netdash-toolkit/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/sunnypatell/netdash-toolkit/actions/workflows/ci.yml)
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

**NetDash Toolkit** is a comprehensive, browser-based network engineering workbench that consolidates **14+ professional networking tools** into a single, elegant interface. Built for network engineers, system administrators, and IT professionals who need powerful utilities without the overhead of installing multiple applications.

<br />

<div align="center">
<table>
<tr>
<td align="center" width="25%">

### Privacy First

All calculations run **100% client-side**. Your network data never leaves your browser.

</td>
<td align="center" width="25%">

### Cloud Sync

Sign in with Google or Email to sync your projects across devices with Firebase.

</td>
<td align="center" width="25%">

### Zero Install

Access professional-grade tools instantly from any modern browser. No downloads required.

</td>
<td align="center" width="25%">

### Dark Mode

Beautiful light and dark themes that adapt to your system preferences.

</td>
</tr>
</table>
</div>

<br />

---

<br />

## Features

<div align="center">

|        Category         |                     Tools                     | Description                                                                                     |
| :---------------------: | :-------------------------------------------: | :---------------------------------------------------------------------------------------------- |
|  **Address Planning**   | Subnet Calculator, VLSM Planner, VLAN Manager | IPv4/IPv6 subnetting with RFC3021 support, optimal VLSM allocation, multi-vendor VLAN templates |
| **Routing & Switching** | Routing Tools, Wireless Tools, ACL Generator  | OSPF/EIGRP/Static route builders, WiFi channel planning, Cisco IOS ACL generation               |
|   **Troubleshooting**   |  Conflict Checker, Network Tester, DNS Tools  | IP/MAC conflict detection, RTT/throughput testing, DNS-over-HTTPS queries                       |
|      **Utilities**      |    MTU Calculator, IPv6 Tools, OUI Lookup     | Protocol overhead analysis, EUI-64 generation, MAC vendor identification                        |
|    **Cloud & Sync**     |        Project Manager, Authentication        | Firebase cloud sync, Google/Email sign-in, cross-device project persistence                     |

</div>

<br />

---

<br />

## Quick Start

### Prerequisites

- **Node.js** 18.0 or later
- **pnpm** (recommended) or npm

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
# Create optimized production build
pnpm build

# Start production server
pnpm start
```

<br />

---

<br />

## Tool Suite

<details>
<summary><b>Subnet Calculator</b> — Dual-stack IPv4/IPv6 calculations</summary>

<br />

- Full IPv4 and IPv6 subnet calculations
- Network, broadcast, and host range computation
- CIDR notation with netmask conversion
- Special address detection (private, loopback, multicast, link-local)
- RFC3021 /31 point-to-point link support
- Export results to CSV/JSON

</details>

<details>
<summary><b>VLSM Planner</b> — Variable Length Subnet Masking optimization</summary>

<br />

- Optimal subnet allocation algorithm
- Host requirement-based planning
- Visual heatmap of network utilization
- Support for /31 and /32 prefixes
- Utilization statistics and waste analysis
- Export to CSV, JSON, or text

</details>

<details>
<summary><b>VLAN Manager</b> — Enterprise VLAN design and configuration</summary>

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
<summary><b>Routing Tools</b> — Configuration builders for routing protocols</summary>

<br />

- **OSPF**: Area configuration, network statements, process ID management
- **EIGRP**: AS configuration, network statements, wildcard masks
- **Static Routes**: Next-hop and exit-interface support, tracking options
- CIDR normalization and validation
- Discontiguous mask rejection
- Administrative distance reference

</details>

<details>
<summary><b>Wireless Tools</b> — WiFi planning and configuration</summary>

<br />

- 2.4 GHz and 5 GHz channel planning
- Channel interference analysis
- Capacity calculator with real-world throughput estimates
- Per-client bandwidth calculations
- Cisco wireless configuration templates
- Security best practices checklist

</details>

<details>
<summary><b>ACL Generator</b> — Access Control List builder</summary>

<br />

- Standard and Extended ACL support
- Host/CIDR/wildcard mask parsing
- TCP/UDP port specification with operators (eq, gt, lt, neq, range)
- ICMP type and code support
- TCP flags and "established" keyword
- Security warnings for dangerous rules
- Cisco IOS configuration output

</details>

<details>
<summary><b>IP Conflict Checker</b> — Network conflict detection</summary>

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
<summary><b>Network Tester</b> — Connectivity and performance testing</summary>

<br />

- HTTP-based RTT measurement with jitter analysis
- Throughput testing (download/upload)
- DNS-over-HTTPS queries (Cloudflare, Google, Quad9, OpenDNS, AdGuard)
- DNSSEC validation
- MTU calculator with protocol overhead
- OUI/MAC vendor lookup

</details>

<details>
<summary><b>DNS Tools</b> — DNS query and analysis</summary>

<br />

- Multiple DoH providers
- Record type support: A, AAAA, CNAME, MX, NS, TXT, SOA, PTR, SRV
- DNSSEC validation indicator
- Response time measurement
- Detailed record information display

</details>

<details>
<summary><b>MTU Calculator</b> — Protocol overhead analysis</summary>

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

<br />

---

<br />

## Tech Stack

<div align="center">

|     Layer      | Technology                                                                  |
| :------------: | :-------------------------------------------------------------------------- |
| **Framework**  | [Next.js 14](https://nextjs.org/) with App Router                           |
|  **Language**  | [TypeScript 5](https://www.typescriptlang.org/)                             |
|  **Styling**   | [Tailwind CSS 4](https://tailwindcss.com/)                                  |
| **Components** | [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) |
|  **Backend**   | [Firebase](https://firebase.google.com/) (Auth + Firestore)                 |
|   **Icons**    | [Lucide React](https://lucide.dev/)                                         |
|   **Charts**   | [Recharts](https://recharts.org/)                                           |
|   **Forms**    | [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)   |
|  **Theming**   | [next-themes](https://github.com/pacocoursey/next-themes)                   |
| **Deployment** | [Vercel](https://vercel.com/)                                               |

</div>

<br />

---

<br />

## Project Structure

```
netdash-toolkit/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout with theme provider
│   ├── page.tsx           # Main application page
│   └── globals.css        # Global styles and Tailwind config
├── components/
│   ├── ui/                # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── ip-input.tsx   # Custom IP address input
│   │   └── ...
│   ├── tools/             # Network tool components
│   │   ├── subnet-calculator.tsx
│   │   ├── vlsm-planner.tsx
│   │   ├── vlan-manager.tsx
│   │   └── ...
│   ├── dashboard.tsx      # Main dashboard view
│   ├── sidebar.tsx        # Navigation sidebar
│   └── header.tsx         # Application header
├── lib/                   # Utility libraries
│   ├── network-utils.ts   # IPv4/IPv6 calculations
│   ├── network-testing.ts # RTT, DNS, throughput utilities
│   ├── conflict-utils.ts  # Conflict detection algorithms
│   ├── vlan-utils.ts      # VLAN validation and config generation
│   ├── vlsm-utils.ts      # VLSM planning algorithms
│   └── parsers.ts         # Multi-format data parsers
├── hooks/                 # React hooks
│   └── use-toast.ts       # Toast notification hook
└── public/                # Static assets
    └── favicon.svg        # Application icon
```

<br />

---

<br />

## Roadmap

<div align="center">

| Status  | Feature              | Description                                |
| :-----: | :------------------- | :----------------------------------------- |
|  Done   | Core Tools           | Subnet, VLSM, VLAN, Routing, ACL, Wireless |
|  Done   | Network Testing      | RTT, Throughput, DNS-over-HTTPS            |
|  Done   | Dark Mode            | System-aware theming                       |
|  Done   | Cloud Sync           | Firebase auth, project sync across devices |
|  Done   | Electron App         | Desktop version with native networking     |
|  Done   | Real ICMP Ping       | Native ping with Electron                  |
|  Done   | Real Traceroute      | TTL-based hop discovery                    |
|  Done   | Port Scanner         | TCP/UDP socket scanning                    |
|  Done   | Network Discovery    | ARP scanning, device enumeration           |
| Planned | Configuration Backup | SSH-based device config backup             |
| Planned | SNMP Polling         | Device monitoring via SNMP                 |
| Planned | Network Topology     | Visual network mapping                     |

</div>

<br />

---

<br />

## Browser Limitations

Running entirely in the browser has some constraints:

| Feature           | Limitation                        | Workaround                    |
| :---------------- | :-------------------------------- | :---------------------------- |
| **ICMP Ping**     | Browsers cannot send ICMP packets | HTTP-based RTT testing        |
| **Traceroute**    | No TTL manipulation available     | Simulated hop visualization   |
| **Port Scanning** | TCP/UDP sockets not accessible    | Educational simulation mode   |
| **Direct DNS**    | Only DoH providers accessible     | Multiple DoH provider support |

> **Available Now**: Electron desktop app with full native networking capabilities!

<br />

---

<br />

## Electron Desktop App

NetDash Toolkit is available as a native desktop application with **real networking capabilities** that go beyond browser limitations.

### Native Features

| Feature               |    Browser    |         Desktop App          |
| :-------------------- | :-----------: | :--------------------------: |
| **ICMP Ping**         | HTTP fallback |      Real ICMP packets       |
| **Traceroute**        |   Simulated   | Real TTL-based hop discovery |
| **Port Scanning**     |    Limited    |    Full TCP/UDP scanning     |
| **Network Discovery** | Not available |         ARP scanning         |
| **DNS Queries**       |   DoH only    |      Direct DNS queries      |

### Install Desktop App

**macOS (Homebrew):** _(supports Apple Silicon & Intel)_

```bash
brew tap sunnypatell/netdash https://github.com/sunnypatell/netdash-toolkit
brew install --cask netdash
sudo xattr -cr "/Applications/NetDash Toolkit.app"
```

> **Note:** The `xattr` command removes the quarantine flag since the app is unsigned.

**Manual Download:**

Download the latest release for your platform from [GitHub Releases](https://github.com/sunnypatell/netdash-toolkit/releases/latest):

| Platform                  | Download                                                                                                                                                           |
| :------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **macOS (Apple Silicon)** | [NetDash.Toolkit-1.0.0-mac-arm64.dmg](https://github.com/sunnypatell/netdash-toolkit/releases/download/v1.0.0/NetDash.Toolkit-1.0.0-mac-arm64.dmg)                 |
| **macOS (Intel)**         | [NetDash.Toolkit-1.0.0-mac-x64.dmg](https://github.com/sunnypatell/netdash-toolkit/releases/download/v1.0.0/NetDash.Toolkit-1.0.0-mac-x64.dmg)                     |
| **Windows**               | [NetDash.Toolkit-1.0.0-win-x64.exe](https://github.com/sunnypatell/netdash-toolkit/releases/download/v1.0.0/NetDash.Toolkit-1.0.0-win-x64.exe)                     |
| **Linux (AppImage)**      | [NetDash.Toolkit-1.0.0-linux-x86_64.AppImage](https://github.com/sunnypatell/netdash-toolkit/releases/download/v1.0.0/NetDash.Toolkit-1.0.0-linux-x86_64.AppImage) |
| **Linux (Debian)**        | [NetDash.Toolkit-1.0.0-linux-amd64.deb](https://github.com/sunnypatell/netdash-toolkit/releases/download/v1.0.0/NetDash.Toolkit-1.0.0-linux-amd64.deb)             |

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

| Platform    | Requirements                                              |
| :---------- | :-------------------------------------------------------- |
| **macOS**   | macOS 10.13+ (High Sierra or later), x64 or Apple Silicon |
| **Windows** | Windows 10+, x64                                          |
| **Linux**   | Ubuntu 18.04+, Debian 10+, or equivalent                  |

<br />

---

<br />

## Available Scripts

| Command             | Description                               |
| :------------------ | :---------------------------------------- |
| `pnpm dev`          | Start development server with hot reload  |
| `pnpm build`        | Generate optimized production build       |
| `pnpm start`        | Serve production build locally            |
| `pnpm lint`         | Run ESLint for code quality               |
| `pnpm electron:dev` | Start Electron app in development mode    |
| `pnpm dist:mac`     | Build macOS app (DMG + ZIP)               |
| `pnpm dist:win`     | Build Windows installer (NSIS + Portable) |
| `pnpm dist:linux`   | Build Linux packages (AppImage + DEB)     |

<br />

---

<br />

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat(scope): add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

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
