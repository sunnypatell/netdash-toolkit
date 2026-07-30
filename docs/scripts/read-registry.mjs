// reads ../lib/tool-registry.ts and returns its data without importing the app
// (the registry pulls in react, lucide-react and `@/` aliases we cannot resolve here).
// strategy: lift the two array literals verbatim, stub the icon identifiers, and
// evaluate them as a data: URL module. the `load:` thunks stay as dead syntax
// because a dynamic import is only resolved when the arrow is called.

import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"

const here = path.dirname(fileURLToPath(import.meta.url))
export const REGISTRY_PATH = path.resolve(here, "../../lib/tool-registry.ts")

function fail(message) {
  throw new Error(
    `[docs] cannot read lib/tool-registry.ts: ${message}\n` +
      "  the registry shape changed. update docs/scripts/read-registry.mjs.\n" +
      "  failing loudly on purpose: silently shipping stale tool docs is worse."
  )
}

// walks from the opening bracket to its match, ignoring brackets inside
// strings, template literals and comments.
function sliceBalanced(source, openIndex) {
  const open = source[openIndex]
  const close = open === "[" ? "]" : "}"
  let depth = 0
  let quote = null

  for (let i = openIndex; i < source.length; i += 1) {
    const c = source[i]
    const next = source[i + 1]

    if (quote) {
      if (c === "\\") i += 1
      else if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c
      continue
    }
    if (c === "/" && next === "/") {
      i = source.indexOf("\n", i)
      if (i === -1) fail("unterminated line comment")
      continue
    }
    if (c === "/" && next === "*") {
      i = source.indexOf("*/", i)
      if (i === -1) fail("unterminated block comment")
      i += 1
      continue
    }
    if (c === open) depth += 1
    else if (c === close) {
      depth -= 1
      if (depth === 0) return source.slice(openIndex, i + 1)
    }
  }
  fail("unbalanced brackets while slicing an array literal")
}

function arrayLiteral(source, declaration) {
  const at = source.indexOf(declaration)
  if (at === -1) fail(`could not find \`${declaration}\``)

  // skip past the type annotation, whose own `[]` would otherwise look like the literal
  let assign = -1
  for (let i = at + declaration.length; i < source.length; i += 1) {
    if (source[i] === "=" && source[i + 1] !== "=") {
      assign = i
      break
    }
  }
  if (assign === -1) fail(`no assignment after \`${declaration}\``)

  const openIndex = source.indexOf("[", assign)
  if (openIndex === -1) fail(`no array literal after \`${declaration}\``)
  return sliceBalanced(source, openIndex)
}

function iconStubs(source) {
  const block = source.match(/import\s*\{([^}]*)\}\s*from\s*["']lucide-react["']/)
  if (!block) fail("no lucide-react import block to derive icon identifiers from")
  const names = block[1]
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean)
  if (names.length === 0) fail("lucide-react import block is empty")
  return names.map((n) => `const ${n} = ${JSON.stringify(n)};`).join("\n")
}

export async function readRegistry() {
  const source = await readFile(REGISTRY_PATH, "utf8")

  const module = [
    iconStubs(source),
    `export const categories = ${arrayLiteral(source, "export const categories")};`,
    `export const tools = ${arrayLiteral(source, "export const tools")};`,
  ].join("\n\n")

  let loaded
  try {
    const url = `data:text/javascript;base64,${Buffer.from(module, "utf8").toString("base64")}`
    loaded = await import(url)
  } catch (error) {
    fail(`the extracted literals are not valid JavaScript (${error.message})`)
  }

  const { categories, tools } = loaded
  if (!Array.isArray(categories) || categories.length === 0) fail("categories is empty")
  if (!Array.isArray(tools) || tools.length === 0) fail("tools is empty")

  for (const c of categories) {
    if (!c.id || !c.label || !c.description) fail(`category ${c.id ?? "?"} is missing fields`)
  }
  const ids = new Set(categories.map((c) => c.id))
  for (const t of tools) {
    if (!t.slug || !t.label || !t.title || !t.description || !t.category) {
      fail(`tool ${t.slug ?? "?"} is missing a required field`)
    }
    if (!ids.has(t.category)) fail(`tool ${t.slug} has unknown category ${t.category}`)
  }

  return { categories, tools }
}
