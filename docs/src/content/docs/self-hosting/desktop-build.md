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

`pnpm electron:build` chains the first three for you. Output lands in `release/`. For a fast unpacked build with no installer, which is what CI does as a smoke test, run `pnpm exec electron-builder --linux --dir` and check that `release/linux-unpacked/` contains an executable plus `resources/app.asar`.

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

| Hook                   | Behaviour                                                                                               | What it prevents                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `setWindowOpenHandler` | always denies, opens `http`/`https` externally out of band                                              | `window.open` and `target="_blank"` loading a remote page in the app window |
| `will-navigate`        | blocks anything whose `url.origin` is not an exact allowlist match                                      | a `location.href` assignment reaching a remote origin                       |
| `will-attach-webview`  | unconditionally prevented                                                                               | an embedded `<webview>` inheriting the preload                              |
| Permission handlers    | deny-list of 11 permissions including `camera`, `geolocation`, `usb`, `serial`, `hid`, `clipboard-read` | the desktop build being weaker than the website's `Permissions-Policy`      |

The comments in `navigation.ts` name the exact mechanism of failure, and it is worth restating: the preload runs for every navigation in that `webContents`. Without the `will-navigate` guard, a page that navigated itself to a remote origin would hand that origin `portScan` and `arpScan` from inside the user's network. Origin comparison is exact `url.origin` equality rather than a substring check, because `url.includes("localhost")` also matches `localhost.example.com`.

Only `http:` and `https:` URLs are handed to `shell.openExternal`. Everything else is blocked with a recorded reason, because passing `file:`, `smb:` or a custom scheme to the OS handler is its own vulnerability class.

The permission handler is a deny-list, not an allow-list, so a permission Electron adds in a future version is granted until someone adds it to `DENIED_PERMISSIONS`.

## Packaging and signing

`electron-builder.json` targets DMG and ZIP for macOS on both `x64` and `arm64`, NSIS and portable for Windows `x64`, and AppImage and `deb` for Linux `x64`. That is eight binaries per release. The Windows installer requests `asInvoker`, so it never asks for elevation, which is also why the desktop app cannot do anything requiring root.

macOS builds are **ad-hoc signed and NOT notarized**. `hardenedRuntime` is `false`, there is no `notarize` key, and no Apple Developer ID is involved because notarization requires a paid one. `electron/after-pack.cjs` verifies the bundle with `codesign --verify --deep --strict` and, if that fails, signs it ad hoc with the `-` identity. The header comment explains why the hook exists at all: `arm64` gets an ad-hoc signature automatically because Apple Silicon requires one, while `x64` was shipping completely unsigned, which turns Gatekeeper's "open anyway" path into a dead end on Intel Macs. A CI step re-runs the same `codesign --verify` across every `.app` in the release directory and fails the release if none is found.

Windows and Linux artifacts are unsigned. SmartScreen warns on first run.

:::caution[Known Inert Configuration]
`electron/resources/entitlements.mac.plist` requests `com.apple.security.device.raw-sockets` and friends, but `electron-builder.json` never references it with an `entitlements` or `entitlementsInherit` key. Those entitlements are not applied, and would be moot anyway with `hardenedRuntime: false`. Nothing in the app depends on them, since ICMP goes through the system `ping` binary rather than a raw socket.
:::
