// regex evaluation, kept as one self-contained function so the same code can run
// on the main thread (tests, no-Worker environments) and inside a blob worker.
//
// blob worker over `new Worker(new URL(...))` on purpose: this app ships as a
// static export (and as electron loading those files), so nothing here may
// depend on the bundler emitting a separate worker chunk at a known url.

export interface RegexMatchRequest {
  id?: number
  pattern: string
  flags: string
  input: string
  /** how many matches to keep in full detail; the rest are counted only */
  maxMatches: number
}

export interface RegexGroup {
  key: string
  value: string | null
}

export interface RegexMatchItem {
  match: string
  index: number
  /** positional capture groups, $1..$n */
  groups: RegexGroup[]
  /** named capture groups from match.groups, which plain slice(1) throws away */
  named: RegexGroup[]
}

export interface RegexMatchResult {
  id?: number
  error: string | null
  matches: RegexMatchItem[]
  total: number
  truncated: boolean
  scanMs: number
  /** the scan loop gave up on its own clock (a single exec() cannot be interrupted) */
  deadlineHit: boolean
}

/**
 * Written deliberately plainly - no imports, no closure over module scope, no
 * spread/destructuring - because `buildRegexWorkerSource` ships its own
 * `toString()` into a worker where none of that context exists.
 */
export function runRegexMatch(request: RegexMatchRequest, deadlineMs: number): RegexMatchResult {
  const started = Date.now()
  const result: RegexMatchResult = {
    id: request.id,
    error: null,
    matches: [],
    total: 0,
    truncated: false,
    scanMs: 0,
    deadlineHit: false,
  }

  if (!request.pattern) {
    return result
  }

  let re: RegExp
  try {
    re = new RegExp(request.pattern, request.flags)
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
    result.scanMs = Date.now() - started
    return result
  }

  const input = typeof request.input === "string" ? request.input : ""
  const cap = request.maxMatches > 0 ? request.maxMatches : 1
  const repeat = request.flags.indexOf("g") !== -1 || request.flags.indexOf("y") !== -1
  const unicode = request.flags.indexOf("u") !== -1 || request.flags.indexOf("v") !== -1

  // ecma-262 22.2.7.3 AdvanceStringIndex. under u/v, exec snaps lastIndex back to
  // the start of the code point, so a bare +1 inside a surrogate pair is undone
  // and the zero-length loop never terminates.
  const advance = function (from: number): number {
    const next = from + 1
    if (!unicode || next >= input.length) return next
    const lead = input.charCodeAt(from)
    if (lead < 0xd800 || lead > 0xdbff) return next
    const trail = input.charCodeAt(next)
    if (trail < 0xdc00 || trail > 0xdfff) return next
    return from + 2
  }

  const collect = function (match: RegExpExecArray): void {
    result.total = result.total + 1
    if (result.matches.length >= cap) {
      result.truncated = true
      return
    }
    const groups: RegexGroup[] = []
    for (let i = 1; i < match.length; i++) {
      groups.push({ key: "$" + String(i), value: match[i] === undefined ? null : match[i] })
    }
    const named: RegexGroup[] = []
    if (match.groups) {
      const keys = Object.keys(match.groups)
      for (let i = 0; i < keys.length; i++) {
        const value = match.groups[keys[i]]
        named.push({ key: keys[i], value: value === undefined ? null : value })
      }
    }
    result.matches.push({ match: match[0], index: match.index, groups: groups, named: named })
  }

  try {
    if (!repeat) {
      const single = re.exec(input)
      if (single) collect(single)
    } else {
      let match = re.exec(input)
      while (match !== null) {
        collect(match)
        if (match[0].length === 0) re.lastIndex = advance(re.lastIndex)
        if (re.lastIndex > input.length) break
        if (Date.now() - started > deadlineMs) {
          result.deadlineHit = true
          break
        }
        match = re.exec(input)
      }
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
  }

  result.scanMs = Date.now() - started
  return result
}

/**
 * Serialise the matcher into worker source. `runRegexMatch` is embedded via
 * toString() rather than by name so a minifier renaming it cannot break the
 * generated code.
 */
export function buildRegexWorkerSource(deadlineMs: number): string {
  return [
    "var __ndRegexRun = " + runRegexMatch.toString() + ";",
    "self.onmessage = function (event) {",
    "  var request = event.data;",
    "  var result;",
    "  try {",
    "    result = __ndRegexRun(request, " + String(deadlineMs) + ");",
    "  } catch (err) {",
    "    result = { error: String(err), matches: [], total: 0, truncated: false, scanMs: 0, deadlineHit: false };",
    "  }",
    "  result.id = request.id;",
    "  self.postMessage(result);",
    "};",
  ].join("\n")
}

export function supportsRegexWorker(): boolean {
  return (
    typeof Worker !== "undefined" &&
    typeof Blob !== "undefined" &&
    typeof URL !== "undefined" &&
    typeof URL.createObjectURL === "function"
  )
}

export function createRegexWorker(deadlineMs: number): { worker: Worker; url: string } | null {
  if (!supportsRegexWorker()) return null
  try {
    const url = URL.createObjectURL(
      new Blob([buildRegexWorkerSource(deadlineMs)], { type: "text/javascript" })
    )
    return { worker: new Worker(url), url: url }
  } catch {
    return null
  }
}

export const REGEX_FLAGS: Array<{ key: string; label: string; desc: string }> = [
  { key: "g", label: "g", desc: "global - find every match" },
  { key: "i", label: "i", desc: "case insensitive" },
  { key: "m", label: "m", desc: "multiline - ^ and $ match line breaks" },
  { key: "s", label: "s", desc: "dotall - . matches newlines" },
  { key: "u", label: "u", desc: "unicode - enables \\p{...} and \\u{...}" },
  { key: "v", label: "v", desc: "unicode sets - \\p{...} with set notation (replaces u)" },
  { key: "y", label: "y", desc: "sticky - match only at lastIndex" },
  { key: "d", label: "d", desc: "indices - record match start/end offsets" },
]
