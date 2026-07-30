import { firstFieldValue, type ResponseBlock } from "./http-header-parse"

export interface RedirectHop {
  url: string
  status: number
  statusText: string
  location?: string
  resolved?: string
}

export interface RedirectChain {
  originalUrl: string
  finalUrl: string
  hops: RedirectHop[]
  // true when the last block was still a redirect, so the destination is unknown
  truncated: boolean
  isHttpsUpgrade: boolean
  warnings: string[]
}

// rfc 9110 15.4: the redirection statuses that carry a Location a client follows.
// 304 is in the 3xx range but is a cache validator, not a redirect (15.4.5), and
// 305/306 are deprecated and unused.
const REDIRECT_STATUSES = new Set([300, 301, 302, 303, 307, 308])

// rfc 9110 15.4.2 / 15.4.3: for 301 and 302 clients historically rewrite a POST
// to GET, and 15.4.4 makes that mandatory for 303
const METHOD_REWRITING_STATUSES = new Set([301, 302, 303])

// rfc 3986 3.1: the scheme is case-insensitive, so "HTTP://x" is the http scheme.
// comparing with startsWith("http://") missed that and reported an upgrade that
// had not happened.
function schemeOf(url: string): string {
  try {
    return new URL(url).protocol.replace(":", "").toLowerCase()
  } catch {
    return ""
  }
}

export function buildRedirectChain(blocks: ResponseBlock[], startUrl: string): RedirectChain {
  const hops: RedirectHop[] = []
  const warnings: string[] = []
  const seen = new Set<string>()
  let currentUrl = startUrl
  let loopReported = false

  for (const block of blocks) {
    const location = firstFieldValue(block, "location")
    const isRedirect = REDIRECT_STATUSES.has(block.status) && !!location

    let resolved: string | undefined
    if (isRedirect && location) {
      try {
        // rfc 9110 10.2.2: Location is a URI-reference, so it resolves against
        // the target uri. covers absolute, path-relative, protocol-relative
        // //host/path and bare relative forms in one step.
        resolved = new URL(location, currentUrl).href
      } catch {
        warnings.push(`Hop ${hops.length + 1} sent an unparsable Location: ${location}`)
      }
    }
    if (block.status === 304 && location) {
      warnings.push(
        "A 304 Not Modified carried a Location header. 304 is a cache validator, not a redirect (RFC 9110 §15.4.5), so the chain stops here."
      )
    }

    hops.push({
      url: currentUrl,
      status: block.status,
      statusText: block.statusText,
      location: location ?? undefined,
      resolved,
    })
    seen.add(currentUrl)

    if (!resolved) break

    if (schemeOf(currentUrl) === "https" && schemeOf(resolved) === "http") {
      warnings.push(`Downgrade at hop ${hops.length}: HTTPS redirected to HTTP (${resolved})`)
    }
    if (METHOD_REWRITING_STATUSES.has(block.status)) {
      warnings.push(
        `Hop ${hops.length} answered ${block.status}, so a client rewrites a POST to GET and drops the body (RFC 9110 §15.4). Use 307 or 308 to preserve the method.`
      )
    }
    if (seen.has(resolved)) {
      if (!loopReported) {
        warnings.push(`Redirect loop: ${resolved} appears twice in the chain`)
        loopReported = true
      }
      // stop rather than walk the loop again and report it once per pass
      hops[hops.length - 1].resolved = resolved
      break
    }

    currentUrl = resolved
  }

  const last = hops[hops.length - 1]
  const truncated = !!last && REDIRECT_STATUSES.has(last.status) && !!last.location
  if (truncated) {
    warnings.push(
      "The chain still had a redirect when the trace stopped, so the destination shown is not final"
    )
  }
  if (last && last.status >= 400) {
    warnings.push(`The chain ends on an error: ${last.status} ${last.statusText}`.trim())
  }

  const finalUrl = last?.url ?? startUrl
  return {
    originalUrl: startUrl,
    finalUrl,
    hops,
    truncated,
    isHttpsUpgrade: schemeOf(startUrl) === "http" && schemeOf(finalUrl) === "https",
    warnings,
  }
}
