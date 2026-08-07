"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Key,
  XCircle,
  AlertTriangle,
  Clock,
  ShieldAlert,
  ShieldQuestion,
  Pause,
  Play,
} from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { inspectJwt, timeClaimLabel, type DecodedJwt } from "@/lib/jwt-decode"

const REGISTERED_CLAIMS = ["iss", "sub", "aud", "exp", "nbf", "iat", "jti"]

function formatDate(date: Date) {
  return date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "medium" })
}

function timeToneClasses(state: DecodedJwt["time"]["state"]) {
  switch (state) {
    case "expired":
      return {
        box: "bg-red-100 dark:bg-red-900/30",
        icon: "text-red-600",
        text: "text-red-700 dark:text-red-400",
      }
    case "not-yet-valid":
      return {
        box: "bg-amber-100 dark:bg-amber-900/30",
        icon: "text-amber-600",
        text: "text-amber-700 dark:text-amber-400",
      }
    case "active":
      return {
        box: "bg-green-100 dark:bg-green-900/30",
        icon: "text-green-600",
        text: "text-green-700 dark:text-green-400",
      }
    default:
      return {
        box: "bg-muted/50",
        icon: "text-muted-foreground",
        text: "text-muted-foreground",
      }
  }
}

export function JWTDecoder() {
  const [token, setToken] = useState("")
  // ticks the countdown; without it the remaining time froze at paste time
  const [now, setNow] = useState(() => Date.now())

  const result = useMemo(() => inspectJwt(token, now), [token, now])
  const decoded = result.ok ? result.jwt : null
  const error = !result.ok && result.error.code !== "empty" ? result.error : null
  const hasTimeClaim = decoded !== null && decoded.time.state !== "no-time-claims"

  // sc 2.2.2: the countdown updates indefinitely, so it needs a stop
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (!hasTimeClaim || paused) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [hasTimeClaim, paused])

  const loadSample = () => {
    setToken(
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE3MDAwMDAwMDAsInJvbGUiOiJhZG1pbiIsImVtYWlsIjoiam9obkBleGFtcGxlLmNvbSJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
    )
  }

  const customClaims = decoded
    ? Object.keys(decoded.payload).filter((k) => !REGISTERED_CLAIMS.includes(k))
    : []

  const tone = decoded ? timeToneClasses(decoded.time.state) : null

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Key}
        title="JWT Decoder"
        description="Decode a JSON Web Token and inspect its claims - decoding only, no signature verification"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>JWT Token</CardTitle>
                <CardDescription>Paste a compact JWS to decode it</CardDescription>
              </div>
              {decoded && (
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className="gap-1">
                    <ShieldQuestion className="h-3 w-3" />
                    Signature not verified
                  </Badge>
                  <Badge
                    variant={
                      decoded.time.state === "expired"
                        ? "destructive"
                        : decoded.time.state === "active"
                          ? "default"
                          : "secondary"
                    }
                  >
                    {decoded.time.state === "expired"
                      ? "Expired"
                      : decoded.time.state === "not-yet-valid"
                        ? "Not yet valid"
                        : decoded.time.state === "active"
                          ? "Within time window"
                          : "No time claims"}
                  </Badge>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="h-32 resize-none font-mono text-sm"
              aria-label="JWT token"
              aria-invalid={error !== null}
              aria-describedby={error ? "jwt-token-error" : undefined}
            />

            {error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription id="jwt-token-error">{error.message}</AlertDescription>
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

            {decoded && tone && (
              <div className={`rounded-lg p-3 ${tone.box}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className={`h-4 w-4 ${tone.icon}`} />
                    <span className={`text-sm font-medium ${tone.text}`}>
                      {timeClaimLabel(decoded.time)}
                    </span>
                  </div>
                  {hasTimeClaim && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPaused((v) => !v)}
                      aria-pressed={paused}
                    >
                      {paused ? (
                        <Play className="mr-1 h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Pause className="mr-1 h-4 w-4" aria-hidden="true" />
                      )}
                      {paused ? "Resume countdown" : "Pause countdown"}
                    </Button>
                  )}
                </div>
                <div className="text-muted-foreground mt-1 space-y-0.5 text-xs">
                  {decoded.time.notBefore && (
                    <p>Not before (nbf): {formatDate(decoded.time.notBefore)}</p>
                  )}
                  {decoded.time.expiresAt && (
                    <p>Expires (exp): {formatDate(decoded.time.expiresAt)}</p>
                  )}
                  {decoded.time.issuedAt && (
                    <p>Issued at (iat): {formatDate(decoded.time.issuedAt)}</p>
                  )}
                  {decoded.time.state === "no-time-claims" && (
                    <p>
                      This token carries no exp and no nbf, so it never expires on its own. Only the
                      issuer can revoke it.
                    </p>
                  )}
                </div>
                {decoded.time.malformed.length > 0 && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    Ignored non-numeric time claim(s): {decoded.time.malformed.join(", ")}
                  </p>
                )}
              </div>
            )}

            {decoded?.algIsNone && (
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertDescription>
                  <strong>alg: &quot;none&quot;</strong> - this token is unsigned. Anyone can forge
                  one. Servers must reject &quot;none&quot; outright rather than treat it as a valid
                  algorithm.
                </AlertDescription>
              </Alert>
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
                    <CopyButton value={JSON.stringify(decoded.header, null, 2)} size="sm" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <pre className="overflow-x-auto font-mono text-sm">
                      {JSON.stringify(decoded.header, null, 2)}
                    </pre>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant={decoded.algIsNone ? "destructive" : "secondary"}>
                      alg: {decoded.alg ?? "missing"}
                    </Badge>
                    <Badge variant="secondary">typ: {decoded.typ ?? "absent"}</Badge>
                    {decoded.kid && <Badge variant="outline">kid: {decoded.kid}</Badge>}
                    {decoded.crit && (
                      <Badge variant="outline">crit: {decoded.crit.join(", ")}</Badge>
                    )}
                  </div>
                  {decoded.alg === null && (
                    <p className="text-muted-foreground mt-2 text-xs">
                      No alg in the header. A compliant JWS always declares one.
                    </p>
                  )}
                  {(decoded.kid || decoded.crit) && (
                    <p className="text-muted-foreground mt-2 text-xs">
                      {decoded.kid && `kid selects which key of the issuer's set signed this. `}
                      {decoded.crit &&
                        `crit lists extensions a verifier must understand or reject. `}
                      Both are only meaningful against alg {decoded.alg ?? "(missing)"}.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Payload</CardTitle>
                    <CopyButton value={JSON.stringify(decoded.payload, null, 2)} size="sm" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <pre className="overflow-x-auto font-mono text-sm">
                      {JSON.stringify(decoded.payload, null, 2)}
                    </pre>
                  </div>

                  <div className="mt-3 space-y-2">
                    {typeof decoded.payload.iss === "string" && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Issuer (iss):</span>{" "}
                        <span className="font-mono">{decoded.payload.iss}</span>
                      </div>
                    )}
                    {typeof decoded.payload.sub === "string" && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Subject (sub):</span>{" "}
                        <span className="font-mono">{decoded.payload.sub}</span>
                      </div>
                    )}
                    {decoded.audience.length > 0 && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Audience (aud):</span>{" "}
                        <span className="font-mono">{decoded.audience.join(", ")}</span>
                      </div>
                    )}
                    {decoded.jwtId && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">JWT ID (jti):</span>{" "}
                        <span className="font-mono">{decoded.jwtId}</span>
                      </div>
                    )}
                    {decoded.time.issuedAt && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Issued At (iat):</span>{" "}
                        <span className="font-mono">{formatDate(decoded.time.issuedAt)}</span>
                      </div>
                    )}
                    {decoded.time.notBefore && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Not Before (nbf):</span>{" "}
                        <span className="font-mono">{formatDate(decoded.time.notBefore)}</span>
                      </div>
                    )}
                    {decoded.time.expiresAt && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Expires (exp):</span>{" "}
                        <span className="font-mono">{formatDate(decoded.time.expiresAt)}</span>
                      </div>
                    )}
                    {customClaims.length > 0 && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Custom claims:</span>{" "}
                        <span className="font-mono">{customClaims.join(", ")}</span>
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
                    <p className="font-mono text-sm break-all">
                      {decoded.signature || "(empty - unsigned token)"}
                    </p>
                  </div>
                  <Alert className="mt-3">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      This tool decodes only. It has no key, so it cannot and does not check the
                      signature - a decoded token is never proof of anything. The status above
                      describes the exp/nbf claims, not authenticity.
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
              { claim: "alg", name: "Algorithm", desc: "Header: how the token was signed" },
              { claim: "kid", name: "Key ID", desc: "Header: which signing key was used" },
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
