// rdap response handling. rfc 9083 defines the json, rfc 9224 defines the
// bootstrap that says which server is authoritative for a given name, and rfc
// 8056 registers the epp-derived status values registries actually send.

export type LookupType = "domain" | "ip" | "asn"

export interface RDAPEntity {
  handle?: string
  roles?: string[]
  vcardArray?: [string, Array<[string, Record<string, unknown>, string, string | string[]]>]
  entities?: RDAPEntity[]
  remarks?: Array<{ title?: string; description?: string[] }>
}

export interface RDAPNameserver {
  ldhName: string
  ipAddresses?: { v4?: string[]; v6?: string[] }
}

export interface RDAPEvent {
  eventAction: string
  eventDate: string
}

export interface RDAPLink {
  rel?: string
  href?: string
  value?: string
}

export interface RDAPDomainResponse {
  objectClassName?: string
  handle?: string
  ldhName: string
  unicodeName?: string
  status?: string[]
  events?: RDAPEvent[]
  entities?: RDAPEntity[]
  nameservers?: RDAPNameserver[]
  secureDNS?: { delegationSigned?: boolean; zoneSigned?: boolean }
  links?: RDAPLink[]
  notices?: Array<{ title?: string; description?: string[] }>
  redacted?: Array<{
    name?: { type?: string; description?: string }
    reason?: { description?: string }
  }>
}

export interface RDAPIPResponse {
  objectClassName?: string
  handle?: string
  startAddress?: string
  endAddress?: string
  ipVersion?: string
  name?: string
  type?: string
  country?: string
  parentHandle?: string
  status?: string[]
  events?: RDAPEvent[]
  entities?: RDAPEntity[]
  cidr0_cidrs?: Array<{ v4prefix?: string; v6prefix?: string; length: number }>
  links?: RDAPLink[]
}

export interface RDAPASNResponse {
  objectClassName?: string
  handle?: string
  startAutnum?: number
  endAutnum?: number
  name?: string
  type?: string
  country?: string
  status?: string[]
  events?: RDAPEvent[]
  entities?: RDAPEntity[]
  links?: RDAPLink[]
}

export interface ParsedContact {
  handle?: string
  name?: string
  organization?: string
  emails: string[]
  phones: string[]
  address?: string
  roles: string[]
  // how deep in the entity tree this contact was found (rfc 9083 5.1)
  depth: number
}

export function detectQueryType(input: string): LookupType {
  const trimmed = input.trim().toLowerCase()
  if (/^(as)?\d+$/i.test(trimmed)) return "asn"
  if (/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(trimmed)) return "ip"
  if (/^[a-f0-9:]+$/i.test(trimmed) && trimmed.includes(":")) return "ip"
  return "domain"
}

export function cleanQuery(input: string, type: LookupType): string {
  let clean = input.trim().toLowerCase()
  if (type === "domain") {
    clean = clean.replace(/^https?:\/\//, "")
    clean = clean.split("/")[0]
    clean = clean.split(":")[0]
    // rfc 9083 3: the query is an ldh name, and a trailing root dot is not part of it
    clean = clean.replace(/\.$/, "")
  } else if (type === "asn") {
    clean = clean.replace(/^as/i, "")
  }
  return clean
}

export type StatusTone = "positive" | "negative" | "warning" | "neutral"

// rfc 9083 10.2.2 registers the base status values and rfc 8056 registers the
// epp-derived ones. matching had to become exact: substring matching graded
// "inactive" as positive because it contains "active", and "revoked" as positive
// because it contains "ok".
const POSITIVE_STATUSES = new Set(["active", "validated"])
const NEGATIVE_STATUSES = new Set([
  "inactive",
  "client hold",
  "server hold",
  "pending delete",
  "redemption period",
  "removed",
  "revoked",
])
const WARNING_STATUSES = new Set([
  "locked",
  "obscured",
  "private",
  "proxy",
  "associated",
  "add period",
  "auto renew period",
  "renew period",
  "transfer period",
  "pending create",
  "pending renew",
  "pending restore",
  "pending transfer",
  "pending update",
])

// some servers send the epp camelCase spelling instead of the rdap value
export function normalizeStatus(status: string): string {
  return status
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

export function classifyStatus(status: string): StatusTone {
  const normalized = normalizeStatus(status)
  if (POSITIVE_STATUSES.has(normalized)) return "positive"
  if (NEGATIVE_STATUSES.has(normalized)) return "negative"
  if (WARNING_STATUSES.has(normalized)) return "warning"
  if (/\bprohibited\b/.test(normalized)) return "warning"
  return "neutral"
}

// rfc 7095 3: a jcard property is [name, parameters, value type, value], and a
// structured value is an array. keeping every tel and email matters because a
// single-slot parse let a fax number overwrite the voice number.
export function parseJCard(entity: RDAPEntity, depth = 0): ParsedContact {
  const contact: ParsedContact = {
    handle: entity.handle,
    roles: entity.roles ?? [],
    emails: [],
    phones: [],
    depth,
  }

  for (const field of entity.vcardArray?.[1] ?? []) {
    const [property, , , value] = field
    const flat = Array.isArray(value) ? value.filter(Boolean) : [value]
    switch (property) {
      case "fn":
        contact.name = contact.name ?? flat.join(" ")
        break
      case "org":
        contact.organization = contact.organization ?? flat.join(" ")
        break
      case "email":
        contact.emails.push(...flat)
        break
      case "tel":
        contact.phones.push(...flat)
        break
      case "adr":
        // rfc 6350 6.3.1: adr is a 7-component structured value, in order
        if (Array.isArray(value)) contact.address = value.filter(Boolean).join(", ")
        break
    }
  }
  return contact
}

// rfc 9083 5.1: an entity may embed entities. the registrar's abuse contact
// usually lives one level down, and a flat pass dropped it silently.
export function flattenEntities(entities: RDAPEntity[] | undefined, depth = 0): ParsedContact[] {
  if (!entities || depth > 4) return []
  return entities.flatMap((entity) => [
    parseJCard(entity, depth),
    ...flattenEntities(entity.entities, depth + 1),
  ])
}

// rfc 9537 lets a server declare which fields it withheld. an empty contact list
// with a redaction block means "not published", not "does not exist".
export function redactedFieldNames(response: RDAPDomainResponse): string[] {
  return (response.redacted ?? [])
    .map((entry) => entry.name?.description ?? entry.name?.type ?? "")
    .filter(Boolean)
}

export interface RdapError {
  message: string
  // true when the failure is "no rdap service for this tld", not "not registered"
  noService: boolean
}

// rfc 9083 6: an error body is { errorCode, title, description[] }
export function parseRdapError(status: number, body: unknown, query: string): RdapError {
  const payload = (body ?? {}) as { title?: string; description?: unknown; errorCode?: number }
  const description = Array.isArray(payload.description)
    ? payload.description.filter((d): d is string => typeof d === "string").join(" ")
    : undefined
  const detail = [payload.title, description].filter(Boolean).join(" - ")

  if (status === 404) {
    return {
      noService: true,
      message: detail
        ? `The RDAP service answered 404: ${detail}`
        : `No RDAP answer for ${query}. Either the object is not registered, or its registry publishes no RDAP service - rdap.org returns 404 for both, and RFC 9224 bootstrapping cannot tell them apart from here.`,
    }
  }
  if (status === 501 || status === 400) {
    return {
      noService: true,
      message: detail || `The RDAP service does not support this query type (HTTP ${status}).`,
    }
  }
  return {
    noService: false,
    message: detail ? `Lookup failed (HTTP ${status}): ${detail}` : `Lookup failed: HTTP ${status}`,
  }
}

// rdap.org is a bootstrap redirector: it reads the rfc 9224 registries and
// forwards to whichever registry or rir is authoritative, so the answer comes
// from that server and not from rdap.org itself.
const BOOTSTRAP = "https://rdap.org"

export const RDAP_PATHS: Record<LookupType, string> = {
  domain: "domain",
  ip: "ip",
  asn: "autnum",
}

export interface RdapLookup<T> {
  data: T
  // rfc 9083 4.2: the self link names the server that actually answered
  authoritativeUrl?: string
}

export async function fetchRdap<T>(type: LookupType, query: string): Promise<RdapLookup<T>> {
  const url = `${BOOTSTRAP}/${RDAP_PATHS[type]}/${encodeURIComponent(query)}`
  const response = await fetch(url, { headers: { Accept: "application/rdap+json" } })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(parseRdapError(response.status, body, query).message)
  }

  const data = (await response.json()) as T & { links?: RDAPLink[] }
  return { data, authoritativeUrl: selfLink(data.links) }
}

export function selfLink(links: RDAPLink[] | undefined): string | undefined {
  return links?.find((link) => link.rel === "self")?.href
}
