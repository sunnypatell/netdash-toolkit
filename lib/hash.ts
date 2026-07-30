export interface HashAlgorithm {
  /** the exact string SubtleCrypto.digest accepts */
  name: string
  bits: number
  hexChars: number
  status: "secure" | "deprecated"
  description: string
}

export interface HashResult {
  algorithm: string
  hash: string
  bits: number
}

// W3C WebCryptoAPI registers exactly four digest algorithms. SHA-1 is one of
// them, cryptographically broken but still specified; MD5 never was.
export const HASH_ALGORITHMS: HashAlgorithm[] = [
  {
    name: "SHA-256",
    bits: 256,
    hexChars: 64,
    status: "secure",
    description: "The default choice. FIPS 180-4.",
  },
  {
    name: "SHA-384",
    bits: 384,
    hexChars: 96,
    status: "secure",
    description: "SHA-512 truncated to 384 bits. FIPS 180-4.",
  },
  {
    name: "SHA-512",
    bits: 512,
    hexChars: 128,
    status: "secure",
    description: "Widest SHA-2 variant, faster than SHA-256 on 64-bit CPUs. FIPS 180-4.",
  },
  {
    name: "SHA-1",
    bits: 160,
    hexChars: 40,
    status: "deprecated",
    description:
      "Collisions are practical (SHAttered, 2017). Fine for checksums against a published SHA-1, never for signatures. RFC 3174.",
  },
]

export const UNAVAILABLE_ALGORITHMS: { name: string; reason: string }[] = [
  {
    name: "MD5",
    reason:
      "Not in the Web Crypto spec, so no browser can compute it here. It would need a JavaScript implementation, and MD5 is collision-broken anyway.",
  },
  {
    name: "SHA-3 / Keccak",
    reason: "Not registered by WebCryptoAPI. crypto.subtle.digest rejects the name.",
  },
  {
    name: "CRC32",
    reason: "A checksum, not a hash, and not part of Web Crypto.",
  },
]

export type CryptoAvailability = "available" | "insecure-context" | "unsupported"

/**
 * SubtleCrypto is gated on a secure context, so over plain http `crypto.subtle`
 * is simply undefined. Worth distinguishing from an old browser, because the
 * user can fix one of those and not the other.
 */
export function cryptoAvailability(): CryptoAvailability {
  if (typeof crypto === "undefined" || typeof crypto.subtle === "undefined") {
    const secure =
      typeof globalThis.isSecureContext === "boolean" ? globalThis.isSecureContext : true
    return secure ? "unsupported" : "insecure-context"
  }
  return "available"
}

export const AVAILABILITY_MESSAGE: Record<Exclude<CryptoAvailability, "available">, string> = {
  "insecure-context":
    "crypto.subtle is only exposed in a secure context, and this page is not one. Load it over HTTPS or from localhost and hashing will work.",
  unsupported: "This browser exposes no crypto.subtle, so no hash can be computed here.",
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

export async function computeHash(data: BufferSource, algorithm: string): Promise<string> {
  return toHex(await crypto.subtle.digest(algorithm, data))
}

export async function computeHashes(
  data: BufferSource,
  algorithms: HashAlgorithm[] = HASH_ALGORITHMS
): Promise<HashResult[]> {
  const digests = await Promise.all(algorithms.map((algo) => computeHash(data, algo.name)))
  return algorithms.map((algo, i) => ({
    algorithm: algo.name,
    hash: digests[i],
    bits: algo.bits,
  }))
}

// return type inferred: annotating it as Uint8Array widens the buffer to
// ArrayBufferLike, which ts 6 will not accept as a BufferSource
export function encodeText(text: string) {
  return new TextEncoder().encode(text)
}

export interface VerifyOutcome {
  state: "match" | "mismatch" | "not-a-hash"
  algorithm: string | null
}

/**
 * Names the algorithm that matched rather than just saying yes. "matches" with
 * no algorithm is not much of an answer when four digests were computed.
 */
export function verifyHash(hashes: HashResult[], candidate: string): VerifyOutcome | null {
  const normalized = candidate.trim().toLowerCase().replace(/^0x/, "")
  if (!normalized) return null
  if (!/^[0-9a-f]+$/.test(normalized)) return { state: "not-a-hash", algorithm: null }
  const hit = hashes.find((result) => result.hash === normalized)
  if (hit) return { state: "match", algorithm: hit.algorithm }
  return { state: "mismatch", algorithm: null }
}
