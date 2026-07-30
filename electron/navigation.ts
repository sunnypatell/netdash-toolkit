// navigation policy for the main window, kept pure so it can be tested without
// launching electron.
//
// this matters more here than in a typical app: preload.ts exposes ping,
// traceroute, portScan, arpScan and getSystemInfo to the renderer, and a preload
// runs for every navigation in its webContents. so a renderer-initiated
// navigation to a remote origin would hand that origin the ability to scan the
// user's internal network from the user's machine. setWindowOpenHandler does not
// cover this: it only sees window.open and target=_blank.

export type NavigationDecision =
  { action: "allow" } | { action: "external"; url: string } | { action: "block"; reason: string }

export function appOrigins(options: { isDev: boolean; staticPort: number }): string[] {
  const port = options.isDev ? 3000 : options.staticPort
  // the window loads over localhost so firebase auth's authorized-domain list
  // matches, while the static server binds 127.0.0.1. both are the app.
  return [`http://localhost:${port}`, `http://127.0.0.1:${port}`]
}

export function decideNavigation(rawUrl: string, allowedOrigins: string[]): NavigationDecision {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { action: "block", reason: "unparseable url" }
  }

  // exact origin match. substring checks like url.includes("localhost") are true
  // for a host such as "localhost.example.com", which is why this compares origins.
  if (allowedOrigins.includes(url.origin)) return { action: "allow" }

  // only http(s) is ever handed to the system browser. passing file:, smb: or a
  // custom scheme to shell.openExternal is its own vulnerability class.
  if (url.protocol === "http:" || url.protocol === "https:") {
    return { action: "external", url: url.href }
  }

  return { action: "block", reason: `refused scheme ${url.protocol}` }
}

// permissions the app has no feature that needs. the web build already sends
// Permissions-Policy: camera=(), microphone=(), geolocation=(), so the desktop
// build should not be weaker than the website.
const DENIED_PERMISSIONS = new Set([
  "camera",
  "media",
  "geolocation",
  "notifications",
  "midi",
  "midiSysex",
  "hid",
  "serial",
  "usb",
  "idle-detection",
  "clipboard-read",
  "openExternal",
])

export function isPermissionAllowed(permission: string): boolean {
  return !DENIED_PERMISSIONS.has(permission)
}
