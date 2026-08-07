// jose parses; the local diagnostics only turn its one coarse throw into an accurate message.
// nothing here verifies a signature, so every label talks about time claims, never validity.

import { decodeJwt, decodeProtectedHeader } from "jose"

export type JwtErrorCode = "empty" | "jwe" | "parts" | "base64" | "json" | "not-object" | "unknown"

export interface JwtError {
  code: JwtErrorCode
  message: string
}

export type TimeClaimState = "expired" | "not-yet-valid" | "active" | "no-time-claims"

export interface JwtTimeClaims {
  state: TimeClaimState
  expiresAt: Date | null
  notBefore: Date | null
  issuedAt: Date | null
  // ms until exp; negative once past. null when the claim is absent or unusable
  msUntilExpiry: number | null
  msUntilValid: number | null
  // claims present but not a finite number (exp: "123") - worth surfacing
  malformed: string[]
}

export interface DecodedJwt {
  header: Record<string, unknown>
  payload: Record<string, unknown>
  signature: string
  alg: string | null
  algIsNone: boolean
  typ: string | null
  kid: string | null
  crit: string[] | null
  audience: string[]
  jwtId: string | null
  time: JwtTimeClaims
}

export type JwtInspection = { ok: true; jwt: DecodedJwt } | { ok: false; error: JwtError }

const B64URL_RE = /^[A-Za-z0-9_-]+$/

export function base64UrlToUtf8(segment: string): string {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/")
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes)
}

function jsonTypeName(value: unknown): string {
  if (value === null) return "null"
  if (Array.isArray(value)) return "an array"
  if (typeof value === "string") return "a string"
  if (typeof value === "number") return `the number ${value}`
  if (typeof value === "boolean") return `the boolean ${value}`
  return typeof value
}

// classifies why a segment is unusable, in the order a human would check
function diagnoseSegment(segment: string, label: "header" | "payload"): JwtError | null {
  if (!segment) {
    return { code: "base64", message: `The ${label} segment is empty.` }
  }
  if (!B64URL_RE.test(segment)) {
    return {
      code: "base64",
      message: `The ${label} segment is not base64url. Allowed characters are A-Z, a-z, 0-9, "-" and "_" (no "+", "/" or "=").`,
    }
  }
  let text: string
  try {
    text = base64UrlToUtf8(segment)
  } catch {
    return { code: "base64", message: `The ${label} segment could not be base64url-decoded.` }
  }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (e) {
    const detail = e instanceof Error ? e.message : "unknown parse error"
    return {
      code: "json",
      message: `The ${label} segment decoded but is not valid JSON: ${detail}`,
    }
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      code: "not-object",
      message: `The ${label} must be a JSON object, but it decoded to ${jsonTypeName(value)}.`,
    }
  }
  return null
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

export function readTimeClaims(payload: Record<string, unknown>, now: number): JwtTimeClaims {
  const malformed: string[] = []
  for (const claim of ["exp", "nbf", "iat"] as const) {
    if (claim in payload && finiteNumber(payload[claim]) === null) malformed.push(claim)
  }

  const exp = finiteNumber(payload.exp)
  const nbf = finiteNumber(payload.nbf)
  const iat = finiteNumber(payload.iat)

  const msUntilExpiry = exp === null ? null : exp * 1000 - now
  const msUntilValid = nbf === null ? null : nbf * 1000 - now

  let state: TimeClaimState = "no-time-claims"
  if (msUntilExpiry !== null && msUntilExpiry <= 0) state = "expired"
  else if (msUntilValid !== null && msUntilValid > 0) state = "not-yet-valid"
  else if (msUntilExpiry !== null || msUntilValid !== null) state = "active"

  return {
    state,
    expiresAt: exp === null ? null : new Date(exp * 1000),
    notBefore: nbf === null ? null : new Date(nbf * 1000),
    issuedAt: iat === null ? null : new Date(iat * 1000),
    msUntilExpiry,
    msUntilValid,
    malformed,
  }
}

function normalizeAudience(aud: unknown): string[] {
  if (typeof aud === "string") return [aud]
  if (Array.isArray(aud)) return aud.filter((a): a is string => typeof a === "string")
  return []
}

export function inspectJwt(token: string, now: number = Date.now()): JwtInspection {
  const trimmed = token.trim()
  if (!trimmed) return { ok: false, error: { code: "empty", message: "No token supplied." } }

  const parts = trimmed.split(".")

  if (parts.length === 5) {
    return {
      ok: false,
      error: {
        code: "jwe",
        message:
          "This is a JWE (5 segments), not a signed JWS. Encrypted tokens cannot be read without the decryption key, so there is nothing to display.",
      },
    }
  }
  if (parts.length !== 3) {
    return {
      ok: false,
      error: {
        code: "parts",
        message: `A compact JWS has 3 dot-separated segments; this has ${parts.length}.`,
      },
    }
  }

  const problem = diagnoseSegment(parts[0], "header") ?? diagnoseSegment(parts[1], "payload")
  if (problem) return { ok: false, error: problem }

  let header: Record<string, unknown>
  let payload: Record<string, unknown>
  try {
    header = decodeProtectedHeader(trimmed) as Record<string, unknown>
    payload = decodeJwt(trimmed) as Record<string, unknown>
  } catch (e) {
    return {
      ok: false,
      error: { code: "unknown", message: e instanceof Error ? e.message : "Could not decode." },
    }
  }

  const alg = typeof header.alg === "string" ? header.alg : null
  const crit = Array.isArray(header.crit)
    ? header.crit.filter((c): c is string => typeof c === "string")
    : null

  return {
    ok: true,
    jwt: {
      header,
      payload,
      signature: parts[2],
      alg,
      algIsNone: alg !== null && alg.toLowerCase() === "none",
      typ: typeof header.typ === "string" ? header.typ : null,
      kid: typeof header.kid === "string" ? header.kid : null,
      crit: crit && crit.length > 0 ? crit : null,
      audience: normalizeAudience(payload.aud),
      jwtId: typeof payload.jti === "string" ? payload.jti : null,
      time: readTimeClaims(payload, now),
    },
  }
}

// d/h/m/s, never drops the seconds field - a token with 40s left must not read "0m"
export function formatTokenLifetime(ms: number): string {
  const total = Math.floor(Math.abs(ms) / 1000)
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60

  const parts: string[] = []
  if (days) parts.push(`${days}d`)
  if (days || hours) parts.push(`${hours}h`)
  if (days || hours || minutes) parts.push(`${minutes}m`)
  parts.push(`${seconds}s`)
  return parts.join(" ")
}

export function timeClaimLabel(time: JwtTimeClaims): string {
  switch (time.state) {
    case "expired":
      return `Expired ${formatTokenLifetime(time.msUntilExpiry ?? 0)} ago`
    case "not-yet-valid":
      return `Not valid for another ${formatTokenLifetime(time.msUntilValid ?? 0)}`
    case "active":
      return time.msUntilExpiry === null
        ? "Within its nbf window (no exp)"
        : `Within time window - expires in ${formatTokenLifetime(time.msUntilExpiry)}`
    case "no-time-claims":
      return "No exp or nbf claim - no expiry to check"
  }
}
