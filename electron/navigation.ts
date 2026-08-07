// pure so it tests without electron. preload runs for every navigation in its webContents, so a
// renderer-initiated hop to a remote origin would hand that origin portScan and getArpTable.

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

// allow-list, not deny-list: a deny-list would grant whatever electron adds next. matches the
// web build's Permissions-Policy so the desktop is never weaker than the site.
const ALLOWED_PERMISSIONS = new Set([
  // every tool has copy buttons; chromium consults this for
  // navigator.clipboard.writeText
  "clipboard-sanitized-write",
])

export function isPermissionAllowed(permission: string): boolean {
  return ALLOWED_PERMISSIONS.has(permission)
}
