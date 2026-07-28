# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **networking math that returned confident wrong answers.** `/0` produced netmask `255.255.255.255` (js shift counts are mod 32), so every default route generated as a host route and the classic `network 0.0.0.0 255.255.255.255` ospf statement was rejected. `summarizeCIDRs` emitted an impossible `/33` and dropped merged ranges. `ipv4ToInt` accepted `a.b.c.d`. addresses were classified from the network address, so `192.168.1.5/8` read as public.
- **five vendor parsers matched zero lines of real cli output.** aruba, juniper, fortigate, hp and mikrotik all had the wrong column order or mac format; juniper and fortigate shared a byte-identical regex that produced duplicate entries with conflicting interfaces.
- **ping and port scan were dead on the deployed site.** a bare hostname defaulted to `http://`, which an https page blocks as mixed content before the request leaves the browser. it worked on localhost (http), which is why it survived. bare hosts now adopt the page's scheme.
- **three tools invented their results.** the port scanner reported `Math.random() > 0.8` as "open"; traceroute returned five hardcoded hops with random jitter added to look measured; the mtu calculator subtracted the ethernet header from the link mtu and reported 1446 where the answer is 1460.
- **every toast in the app was silent.** two toast systems shipped, neither was mounted, so 51 "copied"/"saved"/"failed" messages rendered nothing.
- **conflict detection fabricated conflicts** when one host appeared in two sources, and **generated switch configs did not paste** (`description` is not valid in ios vlan context; aos-cx ports need `no routing`).

### Added

- **a route per tool** at `/tools/<slug>`, so tools are deep-linkable and the back button works
- **115 unit tests** over the math, the vendor parsers, and the electron handlers, with fixtures captured from real `ping`/`traceroute`/`arp` output
- **registry invariant tests** that fail when the registry and the code disagree
- **dashboard search** over the tool keywords that were already in the registry and unused
- `RELEASING.md`

### Changed

- **the registry is the single source of truth.** the 51-case switch, the sidebar's duplicated lists, about.tsx's 16 hand-written tool entries, and a second copy of the `ProjectItemType` union are gone.
- **dashboard first load js: 530 kB -> 131 kB**, since tools are per-route chunks instead of 49 eager imports
- shared `lib/clipboard`, `lib/download` and `lib/format` replace 21 hand-rolled clipboard handlers, 19 blob-download blocks, and two conflicting byte-unit ladders
- next 15.5.21 plus patched transitives; **dependencies 48 -> 28**

### Removed

- the unreachable `network-analyzer` tool (809 lines, metrics were `Math.random()`) and the unused `responsive-tabs` component

## [3.0.1] - 2026-06-11

### Added

- **supply-chain hardened release pipeline** - releases now ship slsa build level 3 provenance (`.intoto.jsonl`), github artifact attestations, a cyclonedx sbom, and `checksums.txt`; release notes automatically include checksums, verification commands, and per-platform install notes
- **openssf scorecard, dependency review, and workflow lint (actionlint + zizmor)** workflows; codeql now also scans the github actions workflows themselves
- **electron packaging smoke test in ci** - every push/pr packs the linux app, so packaging breakage is caught before release time
- **grouped monthly dependabot** - one rolled-up pr per ecosystem per month (max 2 open total), 7-day cooldown on npm bumps
- **repository rulesets as code** (`.github/rulesets/`) - main branch and release tags protected against deletion/force-push

### Changed

- **all github actions pinned to commit shas** with version comments (firebase action was unpinned `@master`)
- **release artifacts renamed** from `NetDash.Toolkit-*` to `NetDash-Toolkit-*` - github's space-to-dot filename mangling would break provenance verification, and the windows nsis/portable targets previously collided on the same filename (only one ever made it to the release); installers now ship as `-setup.exe`, portable as `-portable.exe`
- **homebrew cask job rewritten** - dmg hashes flow from the publish job's outputs instead of re-downloading assets after a `sleep 30`; install instructions now recommend `--no-quarantine`
- **pnpm version pinned** via the `packageManager` field (single source of truth for local dev + ci)
- **security policy corrected** - supported-versions table updated to 3.x, telemetry/sandboxing claims now match the actual code, added release-verification instructions

### Removed

- **package-lock.json** - this is a pnpm repo; the stray npm lockfile is now gitignored

## [3.0.0] - 2026-01-19

### Added

- **24 new networking tools** - massive expansion of the toolkit:
  - **converters**: ip address converter (binary/hex/decimal/ipv6-mapped), data unit converter, subnet mask converter, mac formatter
  - **calculators**: bandwidth calculator, network calculator (latency/throughput/ip math), uptime calculator
  - **generators**: random ip/mac/ipv6 generator, wifi qr generator enhancements
  - **diagnostics**: ssl/tls checker, whois lookup, email diagnostics (spf/dkim/dmarc), redirect checker, http headers analyzer
  - **utilities**: ip range enumerator, url encoder/decoder, regex tester, json formatter, base64 encoder, lorem ipsum generator, cron parser, timestamp converter, hash generator (sha/md5), jwt decoder, password generator, user agent parser
  - **reference pages**: port reference, cidr reference, protocol reference, ipv6 reference, common subnets
- **centralized tool registry** - new `lib/tool-registry.ts` for unified tool management with metadata, categories, and search
- **reusable copybutton component** - consistent copy-to-clipboard with visual checkmark feedback across all tools
- **cors proxy fallback** - tools that fetch external resources now fallback to proxy when direct requests fail

### Changed

- **unified dashboard** - tools now dynamically rendered from centralized registry
- **sidebar starts collapsed** - cleaner default ui on desktop
- **improved tool organization** - tools grouped by category in navigation

### Fixed

- **copy button feedback** - all copy buttons now show checkmark confirmation
- **project deletion** - fixed type mismatch in deleteProject return type
- **cors handling** - ssl checker, whois lookup, and email diagnostics now work in browser mode

### Technical

- added tool registry pattern for scalable tool management
- refactored 13+ tools to use shared copybutton component
- removed redundant toast notifications from copy operations
- improved type safety in project context

## [2.7.0] - 2026-01-17

### Added

- **9 new networking tools**: data unit converter, uptime calculator, mac formatter, network calculator, subnet mask converter, port reference, cidr reference, protocol reference, ipv6 reference
- **cors proxy fallback** - improved browser compatibility for external api requests

### Fixed

- sidebar now starts collapsed by default

## [2.6.0] - 2026-01-16

### Added

- **project sharing** - share projects with other users via email with permission levels (view/edit/admin)
- **in-app account management** - update display name, photo url, email, and password directly in the app
- **shared projects tab** - view and manage projects shared with you by other users
- **real-time sync for shared projects** - changes sync instantly between collaborators

### Changed

- **ci workflow split** - separate github actions jobs for format, lint, typecheck, and build for better visibility
- **user menu improvements** - shows shared project count badge, replaced external firebase console link with in-app settings

### Technical

- added `types/sharing.ts` with permission types and share interfaces
- added `lib/sharing.ts` with sharing service functions (shareProject, unshareProject, findUserByEmail)
- added `projectShares` and `userIndex` firestore collections for efficient sharing queries
- updated firestore security rules for collaborative access control
- added `ShareProjectDialog` and `AccountSettingsDialog` components

## [2.5.0] - 2026-01-15

### Added

- **cloud sync** - sync projects across devices with firebase
- **user authentication** - sign in with google or email/password
- **google one tap sign-in** - quick authentication with one tap

### Fixed

- dark theme styling for wireless channel overview
- settings menu dark theme colors
- one tap only shows when user is not signed in

## [2.4.0] - 2026-01-14

### Added

- github actions ci/cd workflows for automated testing and releases
- eslint and prettier configuration for code quality
- contributing guidelines and code of conduct
- dependabot for automated dependency updates

## [1.0.0] - 2024-01-12

### Added

- **Subnet Calculator** - IPv4/IPv6 subnetting with CIDR notation and RFC3021 support
- **VLSM Planner** - Variable Length Subnet Masking with optimal allocation algorithms
- **VLAN Manager** - Multi-vendor VLAN configuration templates (Cisco, Juniper, Arista, HP)
- **Routing Tools** - OSPF, EIGRP, BGP, and static route configuration builders
- **Wireless Tools** - WiFi channel planning, signal strength analysis, interference detection
- **ACL Generator** - Cisco IOS access control list generation with rule validation
- **Conflict Checker** - IP and MAC address conflict detection from ARP tables
- **Network Tester** - RTT measurements, throughput testing, and latency analysis
- **DNS Tools** - DNS-over-HTTPS queries with multiple resolver support
- **MTU Calculator** - Protocol overhead analysis for optimal MTU configuration
- **IPv6 Tools** - EUI-64 generation, link-local addresses, solicited-node multicast
- **OUI Lookup** - MAC address vendor identification
- **Port Scanner** - TCP port scanning with service detection (Electron only)
- **Ping & Traceroute** - ICMP diagnostics (Electron only)
- Electron desktop app for Windows, macOS, and Linux
- Dark/light theme support with system preference detection
- Responsive design for mobile and tablet devices
- 100% client-side calculations for privacy

[Unreleased]: https://github.com/sunnypatell/netdash-toolkit/compare/v3.0.0...HEAD
[3.0.0]: https://github.com/sunnypatell/netdash-toolkit/compare/v2.7.0...v3.0.0
[2.7.0]: https://github.com/sunnypatell/netdash-toolkit/compare/v2.6.0...v2.7.0
[2.6.0]: https://github.com/sunnypatell/netdash-toolkit/compare/v2.5.0...v2.6.0
[2.5.0]: https://github.com/sunnypatell/netdash-toolkit/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/sunnypatell/netdash-toolkit/compare/v1.0.0...v2.4.0
[1.0.0]: https://github.com/sunnypatell/netdash-toolkit/releases/tag/v1.0.0
