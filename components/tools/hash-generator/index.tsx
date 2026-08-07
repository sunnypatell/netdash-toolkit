"use client"

import { Suspense, lazy, useEffect, useMemo, useState } from "react"
import { parseAsStringLiteral, useQueryStates } from "nuqs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Check, Hash, Upload, FileText, ShieldAlert, X } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"
import {
  AVAILABILITY_MESSAGE,
  HASH_ALGORITHMS,
  UNAVAILABLE_ALGORITHMS,
  computeHashes,
  cryptoAvailability,
  encodeText,
  verifyHash,
  type HashResult,
} from "@/lib/hash"

// one chunk per tab: the file reader is not downloaded until the file tab opens
const TextPanel = lazy(() => import("./text").then((m) => ({ default: m.TextPanel })))
const FilePanel = lazy(() => import("./file").then((m) => ({ default: m.FilePanel })))

const MODES = ["text", "file"] as const
type Mode = (typeof MODES)[number]

function PanelFallback() {
  return (
    <p
      className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm"
      data-panel-fallback
    >
      Loading...
    </p>
  )
}

export function HashGenerator() {
  // only the mode goes in the url: the text being hashed is often exactly the
  // secret you would not want in a link or in browser history, and a file
  // cannot be addressed by url at all
  const [{ mode }, setQuery] = useQueryStates(
    { mode: parseAsStringLiteral(MODES).withDefault("text") },
    { history: "replace" }
  )

  const [inputText, setInputText] = useState("")
  const [inputFile, setInputFile] = useState<File | null>(null)
  const [hashes, setHashes] = useState<HashResult[]>([])
  const [verifyInput, setVerifyInput] = useState("")
  const [failure, setFailure] = useState<string | null>(null)

  const availability = useMemo(() => cryptoAvailability(), [])
  const usable = availability === "available"

  useEffect(() => {
    if (!usable) return
    const source = mode === "file" ? inputFile : inputText
    if (!source) {
      setHashes([])
      setFailure(null)
      return
    }

    let cancelled = false
    const run = async () => {
      try {
        // annotated, not inferred: ts 6 will not widen the ArrayBuffer/Uint8Array
        // union to BufferSource on its own
        let bytes: BufferSource
        if (mode === "file" && inputFile) bytes = await inputFile.arrayBuffer()
        else bytes = encodeText(inputText)
        const results = await computeHashes(bytes)
        if (!cancelled) {
          setHashes(results)
          setFailure(null)
        }
      } catch (err) {
        if (!cancelled) {
          setHashes([])
          setFailure(err instanceof Error ? err.message : "Could not read the input")
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [mode, inputText, inputFile, usable])

  const verification = useMemo(() => verifyHash(hashes, verifyInput), [hashes, verifyInput])
  const sourceLabel = mode === "file" ? inputFile?.name : "Text input"

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Hash}
        title="Hash Generator"
        description="Generate and verify SHA-1, SHA-256, SHA-384 and SHA-512 digests in the browser"
      />

      {!usable && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{AVAILABILITY_MESSAGE[availability]}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>Enter text or choose a file to hash</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={mode} onValueChange={(value) => setQuery({ mode: value as Mode })}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="text">
                  <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
                  Text
                </TabsTrigger>
                <TabsTrigger value="file">
                  <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                  File
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-4">
                <Suspense fallback={<PanelFallback />}>
                  <TextPanel
                    value={inputText}
                    onChange={setInputText}
                    disabled={!usable}
                    aria-invalid={Boolean(failure)}
                    aria-describedby={failure ? "hash-generator-input-error" : undefined}
                  />
                </Suspense>
              </TabsContent>

              <TabsContent value="file" className="space-y-4">
                <Suspense fallback={<PanelFallback />}>
                  <FilePanel
                    file={inputFile}
                    onSelect={setInputFile}
                    disabled={!usable}
                    aria-invalid={Boolean(failure)}
                    aria-describedby={failure ? "hash-generator-input-error" : undefined}
                  />
                </Suspense>
              </TabsContent>
            </Tabs>

            {failure && (
              <Alert variant="destructive">
                <AlertDescription id="hash-generator-input-error">{failure}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="hash-verify">Verify Hash (Optional)</Label>
              <Input
                id="hash-verify"
                value={verifyInput}
                onChange={(event) => setVerifyInput(event.target.value)}
                placeholder="Paste a hash to compare..."
                className="font-mono text-sm"
                aria-invalid={verification?.state === "not-a-hash"}
                aria-describedby={verification ? "hash-verify-status" : undefined}
              />
              {verification && (
                <div
                  id="hash-verify-status"
                  className={`flex items-center gap-2 rounded p-2 ${
                    verification.state === "match"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                  }`}
                >
                  {verification.state === "match" ? (
                    <>
                      <Check className="h-4 w-4" aria-hidden="true" />
                      <span className="text-sm font-medium">
                        Matches the {verification.algorithm} digest
                      </span>
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4" aria-hidden="true" />
                      <span className="text-sm font-medium">
                        {verification.state === "not-a-hash"
                          ? "Not a hex digest, so there is nothing to compare"
                          : hashes.length === 0
                            ? "No digest computed yet to compare against"
                            : "Does not match any of the four digests"}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generated Hashes</CardTitle>
            <CardDescription>
              {hashes.length > 0 ? `${sourceLabel} digests` : "Enter text or choose a file"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hashes.length > 0 ? (
              <div className="space-y-3">
                {hashes.map((result) => (
                  <div key={result.algorithm} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{result.algorithm}</Badge>
                        <span className="text-muted-foreground text-xs">{result.bits} bits</span>
                      </div>
                      <CopyButton value={result.hash} />
                    </div>
                    <div className="bg-muted/50 rounded-lg border p-3">
                      <p className="font-mono text-xs break-all select-all">{result.hash}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center">
                <div className="text-center">
                  <Hash
                    className="text-muted-foreground mx-auto mb-4 h-12 w-12"
                    aria-hidden="true"
                  />
                  <p className="text-muted-foreground">Enter text or choose a file</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hash Algorithm Reference</CardTitle>
          <CardDescription>
            These four are the whole of what Web Crypto offers for digests
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {HASH_ALGORITHMS.map((algo) => (
              <div key={algo.name} className="rounded-lg border p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h4 className="font-semibold">{algo.name}</h4>
                  <Badge variant={algo.status === "secure" ? "default" : "destructive"}>
                    {algo.status === "secure" ? "Secure" : "Deprecated"}
                  </Badge>
                </div>
                <p className="text-muted-foreground mb-2 text-sm">{algo.description}</p>
                <p className="text-muted-foreground text-xs">
                  {algo.bits} bits / {algo.hexChars} hex chars
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-2 border-t pt-4">
            <h4 className="text-sm font-semibold">Not available here, and why</h4>
            <ul className="text-muted-foreground space-y-1 text-xs">
              {UNAVAILABLE_ALGORITHMS.map((algo) => (
                <li key={algo.name}>
                  <span className="font-mono font-medium">{algo.name}</span> - {algo.reason}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
