// grades security headers against the specs that define them rather than against
// their mere presence. "present" and "doing something" are different claims:
// strict-transport-security: max-age=0 deletes the policy, x-content-type-options:
// sniff does nothing, and a report-only csp enforces nothing - all three used to
// score full marks here.

import { fieldValues, firstFieldValue, type ResponseBlock } from "./http-header-parse"

export type HeaderVerdict = "effective" | "ineffective" | "missing" | "not-scored"

export interface HeaderAssessment {
  name: string
  key: string
  verdict: HeaderVerdict
  // every field line for this name, in the order received
  values: string[]
  weight: number
  // the one sentence that decides the verdict
  detail: string
  // the clause that decides it
  spec: string
  recommendation?: string
  learnMore: string
  // spec-backed observations that do not change the verdict
  notes: string[]
}

export interface HeaderGrade {
  score: number
  grade: string
  assessments: HeaderAssessment[]
  effectiveCount: number
  scoredCount: number
}

interface Evaluation {
  verdict: Exclude<HeaderVerdict, "missing">
  detail: string
  notes?: string[]
}

interface Spec {
  name: string
  key: string
  weight: number
  spec: string
  description: string
  recommendation: string
  learnMore: string
  optional?: boolean
  evaluate: (values: string[]) => Evaluation
}

// rfc 6797 6.1: directive names are case-insensitive and the value may be quoted
function parseDirectives(value: string): Array<{ name: string; value?: string }> {
  return value
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf("=")
      if (eq < 0) return { name: part.toLowerCase() }
      const raw = part.slice(eq + 1).trim()
      const unquoted = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw
      return { name: part.slice(0, eq).trim().toLowerCase(), value: unquoted }
    })
}

const ONE_YEAR = 31536000

function evaluateHsts(values: string[]): Evaluation {
  // rfc 6797 8.1: a ua processes only the first sts header field
  const value = values[0]
  const notes: string[] = []
  if (values.length > 1) {
    notes.push(
      `${values.length} Strict-Transport-Security field lines were sent; a user agent processes only the first and ignores the rest (RFC 6797 §8.1), so only the first is graded.`
    )
  }

  const directives = parseDirectives(value)
  const seen = new Set<string>()
  for (const directive of directives) {
    if (seen.has(directive.name)) {
      return {
        verdict: "ineffective",
        detail: `The "${directive.name}" directive appears more than once, so the whole header field is invalid and a user agent ignores it.`,
        notes,
      }
    }
    seen.add(directive.name)
  }

  const maxAge = directives.find((d) => d.name === "max-age")
  if (!maxAge) {
    return {
      verdict: "ineffective",
      detail:
        "No max-age directive. RFC 6797 §6.1.1 makes max-age REQUIRED, so a user agent ignores this header field entirely and the host is not an HSTS host.",
      notes,
    }
  }
  const seconds = Number(maxAge.value)
  if (!Number.isFinite(seconds) || !/^\d+$/.test(maxAge.value ?? "")) {
    return {
      verdict: "ineffective",
      detail: `max-age="${maxAge.value ?? ""}" is not a number of seconds, so the directive is invalid and the header field is ignored.`,
      notes,
    }
  }
  if (seconds === 0) {
    return {
      verdict: "ineffective",
      detail:
        "max-age=0 signals the user agent to stop treating this host as a Known HSTS Host (RFC 6797 §6.1.1). The header is present and switching HSTS off.",
      notes,
    }
  }

  if (seconds < ONE_YEAR) {
    notes.push(
      `max-age is ${seconds}s. HSTS is in force, but the preload list requires at least ${ONE_YEAR}s (one year).`
    )
  }
  if (!seen.has("includesubdomains")) {
    notes.push(
      "includeSubDomains is absent, so subdomains are not covered (RFC 6797 §6.1.2) and can still be reached over cleartext HTTP."
    )
  }
  return {
    verdict: "effective",
    detail: `HSTS is in force for ${seconds}s${seen.has("includesubdomains") ? " including subdomains" : ""}.`,
    notes,
  }
}

const CSP_REPORTING_DIRECTIVES = new Set(["report-uri", "report-to"])

function cspDirectiveNames(policy: string): string[] {
  return policy
    .split(";")
    .map((part) => part.trim().split(/\s+/)[0]?.toLowerCase() ?? "")
    .filter(Boolean)
}

function evaluateCsp(values: string[]): Evaluation {
  const notes: string[] = []
  if (values.length > 1) {
    notes.push(
      `${values.length} Content-Security-Policy field lines were sent. Each one is a separate policy and all of them are enforced (CSP Level 3 §3.1), so a resource must satisfy every policy.`
    )
  }

  // csp level 3 3.1: the header value is a comma-separated list of policies
  const policies = values
    .flatMap((value) => value.split(","))
    .map((policy) => policy.trim())
    .filter(Boolean)

  if (policies.length === 0) {
    return {
      verdict: "ineffective",
      detail: "The header is present but empty, so it declares no policy and restricts nothing.",
      notes,
    }
  }

  const allDirectives = policies.flatMap(cspDirectiveNames)
  if (allDirectives.length === 0) {
    return {
      verdict: "ineffective",
      detail: "No directives were parsed from the policy, so nothing is restricted.",
      notes,
    }
  }
  if (allDirectives.every((name) => CSP_REPORTING_DIRECTIVES.has(name))) {
    return {
      verdict: "ineffective",
      detail:
        "The policy contains only reporting directives (report-uri/report-to). Reporting directives do not block anything, so this policy enforces nothing.",
      notes,
    }
  }

  const restrictsScript = allDirectives.some((name) =>
    ["default-src", "script-src", "script-src-elem"].includes(name)
  )
  if (!restrictsScript) {
    notes.push(
      "No default-src, script-src or script-src-elem directive. script-src falls back to default-src, and with neither present script loading is unrestricted."
    )
  }

  const scriptSources = policies
    .flatMap((policy) => policy.split(";"))
    .map((directive) => directive.trim())
    .filter((directive) => /^(default-src|script-src|script-src-elem)\b/i.test(directive))
    .join(" ")
    .toLowerCase()

  if (scriptSources.includes("'unsafe-inline'")) {
    const hasNonceOrHash = /'(nonce-|sha(256|384|512)-)/.test(scriptSources)
    notes.push(
      hasNonceOrHash
        ? "'unsafe-inline' appears alongside a nonce or hash, and a user agent that supports nonces ignores 'unsafe-inline' - it is only a fallback for older agents."
        : "'unsafe-inline' is present with no nonce or hash, so inline script executes and the policy does not stop reflected XSS."
    )
  }
  if (scriptSources.includes("*") && !scriptSources.includes("*.")) {
    notes.push("A bare * source in the script source list allows script from any host.")
  }

  return {
    verdict: "effective",
    detail: `${policies.length} enforced ${policies.length === 1 ? "policy" : "policies"} with ${new Set(allDirectives).size} distinct directives.`,
    notes,
  }
}

function evaluateFrameOptions(values: string[]): Evaluation {
  const notes: string[] = []
  if (values.length > 1) {
    return {
      verdict: "ineffective",
      detail: `${values.length} X-Frame-Options field lines were sent. RFC 7034 §2.1 allows exactly one value, and browsers treat a conflicting or repeated field as invalid.`,
      notes,
    }
  }
  const value = values[0].trim()
  const upper = value.toUpperCase()
  if (upper === "DENY" || upper === "SAMEORIGIN") {
    notes.push(
      "X-Frame-Options is superseded by the CSP frame-ancestors directive, which is what current browsers consult first."
    )
    return { verdict: "effective", detail: `Framing is restricted by ${upper}.`, notes }
  }
  if (upper.startsWith("ALLOW-FROM")) {
    return {
      verdict: "ineffective",
      detail:
        "ALLOW-FROM was specified in RFC 7034 §2.1 but was never implemented by Chromium or WebKit and was removed from Firefox, so this header restricts nothing. Use CSP frame-ancestors.",
      notes,
    }
  }
  return {
    verdict: "ineffective",
    detail: `"${value}" is not a valid X-Frame-Options value. RFC 7034 §2.1 allows only DENY or SAMEORIGIN, so this is ignored.`,
    notes,
  }
}

function evaluateContentTypeOptions(values: string[]): Evaluation {
  // fetch standard, "determine nosniff": true only when the first extracted value
  // is an ascii case-insensitive match for "nosniff"
  const first = values[0].split(",")[0].trim().toLowerCase()
  if (first === "nosniff") {
    return { verdict: "effective", detail: "MIME sniffing is disabled." }
  }
  return {
    verdict: "ineffective",
    detail: `"${values[0]}" is not "nosniff". The Fetch Standard's "determine nosniff" step matches only the exact value nosniff, so anything else leaves MIME sniffing enabled.`,
  }
}

// referrer policy, "referrer policy" token list
const REFERRER_POLICIES = [
  "",
  "no-referrer",
  "no-referrer-when-downgrade",
  "same-origin",
  "origin",
  "strict-origin",
  "origin-when-cross-origin",
  "strict-origin-when-cross-origin",
  "unsafe-url",
]

const LEAKY_REFERRER_POLICIES = new Set([
  "unsafe-url",
  "origin-when-cross-origin",
  "no-referrer-when-downgrade",
])

export function effectiveReferrerPolicy(values: string[]): string | null {
  // the referrer policy spec parses the header as a comma/space separated token
  // list and keeps the last token it recognises, so a trailing modern value
  // overrides an older fallback in front of it
  let policy: string | null = null
  for (const value of values) {
    for (const token of value.split(/[\s,]+/)) {
      const candidate = token.trim().toLowerCase()
      if (candidate && REFERRER_POLICIES.includes(candidate)) policy = candidate
    }
  }
  return policy
}

function evaluateReferrerPolicy(values: string[]): Evaluation {
  const policy = effectiveReferrerPolicy(values)
  if (!policy) {
    return {
      verdict: "ineffective",
      detail: `No token in "${values.join(", ")}" is a referrer policy, so the header is ignored and the browser default applies.`,
    }
  }
  const notes: string[] = []
  const tokens = values.flatMap((v) => v.split(/[\s,]+/)).filter(Boolean)
  if (tokens.length > 1) {
    notes.push(
      `${tokens.length} tokens were sent; the last recognised one wins, so the policy in force is "${policy}".`
    )
  }
  if (LEAKY_REFERRER_POLICIES.has(policy)) {
    notes.push(
      `"${policy}" still sends referrer information across origins. strict-origin-when-cross-origin sends only the origin.`
    )
  }
  return { verdict: "effective", detail: `Referrer policy in force: ${policy}.`, notes }
}

function evaluatePermissionsPolicy(values: string[]): Evaluation {
  // permissions policy: the value is an rfc 8941 structured field dictionary of
  // feature=allowlist entries
  const entries = values
    .flatMap((value) => value.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean)
  if (entries.length === 0) {
    return {
      verdict: "ineffective",
      detail: "The header is present but empty, so it constrains no feature.",
    }
  }
  const malformed = entries.filter((entry) => !entry.includes("="))
  if (malformed.length === entries.length) {
    return {
      verdict: "ineffective",
      detail: `No entry has the feature=allowlist form required by the structured-field dictionary syntax (RFC 8941), so the header is discarded.`,
    }
  }
  const notes =
    malformed.length > 0
      ? [
          `${malformed.length} entries are not feature=allowlist pairs and are dropped by the parser.`,
        ]
      : []
  return {
    verdict: "effective",
    detail: `${entries.length - malformed.length} features constrained.`,
    notes,
  }
}

function evaluateOpenerPolicy(values: string[]): Evaluation {
  const value = values[0].split(";")[0].trim().toLowerCase()
  if (value === "same-origin" || value === "same-origin-allow-popups") {
    return { verdict: "effective", detail: `Browsing context isolated with ${value}.` }
  }
  if (value === "unsafe-none") {
    return {
      verdict: "ineffective",
      detail:
        "unsafe-none is the default the browser already applies, so sending it isolates nothing.",
    }
  }
  return {
    verdict: "ineffective",
    detail: `"${values[0]}" is not one of unsafe-none, same-origin-allow-popups or same-origin, so it is ignored and the unsafe-none default applies.`,
  }
}

function evaluateXssProtection(values: string[]): Evaluation {
  const value = values[0].trim().toLowerCase()
  if (value.startsWith("0")) {
    return {
      verdict: "not-scored",
      detail: "0 disables the legacy XSS filter, which is the current recommendation.",
    }
  }
  return {
    verdict: "not-scored",
    detail:
      "The legacy XSS filter is removed from Chromium and was never in Firefox. It introduced its own vulnerabilities, so its value is not graded either way. Content-Security-Policy is the replacement.",
  }
}

export const SECURITY_HEADER_SPECS: Spec[] = [
  {
    name: "Content-Security-Policy",
    key: "content-security-policy",
    weight: 25,
    spec: "CSP Level 3 §3.1",
    description: "Controls which resources the page may load, which is what stops injected script",
    recommendation: "Start from default-src 'self' and add only what the app needs",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP",
    evaluate: evaluateCsp,
  },
  {
    name: "Strict-Transport-Security",
    key: "strict-transport-security",
    weight: 20,
    spec: "RFC 6797 §6.1",
    description: "Makes the browser refuse cleartext HTTP to this host for max-age seconds",
    recommendation: "Add: Strict-Transport-Security: max-age=31536000; includeSubDomains",
    learnMore:
      "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security",
    evaluate: evaluateHsts,
  },
  {
    name: "X-Frame-Options",
    key: "x-frame-options",
    weight: 15,
    spec: "RFC 7034 §2.1",
    description: "Legacy clickjacking control; CSP frame-ancestors supersedes it",
    recommendation: "Add: X-Frame-Options: DENY, and a CSP frame-ancestors directive",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options",
    evaluate: evaluateFrameOptions,
  },
  {
    name: "X-Content-Type-Options",
    key: "x-content-type-options",
    weight: 10,
    spec: 'Fetch Standard, "determine nosniff"',
    description: "Stops the browser second-guessing a declared Content-Type",
    recommendation: "Add: X-Content-Type-Options: nosniff",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options",
    evaluate: evaluateContentTypeOptions,
  },
  {
    name: "Referrer-Policy",
    key: "referrer-policy",
    weight: 10,
    spec: "Referrer Policy, header parsing",
    description: "Controls how much of the current URL is sent to other origins",
    recommendation: "Add: Referrer-Policy: strict-origin-when-cross-origin",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy",
    evaluate: evaluateReferrerPolicy,
  },
  {
    name: "Permissions-Policy",
    key: "permissions-policy",
    weight: 10,
    spec: "Permissions Policy, RFC 8941 dictionary",
    description: "Turns off browser features the page does not use",
    recommendation: "Add: Permissions-Policy: geolocation=(), camera=(), microphone=()",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy",
    evaluate: evaluatePermissionsPolicy,
  },
  {
    name: "Cross-Origin-Opener-Policy",
    key: "cross-origin-opener-policy",
    weight: 10,
    spec: "HTML, cross-origin opener policy",
    description: "Severs the window reference between this document and other origins",
    recommendation: "Add: Cross-Origin-Opener-Policy: same-origin",
    learnMore:
      "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy",
    evaluate: evaluateOpenerPolicy,
  },
  {
    name: "X-XSS-Protection",
    key: "x-xss-protection",
    weight: 0,
    optional: true,
    spec: "removed from browsers, not graded",
    description: "Legacy XSS filter. Its absence is not a finding",
    recommendation: "No action needed. Use Content-Security-Policy instead",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-XSS-Protection",
    evaluate: evaluateXssProtection,
  },
]

export function assessBlock(block: ResponseBlock): HeaderAssessment[] {
  return SECURITY_HEADER_SPECS.map((spec) => {
    const values = fieldValues(block, spec.key)
    const base = {
      name: spec.name,
      key: spec.key,
      values,
      weight: spec.weight,
      spec: spec.spec,
      learnMore: spec.learnMore,
    }
    if (values.length === 0) {
      return {
        ...base,
        verdict: spec.optional ? ("not-scored" as const) : ("missing" as const),
        detail: spec.description,
        recommendation: spec.recommendation,
        notes: [],
      }
    }
    const evaluation = spec.evaluate(values)
    return {
      ...base,
      verdict: evaluation.verdict,
      detail: evaluation.detail,
      recommendation: evaluation.verdict === "effective" ? undefined : spec.recommendation,
      notes: evaluation.notes ?? [],
    }
  })
}

export function gradeBlock(block: ResponseBlock): HeaderGrade {
  const assessments = assessBlock(block)
  let score = 0
  let maxScore = 0
  for (const assessment of assessments) {
    if (assessment.weight === 0) continue
    maxScore += assessment.weight
    // only a header that actually does something earns its weight
    if (assessment.verdict === "effective") score += assessment.weight
  }
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  let grade = "F"
  if (percentage >= 90) grade = "A+"
  else if (percentage >= 80) grade = "A"
  else if (percentage >= 70) grade = "B"
  else if (percentage >= 60) grade = "C"
  else if (percentage >= 50) grade = "D"

  const scored = assessments.filter((a) => a.weight > 0)
  return {
    score: percentage,
    grade,
    assessments,
    effectiveCount: scored.filter((a) => a.verdict === "effective").length,
    scoredCount: scored.length,
  }
}

// rfc 6797 8.1: hsts delivered over cleartext http is ignored outright, so a
// grade taken from an http response overstates what the browser will honour
export function hstsIsHonoured(block: ResponseBlock, url: string): boolean {
  if (!firstFieldValue(block, "strict-transport-security")) return true
  try {
    return new URL(url).protocol === "https:"
  } catch {
    return true
  }
}
