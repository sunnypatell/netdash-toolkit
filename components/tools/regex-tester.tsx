"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Copy, FileSearch, CheckCircle2, XCircle } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { useToast } from "@/hooks/use-toast"

interface Match {
  match: string
  index: number
  groups: string[]
}

interface RegexResult {
  valid: boolean
  error?: string
  matches: Match[]
  matchCount: number
}

export function RegexTester() {
  const { toast } = useToast()
  const [pattern, setPattern] = useState("\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b")
  const [testString, setTestString] = useState(
    "Contact us at support@example.com or sales@company.org for more information."
  )
  const [flags, setFlags] = useState({ g: true, i: true, m: false, s: false })

  const result = useMemo((): RegexResult => {
    if (!pattern.trim()) {
      return { valid: true, matches: [], matchCount: 0 }
    }

    try {
      const flagStr = Object.entries(flags)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join("")
      const regex = new RegExp(pattern, flagStr)

      const matches: Match[] = []
      let match: RegExpExecArray | null

      if (flags.g) {
        while ((match = regex.exec(testString)) !== null) {
          matches.push({
            match: match[0],
            index: match.index,
            groups: match.slice(1),
          })
          if (match[0].length === 0) regex.lastIndex++
        }
      } else {
        match = regex.exec(testString)
        if (match) {
          matches.push({
            match: match[0],
            index: match.index,
            groups: match.slice(1),
          })
        }
      }

      return { valid: true, matches, matchCount: matches.length }
    } catch (e) {
      return { valid: false, error: (e as Error).message, matches: [], matchCount: 0 }
    }
  }, [pattern, testString, flags])

  const highlightedText = useMemo(() => {
    if (!result.valid || result.matches.length === 0) return testString

    let lastIndex = 0
    const parts: React.ReactNode[] = []

    result.matches.forEach((match, i) => {
      if (match.index > lastIndex) {
        parts.push(testString.slice(lastIndex, match.index))
      }
      parts.push(
        <mark key={i} className="rounded bg-yellow-300 px-0.5 dark:bg-yellow-700">
          {match.match}
        </mark>
      )
      lastIndex = match.index + match.match.length
    })

    if (lastIndex < testString.length) {
      parts.push(testString.slice(lastIndex))
    }

    return parts
  }, [testString, result])

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "Copied", description: "Pattern copied to clipboard" })
    } catch {
      toast({ title: "Copy failed", variant: "destructive" })
    }
  }

  const presets = [
    { label: "Email", pattern: "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b" },
    { label: "URL", pattern: "https?://[\\w\\-._~:/?#\\[\\]@!$&'()*+,;=%]+" },
    { label: "IPv4", pattern: "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b" },
    { label: "IPv6", pattern: "([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}" },
    { label: "Phone (US)", pattern: "\\(?\\d{3}\\)?[-\\s.]?\\d{3}[-\\s.]?\\d{4}" },
    { label: "Date (YYYY-MM-DD)", pattern: "\\d{4}-\\d{2}-\\d{2}" },
    { label: "MAC Address", pattern: "([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}" },
    { label: "HTML Tag", pattern: "<([a-z][a-z0-9]*)\\b[^>]*>(.*?)</\\1>" },
  ]

  return (
    <div className="tool-container">
      <ToolHeader
        icon={FileSearch}
        title="Regex Tester"
        description="Test and debug regular expressions with live highlighting"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Pattern
              {pattern &&
                (result.valid ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
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
                  />
                  <span className="text-muted-foreground px-3">
                    /
                    {Object.entries(flags)
                      .filter(([, v]) => v)
                      .map(([k]) => k)
                      .join("")}
                  </span>
                </div>
                <Button variant="outline" onClick={() => copyToClipboard(pattern)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Flags</Label>
              <div className="flex flex-wrap gap-4">
                {[
                  { key: "g", label: "Global", desc: "Find all matches" },
                  { key: "i", label: "Case Insensitive", desc: "Ignore case" },
                  { key: "m", label: "Multiline", desc: "^ and $ match line boundaries" },
                  { key: "s", label: "Dotall", desc: ". matches newlines" },
                ].map((flag) => (
                  <div key={flag.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={flag.key}
                      checked={flags[flag.key as keyof typeof flags]}
                      onCheckedChange={(checked) =>
                        setFlags((prev) => ({ ...prev, [flag.key]: !!checked }))
                      }
                    />
                    <Label htmlFor={flag.key} className="cursor-pointer text-sm">
                      {flag.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {!result.valid && result.error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription className="font-mono text-xs">{result.error}</AlertDescription>
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

            <div className="flex items-center justify-between">
              <Badge variant={result.matchCount > 0 ? "default" : "secondary"}>
                {result.matchCount} match{result.matchCount !== 1 ? "es" : ""}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Highlighted Result</CardTitle>
              <CardDescription>Matches are highlighted in yellow</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 min-h-[120px] rounded-lg border p-4 font-mono text-sm whitespace-pre-wrap">
                {highlightedText}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Match Details</CardTitle>
            </CardHeader>
            <CardContent>
              {result.matches.length > 0 ? (
                <div className="max-h-64 space-y-2 overflow-y-auto">
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
                          {match.groups.map((group, j) => (
                            <div key={j} className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                ${j + 1}
                              </Badge>
                              <span className="font-mono text-xs">{group || "(empty)"}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground py-8 text-center">
                  {pattern ? "No matches found" : "Enter a pattern to see matches"}
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
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {presets.map((preset) => (
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
              { char: "()", desc: "Capture group" },
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
