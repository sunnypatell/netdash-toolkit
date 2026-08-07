"use client"

import { useMemo, useState } from "react"
import { parseAsStringLiteral, useQueryStates } from "nuqs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowRight, ArrowLeft, FileCode, Trash2, Download } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"
import { downloadTextFile, dateStamp } from "@/lib/download"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { formatBytes } from "@/lib/format"
import {
  ALPHABET_LABELS,
  decodeBase64,
  detectBase64,
  encodeBase64,
  encodeBytesToBase64,
} from "@/lib/base64"

const MODES = ["encode", "decode"] as const
const ALPHABETS = ["standard", "urlsafe"] as const
type Mode = (typeof MODES)[number]

const SAMPLES = [
  { label: "Hello World", value: "Hello, World!" },
  { label: "Non-ASCII", value: "café 日本語 😀" },
  { label: "JSON Object", value: '{"name":"Ada","age":36}' },
  { label: "Standard Base64", value: "SGVsbG8sIFdvcmxkIQ==" },
  { label: "URL-safe Base64", value: "8J-YgD_Dvw" },
]

export function Base64Encoder() {
  // mode and alphabet go in the url, the payload does not: base64 input is
  // routinely a whole file or a secret, and neither belongs in a shareable link
  const [{ mode, alphabet }, setQuery] = useQueryStates(
    {
      mode: parseAsStringLiteral(MODES).withDefault("encode"),
      alphabet: parseAsStringLiteral(ALPHABETS).withDefault("standard"),
    },
    { history: "replace" }
  )

  const [text, setText] = useState("")
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array } | null>(null)

  // derived, never stored. the old effect wrote the file's base64 into state and
  // was then immediately overwritten by the encoding of the "[File: x]" label it
  // had just put in the input box, so the tool displayed the wrong value.
  const result = useMemo(() => {
    if (mode === "encode" && file) return encodeBytesToBase64(file.bytes, alphabet)
    if (!text.trim()) return { output: "", error: null }
    return mode === "encode" ? encodeBase64(text, alphabet) : decodeBase64(text, alphabet)
  }, [mode, alphabet, text, file])

  const { output, error } = result

  const handleFile = async (chosen: File | null) => {
    if (!chosen) {
      setFile(null)
      return
    }
    const bytes = new Uint8Array(await chosen.arrayBuffer())
    setFile({ name: chosen.name, bytes })
  }

  const swapContent = () => {
    if (!output) return
    setFile(null)
    setText(output)
    void setQuery({ mode: mode === "encode" ? "decode" : "encode" })
  }

  const downloadOutput = () => {
    if (!output) return
    downloadTextFile(
      output,
      `base64-${mode === "encode" ? "encoded" : "decoded"}-${dateStamp()}.txt`
    )
  }

  const clear = () => {
    setText("")
    setFile(null)
  }

  const loadSample = (value: string) => {
    const detected = detectBase64(value)
    setFile(null)
    setText(value)
    void setQuery({
      mode: detected.isBase64 ? "decode" : "encode",
      alphabet: detected.isBase64 ? detected.alphabet : alphabet,
    })
  }

  return (
    <div className="tool-container">
      <ToolHeader
        icon={FileCode}
        title="Base64 Encoder/Decoder"
        description="Encode and decode Base64 text and files, in both RFC 4648 alphabets"
      />

      <Tabs value={mode} onValueChange={(value) => setQuery({ mode: value as Mode })}>
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle>Base64 Converter</CardTitle>
                <CardDescription>Convert between text and Base64 encoding</CardDescription>
              </div>
              <TabsList aria-label="Conversion direction">
                <TabsTrigger value="encode">Encode</TabsTrigger>
                <TabsTrigger value="decode">Decode</TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* one panel keyed to the active mode, so the tab's aria-controls always resolves */}
            <TabsContent value={mode} className="space-y-4">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Alphabet</legend>
                <div className="flex flex-wrap gap-4">
                  {ALPHABETS.map((value) => (
                    <div key={value} className="flex items-center gap-2">
                      <input
                        type="radio"
                        id={`alphabet-${value}`}
                        name="alphabet"
                        value={value}
                        checked={alphabet === value}
                        onChange={() => setQuery({ alphabet: value })}
                        className="accent-primary h-4 w-4"
                      />
                      <Label htmlFor={`alphabet-${value}`} className="cursor-pointer font-normal">
                        {ALPHABET_LABELS[value]}
                      </Label>
                    </div>
                  ))}
                </div>
                <p className="text-muted-foreground text-xs">
                  {alphabet === "standard"
                    ? "Index 62 and 63 are + and /, and the output is padded with =."
                    : "Index 62 and 63 are - and _, and padding is dropped so the value is safe in a URL or a filename."}
                </p>
              </fieldset>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="base64-input">
                      {mode === "encode" ? "Plain Text" : "Base64 String"}
                    </Label>
                    <Badge variant="outline">{text.length} chars</Badge>
                  </div>
                  <Textarea
                    id="base64-input"
                    value={text}
                    onChange={(event) => {
                      setText(event.target.value)
                      setFile(null)
                    }}
                    placeholder={
                      mode === "encode" ? "Enter text to encode..." : "Enter Base64 to decode..."
                    }
                    className="h-48 resize-none font-mono"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "base64-input-error" : undefined}
                  />
                  {mode === "encode" && (
                    <div className="space-y-2">
                      <Label htmlFor="base64-file">Or encode a file</Label>
                      <Input
                        type="file"
                        onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
                        className="cursor-pointer"
                        id="base64-file"
                      />
                      {file && (
                        <p className="text-muted-foreground text-xs">
                          Encoding {file.name} ({formatBytes(file.bytes.length)}). The text box is
                          ignored while a file is selected.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center justify-center gap-4 py-4 lg:py-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={swapContent}
                    disabled={!output}
                    aria-label={
                      mode === "encode"
                        ? "Move output into input and switch to decode"
                        : "Move output into input and switch to encode"
                    }
                  >
                    {mode === "encode" ? (
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>
                </div>

                <div className="space-y-2 lg:col-start-2 lg:row-start-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="base64-output">
                      {mode === "encode" ? "Base64 String" : "Plain Text"}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{output.length} chars</Badge>
                      {output && <CopyButton value={output} />}
                    </div>
                  </div>
                  <Textarea
                    id="base64-output"
                    value={output}
                    readOnly
                    placeholder="Output will appear here..."
                    className="bg-muted/50 h-48 resize-none font-mono"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={downloadOutput} disabled={!output}>
                      <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                      Export
                    </Button>
                    <Button variant="outline" size="sm" onClick={clear}>
                      <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                      Clear
                    </Button>
                  </div>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription id="base64-input-error">{error}</AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sample Inputs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {SAMPLES.map((sample) => (
                <button
                  key={sample.label}
                  onClick={() => loadSample(sample.value)}
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
              Base64 maps every 3 bytes onto 4 ASCII characters. RFC 4648 defines two alphabets:
              section 4 is the standard one, section 5 swaps the last two symbols so the result can
              travel in a URL or a filename.
            </p>
            <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
              <li>Text is encoded as UTF-8 bytes, so non-ASCII round-trips exactly</li>
              <li>Line breaks and spaces in Base64 input are ignored when decoding</li>
              <li>Unpadded URL-safe input is accepted, as RFC 7515 tokens omit the =</li>
            </ul>
            <Alert>
              <AlertDescription className="text-sm">
                Base64 is <strong>not</strong> encryption. It is just an encoding and anyone can
                reverse it. Never use it to hide sensitive data.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
