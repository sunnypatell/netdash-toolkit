// fails the docs build when a hand-written page states a tool count that the
// registry no longer agrees with.
//
// this exists because it already happened: `conflict-checker` moved from
// `offline: false` to `offline: true`, the offline count went 36 -> 37, and
// eleven hand-written sentences across nine pages silently became wrong. the
// generated pages under tools/ re-derive their numbers on every build and were
// fine; only the prose drifted, which is exactly the failure mode prose has.
//
// the check is deliberately blunt. it does not try to understand a sentence. it
// finds numbers sitting in one of the shapes the docs use to state a count, and
// asserts each one is a number the registry can currently justify. a phrasing
// this does not recognise is not checked, so add the shape here rather than
// working around it.

import { readdir, readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { readRegistry } from "./read-registry.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const DOCS_DIR = path.resolve(here, "../src/content/docs")
// generated on every build from the same registry, so it cannot drift
const GENERATED_DIR = path.join(DOCS_DIR, "tools")

async function markdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const out = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (full === GENERATED_DIR) continue
      out.push(...(await markdownFiles(full)))
    } else if (/\.mdx?$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out.sort()
}

export function buildExpectations(registry) {
  const { categories, tools } = registry
  const offline = tools.filter((t) => t.runtime?.offline !== false)
  const networked = tools.filter((t) => t.runtime?.offline === false)
  const saveable = tools.filter((t) => t.projectItemType)
  const perCategory = categories.map((c) => tools.filter((t) => t.category === c.id).length)

  return {
    total: tools.length,
    offline: offline.length,
    networked: networked.length,
    saveable: saveable.length,
    categories: categories.length,
    perCategory,
  }
}

// each rule is [label, regex, set of numbers the capturing group may legally
// hold, optional guard]. keep the regexes anchored to words that only ever
// surround a tool count, so an rfc section number, a byte figure or a header
// grade cannot match.
function rules(expected) {
  const anyToolCount = new Set([
    expected.total,
    expected.offline,
    expected.networked,
    expected.saveable,
    ...expected.perCategory,
  ])

  return [
    // "48 tools", "48-tool dashboard", "all 48 tools".
    // "tool files" is a different unit (tools are directories now, so files
    // outnumber tools), and "N tools whose ..." is a subset by construction.
    // both produced false positives that failed the build.
    [
      "a total tool count",
      /\b(\d+)[ -]tools?\b(?!\s+(?:files?|whose)\b)/g,
      new Set([expected.total]),
    ],
    // "36 of the 48 tools", "11 of the 48". the denominator has to be the tool
    // count for this to be about tools at all: "0 of 100" is a header score.
    [
      "a subset of the tool count",
      /\b(\d+) of (?:the )?(\d+)\b/g,
      anyToolCount,
      (m) => Number(m[2]) === expected.total,
    ],
    // "36 of them never touch the network", "36 offline", "all 36 offline tools"
    [
      "an offline tool count",
      /\b(\d+) (?:of them never|offline|fully working)/g,
      new Set([expected.offline]),
    ],
    // "the other 12", "the 12 networked tools"
    [
      "a networked tool count",
      /\b[Tt]he other (\d+)\b|\b(\d+) networked tools\b/g,
      new Set([expected.networked]),
    ],
    // "seven categories" is spelled out in prose, so only the numeral form is checked
    ["a category count", /\b(\d+) categories\b/g, new Set([expected.categories])],
  ]
}

function lineOf(source, index) {
  return source.slice(0, index).split("\n").length
}

export async function checkCounts() {
  const registry = await readRegistry()
  const expected = buildExpectations(registry)
  const files = await markdownFiles(DOCS_DIR)
  const problems = []

  for (const file of files) {
    const source = await readFile(file, "utf8")
    for (const [label, pattern, allowed, guard] of rules(expected)) {
      pattern.lastIndex = 0
      let match
      while ((match = pattern.exec(source)) !== null) {
        if (guard && !guard(match)) continue
        const captured = match.slice(1).find((g) => g !== undefined)
        if (captured === undefined) continue
        const value = Number(captured)
        if (allowed.has(value)) continue
        problems.push({
          file: path.relative(path.resolve(here, "../.."), file),
          line: lineOf(source, match.index),
          label,
          found: value,
          allowed: [...allowed].sort((a, b) => a - b),
          text: match[0],
        })
      }
    }
  }

  return { expected, problems }
}

const isEntrypoint =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isEntrypoint) {
  const { expected, problems } = await checkCounts()

  if (problems.length > 0) {
    console.error("[docs] tool counts in the prose disagree with lib/tool-registry.ts\n")
    for (const p of problems) {
      console.error(
        `  ${p.file}:${p.line}\n` +
          `    matched   ${JSON.stringify(p.text)} as ${p.label}\n` +
          `    found     ${p.found}\n` +
          `    registry  ${p.allowed.join(", ")}\n`
      )
    }
    console.error(
      "the registry is the source of truth. fix the prose, not this check, unless\n" +
        "the phrasing itself is new, in which case add its shape to docs/scripts/check-counts.mjs.\n"
    )
    process.exit(1)
  }

  console.log(
    `[docs] tool counts agree with the registry ` +
      `(${expected.total} tools, ${expected.offline} offline, ${expected.networked} networked, ` +
      `${expected.saveable} saveable, ${expected.categories} categories)`
  )
}
