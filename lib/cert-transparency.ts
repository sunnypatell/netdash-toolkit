// certspotter sends access-control-allow-origin: *, so it is the one source a page can read.
// CT logs say what was issued for a name, not what the server presents now.
const CERTSPOTTER_ENDPOINT = "https://api.certspotter.com/v1/issuances"

export const CT_SOURCE_HOST = "api.certspotter.com"

export interface CtIssuance {
  id: string
  cert_sha256?: string
  dns_names?: string[]
  issuer?: { name?: string; friendly_name?: string }
  not_before?: string
  not_after?: string
  revoked?: boolean
}

export interface TrustProbe {
  ok: boolean
  ms: number
}

export function cleanHostname(input: string): string {
  let clean = input.trim().toLowerCase()
  clean = clean.replace(/^[a-z]+:\/\//, "")
  clean = clean.split("/")[0]
  clean = clean.split("?")[0]
  clean = clean.split(":")[0]
  return clean
}

// rfc 9110 4.3.4 defers name matching to rfc 6125 6.4.3: a wildcard covers exactly
// one label, so *.a.com covers b.a.com but not c.b.a.com and not a.com itself
export function coversHost(names: string[] | undefined, host: string): boolean {
  if (!names) return false
  return names.some((raw) => {
    const name = raw.trim().toLowerCase()
    if (name === host) return true
    if (name.startsWith("*.")) {
      const suffix = name.slice(1)
      if (!host.endsWith(suffix)) return false
      return !host.slice(0, host.length - suffix.length).includes(".")
    }
    return false
  })
}

export function daysUntil(iso: string | undefined, now = Date.now()): number | null {
  if (!iso) return null
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return null
  return Math.floor((ts - now) / 86400000)
}

export function formatCertDate(iso: string | undefined): string {
  if (!iso) return "unknown"
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return iso
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function sortIssuancesByExpiry(issuances: CtIssuance[]): CtIssuance[] {
  return [...issuances].sort(
    (a, b) => Date.parse(b.not_after ?? "") - Date.parse(a.not_after ?? "")
  )
}

// an opaque fetch still fails when the chain does not validate, but that is indistinguishable
// from dns or network failure, so a failure must not be presented as a certificate problem
export async function probeBrowserTrust(host: string): Promise<TrustProbe> {
  const start = Date.now()
  try {
    await fetch(`https://${host}/`, { mode: "no-cors", cache: "no-store" })
    return { ok: true, ms: Date.now() - start }
  } catch {
    return { ok: false, ms: Date.now() - start }
  }
}

export async function fetchIssuances(host: string): Promise<CtIssuance[]> {
  const params = new URLSearchParams({ domain: host, include_subdomains: "false" })
  for (const field of ["dns_names", "issuer", "cert_sha256", "not_before", "not_after"]) {
    params.append("expand", field)
  }
  const res = await fetch(`${CERTSPOTTER_ENDPOINT}?${params.toString()}`)
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = await res.json()
      if (body?.message) detail = String(body.message)
    } catch {
      // non-json error body, keep the status
    }
    throw new Error(`Certificate transparency lookup failed: ${detail}`)
  }
  const data = await res.json()
  if (!Array.isArray(data)) throw new Error("Certificate transparency lookup returned no list")
  return sortIssuancesByExpiry(data as CtIssuance[])
}
