// the WIFI: URI scheme, as documented by ZXing's "Barcode Contents" reference
// (github.com/zxing/zxing/wiki/Barcode-Contents), which is what Android's and
// iOS's camera scanners implement.
//
// two rules from that page decide whether a scan joins the right network:
//   1. the characters \ ; , : and " are escaped with a backslash, MECARD style.
//   2. an SSID or password that "could be interpreted as hex" is wrapped in
//      double quotes, because an unquoted all-hex value is read as hex bytes
//      (the same rule wpa_supplicant applies to an unquoted ssid= value).
// getting (1) wrong or skipping (2) produces a QR code that scans cleanly and
// silently carries the wrong credential.

export type WifiSecurity = "wpa2" | "wpa3" | "wep" | "open"

export interface WifiConfig {
  ssid: string
  password: string
  security: WifiSecurity
  hidden: boolean
}

/** T: values. SAE is what Android uses for WPA3-Personal. */
export const SECURITY_TOKENS: Record<WifiSecurity, string> = {
  wpa2: "WPA",
  wpa3: "SAE",
  wep: "WEP",
  open: "nopass",
}

export const SECURITY_LABELS: Record<WifiSecurity, string> = {
  wpa2: "WPA2-Personal",
  wpa3: "WPA3-Personal (SAE)",
  wep: "WEP (deprecated)",
  open: "Open (no password)",
}

/**
 * backslash first, or the backslashes introduced by the later replacements get
 * escaped a second time and the value arrives with stray backslashes in it.
 */
export function escapeWifiValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/:/g, "\\:")
    .replace(/"/g, '\\"')
}

/**
 * true when a value would be mistaken for hex bytes if left unquoted: an even
 * number of hex digits and nothing else. odd-length hex cannot be byte pairs,
 * so quoting it would only add noise.
 */
export function looksLikeHex(value: string): boolean {
  return value.length >= 2 && value.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(value)
}

/** escaped, and quoted when it would otherwise be read as hex */
export function encodeWifiValue(value: string): string {
  const escaped = escapeWifiValue(value)
  return looksLikeHex(value) ? `"${escaped}"` : escaped
}

export function buildWifiUri(config: WifiConfig): string {
  const token = SECURITY_TOKENS[config.security]
  let uri = `WIFI:T:${token};S:${encodeWifiValue(config.ssid)};`
  if (config.security !== "open" && config.password) {
    uri += `P:${encodeWifiValue(config.password)};`
  }
  if (config.hidden) uri += "H:true;"
  // the scheme is terminated by an empty field, hence the doubled semicolon
  return `${uri};`
}

export function utf8Length(value: string): number {
  return new TextEncoder().encode(value).length
}

const isPrintableAscii = (value: string) => /^[\x20-\x7e]*$/.test(value)
const isHexKey = (value: string, digits: number) =>
  value.length === digits && /^[0-9a-fA-F]+$/.test(value)

export interface WifiValidation {
  /** blocking problems: no QR code should be produced */
  errors: string[]
  /** things worth saying out loud that still produce a scannable code */
  warnings: string[]
}

/**
 * SSID length is an octet count, not a character count: IEEE Std 802.11-2020
 * 9.4.2.2 defines the SSID element body as 0-32 octets. A WPA passphrase is
 * 8-63 printable ASCII characters, or a 64 hex digit PSK (802.11-2020 Annex
 * J.4.1). WEP keys are 5 or 13 ASCII characters, or 10 or 26 hex digits.
 */
export function validateWifiConfig(config: WifiConfig): WifiValidation {
  const errors: string[] = []
  const warnings: string[] = []

  const ssidBytes = utf8Length(config.ssid)
  if (config.ssid.trim() === "") errors.push("Network name (SSID) is required")
  if (ssidBytes > 32) {
    errors.push(`SSID is ${ssidBytes} bytes; IEEE 802.11 allows at most 32 (9.4.2.2)`)
  }
  if (config.ssid !== "" && ssidBytes !== config.ssid.length) {
    warnings.push(
      `SSID uses ${ssidBytes} bytes for ${config.ssid.length} characters - the 32 byte limit counts bytes`
    )
  }
  if (looksLikeHex(config.ssid)) {
    warnings.push("SSID is all hex digits, so it is quoted in the URI to keep it literal")
  }

  if (config.security === "open") {
    if (config.password !== "") {
      warnings.push("Open networks carry no password; the passphrase field is ignored")
    }
    return { errors, warnings }
  }

  if (config.password === "") {
    errors.push("A passphrase is required for a secured network")
    return { errors, warnings }
  }

  if (config.security === "wep") {
    const ok =
      (config.password.length === 5 || config.password.length === 13) &&
      isPrintableAscii(config.password)
    const hex = isHexKey(config.password, 10) || isHexKey(config.password, 26)
    if (!ok && !hex) {
      errors.push("WEP key must be 5 or 13 ASCII characters, or 10 or 26 hex digits")
    }
    warnings.push("WEP is broken and deprecated; use WPA2 or WPA3 where the hardware allows it")
    return { errors, warnings }
  }

  if (isHexKey(config.password, 64)) return { errors, warnings }

  if (config.password.length < 8 || config.password.length > 63) {
    errors.push(
      `WPA passphrase must be 8-63 characters (or a 64 digit hex PSK); this one is ${config.password.length}`
    )
  }
  if (!isPrintableAscii(config.password)) {
    warnings.push(
      "Passphrase contains non-ASCII characters; IEEE 802.11 Annex J.4.1 defines the mapping for ASCII 32-126 only, so some devices will derive a different key"
    )
  }
  if (looksLikeHex(config.password)) {
    warnings.push("Passphrase is all hex digits, so it is quoted in the URI to keep it literal")
  }

  return { errors, warnings }
}

/** filename-safe stem for a downloaded QR image; never leaks the passphrase */
export function qrFileStem(ssid: string): string {
  const cleaned = ssid.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  return `wifi-qr-${cleaned || "network"}`
}
