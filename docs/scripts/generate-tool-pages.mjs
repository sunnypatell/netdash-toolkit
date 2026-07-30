// writes src/content/docs/tools/ from lib/tool-registry.ts.
// the registry is the app's single source of truth for slug, label, description,
// category and runtime metadata, so hand-written per-tool pages would drift the
// moment a tool is added or its network behaviour changes.

import { mkdir, rm, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { readRegistry } from "./read-registry.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(here, "../src/content/docs/tools")

// the sidebar is manual by design, so a new category is a change the sidebar has
// to opt into. this list is the contract; drift fails the build.
const SIDEBAR_CATEGORIES = [
  "calculators",
  "ip-tools",
  "network",
  "diagnostics",
  "generators",
  "reference",
  "devtools",
]

function yamlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function sentence(text) {
  const trimmed = String(text).trim()
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

function plural(n, one, many) {
  return n === 1 ? `${n} ${one}` : `${n} ${many}`
}

function runtimeCell(tool) {
  if (tool.runtime?.offline !== false) return "no"
  const hosts = tool.runtime.thirdParty ?? []
  return hosts.length > 0 ? `yes: ${hosts.map((h) => `\`${h}\``).join(", ")}` : "yes"
}

function categoryPage(category, categoryTools) {
  const offline = categoryTools.filter((t) => t.runtime?.offline !== false)
  const networked = categoryTools.filter((t) => t.runtime?.offline === false)
  const desktop = categoryTools.filter((t) => (t.runtime?.desktopOnly ?? []).length > 0)

  const lines = []
  lines.push("---")
  lines.push(`title: ${yamlString(category.label)}`)
  lines.push(
    `description: ${yamlString(
      `${sentence(category.description).replace(/\.$/, "")} in NetDash Toolkit, with what each tool sends off your device.`
    )}`
  )
  lines.push("---")
  lines.push("")

  // lede
  if (networked.length === 0) {
    lines.push(
      `${plural(categoryTools.length, "tool", "tools")} in this category, and none of them ` +
        "send anything off your device. Everything below computes in the tab you already have open."
    )
  } else if (offline.length === 0) {
    lines.push(
      `${plural(categoryTools.length, "tool", "tools")} in this category, and every one of them ` +
        "makes a network request. Each entry names the hosts it talks to."
    )
  } else {
    lines.push(
      `${plural(categoryTools.length, "tool", "tools")} in this category. ` +
        `${offline.length} run entirely on your device; ${networked.length} make network requests, ` +
        "and each one names the hosts it talks to."
    )
  }
  lines.push("")

  lines.push("## What is in this category")
  lines.push("")
  lines.push("| Tool | What it does | Leaves your device |")
  lines.push("| --- | --- | --- |")
  for (const tool of categoryTools) {
    lines.push(
      `| [${tool.label}](/tools/${tool.slug}/) | ${tool.description} | ${runtimeCell(tool)} |`
    )
  }
  lines.push("")

  // interpreting prose, derived rather than asserted
  const interpretation = []
  if (networked.length === 0) {
    interpretation.push(
      "The last column is `no` for every row, which is the whole point of this category: " +
        "you can work through it on a locked-down network, on a plane, or inside the desktop app with the network off."
    )
  } else {
    interpretation.push(
      `${networked.length} of ${categoryTools.length} rows leave your device, so those are the only ones ` +
        "that stop working offline. The hosts in that column come from the tool registry, not from this page, " +
        "so they cannot drift from what the code actually requests."
    )
  }
  if (desktop.length > 0) {
    interpretation.push(
      `${plural(desktop.length, "tool", "tools")} here gain capabilities in the desktop build that a ` +
        "browser cannot provide at all; see the per-tool notes below and " +
        "[how the diagnostics work](/docs/diagnostics/browser-limits/) for the mechanism."
    )
  }
  lines.push(interpretation.join(" "))
  lines.push("")

  lines.push("## Tool by tool")
  lines.push("")
  for (const tool of categoryTools) {
    lines.push(`### ${tool.title}`)
    lines.push("")
    lines.push(
      `${sentence(tool.description)} Open it at [\`/tools/${tool.slug}/\`](/tools/${tool.slug}/).`
    )
    lines.push("")
    if ((tool.features ?? []).length > 0) {
      for (const feature of tool.features) lines.push(`- ${feature}`)
      lines.push("")
    }
    const notes = []
    if (tool.runtime?.offline === false) {
      const hosts = tool.runtime.thirdParty ?? []
      notes.push(
        hosts.length > 0
          ? `Sends requests to ${hosts.map((h) => `\`${h}\``).join(", ")}.`
          : "Makes network requests."
      )
    } else {
      notes.push("Runs entirely on your device; no request is made.")
    }
    if ((tool.runtime?.desktopOnly ?? []).length > 0) {
      notes.push(
        `Desktop build only: ${tool.runtime.desktopOnly.join(", ")}. In a browser these fall back to ` +
          "what the web platform permits, which is less."
      )
    }
    if (tool.projectItemType) {
      notes.push("Results can be saved to a project, which requires signing in.")
    }
    lines.push(notes.join(" "))
    lines.push("")
  }

  lines.push("---")
  lines.push("")
  lines.push("## How this page is produced")
  lines.push("")
  lines.push(
    "Everything above is generated at docs build time from " +
      "[`lib/tool-registry.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/tool-registry.ts). " +
      "Editing this page by hand does nothing, because the next build overwrites it. Fix the registry instead."
  )
  lines.push("")

  return lines.join("\n")
}

function hubPage(categories, tools, byCategory) {
  const offline = tools.filter((t) => t.runtime?.offline !== false).length

  const lines = []
  lines.push("---")
  lines.push("title: 'Tools'")
  lines.push(
    `description: 'All ${tools.length} NetDash Toolkit tools, grouped into ${categories.length} categories, with what each one sends off your device.'`
  )
  lines.push("---")
  lines.push("")
  lines.push("import { CardGrid, LinkCard } from '@astrojs/starlight/components';")
  lines.push("")
  lines.push(
    `${tools.length} tools in ${categories.length} categories, ${offline} of which never touch the network.`
  )
  lines.push("")
  lines.push("<CardGrid>")
  for (const category of categories) {
    const count = (byCategory.get(category.id) ?? []).length
    lines.push("\t<LinkCard")
    lines.push(`\t\ttitle="${category.label}"`)
    lines.push(
      `\t\tdescription="${sentence(category.description).replace(/\.$/, "")}. ${plural(count, "tool", "tools")}."`
    )
    lines.push(`\t\thref="/docs/tools/${category.id}/"`)
    lines.push("\t/>")
  }
  lines.push("</CardGrid>")
  lines.push("")

  return lines.join("\n")
}

// the repo's prettier runs over the whole tree, so generated pages have to come
// out already formatted or `pnpm format:check` fails after every docs build.
// resolved from the root install; if it is not there, write unformatted rather
// than making the docs build depend on it.
async function formatter() {
  try {
    const prettier = await import("prettier")
    const config = await prettier.resolveConfig(OUT_DIR)
    return async (source, filepath) =>
      prettier.format(source, {
        ...config,
        filepath,
        parser: filepath.endsWith(".mdx") ? "mdx" : "markdown",
      })
  } catch {
    console.warn("[docs] prettier not resolvable, writing generated pages unformatted")
    return async (source) => source
  }
}

const format = await formatter()

const { categories, tools } = await readRegistry()

const present = categories.map((c) => c.id)
const missing = present.filter((id) => !SIDEBAR_CATEGORIES.includes(id))
const stale = SIDEBAR_CATEGORIES.filter((id) => !present.includes(id))
if (missing.length > 0 || stale.length > 0) {
  throw new Error(
    "[docs] the tool categories no longer match the manual sidebar.\n" +
      (missing.length > 0 ? `  new in the registry: ${missing.join(", ")}\n` : "") +
      (stale.length > 0 ? `  gone from the registry: ${stale.join(", ")}\n` : "") +
      "  add or remove the entry in docs/astro.config.mjs under the Tools group, then update\n" +
      "  SIDEBAR_CATEGORIES in docs/scripts/generate-tool-pages.mjs to match."
  )
}

const byCategory = new Map()
for (const tool of tools) {
  if (!byCategory.has(tool.category)) byCategory.set(tool.category, [])
  byCategory.get(tool.category).push(tool)
}

await rm(OUT_DIR, { recursive: true, force: true })
await mkdir(OUT_DIR, { recursive: true })

const hubPath = path.join(OUT_DIR, "index.mdx")
await writeFile(hubPath, await format(hubPage(categories, tools, byCategory), hubPath), "utf8")

for (const category of categories) {
  const categoryTools = byCategory.get(category.id) ?? []
  if (categoryTools.length === 0) {
    throw new Error(
      `[docs] category ${category.id} has no tools. the sidebar would link to an empty page.`
    )
  }
  const filePath = path.join(OUT_DIR, `${category.id}.md`)
  await writeFile(filePath, await format(categoryPage(category, categoryTools), filePath), "utf8")
}

console.log(
  `[docs] generated ${categories.length + 1} tool pages from lib/tool-registry.ts (${tools.length} tools)`
)
