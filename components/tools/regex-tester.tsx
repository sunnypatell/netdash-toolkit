"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { parseAsString, useQueryStates } from "nuqs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { FileSearch, CheckCircle2, XCircle, AlertTriangle, Timer } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"
import {
  createRegexWorker,
  runRegexMatch,
  REGEX_FLAGS,
  type RegexMatchResult,
} from "@/lib/regex-run"

// a regex engine cannot be interrupted mid-exec, so the only real protection
// against catastrophic backtracking is running it off-thread and killing it.
const DEADLINE_MS = 1000
const MAX_MATCHES = 500
const DEBOUNCE_MS = 250

type Status = "idle" | "running" | "done" | "timeout"

interface MatchRequest {
  pattern: string
  flags: string
  input: string
}

const EMPTY_RESULT: RegexMatchResult = {
  error: null,
  matches: [],
  total: 0,
  truncated: false,
  scanMs: 0,
  deadlineHit: false,
}

const DEFAULT_PATTERN = "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b"
const DEFAULT_TEST_STRING =
  "Contact us at support@example.com or sales@company.org for more information."
const DEFAULT_FLAGS = "gi"

const PRESETS = [
  { label: "Email", pattern: DEFAULT_PATTERN },
  { label: "URL", pattern: "https?://[\\w\\-._~:/?#\\[\\]@!$&'()*+,;=%]+" },
  { label: "IPv4", pattern: "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b" },
  { label: "IPv6", pattern: "([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}" },
  { label: "Phone (US)", pattern: "\\(?\\d{3}\\)?[-\\s.]?\\d{3}[-\\s.]?\\d{4}" },
  { label: "Date (named groups)", pattern: "(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})" },
  { label: "MAC Address", pattern: "([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}" },
  { label: "Any letter (needs u)", pattern: "\\p{L}+" },
  { label: "Catastrophic backtracking", pattern: "(a+)+$" },
]

export function RegexTester() {
  // a pattern, its flags and a sample corpus are all short and never sensitive,
  // so the whole thing goes in the url and a reproduction is a link
  const [query, setQuery] = useQueryStates(
    {
      pattern: parseAsString.withDefault(DEFAULT_PATTERN),
      flags: parseAsString.withDefault(DEFAULT_FLAGS),
      test: parseAsString.withDefault(DEFAULT_TEST_STRING),
    },
    { history: "replace" }
  )

  const { pattern, flags: flagStr, test: testString } = query
  const setPattern = (value: string) => void setQuery({ pattern: value })
  const setTestString = (value: string) => void setQuery({ test: value })

  // canonical order, so the url never carries "ig" and the /flags readout is stable
  const flags = useMemo(() => {
    const active: Record<string, boolean> = {}
    for (const flag of REGEX_FLAGS) active[flag.key] = flagStr.includes(flag.key)
    return active
  }, [flagStr])

  const [request, setRequest] = useState<MatchRequest>({
    pattern: DEFAULT_PATTERN,
    flags: DEFAULT_FLAGS,
    input: DEFAULT_TEST_STRING,
  })
  const [status, setStatus] = useState<Status>("idle")
  const [result, setResult] = useState<RegexMatchResult>(EMPTY_RESULT)
  const [offThread, setOffThread] = useState(true)

  // debounce so a slow pattern is not re-evaluated on every keystroke
  useEffect(() => {
    const timer = setTimeout(
      () => setRequest({ pattern, flags: flagStr, input: testString }),
      DEBOUNCE_MS
    )
    return () => clearTimeout(timer)
  }, [pattern, flagStr, testString])

  const workerRef = useRef<{ worker: Worker; url: string } | null>(null)
  const requestId = useRef(0)

  const killWorker = useCallback(() => {
    const current = workerRef.current
    if (current) {
      current.worker.terminate()
      URL.revokeObjectURL(current.url)
      workerRef.current = null
    }
  }, [])

  useEffect(() => killWorker, [killWorker])

  useEffect(() => {
    if (!request.pattern) {
      setStatus("done")
      setResult(EMPTY_RESULT)
      return
    }

    if (!workerRef.current) workerRef.current = createRegexWorker(DEADLINE_MS)
    const current = workerRef.current

    if (!current) {
      // no Worker in this environment: same code path, but the deadline can only
      // bound the match loop, not a single runaway exec()
      setOffThread(false)
      setStatus("done")
      setResult(runRegexMatch({ ...request, maxMatches: MAX_MATCHES }, DEADLINE_MS))
      return
    }

    setOffThread(true)
    const id = requestId.current + 1
    requestId.current = id
    setStatus("running")

    const timer = setTimeout(() => {
      // terminate mid-exec; a fresh worker is created for the next request
      killWorker()
      setStatus("timeout")
      setResult(EMPTY_RESULT)
    }, DEADLINE_MS + 100)

    const onMessage = (event: MessageEvent<RegexMatchResult>) => {
      if (event.data?.id !== id) return
      clearTimeout(timer)
      setResult(event.data)
      setStatus(event.data.deadlineHit ? "timeout" : "done")
    }

    current.worker.addEventListener("message", onMessage)
    current.worker.postMessage({ ...request, id, maxMatches: MAX_MATCHES })

    return () => {
      clearTimeout(timer)
      current.worker.removeEventListener("message", onMessage)
    }
  }, [request, killWorker])

  const timedOut = status === "timeout"
  const invalid = !timedOut && result.error !== null
  const stale = status === "running" || request.pattern !== pattern || request.input !== testString

  const highlighted = useMemo(() => {
    if (invalid || timedOut || result.matches.length === 0) return request.input
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    result.matches.forEach((match, i) => {
      if (match.index < lastIndex) return
      if (match.index > lastIndex) parts.push(request.input.slice(lastIndex, match.index))
      parts.push(
        <mark key={i} className="rounded bg-yellow-300 px-0.5 dark:bg-yellow-700">
          {match.match}
        </mark>
      )
      lastIndex = match.index + match.match.length
    })
    if (lastIndex < request.input.length) parts.push(request.input.slice(lastIndex))
    return parts
  }, [request.input, result, invalid, timedOut])

  const toggleFlag = (key: string, on: boolean) => {
    const next = { ...flags, [key]: on }
    // u and v cannot be combined; picking one drops the other
    if (on && key === "u") next.v = false
    if (on && key === "v") next.u = false
    void setQuery({
      flags: REGEX_FLAGS.filter((f) => next[f.key])
        .map((f) => f.key)
        .join(""),
    })
  }

  return (
    <div className="tool-container">
      <ToolHeader
        icon={FileSearch}
        title="Regex Tester"
        description="Test regular expressions off the main thread with a hard timeout"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Pattern
              {pattern &&
                !stale &&
                (invalid || timedOut ? (
                  <XCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ))}
            </CardTitle>
            <CardDescription>Enter a regular expression pattern</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pattern">Regular Expression</Label>
              <div className="flex gap-2">
                <div className="flex flex-1 items-center rounded-md border">
                  <span className="text-muted-foreground px-3">/</span>
                  <Input
                    id="pattern"
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    placeholder="[A-Za-z]+"
                    className="border-0 font-mono focus-visible:ring-0"
                    aria-invalid={invalid}
                  />
                  <span className="text-muted-foreground px-3">/{flagStr}</span>
                </div>
                <CopyButton value={pattern} variant="outline" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Flags</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {REGEX_FLAGS.map((flag) => (
                  <div key={flag.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`flag-${flag.key}`}
                      checked={!!flags[flag.key]}
                      onCheckedChange={(checked) => toggleFlag(flag.key, !!checked)}
                    />
                    <Label
                      htmlFor={`flag-${flag.key}`}
                      className="cursor-pointer font-mono text-sm"
                      title={flag.desc}
                    >
                      {flag.label}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground text-xs">
                {REGEX_FLAGS.filter((f) => flags[f.key])
                  .map((f) => `${f.key}: ${f.desc}`)
                  .join(" - ") || "No flags selected"}
              </p>
            </div>

            {timedOut && (
              <Alert variant="destructive">
                <Timer className="h-4 w-4" />
                <AlertDescription>
                  Pattern timed out after {DEADLINE_MS}ms and was stopped - this usually means
                  catastrophic backtracking. Simplify nested quantifiers such as{" "}
                  <code className="font-mono">(a+)+</code> or shorten the test string.
                </AlertDescription>
              </Alert>
            )}

            {invalid && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription className="font-mono text-xs">{result.error}</AlertDescription>
              </Alert>
            )}

            {!offThread && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Web Workers are unavailable here, so matching runs on the main thread. The timeout
                  can only stop the match loop, not a single runaway match.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="test">Test String</Label>
              <Textarea
                id="test"
                value={testString}
                onChange={(e) => setTestString(e.target.value)}
                placeholder="Enter text to test against..."
                className="h-32 resize-none font-mono"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={result.total > 0 && !invalid && !timedOut ? "default" : "secondary"}>
                {timedOut || invalid ? "0" : result.total} match
                {(timedOut || invalid ? 0 : result.total) !== 1 ? "es" : ""}
              </Badge>
              {status === "running" && <Badge variant="outline">matching...</Badge>}
              {!invalid && !timedOut && status === "done" && (
                <Badge variant="outline">{result.scanMs}ms</Badge>
              )}
              {result.truncated && !timedOut && (
                <Badge variant="outline">showing first {MAX_MATCHES}</Badge>
              )}
            </div>

            {result.truncated && !timedOut && (
              <p className="text-muted-foreground text-xs">
                {result.total.toLocaleString()} matches found, {MAX_MATCHES} rendered - the rest are
                counted but not listed so the page stays responsive.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Highlighted Result</CardTitle>
              <CardDescription>Matches are highlighted in yellow</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 max-h-64 min-h-[120px] overflow-y-auto rounded-lg border p-4 font-mono text-sm whitespace-pre-wrap">
                {highlighted}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Match Details</CardTitle>
              <CardDescription>Positional and named capture groups</CardDescription>
            </CardHeader>
            <CardContent>
              {result.matches.length > 0 && !timedOut ? (
                <div className="max-h-96 space-y-2 overflow-y-auto">
                  {result.matches.map((match, i) => (
                    <div key={i} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">Match {i + 1}</Badge>
                        <span className="text-muted-foreground text-xs">Index: {match.index}</span>
                      </div>
                      <p className="mt-2 font-mono text-sm break-all">{match.match}</p>
                      {match.groups.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <p className="text-muted-foreground text-xs">Capture Groups:</p>
                          {match.groups.map((group) => (
                            <div key={group.key} className="flex items-center gap-2">
                              <Badge variant="secondary" className="font-mono text-xs">
                                {group.key}
                              </Badge>
                              <span className="font-mono text-xs break-all">
                                {group.value === null ? "(no match)" : group.value || "(empty)"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {match.named.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <p className="text-muted-foreground text-xs">Named Groups:</p>
                          {match.named.map((group) => (
                            <div key={group.key} className="flex items-center gap-2">
                              <Badge className="font-mono text-xs">{group.key}</Badge>
                              <span className="font-mono text-xs break-all">
                                {group.value === null ? "(no match)" : group.value || "(empty)"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground py-8 text-center">
                  {timedOut
                    ? "Matching was stopped before any results were returned"
                    : invalid
                      ? "Fix the pattern to see matches"
                      : pattern
                        ? "No matches found"
                        : "Enter a pattern to see matches"}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Common Patterns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => setPattern(preset.pattern)}
                className="hover:bg-muted/50 rounded-lg border p-3 text-left transition-colors"
              >
                <p className="text-sm font-medium">{preset.label}</p>
                <p className="text-muted-foreground truncate font-mono text-xs">{preset.pattern}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regex Quick Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            {[
              { char: ".", desc: "Any character" },
              { char: "\\d", desc: "Digit [0-9]" },
              { char: "\\w", desc: "Word char [a-zA-Z0-9_]" },
              { char: "\\s", desc: "Whitespace" },
              { char: "^", desc: "Start of string" },
              { char: "$", desc: "End of string" },
              { char: "*", desc: "0 or more" },
              { char: "+", desc: "1 or more" },
              { char: "?", desc: "0 or 1" },
              { char: "{n}", desc: "Exactly n times" },
              { char: "[abc]", desc: "Character class" },
              { char: "(?<n>)", desc: "Named group" },
              { char: "\\p{L}", desc: "Unicode property (u flag)" },
              { char: "\\u{1F600}", desc: "Code point (u flag)" },
              { char: "(?=)", desc: "Lookahead" },
              { char: "(?<=)", desc: "Lookbehind" },
            ].map((item) => (
              <div key={item.char} className="flex items-center gap-2">
                <code className="bg-muted rounded px-2 py-1 font-bold">{item.char}</code>
                <span className="text-muted-foreground text-xs">{item.desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
