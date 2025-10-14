# NetDash Toolkit

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/sunnypatells-projects/netdash)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/projects/P5xX40KLolT)

NetDash is a front-end networking workbench built with Next.js that consolidates planning, validation, troubleshooting, and documentation utilities into a single browser experience. Every tool runs entirely client-side, making it safe to use with production data while keeping the deployment lightweight enough for Vercel’s static hosting model.

## Table of Contents
- [Live Deployment](#live-deployment)
- [Feature Overview](#feature-overview)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Frontend-Only Constraints](#frontend-only-constraints)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Tool Highlights](#tool-highlights)
- [Data Sources & Integrations](#data-sources--integrations)
- [Changelog](#changelog)

## Live Deployment
The production build is deployed on Vercel and automatically synced from this repository:

**https://vercel.com/sunnypatells-projects/netdash**

## Feature Overview
### Address Planning & Design
- **Subnet Calculator** — Dual-stack IPv4/IPv6 calculations with RFC3021 handling for /31 links and solicited-node multicast discovery.
- **VLSM Planner** — Host-aware allocations that include /31 and /32 prefixes, utilization heatmaps, and CSV/JSON exports.
- **VLAN Manager** — Multi-vendor switch templates, CSV exports, and IPv4/IPv6 overlap detection using CIDR-aware range analysis.

### Routing & Switching Automation
- **Routing Tools** — Guided configuration builders for OSPF, EIGRP, and static routes with CIDR normalization, wildcard validation, and warning surfaces.
- **Wireless Toolkit** — Channel planning, signal modelling, and security checklists for enterprise Wi-Fi deployments.
- **ACL Generator** — Standard and extended Cisco IOS ACLs with host/CIDR parsing, port validation, and exportable configuration bundles.

### Troubleshooting & Operations
- **Network Tester** — HTTP-based RTT measurement with multi-mode fallbacks plus DNS-over-HTTPS queries against Cloudflare, Google, Quad9, and custom endpoints.
- **IP Conflict Checker** — Parses Windows ARP, Linux `ip neigh`, Cisco ARP/MAC tables, and DHCP logs to correlate duplicate addressing with remediation guidance.
- **MTU Calculator, OUI Lookup, Port Scanner, Ping & Traceroute simulators** — Quick checks for everyday operations; ping/traceroute present curated sample flows for visibility.

### Compliance & Documentation
- **About Dashboard** — Rich release history, adoption metrics, and technical notes embedded in the UI.
- **Project Manager** — Secure client-side storage using AES-GCM and PBKDF2 (see app for details) for keeping network project records.

## Architecture & Tech Stack
- **Framework**: [Next.js 14](https://nextjs.org/) with the App Router.
- **Language**: TypeScript with React 18.
- **Styling**: Tailwind CSS + shadcn/ui component primitives.
- **State Management**: Local component state and browser storage; no backend services.
- **Build Tooling**: pnpm, Next.js compiler, and TypeScript.
- **Hosting**: Static deployment on Vercel.

## Frontend-Only Constraints
Running entirely on the client has a few implications:
- Raw ICMP, traceroute, or TCP SYN scans are not possible without a dedicated backend. The Ping & Traceroute views provide curated sample flows while the Network Tester performs standards-compliant HTTP RTT tests instead.
- DNS lookups are executed via DNS-over-HTTPS (Cloudflare JSON and RFC8484 wire encodings). Providers that block browser requests will surface clear warnings in the UI.
- All parsing and validation happens in the browser; no uploaded data leaves the session.

## Getting Started
```bash
# Install dependencies
pnpm install

# Run the development server
pnpm dev

# Build an optimized production bundle
pnpm build
```
The development server is available at `http://localhost:3000`. The Vercel deployment automatically rebuilds from the `main` branch.

## Available Scripts
| Command       | Description                                      |
|---------------|--------------------------------------------------|
| `pnpm dev`    | Start Next.js in development mode with hot reload |
| `pnpm build`  | Generate a production build (used by CI/Vercel)   |
| `pnpm start`  | Serve the production build locally                |
| `pnpm lint`   | Run Next.js linting (uses the default config)     |

## Tool Highlights
### Routing Tools
- Parses CIDR or address/wildcard input, normalizes non-aligned networks, and warns when assumptions are made.
- Supports simultaneous next-hop and exit-interface definitions for static routes, adds comments for skipped entries, and exports ready-to-paste command sets.

### VLAN Manager
- Detects duplicate IDs and reserved ranges, validates trunk/native VLANs, and now inspects IPv4/IPv6 overlaps using BigInt range math.
- Generates Cisco IOS and Aruba CX interface templates plus CSV exports of the VLAN database.

### ACL Generator
- Accepts host statements (`host 192.0.2.10`) or CIDR notation and automatically derives the proper wildcard mask.
- Highlights dangerous “permit any any” rules, invalid ports, and missing documentation while offering export/copy helpers.

### Network Testing
- Uses fetch-based RTT probes with progressively permissive modes (HEAD → GET → image beacon) to maximize CORS compatibility.
- DNS module auto-detects JSON or binary DoH responses and decodes wire-format messages for providers without REST wrappers.

### IP Conflict Checker
- Correlates inputs from ARP, MAC, DHCP, and switch tables; extracts VLAN/port metadata; and produces actionable remediation steps.

## Data Sources & Integrations
- **DNS over HTTPS**: Cloudflare (1.1.1.1), Google (8.8.8.8), Quad9 (9.9.9.9), and configurable custom resolvers.
- **OUI Database**: macvendors.com API with bulk-rate limiting and fallback caching.
- **Project Storage**: Client-side AES-GCM encryption with PBKDF2 key derivation (details in the About page).

## Changelog
The in-app About page contains the full changelog. Recent highlights include:
- v2.2.0 — Routing validation overhaul, VLAN overlap detection, ACL parsing fixes, branded favicon, and full README rewrite.
- v2.1.1 — Mobile navigation fixes for the collapsible sidebar.
- v2.1.0 — Major feature expansion covering routing, ACL, wireless, and changelog infrastructure.

For the complete timeline, open the **About → Technical Changelog** section inside the application.
