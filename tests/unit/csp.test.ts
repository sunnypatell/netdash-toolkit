import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { CSP_DIRECTIVES, CONTENT_SECURITY_POLICY } from "@/electron/csp"
import { appOrigins } from "@/electron/navigation"

// the host list is derived from the source at test time, so a new third-party call fails ci

const repoRoot = process.cwd()
const SCAN_DIRS = ["lib", "components", "app", "contexts"]
const WEB_ORIGIN = new URL(
  JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).homepage
).origin
const DESKTOP_ORIGIN = appOrigins({ isDev: false, staticPort: 17890 })[0]

// policy parsing and source matching

type Directives = Record<string, string[]>

function parsePolicy(policy: string): Directives {
  const directives: Directives = {}
  for (const part of policy.split(";")) {
    const [name, ...values] = part.trim().split(/\s+/)
    if (name) directives[name.toLowerCase()] = values
  }
  return directives
}

// csp source matching, minus the parts this policy never uses (paths, non-default
// ports, nonces, hashes)
function permits(sources: string[], target: string, selfOrigin: string): boolean {
  let url: URL
  try {
    url = new URL(target)
  } catch {
    return false
  }
  return sources.some((source) => {
    if (source === "'none'") return false
    if (source === "'self'") return url.origin === selfOrigin
    if (source.startsWith("'")) return false
    if (/^[a-z][a-z0-9+.-]*:$/i.test(source)) return url.protocol === source.toLowerCase()
    const match = /^(?:([a-z][a-z0-9+.-]*):\/\/)?(\*\.)?([^/:]+)(?::(\d+|\*))?/i.exec(source)
    if (!match) return false
    const [, scheme, wildcard, host, port] = match
    if (scheme && url.protocol !== `${scheme.toLowerCase()}:`) return false
    if (port && port !== "*" && url.port !== port) return false
    const hostname = url.hostname.toLowerCase()
    const pattern = host.toLowerCase()
    return wildcard ? hostname.endsWith(`.${pattern}`) : hostname === pattern
  })
}

// egress derived from the source tree

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(entry) ? [full] : []
  })
}

const LOOKBACK = 120
const FETCH_CALL = /\bfetch\w*\(/
// each rule needs the literal against its request target; doc links in href= match none of them
const FETCH_ARG = /\bfetch\w*\(\s*["'`]?$/
const ENDPOINT_CONST =
  /\b(?:const|let|var)\s+[A-Z0-9_]*(?:ENDPOINT|API|RESOLVER|HOST)[A-Z0-9_]*\s*=[^=]*$/
// not screaming case only: `const observatoryBase = "https://..."` beside a fetch is the same egress
const CONST_IN_FETCHING_FILE = /\b(?:const|let|var)\s+[A-Za-z_$][A-Za-z0-9_$]*\s*=[^=]*$/
const URL_BINDING = /(?:^|[^A-Za-z0-9_.])url\s*[:=]\s*["'`]$/
const SCRIPT_SRC = /\bscript\w*\.src\s*=\s*["'`]$/

interface Egress {
  connect: Map<string, string[]>
  script: Map<string, string[]>
  interpolated: string[]
}

function scanSource(src: string, rel: string, into: Egress) {
  const record = (map: Map<string, string[]>, host: string, where: string) => {
    if (host === new URL(WEB_ORIGIN).hostname) return // 'self' on the web build
    map.set(host, [...(map.get(host) ?? []), where])
  }
  const fileFetches = FETCH_CALL.test(src)

  for (const m of src.matchAll(/https?:\/\/([a-z0-9][a-z0-9.-]*\.[a-z]{2,})/gi)) {
    const before = src.slice(Math.max(0, m.index - LOOKBACK), m.index).replace(/\s+/g, " ")
    const where = `${rel}:${src.slice(0, m.index).split("\n").length}`
    const host = m[1].toLowerCase()
    if (SCRIPT_SRC.test(before)) record(into.script, host, where)
    else if (FETCH_ARG.test(before) || ENDPOINT_CONST.test(before))
      record(into.connect, host, where)
    else if (fileFetches && (URL_BINDING.test(before) || CONST_IN_FETCHING_FILE.test(before)))
      record(into.connect, host, where)
  }

  // a host interpolated straight into a fetch argument: the user typed it.
  // only direct fetch args are detected, so this is a floor, not the total.
  for (const m of src.matchAll(/https?:\/\/\$\{|\}:\/\//g)) {
    if (!FETCH_CALL.test(src.slice(Math.max(0, m.index - 100), m.index))) continue
    into.interpolated.push(`${rel}:${src.slice(0, m.index).split("\n").length}`)
  }
}

function emptyEgress(): Egress {
  return { connect: new Map(), script: new Map(), interpolated: [] }
}

function scanEgress(): Egress {
  const out = emptyEgress()
  for (const dir of SCAN_DIRS) {
    for (const file of sourceFiles(join(repoRoot, dir))) {
      scanSource(readFileSync(file, "utf8"), file.slice(repoRoot.length + 1), out)
    }
  }
  return out
}

// the scan is the only thing standing between an undisclosed third-party call
// and a green ci run, so it gets fed known-bad input rather than trusted.
function connectHostsIn(src: string): string[] {
  const out = emptyEgress()
  scanSource(src, "synthetic.ts", out)
  return [...out.connect.keys()].sort()
}

const egress = scanEgress()
const DERIVED_HOSTS = [...egress.connect.keys()].sort()

// the disclosure the derived list is checked against

// the source is the input and SECURITY.md has to keep up with it, so nothing here is hardcoded
const securityDoc = readFileSync(join(repoRoot, ".github", "SECURITY.md"), "utf8")

function documentedHosts(marker: string): string[] {
  const block = new RegExp(
    `<!-- egress:${marker}:start -->([\\s\\S]*?)<!-- egress:${marker}:end -->`
  )
  const body = block.exec(securityDoc)?.[1] ?? ""
  // backticked tokens that are hostnames: the same cells name source files too
  const hosts = [...body.matchAll(/`([^`]+)`/g)]
    .map((m) => m[1].trim().toLowerCase())
    .filter(
      (token) =>
        /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(token) && !/\.(ts|tsx|js|json)$/.test(token)
    )
  return [...new Set(hosts)].sort()
}

const DOCUMENTED_APP_HOSTS = documentedHosts("app")
// the firebase sdk hardcodes these; they are in node_modules, not in this repo,
// so the doc is their only source and the policy still has to cover them
const DOCUMENTED_SDK_HOSTS = documentedHosts("sdk")
const DOCUMENTED_COUNT = Number(
  /contacts (\d+) fixed third-party hosts/.exec(securityDoc)?.[1] ?? NaN
)

const REQUIRED_DIRECTIVES = [
  "default-src",
  "script-src",
  "style-src",
  "img-src",
  "font-src",
  "connect-src",
  "frame-src",
  "worker-src",
  "object-src",
  "base-uri",
  "form-action",
  "frame-ancestors",
]

const LOCKED_DIRECTIVES: Array<[string, string[]]> = [
  ["object-src", ["'none'"]],
  ["base-uri", ["'self'"]],
  ["form-action", ["'self'"]],
  ["frame-ancestors", ["'none'"]],
]

const vercelConfig = JSON.parse(readFileSync(join(repoRoot, "vercel.json"), "utf8"))
const catchAll = vercelConfig.headers.find((h: { source: string }) => h.source === "/(.*)")
const webHeader = catchAll?.headers.find(
  (h: { key: string }) => h.key.toLowerCase() === "content-security-policy"
)
const web = parsePolicy(webHeader?.value ?? "")
const desktop = parsePolicy(CONTENT_SECURITY_POLICY)

const BUILDS: Array<[string, Directives, string]> = [
  ["web", web, WEB_ORIGIN],
  ["desktop", desktop, DESKTOP_ORIGIN],
]

describe("source matching", () => {
  it("rejects a host no source names", () => {
    expect(permits(["'self'", "https://dns.google"], "https://unlisted.example/", WEB_ORIGIN)).toBe(
      false
    )
  })

  it("matches a wildcard source as a suffix, not as a substring", () => {
    const sources = ["https://*.firebaseapp.com"]
    expect(permits(sources, "https://netdash-toolkit.firebaseapp.com/__/auth/iframe", "")).toBe(
      true
    )
    expect(permits(sources, "https://firebaseapp.com.example/", "")).toBe(false)
  })

  it("resolves 'self' against the build's own origin", () => {
    expect(permits(["'self'"], `${DESKTOP_ORIGIN}/tools/`, DESKTOP_ORIGIN)).toBe(true)
    expect(permits(["'self'"], `${WEB_ORIGIN}/tools/`, DESKTOP_ORIGIN)).toBe(false)
  })
})

describe("the web build ships a policy", () => {
  it("sends it on every path", () => {
    expect(catchAll, "no catch-all header block in vercel.json").toBeTruthy()
    expect(webHeader?.value, "no Content-Security-Policy header in vercel.json").toBeTruthy()
  })

  it("keeps COOP at same-origin-allow-popups", () => {
    // signInWithPopup needs the opener handle; plain same-origin breaks google
    // sign-in on the web build
    const coop = catchAll.headers.find(
      (h: { key: string }) => h.key.toLowerCase() === "cross-origin-opener-policy"
    )
    expect(coop?.value).toBe("same-origin-allow-popups")
  })
})

describe.each(BUILDS)("%s policy", (_name, policy, selfOrigin) => {
  it.each(REQUIRED_DIRECTIVES)("declares %s", (directive) => {
    expect(policy[directive], `missing ${directive}`).toBeTruthy()
  })

  it.each(LOCKED_DIRECTIVES)("locks %s to %s", (directive, expected) => {
    expect(policy[directive]).toEqual(expected)
  })

  it("allows no eval", () => {
    expect(policy["script-src"]).not.toContain("'unsafe-eval'")
  })

  it("does not upgrade insecure requests", () => {
    // the port scanner and ping fallback probe http:// targets on purpose, and
    // upgrade-insecure-requests would silently rewrite them to https
    expect(Object.keys(policy)).not.toContain("upgrade-insecure-requests")
  })

  it("allows the blob worker the regex tester runs patterns in", () => {
    expect(permits(policy["worker-src"], "blob:whatever", selfOrigin)).toBe(true)
  })

  it("allows the data: urls qrcode produces", () => {
    expect(permits(policy["img-src"], "data:image/png;base64,AAAA", selfOrigin)).toBe(true)
  })

  it("serves its own document origin", () => {
    expect(permits(policy["default-src"], `${selfOrigin}/`, selfOrigin)).toBe(true)
  })

  it("allows firebase auth's gapi loader and its auth-handler iframe", () => {
    expect(permits(policy["script-src"], "https://apis.google.com/js/api.js", selfOrigin)).toBe(
      true
    )
    expect(
      permits(policy["frame-src"], "https://netdash-toolkit.firebaseapp.com/__/auth/iframe", "")
    ).toBe(true)
  })

  it.each(DOCUMENTED_SDK_HOSTS)("reaches %s", (host) => {
    expect(permits(policy["connect-src"], `https://${host}/v1/projects`, selfOrigin)).toBe(true)
  })

  it.each(DERIVED_HOSTS)("reaches %s", (host) => {
    expect(permits(policy["connect-src"], `https://${host}/`, selfOrigin)).toBe(true)
  })

  it.each([...egress.script.keys()])("loads the %s script", (host) => {
    expect(permits(policy["script-src"], `https://${host}/`, selfOrigin)).toBe(true)
  })

  it("permits a host the user types, because four tools fetch one", () => {
    // if this ever reaches zero, re-derive whether connect-src can drop its
    // scheme sources for an allowlist
    expect(egress.interpolated.length).toBeGreaterThan(0)
    expect(policy["connect-src"]).toContain("https:")
    expect(
      permits(policy["connect-src"], "https://whatever-the-user-typed.example/", selfOrigin)
    ).toBe(true)
  })
})

describe("the egress scan sees the shapes a third-party call is written in", () => {
  it.each([
    ["a direct fetch argument", 'await fetch("https://probe.example/v1")'],
    [
      "a screaming-case endpoint constant",
      'const PROBE_ENDPOINT = "https://probe.example"\nfetch(`${PROBE_ENDPOINT}/v1`)',
    ],
    [
      "a camelCase constant in a fetching file",
      'const probeBase = "https://probe.example"\nasync function go() { return fetch(`${probeBase}/v1`) }',
    ],
    [
      "a url-keyed property in a fetching file",
      'const target = { url: "https://probe.example/v1" }\nfetch(target.url)',
    ],
  ])("catches %s", (_shape, source) => {
    expect(connectHostsIn(source)).toContain("probe.example")
  })

  it("does not sweep in a documentation link from a file that never fetches", () => {
    expect(connectHostsIn('const learnMore = "https://developer.mozilla.org/en-US/"')).toEqual([])
  })
})

describe("egress derived from the source tree", () => {
  it("finds the calls at all", () => {
    // guards against a scanner that silently matches nothing
    expect(egress.connect.size).toBeGreaterThan(5)
    expect(egress.script.size).toBeGreaterThan(0)
  })

  it("is disclosed host for host in SECURITY.md", () => {
    const provenance = [...egress.connect]
      .map(([host, where]) => `  ${host} <- ${where.join(", ")}`)
      .join("\n")
    expect(
      DERIVED_HOSTS,
      `the code and the egress table in .github/SECURITY.md disagree. call sites:\n${provenance}`
    ).toEqual(DOCUMENTED_APP_HOSTS)
  })

  it("keeps the count in the prose equal to the table", () => {
    expect(DOCUMENTED_COUNT).toBe(DOCUMENTED_APP_HOSTS.length)
  })

  it("reads a non-empty table out of the doc", () => {
    // a marker rename would otherwise turn the assertion above into [] === []
    expect(DOCUMENTED_APP_HOSTS.length).toBeGreaterThan(5)
    expect(DOCUMENTED_SDK_HOSTS.length).toBeGreaterThan(0)
  })

  it("names every host with the file that contacts it", () => {
    for (const [host, where] of egress.connect) {
      expect(where.length, `${host} has no call site`).toBeGreaterThan(0)
    }
  })
})

describe("the two builds do not drift", () => {
  it("ships the same directives, since both run the same static export", () => {
    expect(desktop).toEqual(web)
  })

  it("resolves 'self' to the app's own origin in each build", () => {
    expect(permits(desktop["connect-src"], `${DESKTOP_ORIGIN}/tools/`, DESKTOP_ORIGIN)).toBe(true)
    expect(permits(web["connect-src"], `${WEB_ORIGIN}/tools/`, WEB_ORIGIN)).toBe(true)
  })

  it("keeps electron/csp.ts the single source for the desktop policy", () => {
    const serialized = Object.entries(CSP_DIRECTIVES)
      .map(([name, values]) => `${name} ${values.join(" ")}`)
      .join("; ")
    expect(CONTENT_SECURITY_POLICY).toBe(serialized)
  })
})

describe("the desktop policy is wired to the session", () => {
  const main = readFileSync(join(repoRoot, "electron", "main.ts"), "utf8")

  it("sets the header on responses instead of a meta tag", () => {
    expect(main).toContain("session.defaultSession.webRequest.onHeadersReceived")
    expect(main).toContain('headers["Content-Security-Policy"] = [CONTENT_SECURITY_POLICY]')
  })

  it("only applies it to the app's own origins", () => {
    expect(main).toContain("allowedOrigins.includes(origin)")
  })

  it("skips the dev renderer, which needs eval and an hmr socket", () => {
    expect(main).toMatch(/if \(!isDev\) \{\s*applyContentSecurityPolicy\(/)
  })
})
