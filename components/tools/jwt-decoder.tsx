"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Copy, Key, CheckCircle2, XCircle, AlertTriangle, Clock } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface JWTHeader {
  alg: string
  typ: string
  [key: string]: unknown
}

interface JWTPayload {
  iss?: string
  sub?: string
  aud?: string | string[]
  exp?: number
  nbf?: number
  iat?: number
  jti?: string
  [key: string]: unknown
}

interface DecodedJWT {
  header: JWTHeader
  payload: JWTPayload
  signature: string
  isExpired: boolean
  expiresAt?: Date
  issuedAt?: Date
  notBefore?: Date
}

function decodeBase64Url(str: string): string {
  // Add padding if needed
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/")
  while (base64.length % 4) {
    base64 += "="
  }
  return decodeURIComponent(escape(atob(base64)))
}

function decodeJWT(token: string): DecodedJWT | null {
  try {
    const parts = token.trim().split(".")
    if (parts.length !== 3) return null

    const header = JSON.parse(decodeBase64Url(parts[0]))
    const payload = JSON.parse(decodeBase64Url(parts[1]))
    const signature = parts[2]

    const now = Date.now() / 1000
    const isExpired = payload.exp ? payload.exp < now : false

    return {
      header,
      payload,
      signature,
      isExpired,
      expiresAt: payload.exp ? new Date(payload.exp * 1000) : undefined,
      issuedAt: payload.iat ? new Date(payload.iat * 1000) : undefined,
      notBefore: payload.nbf ? new Date(payload.nbf * 1000) : undefined,
    }
  } catch {
    return null
  }
}

export function JWTDecoder() {
  const { toast } = useToast()
  const [token, setToken] = useState("")
  const [decoded, setDecoded] = useState<DecodedJWT | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token.trim()) {
      setDecoded(null)
      setError(null)
      return
    }

    const result = decodeJWT(token)
    if (result) {
      setDecoded(result)
      setError(null)
    } else {
      setDecoded(null)
      setError("Invalid JWT format. Make sure it has three parts separated by dots.")
    }
  }, [token])

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "Copied", description: `${label} copied to clipboard` })
    } catch {
      toast({ title: "Copy failed", variant: "destructive" })
    }
  }

  const loadSample = () => {
    // Sample JWT (expired, for demo purposes)
    setToken(
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE3MDAwMDAwMDAsInJvbGUiOiJhZG1pbiIsImVtYWlsIjoiam9obkBleGFtcGxlLmNvbSJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
    )
  }

  const formatDate = (date: Date) => {
    return date.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "medium",
    })
  }

  const getTimeRemaining = (exp: Date) => {
    const now = new Date()
    const diff = exp.getTime() - now.getTime()

    if (diff < 0) return "Expired"

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (days > 0) return `${days}d ${hours}h remaining`
    if (hours > 0) return `${hours}h ${minutes}m remaining`
    return `${minutes}m remaining`
  }

  return (
    <div className="tool-container">
      <ToolHeader icon={Key} title="JWT Decoder" description="Decode and inspect JSON Web Tokens" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  JWT Token
                  {decoded &&
                    (decoded.isExpired ? (
                      <XCircle className="h-5 w-5 text-red-500" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ))}
                </CardTitle>
                <CardDescription>Paste a JWT to decode it</CardDescription>
              </div>
              {decoded && (
                <Badge variant={decoded.isExpired ? "destructive" : "default"}>
                  {decoded.isExpired ? "Expired" : "Valid"}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="h-32 resize-none font-mono text-sm"
            />

            {error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={loadSample}>
                Load Sample
              </Button>
              <Button variant="outline" size="sm" onClick={() => setToken("")}>
                Clear
              </Button>
            </div>

            {decoded?.expiresAt && (
              <div
                className={`rounded-lg p-3 ${decoded.isExpired ? "bg-red-100 dark:bg-red-900/30" : "bg-green-100 dark:bg-green-900/30"}`}
              >
                <div className="flex items-center gap-2">
                  <Clock
                    className={`h-4 w-4 ${decoded.isExpired ? "text-red-600" : "text-green-600"}`}
                  />
                  <span
                    className={`text-sm font-medium ${decoded.isExpired ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}
                  >
                    {getTimeRemaining(decoded.expiresAt)}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  Expires: {formatDate(decoded.expiresAt)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {decoded ? (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Header</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(JSON.stringify(decoded.header, null, 2), "Header")
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <pre className="overflow-x-auto font-mono text-sm">
                      {JSON.stringify(decoded.header, null, 2)}
                    </pre>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="secondary">Algorithm: {decoded.header.alg}</Badge>
                    <Badge variant="secondary">Type: {decoded.header.typ}</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Payload</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(JSON.stringify(decoded.payload, null, 2), "Payload")
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <pre className="overflow-x-auto font-mono text-sm">
                      {JSON.stringify(decoded.payload, null, 2)}
                    </pre>
                  </div>

                  <div className="mt-3 space-y-2">
                    {decoded.payload.iss && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Issuer:</span>{" "}
                        <span className="font-mono">{decoded.payload.iss}</span>
                      </div>
                    )}
                    {decoded.payload.sub && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Subject:</span>{" "}
                        <span className="font-mono">{decoded.payload.sub}</span>
                      </div>
                    )}
                    {decoded.issuedAt && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Issued At:</span>{" "}
                        <span className="font-mono">{formatDate(decoded.issuedAt)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Signature</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="font-mono text-sm break-all">{decoded.signature}</p>
                  </div>
                  <Alert className="mt-3">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      This tool only decodes the token. It does not verify the signature. Never
                      trust a JWT without server-side validation.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex h-64 items-center justify-center">
                <div className="text-center">
                  <Key className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                  <p className="text-muted-foreground">Paste a JWT token to decode it</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Common JWT Claims</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[
              { claim: "iss", name: "Issuer", desc: "Who created the token" },
              { claim: "sub", name: "Subject", desc: "The user the token represents" },
              { claim: "aud", name: "Audience", desc: "Intended recipient(s)" },
              { claim: "exp", name: "Expiration", desc: "When the token expires" },
              { claim: "nbf", name: "Not Before", desc: "Token not valid before this time" },
              { claim: "iat", name: "Issued At", desc: "When the token was created" },
              { claim: "jti", name: "JWT ID", desc: "Unique identifier for the token" },
            ].map((item) => (
              <div key={item.claim} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    {item.claim}
                  </Badge>
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
