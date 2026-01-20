"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, ArrowRight, ArrowLeft, FileCode, Trash2, Upload, Download } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"

export function Base64Encoder() {
  const { toast } = useToast()
  const [input, setInput] = useState("")
  const [output, setOutput] = useState("")
  const [mode, setMode] = useState<"encode" | "decode">("encode")
  const [error, setError] = useState<string | null>(null)
  const [fileInput, setFileInput] = useState<File | null>(null)

  useEffect(() => {
    setError(null)

    if (!input.trim() && !fileInput) {
      setOutput("")
      return
    }

    try {
      if (mode === "encode") {
        // Handle text encoding
        const encoded = btoa(unescape(encodeURIComponent(input)))
        setOutput(encoded)
      } else {
        // Handle decoding
        const decoded = decodeURIComponent(escape(atob(input)))
        setOutput(decoded)
      }
    } catch {
      setError(mode === "decode" ? "Invalid Base64 string" : "Encoding failed")
      setOutput("")
    }
  }, [input, mode, fileInput])

  const handleFileEncode = async (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      // Remove data URL prefix
      const base64Data = base64.split(",")[1]
      setOutput(base64Data)
      setInput(`[File: ${file.name}]`)
    }
    reader.readAsDataURL(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFileInput(file)
      handleFileEncode(file)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "Copied", description: "Content copied to clipboard" })
    } catch {
      toast({ title: "Copy failed", variant: "destructive" })
    }
  }

  const swapContent = () => {
    setInput(output)
    setMode(mode === "encode" ? "decode" : "encode")
  }

  const downloadOutput = () => {
    if (!output) return
    const blob = new Blob([output], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = mode === "encode" ? "encoded.txt" : "decoded.txt"
    a.click()
    URL.revokeObjectURL(url)
  }

  const clear = () => {
    setInput("")
    setOutput("")
    setFileInput(null)
    setError(null)
  }

  return (
    <div className="tool-container">
      <ToolHeader
        icon={FileCode}
        title="Base64 Encoder/Decoder"
        description="Encode and decode Base64 strings and files"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Base64 Converter</CardTitle>
              <CardDescription>Convert between text and Base64 encoding</CardDescription>
            </div>
            <Tabs value={mode} onValueChange={(v) => setMode(v as "encode" | "decode")}>
              <TabsList>
                <TabsTrigger value="encode">Encode</TabsTrigger>
                <TabsTrigger value="decode">Decode</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="input">{mode === "encode" ? "Plain Text" : "Base64 String"}</Label>
                <Badge variant="outline">{input.length} chars</Badge>
              </div>
              <Textarea
                id="input"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  setFileInput(null)
                }}
                placeholder={
                  mode === "encode" ? "Enter text to encode..." : "Enter Base64 to decode..."
                }
                className="h-48 resize-none font-mono"
              />
              {mode === "encode" && (
                <div className="flex gap-2">
                  <Input
                    type="file"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                    id="file-upload"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col items-center justify-center gap-4 py-4 lg:py-0">
              <Button variant="outline" size="sm" onClick={swapContent} disabled={!output}>
                {mode === "encode" ? (
                  <ArrowRight className="h-4 w-4" />
                ) : (
                  <ArrowLeft className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="space-y-2 lg:col-start-2 lg:row-start-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="output">{mode === "encode" ? "Base64 String" : "Plain Text"}</Label>
                <Badge variant="outline">{output.length} chars</Badge>
              </div>
              <Textarea
                id="output"
                value={output}
                readOnly
                placeholder="Output will appear here..."
                className="bg-muted/50 h-48 resize-none font-mono"
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
                <Button variant="outline" size="sm" onClick={downloadOutput} disabled={!output}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
                <Button variant="outline" size="sm" onClick={clear}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear
                </Button>
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sample Inputs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { label: "Hello World", value: "Hello, World!" },
                { label: "JSON Object", value: '{"name":"John","age":30}' },
                { label: "URL", value: "https://example.com/path?query=value" },
                { label: "Base64 Sample", value: "SGVsbG8sIFdvcmxkIQ==" },
              ].map((sample, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(sample.value)
                    setMode(sample.value.match(/^[A-Za-z0-9+/]+=*$/) ? "decode" : "encode")
                  }}
                  className="hover:bg-muted/50 w-full rounded border p-2 text-left transition-colors"
                >
                  <p className="text-sm font-medium">{sample.label}</p>
                  <p className="text-muted-foreground truncate font-mono text-xs">{sample.value}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>About Base64</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Base64 is a binary-to-text encoding scheme that represents binary data in ASCII string
              format. It's commonly used for:
            </p>
            <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
              <li>Encoding binary data in JSON/XML</li>
              <li>Data URLs for images in HTML/CSS</li>
              <li>Email attachments (MIME)</li>
              <li>Basic authentication headers</li>
              <li>Storing complex data in URLs</li>
            </ul>
            <Alert>
              <AlertDescription className="text-sm">
                Base64 is <strong>not</strong> encryption. It's just encoding and can be easily
                decoded by anyone. Never use Base64 to hide sensitive data.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
