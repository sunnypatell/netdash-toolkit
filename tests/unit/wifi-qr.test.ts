import { describe, expect, it } from "vitest"
import {
  SECURITY_TOKENS,
  buildWifiUri,
  encodeWifiValue,
  escapeWifiValue,
  looksLikeHex,
  qrFileStem,
  utf8Length,
  validateWifiConfig,
  type WifiConfig,
} from "@/lib/wifi-qr"

// a mis-escaped passphrase produces a QR code that scans fine and joins nothing

const config = (overrides: Partial<WifiConfig> = {}): WifiConfig => ({
  ssid: "Lab-Net",
  password: "correct horse battery",
  security: "wpa2",
  hidden: false,
  ...overrides,
})

describe("escaping the reserved characters", () => {
  it("escapes backslash, semicolon, comma, colon and quote", () => {
    expect(escapeWifiValue("\\")).toBe("\\\\")
    expect(escapeWifiValue(";")).toBe("\\;")
    expect(escapeWifiValue(",")).toBe("\\,")
    expect(escapeWifiValue(":")).toBe("\\:")
    expect(escapeWifiValue('"')).toBe('\\"')
  })

  it("escapes the backslash first, so nothing is double-escaped", () => {
    // escaping ; before \ would escape the backslash it introduces and leave a stray one
    expect(escapeWifiValue("a;b")).toBe("a\\;b")
    expect(escapeWifiValue("a\\;b")).toBe("a\\\\\\;b")
    expect(escapeWifiValue("a\\b")).toBe("a\\\\b")
  })

  it("leaves ordinary characters alone", () => {
    expect(escapeWifiValue("Guest WiFi 2024!")).toBe("Guest WiFi 2024!")
    expect(escapeWifiValue("")).toBe("")
  })

  it("survives a passphrase made entirely of reserved characters", () => {
    expect(escapeWifiValue(';,:"\\')).toBe('\\;\\,\\:\\"\\\\')
  })
})

describe("hex-ambiguous values are quoted", () => {
  it("spots values a scanner would read as hex bytes", () => {
    expect(looksLikeHex("ABCD")).toBe(true)
    expect(looksLikeHex("0123456789abcdef")).toBe(true)
    expect(looksLikeHex("ABC")).toBe(false) // odd length cannot be byte pairs
    expect(looksLikeHex("ABCDG")).toBe(false)
    expect(looksLikeHex("")).toBe(false)
    expect(looksLikeHex("cafe cafe")).toBe(false)
  })

  it("wraps them in double quotes and leaves everything else bare", () => {
    expect(encodeWifiValue("ABCD")).toBe('"ABCD"')
    expect(encodeWifiValue("Lab-Net")).toBe("Lab-Net")
    // escaping still happens inside the quotes
    expect(encodeWifiValue("Guest;Net")).toBe("Guest\\;Net")
  })
})

describe("the URI a scanner receives", () => {
  it("has the documented shape, terminated by an empty field", () => {
    expect(buildWifiUri(config({ ssid: "Lab-Net", password: "hunter2000" }))).toBe(
      "WIFI:T:WPA;S:Lab-Net;P:hunter2000;;"
    )
  })

  it("maps each security type to its token", () => {
    expect(SECURITY_TOKENS).toEqual({ wpa2: "WPA", wpa3: "SAE", wep: "WEP", open: "nopass" })
    expect(buildWifiUri(config({ security: "wpa3" }))).toContain("T:SAE;")
    expect(buildWifiUri(config({ security: "wep" }))).toContain("T:WEP;")
  })

  it("omits the passphrase field entirely for an open network", () => {
    const uri = buildWifiUri(config({ security: "open", password: "ignored" }))
    expect(uri).toBe("WIFI:T:nopass;S:Lab-Net;;")
    expect(uri).not.toContain("ignored")
  })

  it("adds H:true only for a hidden network", () => {
    expect(buildWifiUri(config({ hidden: true }))).toContain("H:true;")
    expect(buildWifiUri(config({ hidden: false }))).not.toContain("H:")
  })

  it("escapes a passphrase containing every reserved character", () => {
    const uri = buildWifiUri(config({ ssid: "A;B", password: 'p:a,s"s\\word' }))
    expect(uri).toBe('WIFI:T:WPA;S:A\\;B;P:p\\:a\\,s\\"s\\\\word;;')
    // an unescaped ; would terminate the field early and truncate the credential
    expect(uri.split(";").length).toBeGreaterThan(0)
    expect(uri).not.toMatch(/[^\\];a/)
  })

  it("quotes a hex-looking ssid and passphrase", () => {
    expect(buildWifiUri(config({ ssid: "ABCD", password: "DEADBEEF" }))).toBe(
      'WIFI:T:WPA;S:"ABCD";P:"DEADBEEF";;'
    )
  })
})

describe("validation follows IEEE 802.11", () => {
  it("counts the SSID limit in octets, not characters", () => {
    // ieee std 802.11-2020 9.4.2.2: the SSID element body is 0-32 octets
    expect(utf8Length("café")).toBe(5)
    const wide = "é".repeat(20) // 40 octets, 20 characters
    expect(utf8Length(wide)).toBe(40)
    const result = validateWifiConfig(config({ ssid: wide }))
    expect(result.errors.join(" ")).toMatch(/32/)
  })

  it("accepts a 32 octet ascii ssid and rejects 33", () => {
    expect(validateWifiConfig(config({ ssid: "a".repeat(32) })).errors).toEqual([])
    expect(validateWifiConfig(config({ ssid: "a".repeat(33) })).errors.length).toBe(1)
  })

  it("requires an ssid", () => {
    expect(validateWifiConfig(config({ ssid: "   " })).errors.join(" ")).toMatch(/required/i)
  })

  it("enforces the 8-63 character WPA passphrase range", () => {
    // ieee std 802.11-2020 annex j.4.1
    expect(validateWifiConfig(config({ password: "short12" })).errors.length).toBe(1)
    expect(validateWifiConfig(config({ password: "a".repeat(8) })).errors).toEqual([])
    expect(validateWifiConfig(config({ password: "a".repeat(63) })).errors).toEqual([])
    // "a" is a hex digit, so 64 of them are a valid PSK; 64 non-hex are not
    expect(validateWifiConfig(config({ password: "z".repeat(64) })).errors.length).toBe(1)
  })

  it("accepts a 64 hex digit PSK, which is not a passphrase", () => {
    expect(validateWifiConfig(config({ password: "a1".repeat(32) })).errors).toEqual([])
  })

  it("warns about a non-ascii passphrase instead of silently mis-deriving a key", () => {
    const result = validateWifiConfig(config({ password: "pässwörd123" }))
    expect(result.errors).toEqual([])
    expect(result.warnings.join(" ")).toMatch(/non-ASCII/i)
  })

  it("accepts both WEP key lengths in ascii and hex", () => {
    for (const key of ["abcde", "abcdefghijklm", "0123456789", "0".repeat(26)]) {
      expect(validateWifiConfig(config({ security: "wep", password: key })).errors, key).toEqual([])
    }
    for (const key of ["abcd", "abcdefg", "0".repeat(11)]) {
      expect(
        validateWifiConfig(config({ security: "wep", password: key })).errors.length,
        key
      ).toBe(1)
    }
  })

  it("always says WEP is broken", () => {
    const result = validateWifiConfig(config({ security: "wep", password: "abcde" }))
    expect(result.warnings.join(" ")).toMatch(/deprecated/i)
  })

  it("needs no passphrase for an open network but says the field is ignored", () => {
    expect(validateWifiConfig(config({ security: "open", password: "" })).errors).toEqual([])
    expect(
      validateWifiConfig(config({ security: "open", password: "x" })).warnings.join(" ")
    ).toMatch(/ignored/i)
  })

  it("requires a passphrase for a secured network", () => {
    expect(validateWifiConfig(config({ password: "" })).errors.join(" ")).toMatch(/required/i)
  })
})

describe("download filename", () => {
  it("never carries the passphrase and never carries a path separator", () => {
    expect(qrFileStem("Guest / Lab: Net")).toBe("wifi-qr-Guest-Lab-Net")
    expect(qrFileStem("../../etc")).toBe("wifi-qr-etc")
    expect(qrFileStem("")).toBe("wifi-qr-network")
  })
})

describe("a scanner recovers exactly what was entered", () => {
  // written from the zxing rules rather than from lib/wifi-qr, so the round trip proves the escaping
  function parseWifiUri(uri: string): Record<string, string> {
    const body = uri.slice("WIFI:".length)
    const out: Record<string, string> = {}
    let i = 0
    while (i < body.length) {
      let key = ""
      while (i < body.length && body[i] !== ":") key += body[i++]
      if (i >= body.length) break
      i++
      let value = ""
      while (i < body.length) {
        const ch = body[i]
        if (ch === "\\") {
          value += body[i + 1]
          i += 2
          continue
        }
        if (ch === ";") break
        value += ch
        i++
      }
      i++
      if (key === "") break
      if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1)
      }
      out[key] = value
      if (body[i] === ";") break
    }
    return out
  }

  it("round trips every three-character combination of the reserved set", () => {
    const alphabet = [";", ",", ":", "\\", '"', "a", "1", " ", "#", "%"]
    let checked = 0
    for (const a of alphabet) {
      for (const b of alphabet) {
        for (const c of alphabet) {
          const password = `x${a}${b}${c}y`
          const ssid = `S${c}${a}`
          const parsed = parseWifiUri(
            buildWifiUri({ ssid, password, security: "wpa2", hidden: false })
          )
          expect(parsed.P, JSON.stringify(password)).toBe(password)
          expect(parsed.S, JSON.stringify(ssid)).toBe(ssid)
          checked++
        }
      }
    }
    expect(checked).toBe(1000)
  })

  it("shows what an unescaped semicolon would have cost", () => {
    const password = "first;second"
    const uri = buildWifiUri({ ssid: "N", password, security: "wpa2", hidden: false })
    expect(uri).toContain("P:first\\;second;")
    expect(parseWifiUri(uri).P).toBe(password)
    // the same credential without escaping is silently truncated at the ;
    expect(parseWifiUri(`WIFI:T:WPA;S:N;P:${password};;`).P).toBe("first")
  })

  it("recovers a hex-looking value from its quoted form", () => {
    const parsed = parseWifiUri(
      buildWifiUri({ ssid: "ABCD", password: "DEADBEEF", security: "wpa2", hidden: false })
    )
    expect(parsed.S).toBe("ABCD")
    expect(parsed.P).toBe("DEADBEEF")
  })
})
