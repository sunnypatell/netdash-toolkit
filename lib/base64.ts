// rfc 4648: section 4 is the standard alphabet, section 5 is the url-safe one.
// only the last two symbols differ, so the 6-bit groups are identical.
export type Base64Alphabet = "standard" | "urlsafe"

export interface Base64Result {
  output: string
  error: string | null
}

const STANDARD_ALPHABET = /^[A-Za-z0-9+/]*={0,2}$/
const URLSAFE_ALPHABET = /^[A-Za-z0-9\-_]*={0,2}$/

export const ALPHABET_LABELS: Record<Base64Alphabet, string> = {
  standard: "Standard (RFC 4648 §4)",
  urlsafe: "URL-safe (RFC 4648 §5)",
}

// spread on a whole large array overflows the argument stack, so chunk it
function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

function base64ToBytes(encoded: string): Uint8Array {
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function toUrlSafe(standard: string, pad: boolean): string {
  const swapped = standard.replaceAll("+", "-").replaceAll("/", "_")
  return pad ? swapped : swapped.replace(/=+$/, "")
}

// rfc 7515 appendix c drops padding; atob needs it back
function toStandard(urlsafe: string): string {
  const swapped = urlsafe.replaceAll("-", "+").replaceAll("_", "/")
  const remainder = swapped.length % 4
  if (remainder === 0) return swapped
  return swapped + "=".repeat(4 - remainder)
}

export function encodeBase64(
  text: string,
  alphabet: Base64Alphabet = "standard",
  padUrlSafe = false
): Base64Result {
  try {
    const standard = bytesToBase64(new TextEncoder().encode(text))
    return {
      output: alphabet === "urlsafe" ? toUrlSafe(standard, padUrlSafe) : standard,
      error: null,
    }
  } catch {
    return { output: "", error: "Could not encode this input" }
  }
}

export function encodeBytesToBase64(
  bytes: Uint8Array,
  alphabet: Base64Alphabet = "standard",
  padUrlSafe = false
): Base64Result {
  try {
    const standard = bytesToBase64(bytes)
    return {
      output: alphabet === "urlsafe" ? toUrlSafe(standard, padUrlSafe) : standard,
      error: null,
    }
  } catch {
    return { output: "", error: "Could not encode these bytes" }
  }
}

export function decodeBase64(encoded: string, alphabet: Base64Alphabet = "standard"): Base64Result {
  // the html forgiving-base64 decoder strips ascii whitespace, so line-wrapped
  // mime input (rfc 2045) is accepted rather than rejected
  const stripped = encoded.replace(/[\t\n\f\r ]/g, "")
  if (!stripped) return { output: "", error: null }

  const expected = alphabet === "urlsafe" ? URLSAFE_ALPHABET : STANDARD_ALPHABET
  if (!expected.test(stripped)) {
    const otherAlphabet = alphabet === "urlsafe" ? STANDARD_ALPHABET : URLSAFE_ALPHABET
    if (otherAlphabet.test(stripped)) {
      return {
        output: "",
        error:
          alphabet === "urlsafe"
            ? "Contains + or /, which is the standard alphabet. Switch to Standard."
            : "Contains - or _, which is the URL-safe alphabet. Switch to URL-safe.",
      }
    }
    return { output: "", error: "Not Base64: contains characters outside the selected alphabet" }
  }

  const standard = alphabet === "urlsafe" ? toStandard(stripped) : stripped
  let bytes: Uint8Array
  try {
    bytes = base64ToBytes(standard)
  } catch {
    return { output: "", error: "Not valid Base64: the length or padding is wrong" }
  }

  try {
    // fatal, so binary that is not utf-8 text is reported instead of being
    // silently replaced with U+FFFD and passed off as the decoded string
    return { output: new TextDecoder("utf-8", { fatal: true }).decode(bytes), error: null }
  } catch {
    return {
      output: "",
      error: `Decodes to ${bytes.length} bytes that are not valid UTF-8 text. This is binary data, not text.`,
    }
  }
}

// used by the sample buttons to pick a sensible starting mode and alphabet
export function detectBase64(value: string): { isBase64: boolean; alphabet: Base64Alphabet } {
  const stripped = value.replace(/[\t\n\f\r ]/g, "")
  if (stripped.length < 4) return { isBase64: false, alphabet: "standard" }
  if (/[-_]/.test(stripped) && URLSAFE_ALPHABET.test(stripped)) {
    return { isBase64: true, alphabet: "urlsafe" }
  }
  return { isBase64: STANDARD_ALPHABET.test(stripped), alphabet: "standard" }
}
