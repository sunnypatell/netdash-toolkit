"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, Check, Hash, Upload, FileText, Trash2 } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { useToast } from "@/hooks/use-toast"

interface HashResult {
  algorithm: string
  hash: string
  bits: number
}

// Web Crypto API hash function
async function computeHash(data: ArrayBuffer | string, algorithm: string): Promise<string> {
  let buffer: ArrayBuffer

  if (typeof data === "string") {
    buffer = new TextEncoder().encode(data)
  } else {
    buffer = data
  }

  const hashBuffer = await crypto.subtle.digest(algorithm, buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

export function HashGenerator() {
  const { toast } = useToast()
  const [inputText, setInputText] = useState("")
  const [inputFile, setInputFile] = useState<File | null>(null)
  const [hashes, setHashes] = useState<HashResult[]>([])
  const [copied, setCopied] = useState<string | null>(null)
  const [verifyHash, setVerifyHash] = useState("")
  const [verifyResult, setVerifyResult] = useState<boolean | null>(null)
  const [, setLoading] = useState(false)
  const [mode, setMode] = useState<"text" | "file">("text")

  const algorithms = [
    { name: "SHA-256", algo: "SHA-256", bits: 256 },
    { name: "SHA-384", algo: "SHA-384", bits: 384 },
    { name: "SHA-512", algo: "SHA-512", bits: 512 },
    { name: "SHA-1", algo: "SHA-1", bits: 160 },
  ]

  const generateHashes = async () => {
    setLoading(true)
    setHashes([])
    setVerifyResult(null)

    try {
      let data: ArrayBuffer | string

      if (mode === "file" && inputFile) {
        data = await inputFile.arrayBuffer()
      } else if (mode === "text" && inputText) {
        data = inputText
      } else {
        setLoading(false)
        return
      }

      const results: HashResult[] = []

      for (const algo of algorithms) {
        const hash = await computeHash(data, algo.algo)
        results.push({
          algorithm: algo.name,
          hash,
          bits: algo.bits,
        })
      }

      setHashes(results)

      // Check verification if hash provided
      if (verifyHash.trim()) {
        const normalizedVerify = verifyHash.trim().toLowerCase()
        const match = results.some((r) => r.hash.toLowerCase() === normalizedVerify)
        setVerifyResult(match)
      }
    } catch (error) {
      toast({ title: "Hash generation failed", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if ((mode === "text" && inputText) || (mode === "file" && inputFile)) {
      generateHashes()
    } else {
      setHashes([])
    }
  }, [inputText, inputFile, mode])

  useEffect(() => {
    if (verifyHash.trim() && hashes.length > 0) {
      const normalizedVerify = verifyHash.trim().toLowerCase()
      const match = hashes.some((r) => r.hash.toLowerCase() === normalizedVerify)
      setVerifyResult(match)
    } else {
      setVerifyResult(null)
    }
  }, [verifyHash, hashes])

  const copyToClipboard = async (hash: string, algorithm: string) => {
    try {
      await navigator.clipboard.writeText(hash)
      setCopied(algorithm)
      setTimeout(() => setCopied(null), 2000)
      toast({ title: "Copied", description: `${algorithm} hash copied` })
    } catch {
      toast({ title: "Copy failed", variant: "destructive" })
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setInputFile(file)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Hash}
        title="Hash Generator"
        description="Generate and verify cryptographic hashes (SHA-256, SHA-384, SHA-512, SHA-1)"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>Enter text or upload a file to hash</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={mode} onValueChange={(v) => setMode(v as "text" | "file")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="text">
                  <FileText className="mr-2 h-4 w-4" />
                  Text
                </TabsTrigger>
                <TabsTrigger value="file">
                  <Upload className="mr-2 h-4 w-4" />
                  File
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-4">
                <div>
                  <Label htmlFor="text-input">Text to Hash</Label>
                  <Textarea
                    id="text-input"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Enter text to generate hash..."
                    className="h-32 font-mono"
                  />
                </div>
              </TabsContent>

              <TabsContent value="file" className="space-y-4">
                <div>
                  <Label htmlFor="file-input">File to Hash</Label>
                  <Input
                    id="file-input"
                    type="file"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                </div>

                {inputFile && (
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="truncate text-sm font-medium">{inputFile.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatFileSize(inputFile.size)}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setInputFile(null)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="verify">Verify Hash (Optional)</Label>
              <Input
                id="verify"
                value={verifyHash}
                onChange={(e) => setVerifyHash(e.target.value)}
                placeholder="Paste a hash to verify..."
                className="font-mono text-sm"
              />
              {verifyResult !== null && (
                <div
                  className={`flex items-center gap-2 rounded p-2 ${verifyResult ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"}`}
                >
                  {verifyResult ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span className="text-sm font-medium">Hash matches!</span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-medium">Hash does not match</span>
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
              {hashes.length > 0
                ? `${mode === "file" ? inputFile?.name : "Text input"} hashes`
                : "Enter text or upload a file to see hashes"}
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(result.hash, result.algorithm)}
                      >
                        {copied === result.algorithm ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
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
                  <Hash className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                  <p className="text-muted-foreground">Enter text or upload a file</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hash Algorithm Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                name: "SHA-256",
                bits: 256,
                hex: 64,
                desc: "Widely used, recommended for most applications",
                status: "Secure",
              },
              {
                name: "SHA-384",
                bits: 384,
                hex: 96,
                desc: "Truncated SHA-512, good for sensitive applications",
                status: "Secure",
              },
              {
                name: "SHA-512",
                bits: 512,
                hex: 128,
                desc: "Strongest SHA-2 variant, higher security margin",
                status: "Secure",
              },
              {
                name: "SHA-1",
                bits: 160,
                hex: 40,
                desc: "Legacy algorithm, do not use for security",
                status: "Deprecated",
              },
            ].map((algo) => (
              <div key={algo.name} className="rounded-lg border p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="font-semibold">{algo.name}</h4>
                  <Badge variant={algo.status === "Secure" ? "default" : "destructive"}>
                    {algo.status}
                  </Badge>
                </div>
                <p className="text-muted-foreground mb-2 text-sm">{algo.desc}</p>
                <div className="text-muted-foreground text-xs">
                  <p>
                    {algo.bits} bits / {algo.hex} hex chars
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
