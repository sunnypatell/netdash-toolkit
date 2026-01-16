# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.6.0] - 2025-01-16

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

## [2.5.0] - 2025-01-15

### Added

- **cloud sync** - sync projects across devices with firebase
- **user authentication** - sign in with google or email/password
- **google one tap sign-in** - quick authentication with one tap

### Fixed

- dark theme styling for wireless channel overview
- settings menu dark theme colors
- one tap only shows when user is not signed in

## [2.4.0] - 2025-01-14

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

[Unreleased]: https://github.com/sunnypatell/netdash-toolkit/compare/v2.6.0...HEAD
[2.6.0]: https://github.com/sunnypatell/netdash-toolkit/compare/v2.5.0...v2.6.0
[2.5.0]: https://github.com/sunnypatell/netdash-toolkit/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/sunnypatell/netdash-toolkit/compare/v1.0.0...v2.4.0
[1.0.0]: https://github.com/sunnypatell/netdash-toolkit/releases/tag/v1.0.0
