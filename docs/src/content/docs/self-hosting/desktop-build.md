---
title: Building the desktop app
description: How the Electron shell serves the static export over loopback HTTP, what its security posture is, and how to package it for macOS, Windows and Linux.
---

The desktop app is the same static export with an Electron shell around it. The shell adds a loopback HTTP server and an IPC bridge to OS networking tools; it does not fork the UI.

## Build it

```bash
# compile the main process, then package for the current platform
pnpm install
pnpm build
pnpm electron:compile
pnpm dist:mac    # or dist:win, dist:linux, dist:all
```

`pnpm electron:build` chains the first three for you. Output lands in `release/`. For a fast unpacked build with no installer, which is what CI does as a smoke test, run `pnpm electron:pack` (`electron:compile` plus `electron-builder --dir`) and check that `release/linux-unpacked/` contains an executable plus `resources/app.asar`. `electron:pack` packs whatever is currently in `out/`, so run `pnpm build` first if the web output is stale.

During development, `pnpm electron:dev` starts `next dev` on port 3000 and points the Electron window at it, so the renderer hot-reloads while the main process is compiled once by `tsc -p electron/tsconfig.json`.

## How the static export gets served

There is no `file://` loading. `electron/main.ts` starts a Node `http` server wrapped around `serve-handler`, pointed at `out/`, and the window loads an `http://` URL from it.

| Detail           | Value                                        | Why it is that way                                                             |
| ---------------- | -------------------------------------------- | ------------------------------------------------------------------------------ |
| Server           | Node `http` plus `serve-handler`             | `output: "export"` needs directory-index resolution, which `file://` cannot do |
| Port             | `17890`, hardcoded                           | a stable origin, so Firebase Auth's authorized-domain list can contain it      |
| Bind address     | `127.0.0.1`                                  | never reachable from the network                                               |
| Served directory | `path.join(__dirname, "../out")`             | `__dirname` is `dist-electron/`, so this is the Next export                    |
| Options          | `cleanUrls: true`, `directoryListing: false` | matches `trailingSlash: true` without exposing a file browser                  |
| Window URL       | `http://localhost:17890`                     | Firebase treats `localhost` and `127.0.0.1` as different origins               |

That last row is the one that looks like a bug and is not. The server binds the literal loopback address, but the window loads the `localhost` hostname, because Firebase Auth's authorized-domain list contains `localhost` and rejected the IP form with `auth/unauthorized-domain`. Both spellings are in the navigation allowlist, so either resolves.

If port 17890 is already in use, the listen fails, the app shows an error dialog, and quits. There is no fallback port.

## Security posture of the shell

```ts
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: false,
  webSecurity: true,
}
```

`contextIsolation` and the absence of `nodeIntegration` mean the renderer sees only what `electron/preload.ts` chooses to expose on `window.electronAPI`. `sandbox: false` is a real deviation from Electron's recommended posture and is worth knowing about.

What compensates for it is `electron/navigation.ts`, which is written as pure functions so it can be unit-tested without launching Electron:

| Hook                   | Behaviour                                                                  | What it prevents                                                            |
| ---------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `setWindowOpenHandler` | always denies, opens `http`/`https` externally out of band                 | `window.open` and `target="_blank"` loading a remote page in the app window |
| `will-navigate`        | blocks anything whose `url.origin` is not an exact allowlist match         | a `location.href` assignment reaching a remote origin                       |
| `will-attach-webview`  | unconditionally prevented                                                  | an embedded `<webview>` inheriting the preload                              |
| Permission handlers    | an **allowlist** containing exactly one entry, `clipboard-sanitized-write` | the desktop build being weaker than the website's `Permissions-Policy`      |

The comments in `navigation.ts` name the exact mechanism of failure, and it is worth restating: the preload runs for every navigation in that `webContents`. Without the `will-navigate` guard, a page that navigated itself to a remote origin would hand that origin `portScan` and `arpScan` from inside the user's network. Origin comparison is exact `url.origin` equality rather than a substring check, because `url.includes("localhost")` also matches `localhost.example.com`.

Only `http:` and `https:` URLs are handed to `shell.openExternal`. Everything else is blocked with a recorded reason, because passing `file:`, `smb:` or a custom scheme to the OS handler is its own vulnerability class.

The permission direction is the one worth copying. `ALLOWED_PERMISSIONS` is a `Set` with a single member, `clipboard-sanitized-write`, which Chromium consults for `navigator.clipboard.writeText` and which every tool's copy button needs. Everything else is denied, including anything Electron adds in a future version, which is precisely the argument the code comment makes against a denylist: a denylist grants whatever nobody remembered to name, and that is the wrong default for a window whose preload can reach the network directly.

## The policy the packaged build sends

`electron/csp.ts` holds the Content-Security-Policy as data rather than a string literal, for the same reason `navigation.ts` is pure functions: so a test can assert it without launching Electron.

| Directive         | Value                                                                                           | Why                                                                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default-src`     | `'self'`                                                                                        | the baseline everything else narrows                                                                                                                             |
| `script-src`      | `'self' 'unsafe-inline' 'wasm-unsafe-eval' https://apis.google.com https://accounts.google.com` | a static export inlines hydration scripts and has no per-request nonce, so `'unsafe-inline'` is the ceiling. `'wasm-unsafe-eval'` is there for one reason, below |
| `connect-src`     | `'self' https: http:`                                                                           | deliberately not an allowlist: the tools fetch a host you type                                                                                                   |
| `frame-src`       | `https://*.firebaseapp.com https://accounts.google.com`                                         | Firebase Auth's `__/auth/iframe` and the Google sign-in frame                                                                                                    |
| `worker-src`      | `'self' blob:`                                                                                  | the regex tester evaluates user patterns in a blob worker                                                                                                        |
| `img-src`         | `'self' data: https:`                                                                           | a signed-in user can point `photoURL` at any avatar host                                                                                                         |
| `object-src`      | `'none'`                                                                                        | nothing embeds plugins                                                                                                                                           |
| `frame-ancestors` | `'none'`                                                                                        | nothing should frame the app                                                                                                                                     |

Two properties are enforced rather than intended. `tests/unit/csp.test.ts` asserts the desktop directives serialize to a string **identical** to the one in `vercel.json`, so the only difference between the two deployments is what `'self'` resolves to: the deployed HTTPS origin on the web, `http://localhost:17890` on the desktop. And the same suite walks `lib/`, `components/`, `app/` and `contexts/` for request-target literals and asserts the policy permits each one, so adding a call to a new third-party host fails CI rather than failing a user at runtime.

The policy is installed by `applyContentSecurityPolicy` in `electron/main.ts`, on `session.defaultSession.webRequest.onHeadersReceived`, and only for responses whose origin is in the app's own allowlist. Rewriting headers on the third-party API responses the tools fetch would change nothing and would mean parsing every response in the main process. It is also applied to the packaged build only, because `next dev` serves eval-based sourcemaps and an HMR websocket that the policy blocks.

### `'unsafe-inline'`, and why a static export cannot use a nonce

The `script-src` row above is the weakest thing in the policy, and it is worth being exact about why it is the ceiling rather than an oversight, because "just add a nonce" is the obvious suggestion and it does not work here.

[CSP Level 3, should element's inline type behavior be blocked by content security policy?](https://www.w3.org/TR/CSP3/#should-block-inline) allows an inline script when the source list matches it, and the two ways to match are a [nonce-source](https://www.w3.org/TR/CSP3/#grammardef-nonce-source) or a [hash-source](https://www.w3.org/TR/CSP3/#grammardef-hash-source):

```text
allowed = 'unsafe-inline' in list
        OR nonce(script) matches some 'nonce-<value>' in list
        OR hash(script body) matches some 'sha256-<value>' in list

where:
  nonce(script) = the element's own nonce attribute, compared by
                  match nonce to source list
  hash(...)     = a base64 digest of the exact script text, so it changes
                  whenever a single byte of that script changes
```

A nonce is out because of what a nonce is. [CSP Level 3 section 8.2, nonce reuse](https://www.w3.org/TR/CSP3/#security-nonces) requires the value to be unguessable and regenerated for **every response**, and the whole point of `output: "export"` is that there is no per-response anything: `next build` writes HTML files once, and Vercel or the desktop build's `serve-handler` sends those bytes unchanged to everyone. A value baked into the file at build time is a constant that ships in plain sight in the HTML, so anyone who could inject markup could copy it out of the page they are injecting into. It would satisfy the syntax and provide none of the protection, which is worse than not claiming it.

A hash allowlist is the real alternative, and the reason it is not done is a build-pipeline cost rather than a principle. Count what would have to be hashed, against the export in `out/`:

```bash
# inline <script> tags with no src attribute, per page
python3 - <<'PY'
import re, sys
for page in ("out/index.html", "out/tools/subnet-calculator/index.html"):
    h = open(page, encoding="utf-8").read()
    inline = re.findall(r'<script(?![^>]*\ssrc=)[^>]*>(.*?)</script>', h, re.S)
    print(page, len(inline), "inline scripts,", sum(len(x) for x in inline), "bytes")
PY
```

```text
out/index.html                          13 inline scripts, 13407 bytes
out/tools/subnet-calculator/index.html  15 inline scripts, 16548 bytes
```

The sets are not the same between the two pages, because most of that content is React's streamed hydration payload for that specific route. So a hash-based policy is not one extra source expression; it is a distinct `script-src` per page, computed after `next build` and injected as a per-path response header. `vercel.json` sets one `headers` block for all paths, and the desktop build sends one policy from `electron/csp.ts` for the whole session, so both would need to become path-aware first.

What makes the current position defensible rather than merely convenient is what `'unsafe-inline'` is actually exposed to here. There is no server, so no request of yours is reflected into a page. No tool renders user input as HTML either: `dangerouslySetInnerHTML` occurs exactly once in the whole tree, at [`app/layout.tsx`](https://github.com/sunnypatell/netdash-toolkit/blob/main/app/layout.tsx), where it writes a JSON-LD block assembled from build-time constants with no user input reaching it. So the injection vector that `'unsafe-inline'` fails to stop has no way in. That is an argument for the residual risk being low, not for the directive being correct, and it is written down here so the next person tightening this policy starts from the real constraint rather than from the obvious suggestion.

### `'wasm-unsafe-eval'`, and the search box it fixed

This one is worth recording because the symptom pointed away from the cause. Documentation search is [Pagefind](https://pagefind.app/), which Starlight builds into a WebAssembly index at docs build time. Chromium gates WebAssembly compilation on `script-src`, so a policy with no WASM source kills `WebAssembly.instantiate` even though nothing about it is an `eval`. The search box rendered, accepted typing, and returned nothing, on both the web deploy and inside the desktop app at once, with the failure visible only in the console.

[`'wasm-unsafe-eval'`](https://www.w3.org/TR/CSP3/#directive-script-src) is the narrow fix: it permits WebAssembly compilation and nothing else. It does **not** re-enable `eval` or `new Function`, which is the whole reason it exists as a separate source expression rather than requiring `'unsafe-eval'`.

Two things follow that are worth carrying. A CSP that breaks a feature silently is worse than one that breaks it loudly, and this one broke silently for as long as nobody typed in the search box. And if you fork this project and tighten `script-src`, keep this token or the docs search stops working in both builds at the same time, for the same reason, with the same non-obvious symptom.

## Packaging and signing

`electron-builder.json` targets DMG and ZIP for macOS on both `x64` and `arm64`, NSIS and portable for Windows `x64`, and AppImage and `deb` for Linux `x64`. That is eight binaries per release. The Windows installer requests `asInvoker`, so it never asks for elevation, which is also why the desktop app cannot do anything requiring root.

macOS builds are **ad-hoc signed and NOT notarized**. `hardenedRuntime` is `false`, there is no `notarize` key, and no Apple Developer ID is involved because notarization requires a paid one. `electron/after-pack.cjs` verifies the bundle with `codesign --verify --deep --strict` and, if that fails, signs it ad hoc with the `-` identity. The header comment explains why the hook exists at all: `arm64` gets an ad-hoc signature automatically because Apple Silicon requires one, while `x64` was shipping completely unsigned, which turns Gatekeeper's "open anyway" path into a dead end on Intel Macs. A CI step re-runs the same `codesign --verify` across every `.app` in the release directory and fails the release if none is found.

Windows and Linux artifacts are unsigned. SmartScreen warns on first run.

### What goes into the package

`files` in `electron-builder.json` is `dist-electron/**/*` and `out/**/*`, plus exclusions for sourcemaps, `.d.ts` files, and the usual dependency noise. That is the whole payload: the compiled main process, and the static export.

It used to also list `public/**/*`, which shipped the documentation twice. `pnpm build:docs` copies `docs/dist` into `public/docs`, and `next build` then copies all of `public/` into `out/`, so `out/docs/` is already the served copy. The `public/**/*` glob added a second 2.7 MB copy at `<asar>/public/docs` that nothing reads, because `electron/main.ts` points `serve-handler` at `../out` and only at `../out`. It has been removed.

The general shape of that mistake is worth naming, because it is easy to repeat: two build steps each copying a directory forward means the final artifact already contains the intermediate one, and adding the intermediate to a package manifest duplicates rather than includes.

### The entitlements file that had to be deleted, not left alone

`electron/resources/entitlements.mac.plist` used to sit in the tree requesting `com.apple.security.device.raw-sockets` and friends. It has been removed, and the reasoning is a better example than the file was.

It was wrong on the merits. `com.apple.security.device.raw-sockets` is not a documented Apple entitlement spelling, and the app does not need raw sockets under any spelling: ICMP goes through `/sbin/ping`, which is setuid and needs no entitlement from the caller; port scanning is a `net.Socket` TCP connect rather than a SYN scan; DNS is `dns.promises.Resolver`. Nothing in the app opens a raw socket, so nothing would have used the entitlement even if it had been spelled correctly.

It was also wired to nothing. The `mac` block in `electron-builder.json` sets no `entitlements` and no `identity`, `hardenedRuntime` is `false`, and the shipped signature comes from `electron/after-pack.cjs` running `codesign --force --deep --sign -` with no `--entitlements` flag. The binary carried zero entitlements, so the file changed nothing about what shipped.

The reason it could not simply be left there harmlessly is the sharp one. electron-builder **auto-discovers** a file named `entitlements.mac.plist` in `buildResources`, and `buildResources` here is `electron/resources`. Nothing referenced it today because ad-hoc signing skips entitlements entirely. The day someone adds a Developer ID certificate and turns on `hardenedRuntime`, that file would have been picked up automatically, and the app would have silently acquired `allow-unsigned-executable-memory` and `disable-library-validation` along with the nonsense one.

:::caution[The rule that follows]
Dead configuration is not inert when the tool that reads it discovers files by name. An unused credential, plist, or policy file sitting in a conventional location is a change waiting for a trigger. Delete it, rather than documenting that it currently does nothing.
:::
