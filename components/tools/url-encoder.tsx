"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, Link2, Trash2, Plus, X } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface URLComponent {
  key: string
  value: string
}

export function URLEncoder() {
  const { toast } = useToast()
  const [mode, setMode] = useState<"encode" | "decode" | "build">("encode")
  const [input, setInput] = useState("")
  const [output, setOutput] = useState("")
  const [error, setError] = useState<string | null>(null)

  // URL Builder state
  const [baseUrl, setBaseUrl] = useState("https://example.com/path")
  const [params, setParams] = useState<URLComponent[]>([
    { key: "search", value: "hello world" },
    { key: "page", value: "1" },
  ])

  useEffect(() => {
    if (mode === "build") return
    setError(null)

    if (!input.trim()) {
      setOutput("")
      return
    }

    try {
      if (mode === "encode") {
        setOutput(encodeURIComponent(input))
      } else {
        setOutput(decodeURIComponent(input))
      }
    } catch {
      setError(mode === "decode" ? "Invalid URL-encoded string" : "Encoding failed")
      setOutput("")
    }
  }, [input, mode])

  // Build URL from components
  useEffect(() => {
    if (mode !== "build") return

    try {
      const url = new URL(baseUrl)
      params.forEach((param) => {
        if (param.key.trim()) {
          url.searchParams.set(param.key, param.value)
        }
      })
      setOutput(url.toString())
      setError(null)
    } catch {
      setError("Invalid base URL")
      setOutput("")
    }
  }, [baseUrl, params, mode])

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "Copied", description: "Content copied to clipboard" })
    } catch {
      toast({ title: "Copy failed", variant: "destructive" })
    }
  }

  const addParam = () => {
    setParams([...params, { key: "", value: "" }])
  }

  const removeParam = (index: number) => {
    setParams(params.filter((_, i) => i !== index))
  }

  const updateParam = (index: number, field: "key" | "value", value: string) => {
    setParams(params.map((p, i) => (i === index ? { ...p, [field]: value } : p)))
  }

  const parseUrl = () => {
    try {
      const url = new URL(input)
      setBaseUrl(url.origin + url.pathname)
      const newParams: URLComponent[] = []
      url.searchParams.forEach((value, key) => {
        newParams.push({ key, value })
      })
      setParams(newParams.length > 0 ? newParams : [{ key: "", value: "" }])
      setMode("build")
    } catch {
      toast({
        title: "Invalid URL",
        description: "Could not parse the URL",
        variant: "destructive",
      })
    }
  }

  const clear = () => {
    setInput("")
    setOutput("")
    setError(null)
    if (mode === "build") {
      setBaseUrl("https://example.com/path")
      setParams([{ key: "", value: "" }])
    }
  }

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Link2}
        title="URL Encoder/Decoder"
        description="Encode, decode, and build URLs with query parameters"
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>URL Tool</CardTitle>
              <CardDescription>Encode/decode URL components or build URLs</CardDescription>
            </div>
            <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              <TabsList>
                <TabsTrigger value="encode">Encode</TabsTrigger>
                <TabsTrigger value="decode">Decode</TabsTrigger>
                <TabsTrigger value="build">Build URL</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode !== "build" ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="input">{mode === "encode" ? "Plain Text" : "URL Encoded"}</Label>
                  <Badge variant="outline">{input.length} chars</Badge>
                </div>
                <Textarea
                  id="input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    mode === "encode"
                      ? "Enter text to URL encode..."
                      : "Enter URL-encoded string..."
                  }
                  className="h-32 resize-none font-mono"
                />
                {mode === "decode" && input.includes("http") && (
                  <Button variant="outline" size="sm" onClick={parseUrl}>
                    Parse URL into Builder
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="output">{mode === "encode" ? "URL Encoded" : "Plain Text"}</Label>
                  <Badge variant="outline">{output.length} chars</Badge>
                </div>
                <Textarea
                  id="output"
                  value={output}
                  readOnly
                  placeholder="Output will appear here..."
                  className="bg-muted/50 h-32 resize-none font-mono"
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
                  <Button variant="outline" size="sm" onClick={clear}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="baseUrl">Base URL</Label>
                <Input
                  id="baseUrl"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://example.com/path"
                  className="font-mono"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Query Parameters</Label>
                  <Button variant="outline" size="sm" onClick={addParam}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Parameter
                  </Button>
                </div>

                <div className="space-y-2">
                  {params.map((param, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={param.key}
                        onChange={(e) => updateParam(index, "key", e.target.value)}
                        placeholder="Key"
                        className="flex-1 font-mono"
                      />
                      <span className="text-muted-foreground">=</span>
                      <Input
                        value={param.value}
                        onChange={(e) => updateParam(index, "value", e.target.value)}
                        placeholder="Value"
                        className="flex-1 font-mono"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeParam(index)}
                        disabled={params.length === 1}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Generated URL</Label>
                <div className="bg-muted/50 rounded-lg border p-3">
                  <p className="font-mono text-sm break-all">{output || "Enter a base URL..."}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(output)}
                    disabled={!output}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy URL
                  </Button>
                  <Button variant="outline" size="sm" onClick={clear}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>URL Encoding Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
            {[
              { char: " ", encoded: "%20 or +" },
              { char: "!", encoded: "%21" },
              { char: "#", encoded: "%23" },
              { char: "$", encoded: "%24" },
              { char: "&", encoded: "%26" },
              { char: "'", encoded: "%27" },
              { char: "(", encoded: "%28" },
              { char: ")", encoded: "%29" },
              { char: "*", encoded: "%2A" },
              { char: "+", encoded: "%2B" },
              { char: "/", encoded: "%2F" },
              { char: "?", encoded: "%3F" },
              { char: "@", encoded: "%40" },
              { char: "=", encoded: "%3D" },
              { char: ":", encoded: "%3A" },
              { char: ";", encoded: "%3B" },
            ].map((item) => (
              <div key={item.char} className="rounded border p-2 text-center">
                <p className="font-mono text-lg">{item.char}</p>
                <p className="text-muted-foreground font-mono text-xs">{item.encoded}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
