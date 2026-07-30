import { parseResponseBlocks, type ResponseBlock } from "./http-header-parse"

// verified by curl: this endpoint sends "access-control-allow-origin: *" and
// returns the target's real status line and headers, one block per redirect hop.
// it is the only way a page can see a cross-origin Location or Set-Cookie at all.
// it is also an unaffiliated relay that can add, drop or rewrite anything, so
// every caller labels its output unverified.
export const RELAY_HOST = "api.hackertarget.com"
const RELAY_ENDPOINT = "https://api.hackertarget.com/httpheaders/"

export interface RelayResponse {
  raw: string
  blocks: ResponseBlock[]
}

export function normalizeTargetUrl(input: string, defaultScheme: "http" | "https"): string {
  const trimmed = input.trim()
  if (!trimmed) return ""
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  // anything that is not http or https cannot be probed at all, so do not
  // silently rewrite it into something that looks probeable
  if (/^[a-z][a-z\d+\-.]*:/i.test(trimmed)) return trimmed
  return `${defaultScheme}://${trimmed}`
}

export function isProbeableUrl(url: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(url).protocol)
  } catch {
    return false
  }
}

export async function fetchRelayHeaders(
  target: string,
  signal?: AbortSignal
): Promise<RelayResponse> {
  const res = await fetch(`${RELAY_ENDPOINT}?q=${encodeURIComponent(target)}`, { signal })
  if (!res.ok) throw new Error(`Relay returned HTTP ${res.status}`)
  const raw = await res.text()
  if (!/^HTTP\//im.test(raw)) {
    // the relay answers plain text on bad input and on daily quota exhaustion
    throw new Error(`Relay could not fetch that URL: ${raw.trim().slice(0, 160)}`)
  }
  const blocks = parseResponseBlocks(raw)
  if (blocks.length === 0) throw new Error("Relay returned no parsable headers")
  return { raw, blocks }
}
