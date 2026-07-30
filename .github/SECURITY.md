# Security Policy

## Supported Versions

Only the latest release receives security fixes.

| Version          | Supported          |
| ---------------- | ------------------ |
| latest (3.x)     | :white_check_mark: |
| anything earlier | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please use one of these methods:

1. **GitHub Security Advisories (Preferred)**
   - Go to [Security Advisories](https://github.com/sunnypatell/netdash-toolkit/security/advisories/new)
   - Click "Report a vulnerability"
   - Fill out the form with details

2. **Email**
   - Send details to: sunnypatel124555@gmail.com
   - Subject: `[SECURITY] NetDash Toolkit Vulnerability Report`
   - Use PGP encryption if possible (key available upon request)

### What to Include

Please provide as much information as possible:

- **Description**: Clear description of the vulnerability
- **Impact**: What an attacker could achieve
- **Affected Components**: Which tools or features are affected
- **Reproduction Steps**: Step-by-step instructions to reproduce
- **Proof of Concept**: Code, screenshots, or recordings if applicable
- **Suggested Fix**: If you have recommendations for fixing the issue
- **Your Contact**: How we can reach you for follow-up questions

### What to Expect

| Timeline | Action                                             |
| -------- | -------------------------------------------------- |
| 24 hours | Initial acknowledgment of your report              |
| 72 hours | Preliminary assessment and severity rating         |
| 7 days   | Detailed response with remediation plan            |
| 30 days  | Target for fix deployment (critical issues faster) |

### Severity Ratings

We use the following severity classifications:

| Severity     | Description                                               | Response Time |
| ------------ | --------------------------------------------------------- | ------------- |
| **Critical** | Remote code execution, data breach, authentication bypass | < 24 hours    |
| **High**     | Privilege escalation, significant data exposure           | < 72 hours    |
| **Medium**   | Limited data exposure, denial of service                  | < 7 days      |
| **Low**      | Minor issues, theoretical vulnerabilities                 | < 30 days     |

### Safe Harbor

We support responsible security research. If you:

- Act in good faith to avoid privacy violations, data destruction, and service disruption
- Only interact with accounts you own or have explicit permission to test
- Report vulnerabilities promptly and don't exploit them beyond proof of concept
- Give us reasonable time to address the issue before public disclosure

We commit to:

- Not pursue legal action against you for your research
- Work with you to understand and resolve the issue
- Credit you in our security acknowledgments (if desired)
- Keep you informed about the fix progress

### Scope

#### In Scope

- NetDash Toolkit desktop application (all platforms)
- NetDash Toolkit web application
- All network tools (ping, traceroute, port scanner, DNS, etc.)
- IPC communication between renderer and main process
- Data storage and handling
- Authentication and authorization (if applicable)

#### Out of Scope

- Third-party dependencies (report to respective maintainers)
- Social engineering attacks
- Physical security
- Denial of service attacks that require significant resources
- Issues in outdated/unsupported versions

### Security Best Practices for Users

1. **Keep Updated**: Always use the latest version of NetDash Toolkit
2. **Download from Official Sources**: Only download from GitHub releases or the official Homebrew tap
3. **Verify Downloads**: See "Verifying Releases" below - every release ships checksums and build provenance
4. **Network Permissions**: Be aware that network tools require certain system permissions
5. **Sensitive Data**: Avoid scanning networks you don't have permission to scan

### Verifying Releases

Every release is built on GitHub-hosted runners and ships with:

- `checksums.txt` - SHA-256 digests of every asset (`sha256sum -c checksums.txt --ignore-missing`)
- `netdash-toolkit-<tag>.intoto.jsonl` - [SLSA Build Level 3](https://slsa.dev/spec/v1.0/levels) provenance, verifiable offline with [slsa-verifier](https://github.com/slsa-framework/slsa-verifier)
- [GitHub artifact attestations](https://github.com/sunnypatell/netdash-toolkit/attestations) - `gh attestation verify <file> --repo sunnypatell/netdash-toolkit`
- a CycloneDX SBOM of the exact dependency graph the release was built from

Each release's notes include copy-pasteable verification commands.

### Security Features

NetDash Toolkit implements several security measures:

- **Input Validation**: All user inputs are validated and sanitized
- **Command Injection Prevention**: Network commands use parameterized execution
- **Local Processing**: All network operations run locally on your machine
- **No Desktop Telemetry**: The desktop app makes no update checks or analytics calls. (The hosted web app at netdash-toolkit.vercel.app uses Vercel Analytics for anonymous page metrics; cloud sync via Firebase is opt-in and user-initiated.)
- **Renderer Isolation**: The Electron renderer runs with `nodeIntegration` disabled and `contextIsolation` enabled, with a minimal preload bridge for the networking IPC
- **Supply-Chain Hardening**: CI actions are pinned to commit SHAs, runners are egress-audited, releases ship SLSA provenance, and CodeQL + OpenSSF Scorecard + dependency review run continuously
- **Content Security Policy**: both builds send one; the two directives it cannot tighten, and why, are spelled out below

### Content Security Policy

both builds send the same directives. the web build sends them from `vercel.json`; the desktop build sends them from `session.defaultSession.webRequest.onHeadersReceived` in `electron/main.ts`, on responses from the app's own origin only, and only in packaged builds (the dev renderer needs `eval` for source maps and a websocket for hot reload). the renderer bundle is the same static export in both, so `'self'` is the only thing that differs: `https://netdash-toolkit.vercel.app` on the web, `http://localhost:17890` on the desktop.

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
font-src 'self' data:;
connect-src 'self' https: http:;
frame-src https://*.firebaseapp.com https://accounts.google.com;
worker-src 'self' blob:;
object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

what it stops: plugin content (`object-src 'none'`), base-tag hijacking (`base-uri 'self'`), being framed by another site (`frame-ancestors 'none'`, alongside `X-Frame-Options: DENY`), cross-origin form posts (`form-action 'self'`), and script from any origin other than this one, `apis.google.com` and `accounts.google.com`.

what it does not stop, stated with the reason rather than left implied:

- **inline script runs.** a Next static export inlines its hydration script and has no per-request nonce, so `script-src` has to allow `'unsafe-inline'`; that is the ceiling for this build, not a preference. `'unsafe-eval'` is not allowed, so the policy still blocks the `eval`-based half of that class.
- **`connect-src` permits any `https:` or `http:` origin,** because 4 tools fetch a host the user types: the network tester (RTT and throughput), the browser port scanner, the ping and traceroute browser fallback, and the TLS trust probe in the SSL checker. an allowlist would break those tools in production without stopping anything, so what `connect-src` actually buys here is narrow: `ws:`, `wss:`, `data:` and `blob:` connections are blocked, nothing else. a stricter version is possible on the desktop build alone, by routing those 4 browser fallbacks through the existing preload bridge, which is not done today.
- **`img-src` permits any `https:` origin,** because a signed-in user can point their profile photo URL at any host.

- **a fixed allowlist could not have covered `rdap.org` anyway.** it is an RFC 9224 bootstrap redirector: every whois lookup is redirected to whichever registry or RIR is authoritative, and CSP checks each redirect hop, so the allowlist would have to name every registry RDAP server that exists.

### What the App Contacts

beyond the host a user types into those tools, the app contacts 10 fixed third-party hosts, each of them also declared per tool in the UI before the tool runs.

<!-- egress:app:start -->

| host                              | what it is                    | reached from                                       |
| --------------------------------- | ----------------------------- | -------------------------------------------------- |
| `cloudflare-dns.com`              | DNS over HTTPS                | `lib/network-testing.ts`, `lib/email-auth.ts`      |
| `dns.google`                      | DNS over HTTPS                | `lib/network-testing.ts`, `lib/email-auth.ts`      |
| `dns.quad9.net`                   | DNS over HTTPS                | `lib/network-testing.ts`                           |
| `doh.opendns.com`                 | DNS over HTTPS                | `lib/network-testing.ts`                           |
| `dns.adguard-dns.com`             | DNS over HTTPS                | `lib/network-testing.ts`                           |
| `rdap.org`                        | whois bootstrap redirector    | `lib/rdap.ts`, `components/tools/whois-lookup.tsx` |
| `api.maclookup.app`               | MAC vendor lookup             | `lib/oui-vendors.ts`                               |
| `api.certspotter.com`             | certificate transparency logs | `lib/cert-transparency.ts`                         |
| `observatory-api.mdn.mozilla.net` | Mozilla's header scan         | `components/tools/security-headers/`               |
| `api.hackertarget.com`            | header relay, unaffiliated    | `lib/http-relay.ts`                                |

<!-- egress:app:end -->

`api.hackertarget.com` is the one that deserves a second sentence: it is an unaffiliated relay that can add, drop or rewrite anything it returns, which is why every tool that uses it labels its output as unverified rather than grading it.

signing in adds the Firebase SDK's own hosts, reached only when cloud sync is configured and the user signs in:

<!-- egress:sdk:start -->

`identitytoolkit.googleapis.com`, `securetoken.googleapis.com`, `firestore.googleapis.com`

<!-- egress:sdk:end -->

this table is not maintained by hand. `tests/unit/csp.test.ts` re-derives the host list from the source tree on every CI run, and fails if the code contacts a host this table does not list, if the table lists a host the code no longer contacts, or if the count in the sentence above stops matching the table.

### Acknowledgments

We appreciate the security researchers who help keep NetDash Toolkit secure:

<!-- Security researchers will be acknowledged here -->

_No vulnerabilities reported yet. Be the first!_

---

Thank you for helping keep NetDash Toolkit and its users safe!
