// email authentication record parsing: MX (RFC 5321/7505), SPF (RFC 7208),
// DKIM (RFC 6376), DMARC (RFC 7489). Lookups go over DNS-over-HTTPS.

import { isValidCIDR, isValidIPv4, isValidIPv6, parsePrefixText } from "@/lib/network-utils"

export const DNS_TYPE = { A: 1, CNAME: 5, MX: 15, TXT: 16 } as const

// resolvers are tried in order; the second one is why a blocked or failing
// provider does not turn into "no record found"
export const DOH_RESOLVERS = [
  "https://cloudflare-dns.com/dns-query",
  "https://dns.google/resolve",
] as const

export interface DnsAnswer {
  name: string
  type: number
  TTL: number
  data: string
}

export interface DnsResponse {
  // dns rcode: 0 NoError, 3 NXDomain
  status: number
  answers: DnsAnswer[]
  // set when every resolver failed, so callers can say "unknown" not "missing"
  error?: string
  resolver?: string
}

export interface DnsOptions {
  resolvers?: readonly string[]
  fetchImpl?: typeof fetch
}

export async function queryDns(
  name: string,
  type: keyof typeof DNS_TYPE,
  options: DnsOptions = {}
): Promise<DnsResponse> {
  const resolvers = options.resolvers ?? DOH_RESOLVERS
  const doFetch = options.fetchImpl ?? fetch
  let lastError = "no resolver available"

  for (const resolver of resolvers) {
    try {
      const url = `${resolver}?name=${encodeURIComponent(name)}&type=${type}`
      const response = await doFetch(url, { headers: { Accept: "application/dns-json" } })
      if (!response.ok) {
        lastError = `${resolver} returned HTTP ${response.status}`
        continue
      }
      const body = (await response.json()) as { Status?: number; Answer?: DnsAnswer[] }
      return {
        status: typeof body.Status === "number" ? body.Status : 0,
        answers: body.Answer ?? [],
        resolver,
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : `${resolver} failed`
    }
  }

  return { status: -1, answers: [], error: lastError }
}

// rfc 1035 splits long txt records into 255-octet strings; rfc 7208 section 3.3
// says concatenate them with nothing in between
export function joinTxtStrings(data: string): string {
  const quoted = data.match(/"(?:\\.|[^"\\])*"/g)
  if (!quoted) return data.trim()
  return quoted.map((chunk) => chunk.slice(1, -1).replace(/\\"/g, '"')).join("")
}

function txtRecords(response: DnsResponse): string[] {
  return response.answers
    .filter((answer) => answer.type === DNS_TYPE.TXT)
    .map((answer) => joinTxtStrings(answer.data))
}

const failureOf = (response: DnsResponse): string | null => {
  if (response.error) return `DNS lookup failed (${response.error})`
  if (response.status === 3) return "Domain does not exist (NXDOMAIN)"
  if (response.status !== 0) return `DNS lookup returned status ${response.status}`
  return null
}

export function cleanDomain(input: string): string {
  let clean = input.trim().toLowerCase()
  clean = clean.replace(/^https?:\/\//, "")
  clean = clean.replace(/^www\./, "")
  clean = clean.split("/")[0]
  if (clean.includes("@")) {
    clean = clean.split("@")[1] ?? ""
  }
  clean = clean.split(":")[0]
  return clean.replace(/\.$/, "")
}

export function looksLikeDomain(value: string): boolean {
  return /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
    value
  )
}

export interface MXRecord {
  priority: number
  exchange: string
  ttl: number
}

export interface MXResult {
  records: MXRecord[]
  // rfc 7505: "0 ." means the domain accepts no mail at all
  nullMx: boolean
  lookupFailed: boolean
  errors: string[]
  warnings: string[]
}

export function analyzeMx(response: DnsResponse): MXResult {
  const failure = failureOf(response)
  if (failure) {
    return {
      records: [],
      nullMx: false,
      lookupFailed: !!response.error,
      errors: [failure],
      warnings: [],
    }
  }

  const errors: string[] = []
  const warnings: string[] = []
  const raw = response.answers
    .filter((answer) => answer.type === DNS_TYPE.MX)
    .map((answer) => {
      const parts = answer.data.trim().split(/\s+/)
      return {
        priority: Number.parseInt(parts[0], 10),
        exchange: (parts[1] ?? "").replace(/\.$/, ""),
        ttl: answer.TTL,
      }
    })

  const nullMx = raw.length === 1 && raw[0].exchange === "" && raw[0].priority === 0

  if (nullMx) {
    errors.push("Domain publishes a null MX (RFC 7505) and accepts no mail")
  }

  for (const record of raw) {
    if (Number.isNaN(record.priority)) {
      warnings.push(`MX record "${record.exchange}" has an unreadable preference value`)
    }
    if (isValidIPv4(record.exchange) || isValidIPv6(record.exchange)) {
      warnings.push(
        `MX target ${record.exchange} is an IP address; RFC 5321 section 5.1 requires a hostname`
      )
    }
  }

  return {
    records: nullMx ? [] : raw.sort((a, b) => a.priority - b.priority),
    nullMx,
    lookupFailed: false,
    errors,
    warnings,
  }
}

export type SPFQualifier = "+" | "-" | "~" | "?"

export interface SPFTerm {
  raw: string
  qualifier: SPFQualifier
  name: string
  value?: string
  isModifier: boolean
}

export interface SPFResult {
  found: boolean
  record: string | null
  valid: boolean
  terms: SPFTerm[]
  mechanisms: string[]
  includes: string[]
  all: string | null
  // rfc 7208 section 4.6.4 caps dns-querying terms at 10, without recursion
  lookupCount: number
  lookupFailed: boolean
  errors: string[]
  warnings: string[]
}

const SPF_MECHANISMS = ["all", "include", "a", "mx", "ptr", "ip4", "ip6", "exists"]
// each of these costs one dns lookup; ip4/ip6/all cost none
const SPF_LOOKUP_MECHANISMS = ["include", "a", "mx", "ptr", "exists"]

const isSpfIp4 = (value: string): boolean =>
  value.includes("/") ? isValidCIDR(value) : isValidIPv4(value)

const isSpfIp6 = (value: string): boolean => {
  if (!value.includes("/")) return isValidIPv6(value)
  const [address, prefix] = value.split("/")
  return isValidIPv6(address) && parsePrefixText(prefix, 128) !== null
}

const isSpfRecord = (record: string): boolean => /^v=spf1(\s|$)/i.test(record.trim())

export function parseSpfTerm(token: string): SPFTerm {
  const modifier = token.match(/^([a-z][a-z0-9_.-]*)=(.*)$/i)
  if (modifier && !SPF_MECHANISMS.includes(modifier[1].toLowerCase())) {
    return {
      raw: token,
      qualifier: "+",
      name: modifier[1].toLowerCase(),
      value: modifier[2],
      isModifier: true,
    }
  }

  let rest = token
  let qualifier: SPFQualifier = "+"
  if (/^[+\-~?]/.test(rest)) {
    qualifier = rest[0] as SPFQualifier
    rest = rest.slice(1)
  }

  const separator = rest.search(/[:/]/)
  const name = (separator === -1 ? rest : rest.slice(0, separator)).toLowerCase()
  const value = separator === -1 ? undefined : rest.slice(separator + 1)

  return { raw: token, qualifier, name, value, isModifier: false }
}

export function analyzeSpf(response: DnsResponse): SPFResult {
  const empty = (errors: string[], lookupFailed = false): SPFResult => ({
    found: false,
    record: null,
    valid: false,
    terms: [],
    mechanisms: [],
    includes: [],
    all: null,
    lookupCount: 0,
    lookupFailed,
    errors,
    warnings: [],
  })

  const failure = failureOf(response)
  if (failure) return empty([failure], !!response.error)

  const candidates = txtRecords(response).filter(isSpfRecord)
  if (candidates.length === 0) return empty(["No SPF record found"])

  const record = candidates[0]
  const errors: string[] = []
  const warnings: string[] = []

  if (candidates.length > 1) {
    errors.push(
      `${candidates.length} SPF records published; RFC 7208 section 4.5 requires exactly one, so evaluation fails with permerror`
    )
  }

  const tokens = record.trim().split(/\s+/).slice(1)
  const terms = tokens.map(parseSpfTerm)
  const mechanisms: string[] = []
  const includes: string[] = []
  let all: string | null = null
  let lookupCount = 0
  let sawAll = false
  let redirect: SPFTerm | undefined
  let unreachable = 0

  for (const term of terms) {
    if (sawAll && !term.isModifier) {
      unreachable += 1
    }

    if (term.isModifier) {
      if (term.name === "redirect") {
        redirect = term
        lookupCount += 1
        mechanisms.push(term.raw)
      } else if (term.name !== "exp") {
        // rfc 7208 section 6: unknown modifiers are ignored, not an error
        warnings.push(`Unknown modifier "${term.name}" is ignored by receivers`)
      }
      continue
    }

    if (!SPF_MECHANISMS.includes(term.name)) {
      errors.push(`Unknown mechanism "${term.raw}" makes the record a permerror`)
      continue
    }

    if (term.name === "all") {
      sawAll = true
      all = `${term.qualifier}all`
      continue
    }

    mechanisms.push(term.raw)

    if (SPF_LOOKUP_MECHANISMS.includes(term.name)) {
      lookupCount += 1
    }

    if (term.name === "include") {
      if (!term.value) {
        errors.push('An "include" mechanism requires a domain')
      } else {
        includes.push(term.value)
      }
    }

    if (term.name === "ip4" && (!term.value || !isSpfIp4(term.value))) {
      errors.push(`"${term.raw}" is not a valid IPv4 address or CIDR block`)
    }

    if (term.name === "ip6" && (!term.value || !isSpfIp6(term.value))) {
      errors.push(`"${term.raw}" is not a valid IPv6 address or prefix`)
    }

    if (term.name === "ptr") {
      warnings.push("The ptr mechanism is slow and unreliable; RFC 7208 section 5.5 discourages it")
    }
  }

  if (all === "+all") {
    errors.push("Using +all allows any server to send mail - highly insecure!")
  } else if (all === "~all") {
    warnings.push("Using ~all (softfail) - consider using -all for stricter policy")
  } else if (all === "?all") {
    warnings.push("Using ?all (neutral) provides no protection")
  } else if (!all && !redirect) {
    warnings.push("No all mechanism and no redirect: unmatched senders get a neutral result")
  }

  if (all && redirect) {
    warnings.push("A redirect modifier is ignored when the record also has an all mechanism")
  }

  if (unreachable > 0) {
    warnings.push(`${unreachable} term(s) appear after all and will never be evaluated`)
  }

  if (lookupCount > 10) {
    errors.push(
      `${lookupCount} DNS-querying terms exceed the limit of 10 in RFC 7208 section 4.6.4; evaluation fails with permerror`
    )
  } else if (lookupCount === 10) {
    warnings.push("At the RFC 7208 limit of 10 DNS-querying terms; nested includes add more")
  }

  if (record.length > 255) {
    warnings.push(
      "Record is longer than 255 characters, so it must be published as multiple DNS strings"
    )
  }

  return {
    found: true,
    record,
    valid: errors.length === 0,
    terms,
    mechanisms,
    includes,
    all,
    lookupCount,
    lookupFailed: false,
    errors,
    warnings,
  }
}

export interface DKIMResult {
  found: boolean
  selector: string
  record: string | null
  valid: boolean
  keyType: string | null
  publicKey: string | null
  // t=y means the domain is still testing; failures must not be enforced
  testing: boolean
  errors: string[]
  warnings: string[]
}

// tag values contain "=" (base64 padding), so split on the first one only
export function parseTagList(record: string): Map<string, string> {
  const tags = new Map<string, string>()
  for (const part of record.split(";")) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const index = trimmed.indexOf("=")
    if (index === -1) continue
    tags.set(trimmed.slice(0, index).trim().toLowerCase(), trimmed.slice(index + 1).trim())
  }
  return tags
}

export function analyzeDkim(selector: string, response: DnsResponse): DKIMResult | null {
  const failure = failureOf(response)
  if (failure || response.answers.length === 0) return null

  const records = txtRecords(response)
  if (records.length === 0) {
    // a selector that is only a cname is a valid setup; the resolver flattens it,
    // so nothing but a cname means the target has no txt record
    const cname = response.answers.find((answer) => answer.type === DNS_TYPE.CNAME)
    if (!cname) return null
    return {
      found: true,
      selector,
      record: null,
      valid: false,
      keyType: null,
      publicKey: null,
      testing: false,
      errors: [`Selector is a CNAME to ${cname.data.replace(/\.$/, "")} with no DKIM TXT record`],
      warnings: [],
    }
  }

  const record = records[0]
  const errors: string[] = []
  const warnings: string[] = []
  const tags = parseTagList(record)

  if (records.length > 1) {
    warnings.push(`${records.length} TXT records at this selector; only the first is shown`)
  }

  const version = tags.get("v")
  if (!version) {
    errors.push("Missing v=DKIM1 version tag")
  } else if (version !== "DKIM1") {
    errors.push(`Version tag is "v=${version}"; RFC 6376 section 3.6.1 requires v=DKIM1`)
  } else if (!/^\s*v\s*=/i.test(record)) {
    errors.push("The v tag must be the first tag in the record (RFC 6376 section 3.6.1)")
  }

  const publicKey = tags.get("p") ?? null
  if (publicKey === null) {
    errors.push("Missing required p (public key) tag")
  } else if (publicKey === "") {
    errors.push("Empty public key - DKIM is revoked")
  } else if (!/^[A-Za-z0-9+/=\s]+$/.test(publicKey)) {
    errors.push("Public key is not valid base64")
  }

  const keyType = tags.get("k") ?? "rsa"
  if (!["rsa", "ed25519"].includes(keyType.toLowerCase())) {
    warnings.push(`Unrecognized key type "k=${keyType}"`)
  }

  const flags = tags.get("t")
  const testing = !!flags && flags.split(":").includes("y")
  if (testing) {
    warnings.push("t=y marks this key as testing, so receivers must not enforce failures")
  }

  const service = tags.get("s")
  if (service && !service.split(":").some((s) => s === "*" || s === "email")) {
    warnings.push(`Service type "s=${service}" excludes email`)
  }

  const hashes = tags.get("h")
  if (hashes && !hashes.split(":").includes("sha256")) {
    warnings.push("Only SHA-1 is offered; RFC 8301 deprecates it in favour of SHA-256")
  }

  return {
    found: true,
    selector,
    record,
    valid: errors.length === 0,
    keyType,
    publicKey,
    testing,
    errors,
    warnings,
  }
}

export type DMARCPolicy = "none" | "quarantine" | "reject"
export type DMARCAlignment = "r" | "s"

export interface DMARCResult {
  found: boolean
  record: string | null
  valid: boolean
  policy: DMARCPolicy | null
  subdomainPolicy: DMARCPolicy | null
  // sp defaults to p, so subdomains are never unprotected by omission
  effectiveSubdomainPolicy: DMARCPolicy | null
  percentage: number
  dkimAlignment: DMARCAlignment
  spfAlignment: DMARCAlignment
  rua: string[]
  ruf: string[]
  lookupFailed: boolean
  errors: string[]
  warnings: string[]
}

const DMARC_POLICIES: DMARCPolicy[] = ["none", "quarantine", "reject"]
const isDmarcRecord = (record: string): boolean => /^v=dmarc1\s*(;|$)/i.test(record.trim())

// "mailto:dmarc@example.com!10m" is one uri with a report size limit
export function parseDmarcUri(uri: string): { address: string; scheme: string; limit?: string } {
  const trimmed = uri.trim()
  const [target, limit] = trimmed.split("!")
  const schemeMatch = target.match(/^([a-z][a-z0-9+.-]*):/i)
  const scheme = schemeMatch ? schemeMatch[1].toLowerCase() : ""
  const address = schemeMatch ? target.slice(schemeMatch[0].length) : target
  return { address, scheme, limit }
}

export function analyzeDmarc(response: DnsResponse): DMARCResult {
  const empty = (errors: string[], lookupFailed = false): DMARCResult => ({
    found: false,
    record: null,
    valid: false,
    policy: null,
    subdomainPolicy: null,
    effectiveSubdomainPolicy: null,
    percentage: 100,
    dkimAlignment: "r",
    spfAlignment: "r",
    rua: [],
    ruf: [],
    lookupFailed,
    errors,
    warnings: [],
  })

  const failure = failureOf(response)
  if (failure) return empty([failure], !!response.error)

  const candidates = txtRecords(response).filter(isDmarcRecord)
  if (candidates.length === 0) return empty(["No DMARC record found"])

  const record = candidates[0]
  const errors: string[] = []
  const warnings: string[] = []

  if (candidates.length > 1) {
    errors.push(
      `${candidates.length} DMARC records published; RFC 7489 section 6.6.3 says receivers apply no DMARC processing at all`
    )
  }

  const tags = parseTagList(record)

  const readPolicy = (tag: "p" | "sp"): DMARCPolicy | null => {
    const value = tags.get(tag)
    if (value === undefined) return null
    const normalized = value.toLowerCase() as DMARCPolicy
    if (!DMARC_POLICIES.includes(normalized)) {
      errors.push(`Invalid ${tag}=${value}; RFC 7489 allows none, quarantine, or reject`)
      return null
    }
    return normalized
  }

  const policy = readPolicy("p")
  const subdomainPolicy = readPolicy("sp")

  if (!tags.has("p")) {
    errors.push("Missing required 'p' (policy) tag")
  }

  if (policy === "none") {
    warnings.push("Policy is 'none' - emails failing authentication are not rejected")
  }

  const effectiveSubdomainPolicy = subdomainPolicy ?? policy
  if (subdomainPolicy === "none" && policy && policy !== "none") {
    warnings.push(`sp=none leaves subdomains unprotected even though p=${policy}`)
  }

  let percentage = 100
  const pct = tags.get("pct")
  if (pct !== undefined) {
    const parsed = Number.parseInt(pct, 10)
    if (!/^\d+$/.test(pct) || parsed < 0 || parsed > 100) {
      errors.push(`Invalid pct=${pct}; RFC 7489 requires an integer between 0 and 100`)
    } else {
      percentage = parsed
      if (parsed === 0) {
        warnings.push("pct=0 applies the policy to no mail at all, so it is monitoring only")
      } else if (parsed < 100) {
        warnings.push(`Only ${parsed}% of emails are subject to DMARC policy`)
      }
    }
  }

  const alignment = (tag: "adkim" | "aspf"): DMARCAlignment => {
    const value = tags.get(tag)?.toLowerCase()
    if (value === undefined) return "r"
    if (value !== "r" && value !== "s") {
      warnings.push(`Invalid ${tag}=${value}; expected r (relaxed) or s (strict)`)
      return "r"
    }
    return value
  }

  const readUris = (tag: "rua" | "ruf"): string[] => {
    const value = tags.get(tag)
    if (!value) return []
    return value
      .split(",")
      .map((uri) => parseDmarcUri(uri))
      .filter((parsed) => {
        if (!parsed.address) return false
        if (parsed.scheme !== "mailto" && parsed.scheme !== "https") {
          warnings.push(`Unsupported ${tag} scheme "${parsed.scheme || "none"}"`)
          return false
        }
        return true
      })
      .map((parsed) =>
        parsed.scheme === "mailto" ? parsed.address : `${parsed.scheme}:${parsed.address}`
      )
  }

  const rua = readUris("rua")
  const ruf = readUris("ruf")

  if (rua.length === 0) {
    warnings.push("No aggregate report (rua) address configured")
  }

  return {
    found: true,
    record,
    valid: errors.length === 0,
    policy,
    subdomainPolicy,
    effectiveSubdomainPolicy,
    percentage,
    dkimAlignment: alignment("adkim"),
    spfAlignment: alignment("aspf"),
    rua,
    ruf,
    lookupFailed: false,
    errors,
    warnings,
  }
}

export interface EmailDiagnosticResult {
  domain: string
  mx: MXResult
  spf: SPFResult
  dkim: DKIMResult[]
  dmarc: DMARCResult
  overallScore: number
  // true when at least one lookup failed, so the score is based on partial data
  incomplete: boolean
  timestamp: Date
}

export function scoreEmailAuth(result: Omit<EmailDiagnosticResult, "overallScore">): number {
  let score = 0

  if (result.mx.records.length > 0) score += 20

  if (result.spf.found) {
    score += 10
    if (result.spf.valid) score += 10
    if (result.spf.all === "-all") score += 10
    else if (result.spf.all === "~all") score += 5
  }

  const enforcedDkim = result.dkim.filter((d) => d.valid && !d.testing)
  if (result.dkim.length > 0) {
    score += 15
    if (enforcedDkim.length > 0) score += 15
  }

  if (result.dmarc.found) {
    score += 5
    if (result.dmarc.valid) score += 5
    // pct=0 means nothing is enforced, whatever p says
    const enforced = result.dmarc.percentage > 0 ? result.dmarc.policy : "none"
    if (enforced === "reject") score += 10
    else if (enforced === "quarantine") score += 7
    else if (enforced === "none") score += 3
  }

  return Math.min(score, 100)
}

export const COMMON_DKIM_SELECTORS = [
  "default",
  "google",
  "selector1",
  "selector2",
  "k1",
  "k2",
  "mail",
  "dkim",
  "s1",
  "s2",
  "email",
  "smtp",
  "mandrill",
  "mxvault",
  "everlytickey1",
  "everlytickey2",
  "zendesk1",
  "zendesk2",
]

export interface DiagnosticsOptions extends DnsOptions {
  selectors?: string[]
  onProgress?: (message: string) => void
}

export async function runEmailDiagnostics(
  domain: string,
  options: DiagnosticsOptions = {}
): Promise<EmailDiagnosticResult> {
  const { selectors = COMMON_DKIM_SELECTORS, onProgress, ...dns } = options

  onProgress?.("Checking MX records...")
  const mx = analyzeMx(await queryDns(domain, "MX", dns))

  onProgress?.("Checking SPF record...")
  const spf = analyzeSpf(await queryDns(domain, "TXT", dns))

  onProgress?.("Checking DKIM records...")
  const dkimResponses = await Promise.all(
    selectors.map(async (selector) => ({
      selector,
      response: await queryDns(`${selector}._domainkey.${domain}`, "TXT", dns),
    }))
  )
  const dkim = dkimResponses
    .map(({ selector, response }) => analyzeDkim(selector, response))
    .filter((entry): entry is DKIMResult => entry !== null)

  onProgress?.("Checking DMARC record...")
  const dmarc = analyzeDmarc(await queryDns(`_dmarc.${domain}`, "TXT", dns))

  const partial = {
    domain,
    mx,
    spf,
    dkim,
    dmarc,
    incomplete:
      mx.lookupFailed ||
      spf.lookupFailed ||
      dmarc.lookupFailed ||
      dkimResponses.some(({ response }) => !!response.error),
    timestamp: new Date(),
  }

  return { ...partial, overallScore: scoreEmailAuth(partial) }
}
