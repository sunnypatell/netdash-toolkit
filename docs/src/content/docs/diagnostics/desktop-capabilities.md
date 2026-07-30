---
title: Desktop-only capabilities
description: The four capabilities that exist only in the NetDash Toolkit desktop build, how each one is implemented, and the limits and clamps that apply to them.
---

Four capabilities exist only in the Electron build: ICMP ping, system traceroute, TCP connect scanning, and ARP-based local discovery. Each is implemented in `electron/network/handlers.ts` and reached over an IPC bridge, never from the page directly.

## How the renderer reaches them

`electron/preload.ts` exposes exactly ten methods on `window.electronAPI`, and nothing else crosses the boundary. `lib/electron.ts` detects the desktop build by testing for that object rather than sniffing the user agent, and returns `null` from every call when it is absent.

| `window.electronAPI` method                     | IPC channel             | Implementation                                      |
| ----------------------------------------------- | ----------------------- | --------------------------------------------------- |
| `ping(host, options)`                           | `network:ping`          | spawns the system `ping` binary                     |
| `traceroute(host, options)`                     | `network:traceroute`    | spawns `traceroute`, or `tracert` on Windows        |
| `portScan(host, ports, options)`                | `network:portScan`      | Node `net.Socket` connect attempts                  |
| `dnsLookup(hostname, options)`                  | `network:dnsLookup`     | Node `dns.promises.Resolver`                        |
| `getNetworkInterfaces()`                        | `network:getInterfaces` | `os.networkInterfaces()`                            |
| `arpScan()`                                     | `network:arpScan`       | spawns `arp -a`                                     |
| `getSystemInfo()`                               | `system:getInfo`        | `os` hostname, platform, arch, cpus, memory, uptime |
| `getVersion()`, `getPlatform()`, `isElectron()` | `app:*`                 | app metadata                                        |

Two rows in that table shell out to system binaries and parse their text output, which is a design choice worth being explicit about: the app does not reimplement `ping` or `traceroute`, it drives yours. That means results match what you would get in a terminal on that machine, and it also means a missing binary is a real failure mode with its own error message.

## ICMP ping

Real ICMP, because the system `ping` binary sends it. Not a raw socket in Node, which would need elevated privileges the Windows installer explicitly does not request.

| Parameter               | Default                     | Range         | Why bounded                                |
| ----------------------- | --------------------------- | ------------- | ------------------------------------------ |
| `count`                 | 4                           | 1 to 10       | a caller cannot turn the tool into a flood |
| `timeout`               | 5000 ms                     | 1000 to 30000 | keeps the spawned process bounded          |
| Overall process timeout | `timeout * count + 5000` ms | derived       | the child is killed even if `ping` hangs   |

Arguments are built per platform, because the flags genuinely differ: Windows takes `-n` for count and `-w` in milliseconds; macOS takes `-c`, `-W` in milliseconds, plus a `-t` overall deadline; Linux takes `-c` and `-W` in **seconds**. Getting that unit wrong is the classic bug in this area, and `buildPingArgs` is exported so `tests/unit/electron-handlers.test.ts` can assert it against each platform.

Output is parsed with a regex over the RTT lines. One subtlety: replies are de-duplicated by `icmp_seq`, because BSD `ping` prints duplicate replies marked `dup!` and counting those would report more responses than packets sent. Packet loss is therefore clamped at zero rather than allowed to go negative. The parser is tested against a real captured macOS transcript in `tests/fixtures/ping-macos.txt`.

## System traceroute

`traceroute` on Unix, `tracert` on Windows. Both are asked for numeric output and one query per hop, so the run is faster and the parse is simpler.

| Parameter               | Default                        | Range         |
| ----------------------- | ------------------------------ | ------------- |
| `maxHops`               | 30                             | 1 to 64       |
| `timeout`               | 5000 ms                        | 1000 to 10000 |
| Overall process timeout | `timeout * maxHops + 10000` ms | derived       |

The parser skips banner lines, accepts both the bare-IP and `hostname (ip)` forms, and requires either an RTT or a `*` before treating a numbered line as a hop, so a wrapped line cannot be misread as a hop. Windows sub-millisecond hops print as `<1 ms` and are recorded as `1`. Fixture: `tests/fixtures/traceroute-macos.txt`.

This is the capability with no browser fallback at all, for the reason in [what a browser cannot do](/docs/diagnostics/browser-limits/): setting a per-packet TTL is not something a page can do.

## TCP connect scanning

A real connect scan using Node's `net.Socket`. No `nmap`, no raw packets, no SYN scan, so it is a full three-way handshake per port and it is visible in the target's logs.

The state mapping is the reason this is worth having over the browser probe:

| Socket outcome                                           | Reported state | Meaning                                      |
| -------------------------------------------------------- | -------------- | -------------------------------------------- |
| `connect` event                                          | `open`         | handshake completed, `responseTime` recorded |
| socket `timeout`                                         | `filtered`     | no answer at all, consistent with a drop     |
| `ECONNREFUSED`                                           | `closed`       | the host actively refused, so the host is up |
| `EHOSTUNREACH`, `ENETUNREACH`, `ETIMEDOUT`, `ECONNRESET` | `filtered`     | reachability problem, not a port answer      |
| anything else                                            | `filtered`     | conservative default                         |

The distinction between `closed` and `filtered` is the entire point. A browser probe collapses both into `unknown` because a failed `fetch` carries no error detail; a connect scan gets the errno and can tell them apart. `closed` is also a positive result about the host: something answered with a refusal, so the host exists.

Limits: `timeout` defaults to 3000 ms with a 500 to 10000 range, concurrency defaults to 50 with a 1 to 200 range, and a port list longer than 10000 entries is rejected outright. Concurrency is implemented as sequential batches through `Promise.all` rather than a rolling window, so one slow port in a batch delays the next batch. Service names come from a hardcoded 35-entry map, so an open port with no entry shows no name rather than a guess.

## ARP and interface enumeration

`arpScan()` spawns `arp -a` with a fixed 10 second timeout and parses the output, with separate regexes for Windows and for the BSD and Linux `(ip) at mac` form. `normalizeMac` pads BSD's unpadded octets, so `8:0:27:1a:2b:3c` becomes `08:00:27:1a:2b:3c`. Fixture: `tests/fixtures/arp-macos.txt`.

This reads the kernel's existing ARP cache ([RFC 826](https://www.rfc-editor.org/rfc/rfc826)); it does not sweep the subnet. So it shows hosts your machine has recently talked to, which is a smaller and less predictable set than an active scan would find, and it needs no privileges.

Interface enumeration is `os.networkInterfaces()` with no platform branching. Two rough edges are visible in the code: a missing MAC falls back to the literal `00:00:00:00:00:00`, and when an interface has several addresses of the same family the last one wins.

Two more, worth knowing before you rely on them:

- `arpScan(subnet)` accepts a `subnet` argument, forwards it across IPC, and the handler ignores it entirely. The only caller passes nothing.
- `ArpEntry.vendor` is declared but never populated by the main process. Vendor names are resolved in the renderer from `lib/oui-vendors.ts`.

## DNS in the desktop build

The desktop build can do the thing DoH cannot: query an arbitrary DNS server. It uses a **new** `dns.promises.Resolver` per request, because `dns.setServers` is process-global and concurrent lookups would race and could permanently clobber the resolver configuration.

The server must be an IPv4 literal, not a hostname, and the default is the literal string `"system"`, meaning your OS resolver. Supported record types are the same nine the browser path offers. Non-string answers such as `MX` and `SOA` are `JSON.stringify`ed into the value field, and the `ttl` field is declared in the return type but never populated.

## How input is kept from becoming a shell command

Nothing is passed through a shell. Commands are launched with `spawn(binary, args)`, so an argument containing `;` is an argument, not a separator. On top of that:

| Guard                 | Rule                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Host character filter | rejects ``; & \| ` $ ( ) { } [ ] < > \ ' " !`` plus newlines and tabs                                                      |
| Host length           | 253 characters maximum                                                                                                     |
| Host format           | must match an IPv4 literal, an IPv6 literal, or an [RFC 1123](https://www.rfc-editor.org/rfc/rfc1123#section-2.1) hostname |
| Port                  | integer, 1 to 65535                                                                                                        |
| Port list             | non-empty array, 10000 entries maximum                                                                                     |
| DNS server            | IPv4 literal only                                                                                                          |
| Binary path           | absolute and pinned per platform, so `PATH` cannot be hijacked                                                             |

Binary paths are hardcoded per platform (`/sbin/ping` on macOS, `/bin/ping` on Linux, bare `ping` on Windows) because a packaged app does not inherit a shell's `PATH`. Timeouts are enforced twice: `spawn`'s own `timeout` option, plus a manual `SIGTERM` escalating to `SIGKILL` after one second, resolving with partial output if any arrived. A non-zero exit code with output is treated as success, because `ping` exits `1` for an unreachable host and that is a result, not an error.

:::note[No Elevation, By Design]
The Windows installer requests `asInvoker` and nothing in the app asks for root. Everything above works as an unprivileged user, which is why ICMP goes through the system `ping` binary instead of a raw socket. If a diagnostic would need privileges, it is not in the app.
:::
