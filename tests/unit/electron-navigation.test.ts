import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { appOrigins, decideNavigation, isPermissionAllowed } from "@/electron/navigation"

// the preload runs for every navigation, so the question is whether any can land a non-app origin

const PROD = appOrigins({ isDev: false, staticPort: 17890 })
const DEV = appOrigins({ isDev: true, staticPort: 17890 })

describe("app origins", () => {
  it("covers both localhost and the loopback literal", () => {
    // the window loads over localhost for firebase while the server binds 127.0.0.1, so both are us
    expect(PROD).toEqual(["http://localhost:17890", "http://127.0.0.1:17890"])
    expect(DEV).toEqual(["http://localhost:3000", "http://127.0.0.1:3000"])
  })

  it("does not treat the dev origin as the app in a packaged build", () => {
    expect(decideNavigation("http://localhost:3000/", PROD).action).not.toBe("allow")
  })
})

describe("in-app navigation still works", () => {
  it.each([
    "http://localhost:17890/",
    "http://localhost:17890/tools/subnet-calculator/",
    "http://127.0.0.1:17890/projects/",
    "http://localhost:17890/tools/mtu-calculator/?mtu=1500#results",
  ])("allows %s", (url) => {
    expect(decideNavigation(url, PROD)).toEqual({ action: "allow" })
  })
})

describe("remote origins never load in the app window", () => {
  it.each([
    "https://example.com/",
    "http://example.com/page",
    "https://example.com:17890/",
    // a different scheme on the app's own host and port is still not the app origin
    "https://localhost:17890/",
  ])("sends %s to the system browser instead", (url) => {
    expect(decideNavigation(url, PROD)).toEqual({ action: "external", url })
  })

  // the previous implementation used url.includes("localhost"), true of any hostname containing it
  it.each([
    "http://localhost.example.com/",
    "http://notlocalhost:17890/",
    "http://127.0.0.1.example.com/",
  ])("is not fooled by %s, which contains the allowed host as a substring", (url) => {
    const decision = decideNavigation(url, PROD)
    expect(decision.action).toBe("external")
  })

  it("blocks a host that smuggles the allowed port into the hostname", () => {
    // "17890.example.com" is not a valid port, so this never parses; block what has no origin
    expect(decideNavigation("http://localhost:17890.example.com/", PROD).action).toBe("block")
  })

  it("treats a userinfo-spoofed url by its real origin", () => {
    // the host here is example.com, not localhost
    const decision = decideNavigation("http://localhost:17890@example.com/", PROD)
    expect(decision.action).toBe("external")
    expect(decision).not.toEqual({ action: "allow" })
  })
})

describe("non-http schemes are refused outright, never handed to the shell", () => {
  it.each([
    "file:///etc/hosts",
    "netdash-evil://payload",
    "javascript:void(0)",
    "data:text/html,<script></script>",
    "about:blank",
    "vbscript:msgbox",
  ])("blocks %s without producing an external open", (url) => {
    const decision = decideNavigation(url, PROD)
    expect(decision.action).toBe("block")
    // the important half: nothing here can reach shell.openExternal
    expect(decision).not.toHaveProperty("url")
  })

  it("blocks a url it cannot parse", () => {
    expect(decideNavigation("http://", PROD).action).toBe("block")
    expect(decideNavigation("", PROD).action).toBe("block")
    expect(decideNavigation("///", PROD).action).toBe("block")
  })
})

describe("permissions", () => {
  it.each(["camera", "media", "geolocation", "notifications", "midi", "usb", "serial", "hid"])(
    "denies %s, which no feature uses",
    (permission) => {
      expect(isPermissionAllowed(permission)).toBe(false)
    }
  )

  it("denies openExternal as a permission, since navigation decides that", () => {
    expect(isPermissionAllowed("openExternal")).toBe(false)
  })

  it("allows the clipboard write every copy button depends on", () => {
    expect(isPermissionAllowed("clipboard-sanitized-write")).toBe(true)
  })

  // an allow-list, so a permission electron adds later is refused by default rather than granted
  it.each(["a-permission-that-does-not-exist-yet", "display-capture", "window-management"])(
    "refuses %s, an unknown or future permission",
    (permission) => {
      expect(isPermissionAllowed(permission)).toBe(false)
    }
  )
})

// a perfect decision function that nothing calls protects nothing
describe("main.ts wiring", () => {
  const main = readFileSync(join(process.cwd(), "electron", "main.ts"), "utf8")

  it("guards will-navigate, not just window.open", () => {
    expect(main).toMatch(/on\("will-navigate"/)
    expect(main).toMatch(/setWindowOpenHandler/)
  })

  it("routes both through the shared policy rather than ad hoc checks", () => {
    const calls = main.match(/decideNavigation\(/g) ?? []
    expect(calls.length).toBeGreaterThanOrEqual(2)
  })

  it("no longer decides origin by substring", () => {
    expect(main).not.toMatch(/includes\("localhost"\)/)
    expect(main).not.toMatch(/includes\("127\.0\.0\.1"\)/)
    expect(main).not.toMatch(/startsWith\("https?:\/\/"\)/)
  })

  it("denies webview attachment and locks down permissions", () => {
    expect(main).toMatch(/will-attach-webview/)
    expect(main).toMatch(/setPermissionRequestHandler/)
    expect(main).toMatch(/setPermissionCheckHandler/)
  })

  it("keeps the renderer isolated", () => {
    expect(main).toMatch(/contextIsolation:\s*true/)
    expect(main).toMatch(/nodeIntegration:\s*false/)
    expect(main).toMatch(/webSecurity:\s*true/)
  })
})
