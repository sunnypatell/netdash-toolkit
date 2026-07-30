// crawls the built html and fails on any internal link that does not resolve.
// "verified by eye" is not verification: this runs on every docs build.

import { readdir, readFile, stat } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"

const here = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.resolve(here, "../dist")
const BASE = "/docs"

// links to pages this build does not own. the accessibility conformance record is
// authored separately; it is referenced from the sidebar on purpose and must not
// be created here just to satisfy the crawler.
const KNOWN_PENDING = new Set(["/docs/accessibility-conformance/"])

async function htmlFiles(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await htmlFiles(full)))
    else if (entry.name.endsWith(".html")) out.push(full)
  }
  return out
}

async function exists(p) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

// maps a site-absolute url path to the file that would serve it
async function resolves(urlPath) {
  const withoutBase = urlPath.startsWith(BASE) ? urlPath.slice(BASE.length) : null
  if (withoutBase === null) return false
  const rel = withoutBase.replace(/^\/+/, "")
  const candidates = [
    path.join(DIST, rel, "index.html"),
    path.join(DIST, rel),
    path.join(DIST, `${rel.replace(/\/$/, "")}.html`),
  ]
  for (const c of candidates) if (await exists(c)) return true
  return false
}

const files = await htmlFiles(DIST)
if (files.length === 0) {
  console.error("[docs] no html in dist/. did the build run?")
  process.exit(1)
}

// collect every id and name anchor per page so fragment links can be checked too
const anchors = new Map()
const pages = new Map()
for (const file of files) {
  const html = await readFile(file, "utf8")
  pages.set(file, html)
  const ids = new Set()
  for (const m of html.matchAll(/\sid="([^"]+)"/g)) ids.add(m[1])
  anchors.set(file, ids)
}

const problems = []
let checked = 0
let pending = 0

for (const [file, html] of pages) {
  const from = path.relative(DIST, file)
  for (const m of html.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)) {
    const href = m[1]
    if (!href || href.startsWith("#")) continue
    if (/^(https?:|mailto:|tel:|data:)/i.test(href)) continue
    if (!href.startsWith("/")) {
      problems.push(`${from}: relative link "${href}" (internal links must be absolute)`)
      continue
    }

    const [urlPath, fragment] = href.split("#")

    // links out of the docs and into the app (for example "/" or "/tools/x/")
    if (!urlPath.startsWith(`${BASE}/`) && urlPath !== BASE && urlPath !== `${BASE}/`) continue

    const normalised = urlPath.endsWith("/") ? urlPath : `${urlPath}/`
    if (KNOWN_PENDING.has(normalised)) {
      pending += 1
      continue
    }

    checked += 1
    if (!(await resolves(urlPath))) {
      problems.push(`${from}: dead internal link "${href}"`)
      continue
    }
    if (!urlPath.endsWith("/") && !urlPath.match(/\.[a-z0-9]+$/i)) {
      problems.push(`${from}: internal link "${href}" is missing its trailing slash`)
    }
    if (fragment) {
      const rel = urlPath.slice(BASE.length).replace(/^\/+/, "")
      const target = path.join(DIST, rel, "index.html")
      const ids = anchors.get(target)
      if (ids && !ids.has(fragment)) {
        problems.push(`${from}: link "${href}" points at a fragment that does not exist`)
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`[docs] ${problems.length} link problem(s):`)
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}

console.log(
  `[docs] ${checked} internal links resolve across ${files.length} pages` +
    (pending > 0 ? `, ${pending} skipped as externally owned (accessibility record)` : "")
)
