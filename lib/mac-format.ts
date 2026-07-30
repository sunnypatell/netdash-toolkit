// MAC address parsing, formatting and IEEE 802 bit analysis.

export type MacFormat = "colon" | "hyphen" | "cisco" | "bare" | "hp"

export interface MacInfo {
  hex: string
  colon: string
  hyphen: string
  cisco: string
  bare: string
  oui: string
  nic: string
  detectedFormat: MacFormat
  // ieee 802.1ac: bit 0 of the first octet is the i/g bit, bit 1 is the u/l bit
  isMulticast: boolean
  isLocallyAdministered: boolean
  isBroadcast: boolean
  binary: string
  // rfc 4291 appendix a: insert fffe, then invert the u/l bit
  modifiedEui64: string
}

const PATTERNS: ReadonlyArray<{ format: MacFormat; re: RegExp }> = [
  { format: "colon", re: /^[0-9a-f]{1,2}(:[0-9a-f]{1,2}){5}$/i },
  { format: "hyphen", re: /^[0-9a-f]{1,2}(-[0-9a-f]{1,2}){5}$/i },
  { format: "cisco", re: /^[0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}$/i },
  { format: "hp", re: /^[0-9a-f]{6}-[0-9a-f]{6}$/i },
  { format: "bare", re: /^[0-9a-f]{12}$/i },
]

// strict on purpose: lib/parsers.normalizeMac strips every non-hex character so
// it can survive vendor cli output, which also lets "zz00:1a:.." through
export function detectMacFormat(input: string): MacFormat | null {
  const trimmed = input.trim()
  for (const { format, re } of PATTERNS) {
    if (re.test(trimmed)) return format
  }
  return null
}

export function parseMac(input: string): MacInfo | null {
  const trimmed = input.trim()
  const detectedFormat = detectMacFormat(trimmed)
  if (!detectedFormat) return null

  const hex =
    detectedFormat === "colon" || detectedFormat === "hyphen"
      ? trimmed
          .split(/[:-]/)
          .map((group) => group.padStart(2, "0"))
          .join("")
          .toUpperCase()
      : trimmed.replace(/[^0-9a-f]/gi, "").toUpperCase()

  if (hex.length !== 12) return null

  const bytes: string[] = []
  for (let i = 0; i < 12; i += 2) bytes.push(hex.slice(i, i + 2))

  const firstByte = Number.parseInt(bytes[0], 16)
  const flipped = (firstByte ^ 0x02).toString(16).padStart(2, "0").toUpperCase()

  return {
    hex,
    colon: bytes.join(":"),
    hyphen: bytes.join("-"),
    cisco: `${bytes[0]}${bytes[1]}.${bytes[2]}${bytes[3]}.${bytes[4]}${bytes[5]}`.toLowerCase(),
    bare: hex,
    oui: bytes.slice(0, 3).join(":"),
    nic: bytes.slice(3).join(":"),
    detectedFormat,
    isMulticast: (firstByte & 0x01) === 0x01,
    isLocallyAdministered: (firstByte & 0x02) === 0x02,
    isBroadcast: hex === "FFFFFFFFFFFF",
    binary: bytes.map((b) => Number.parseInt(b, 16).toString(2).padStart(8, "0")).join(" "),
    modifiedEui64: `${flipped}${bytes[1]}:${bytes[2]}FF:FE${bytes[3]}:${bytes[4]}${bytes[5]}`,
  }
}

export function formatMac(info: MacInfo, format: MacFormat): string {
  switch (format) {
    case "colon":
      return info.colon
    case "hyphen":
      return info.hyphen
    case "cisco":
      return info.cisco
    case "hp":
      return `${info.hex.slice(0, 6)}-${info.hex.slice(6)}`.toLowerCase()
    case "bare":
      return info.bare
  }
}
