"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Copy,
  Braces,
  Trash2,
  Download,
  CheckCircle2,
  XCircle,
  Minimize2,
  Maximize2,
} from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface JSONStats {
  keys: number
  arrays: number
  objects: number
  strings: number
  numbers: number
  booleans: number
  nulls: number
  depth: number
}

function getJSONStats(obj: unknown, depth = 0): JSONStats {
  const stats: JSONStats = {
    keys: 0,
    arrays: 0,
    objects: 0,
    strings: 0,
    numbers: 0,
    booleans: 0,
    nulls: 0,
    depth,
  }

  if (obj === null) {
    stats.nulls = 1
    return stats
  }

  if (Array.isArray(obj)) {
    stats.arrays = 1
    obj.forEach((item) => {
      const childStats = getJSONStats(item, depth + 1)
      stats.keys += childStats.keys
      stats.arrays += childStats.arrays
      stats.objects += childStats.objects
      stats.strings += childStats.strings
      stats.numbers += childStats.numbers
      stats.booleans += childStats.booleans
      stats.nulls += childStats.nulls
      if (childStats.depth > stats.depth) stats.depth = childStats.depth
    })
    return stats
  }

  if (typeof obj === "object") {
    stats.objects = 1
    const keys = Object.keys(obj as Record<string, unknown>)
    stats.keys = keys.length
    keys.forEach((key) => {
      const childStats = getJSONStats((obj as Record<string, unknown>)[key], depth + 1)
      stats.keys += childStats.keys
      stats.arrays += childStats.arrays
      stats.objects += childStats.objects
      stats.strings += childStats.strings
      stats.numbers += childStats.numbers
      stats.booleans += childStats.booleans
      stats.nulls += childStats.nulls
      if (childStats.depth > stats.depth) stats.depth = childStats.depth
    })
    return stats
  }

  if (typeof obj === "string") stats.strings = 1
  if (typeof obj === "number") stats.numbers = 1
  if (typeof obj === "boolean") stats.booleans = 1

  return stats
}

export function JSONFormatter() {
  const { toast } = useToast()
  const [input, setInput] = useState("")
  const [output, setOutput] = useState("")
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [indentSize, setIndentSize] = useState("2")
  const [stats, setStats] = useState<JSONStats | null>(null)

  useEffect(() => {
    if (!input.trim()) {
      setOutput("")
      setIsValid(null)
      setError(null)
      setStats(null)
      return
    }

    try {
      const parsed = JSON.parse(input)
      setIsValid(true)
      setError(null)
      setOutput(JSON.stringify(parsed, null, parseInt(indentSize)))
      setStats(getJSONStats(parsed))
    } catch (e) {
      setIsValid(false)
      setError((e as Error).message)
      setOutput("")
      setStats(null)
    }
  }, [input, indentSize])

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "Copied", description: "JSON copied to clipboard" })
    } catch {
      toast({ title: "Copy failed", variant: "destructive" })
    }
  }

  const minify = () => {
    if (!isValid) return
    try {
      const parsed = JSON.parse(input)
      setOutput(JSON.stringify(parsed))
    } catch {
      // Already handled
    }
  }

  const format = () => {
    if (!isValid) return
    try {
      const parsed = JSON.parse(input)
      setOutput(JSON.stringify(parsed, null, parseInt(indentSize)))
    } catch {
      // Already handled
    }
  }

  const downloadJSON = () => {
    if (!output) return
    const blob = new Blob([output], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "formatted.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  const clear = () => {
    setInput("")
    setOutput("")
    setIsValid(null)
    setError(null)
    setStats(null)
  }

  const loadSample = () => {
    setInput(
      JSON.stringify(
        {
          name: "NetDash Toolkit",
          version: "1.0.0",
          features: ["subnet calculator", "dns tools", "port scanner"],
          config: {
            theme: "dark",
            notifications: true,
            maxResults: 100,
          },
          metadata: {
            created: "2024-01-15",
            updated: null,
            tags: ["networking", "tools", "utilities"],
          },
        },
        null,
        2
      )
    )
  }

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Braces}
        title="JSON Formatter"
        description="Format, validate, and minify JSON data"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Input
                  {isValid !== null &&
                    (isValid ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    ))}
                </CardTitle>
                <CardDescription>Paste or type JSON to format</CardDescription>
              </div>
              <Badge
                variant={isValid ? "default" : isValid === false ? "destructive" : "secondary"}
              >
                {isValid ? "Valid" : isValid === false ? "Invalid" : "Empty"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='{"key": "value"}'
              className="h-80 resize-none font-mono text-sm"
            />

            {error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={loadSample}>
                Load Sample
              </Button>
              <Button variant="outline" size="sm" onClick={clear}>
                <Trash2 className="mr-2 h-4 w-4" />
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Formatted Output</CardTitle>
                <CardDescription>
                  {output ? `${output.length} characters` : "Enter valid JSON to see output"}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="indent" className="text-sm">
                  Indent:
                </Label>
                <Select value={indentSize} onValueChange={setIndentSize}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                    <SelectItem value="0">Tab</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={output}
              readOnly
              placeholder="Formatted JSON will appear here..."
              className="bg-muted/50 h-80 resize-none font-mono text-sm"
            />

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(output)}
                disabled={!output}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={format} disabled={!isValid}>
                <Maximize2 className="mr-2 h-4 w-4" />
                Format
              </Button>
              <Button variant="outline" size="sm" onClick={minify} disabled={!isValid}>
                <Minimize2 className="mr-2 h-4 w-4" />
                Minify
              </Button>
              <Button variant="outline" size="sm" onClick={downloadJSON} disabled={!output}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>JSON Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-8">
              {[
                { label: "Total Keys", value: stats.keys },
                { label: "Objects", value: stats.objects },
                { label: "Arrays", value: stats.arrays },
                { label: "Strings", value: stats.strings },
                { label: "Numbers", value: stats.numbers },
                { label: "Booleans", value: stats.booleans },
                { label: "Nulls", value: stats.nulls },
                { label: "Max Depth", value: stats.depth },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-muted-foreground text-xs">{stat.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
