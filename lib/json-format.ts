export type JsonIndent = "2" | "4" | "tab"
export type JsonOutputMode = "pretty" | "minify"

export interface JsonStats {
  keys: number
  arrays: number
  objects: number
  strings: number
  numbers: number
  booleans: number
  nulls: number
  depth: number
}

export interface JsonWarning {
  kind: "duplicate-key" | "precision" | "non-finite" | "too-large-to-analyze"
  message: string
}

export interface JsonAnalysis {
  valid: boolean | null
  error: string | null
  output: string
  stats: JsonStats | null
  warnings: JsonWarning[]
  bytes: number
}

// past this the scanner and the stats walk are skipped: they are O(n) but the
// whole analysis runs synchronously on every keystroke
export const MAX_ANALYZE_CHARS = 2_000_000
const MAX_REPORTED_WARNINGS = 10

export const INDENT_LABELS: Record<JsonIndent, string> = {
  "2": "2 spaces",
  "4": "4 spaces",
  tab: "Tab",
}

// json.stringify treats a number space of 0 as "no whitespace at all" and only a
// string space produces tabs, so "tab" has to be the literal character
function indentValue(indent: JsonIndent): string | number {
  if (indent === "tab") return "\t"
  return indent === "4" ? 4 : 2
}

interface ScanFrame {
  isObject: boolean
  keys: Set<string>
  expectKey: boolean
}

// must run on the source text: JSON.parse collapses repeated keys and rounds past 2^53
export function scanJsonSource(source: string): JsonWarning[] {
  const warnings: JsonWarning[] = []
  const duplicates = new Set<string>()
  const stack: ScanFrame[] = []
  let i = 0

  const push = (warning: JsonWarning) => {
    if (warnings.length < MAX_REPORTED_WARNINGS) warnings.push(warning)
  }

  while (i < source.length) {
    const char = source[i]

    if (char === '"') {
      const start = i
      i += 1
      while (i < source.length) {
        if (source[i] === "\\") {
          i += 2
          continue
        }
        if (source[i] === '"') break
        i += 1
      }
      i += 1
      const top = stack[stack.length - 1]
      if (top?.isObject && top.expectKey) {
        let key: string
        try {
          key = JSON.parse(source.slice(start, i)) as string
        } catch {
          key = source.slice(start + 1, i - 1)
        }
        if (top.keys.has(key) && !duplicates.has(key)) {
          duplicates.add(key)
          push({
            kind: "duplicate-key",
            message: `Duplicate key "${key}": every JSON.parse keeps only the last value, so the earlier one is discarded without an error.`,
          })
        }
        top.keys.add(key)
      }
      continue
    }

    if (char === "{") {
      stack.push({ isObject: true, keys: new Set(), expectKey: true })
      i += 1
      continue
    }
    if (char === "[") {
      stack.push({ isObject: false, keys: new Set(), expectKey: false })
      i += 1
      continue
    }
    if (char === "}" || char === "]") {
      stack.pop()
      i += 1
      continue
    }
    if (char === ",") {
      const top = stack[stack.length - 1]
      if (top?.isObject) top.expectKey = true
      i += 1
      continue
    }
    if (char === ":") {
      const top = stack[stack.length - 1]
      if (top?.isObject) top.expectKey = false
      i += 1
      continue
    }

    if (char === "-" || (char >= "0" && char <= "9")) {
      const start = i
      i += 1
      while (i < source.length && /[0-9eE+.\-]/.test(source[i])) i += 1
      const literal = source.slice(start, i)
      const parsed = Number(literal)
      if (!Number.isFinite(parsed)) {
        push({
          kind: "non-finite",
          message: `${literal} overflows a double, so it parses to Infinity and JSON.stringify writes it back as null.`,
        })
      } else if (!/[.eE]/.test(literal) && !Number.isSafeInteger(parsed)) {
        push({
          kind: "precision",
          message: `${literal} is past 2^53-1, so JSON.parse rounds it to ${parsed}. Keep IDs this large as strings.`,
        })
      }
      continue
    }

    i += 1
  }

  return warnings
}

// iterative on purpose: the recursive version overflowed and got reported as invalid JSON
export function jsonStats(root: unknown): JsonStats {
  const stats: JsonStats = {
    keys: 0,
    arrays: 0,
    objects: 0,
    strings: 0,
    numbers: 0,
    booleans: 0,
    nulls: 0,
    depth: 0,
  }
  const stack: { value: unknown; depth: number }[] = [{ value: root, depth: 0 }]

  while (stack.length > 0) {
    const { value, depth } = stack.pop() as { value: unknown; depth: number }
    if (depth > stats.depth) stats.depth = depth

    if (value === null) {
      stats.nulls += 1
      continue
    }
    if (Array.isArray(value)) {
      stats.arrays += 1
      for (const item of value) stack.push({ value: item, depth: depth + 1 })
      continue
    }
    if (typeof value === "object") {
      stats.objects += 1
      const entries = Object.keys(value as Record<string, unknown>)
      stats.keys += entries.length
      for (const key of entries) {
        stack.push({ value: (value as Record<string, unknown>)[key], depth: depth + 1 })
      }
      continue
    }
    if (typeof value === "string") stats.strings += 1
    else if (typeof value === "number") stats.numbers += 1
    else if (typeof value === "boolean") stats.booleans += 1
  }

  return stats
}

export function analyzeJson(input: string, indent: JsonIndent, mode: JsonOutputMode): JsonAnalysis {
  const bytes = input.length
  const empty: JsonAnalysis = {
    valid: null,
    error: null,
    output: "",
    stats: null,
    warnings: [],
    bytes,
  }
  if (!input.trim()) return empty

  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Invalid JSON",
      output: "",
      stats: null,
      warnings: [],
      bytes,
    }
  }

  let output: string
  try {
    output =
      mode === "minify" ? JSON.stringify(parsed) : JSON.stringify(parsed, null, indentValue(indent))
  } catch (err) {
    // JSON.stringify recurses where parse does not, so ~10k levels is valid but not re-serialisable
    const message =
      err instanceof RangeError
        ? `Valid JSON, but too deeply nested to re-serialise: JSON.stringify recurses and overflowed the stack at depth ${jsonStats(parsed).depth.toLocaleString()}.`
        : err instanceof Error
          ? err.message
          : "Could not serialise this JSON"
    return {
      valid: true,
      error: message,
      output: "",
      stats: jsonStats(parsed),
      warnings: [],
      bytes,
    }
  }

  if (bytes > MAX_ANALYZE_CHARS) {
    return {
      valid: true,
      error: null,
      output,
      stats: null,
      warnings: [
        {
          kind: "too-large-to-analyze",
          message: `Input is ${bytes.toLocaleString()} characters. Formatting still ran, but the duplicate-key, precision and statistics passes are skipped above ${MAX_ANALYZE_CHARS.toLocaleString()} to keep typing responsive.`,
        },
      ],
      bytes,
    }
  }

  return {
    valid: true,
    error: null,
    output,
    stats: jsonStats(parsed),
    warnings: scanJsonSource(input),
    bytes,
  }
}
