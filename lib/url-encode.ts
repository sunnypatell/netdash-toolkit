// four things called "url encoding" that are not interchangeable: encodeURIComponent, encodeURI,
// form (space is "+"), and rfc3986 (encodeURIComponent plus the five sub-delims it leaves alone)
export type UrlEncodeMode = "component" | "uri" | "form" | "rfc3986"

export interface UrlEncodeResult {
  output: string
  error: string | null
}

export const URL_MODE_LABELS: Record<UrlEncodeMode, string> = {
  component: "encodeURIComponent",
  uri: "encodeURI",
  form: "form-urlencoded",
  rfc3986: "RFC 3986 strict",
}

export const URL_MODE_HELP: Record<UrlEncodeMode, string> = {
  component:
    "For a single query value or path segment. Percent-encodes the reserved delimiters : / ? # [ ] @ ! $ & ' ( ) * + , ; = so the value cannot break out of its slot. ECMA-262 19.2.6.5.",
  uri: "For a whole URL that is already assembled. Leaves the reserved delimiters : / ? # [ ] @ & = + $ , and ; intact so the URL keeps its structure, and only escapes what is never legal. ECMA-262 19.2.6.4.",
  form: "For an HTML form body or a query string built by a browser. A space becomes + rather than %20, and * - . _ are the only non-alphanumerics left alone. WHATWG URL 5.2.",
  rfc3986:
    "encodeURIComponent leaves ! ' ( ) * unescaped, but RFC 3986 2.2 reserves them as sub-delims. This escapes those five as well, which is what a strict RFC 3986 parser expects.",
}

// rfc 3986 2.2 sub-delims that encodeURIComponent leaves alone
const RFC3986_EXTRA = /[!'()*]/g

function percentEncodeChar(char: string): string {
  return `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`
}

// the platform's own urlencoded serialiser, so it cannot drift from the spec
function encodeForm(text: string): string {
  return new URLSearchParams([["k", text]]).toString().slice(2)
}

export function encodeUrlText(text: string, mode: UrlEncodeMode): UrlEncodeResult {
  if (!text) return { output: "", error: null }
  try {
    switch (mode) {
      case "component":
        return { output: encodeURIComponent(text), error: null }
      case "uri":
        return { output: encodeURI(text), error: null }
      case "form":
        return { output: encodeForm(text), error: null }
      case "rfc3986":
        return {
          output: encodeURIComponent(text).replace(RFC3986_EXTRA, percentEncodeChar),
          error: null,
        }
    }
  } catch {
    // a lone surrogate cannot be utf-8 encoded, so both encoders throw URIError
    return {
      output: "",
      error: "Contains an unpaired surrogate, which has no UTF-8 encoding (URIError)",
    }
  }
}

export function decodeUrlText(text: string, mode: UrlEncodeMode): UrlEncodeResult {
  if (!text) return { output: "", error: null }
  try {
    if (mode === "form") {
      // a form body means "+" for space, so it must be restored before decoding
      return { output: decodeURIComponent(text.replace(/\+/g, "%20")), error: null }
    }
    if (mode === "uri") {
      return { output: decodeURI(text), error: null }
    }
    return { output: decodeURIComponent(text), error: null }
  } catch {
    return {
      output: "",
      error: "Not valid percent-encoding: a % must be followed by two hex digits (URIError)",
    }
  }
}

export interface UrlReferenceRow {
  char: string
  name: string
  component: string
  uri: string
  form: string
  rfc3986: string
}

const REFERENCE_CHARS: { char: string; name: string }[] = [
  { char: " ", name: "space" },
  { char: "!", name: "exclamation" },
  { char: '"', name: "quote" },
  { char: "#", name: "hash" },
  { char: "$", name: "dollar" },
  { char: "%", name: "percent" },
  { char: "&", name: "ampersand" },
  { char: "'", name: "apostrophe" },
  { char: "(", name: "open paren" },
  { char: ")", name: "close paren" },
  { char: "*", name: "asterisk" },
  { char: "+", name: "plus" },
  { char: ",", name: "comma" },
  { char: "-", name: "hyphen" },
  { char: ".", name: "period" },
  { char: "/", name: "slash" },
  { char: ":", name: "colon" },
  { char: ";", name: "semicolon" },
  { char: "=", name: "equals" },
  { char: "?", name: "question" },
  { char: "@", name: "at" },
  { char: "[", name: "open bracket" },
  { char: "]", name: "close bracket" },
  { char: "_", name: "underscore" },
  { char: "~", name: "tilde" },
  { char: "é", name: "e acute (2 UTF-8 bytes)" },
]

// derived from the encoders themselves rather than typed out, because a
// hand-written table is how the old one came to claim ! encodes to %21
export const URL_ENCODING_REFERENCE: UrlReferenceRow[] = REFERENCE_CHARS.map(({ char, name }) => ({
  char,
  name,
  component: encodeUrlText(char, "component").output,
  uri: encodeUrlText(char, "uri").output,
  form: encodeUrlText(char, "form").output,
  rfc3986: encodeUrlText(char, "rfc3986").output,
}))

export interface QueryParam {
  key: string
  value: string
}

export interface BuiltUrl {
  url: string
  error: string | null
}

export function buildUrl(base: string, params: QueryParam[]): BuiltUrl {
  if (!base.trim()) return { url: "", error: null }
  let parsed: URL
  try {
    parsed = new URL(base)
  } catch {
    return { url: "", error: "Not an absolute URL. Include a scheme, for example https://" }
  }
  // set(), not append(), so the base's own duplicate keys collapse the same way
  for (const param of params) {
    if (param.key.trim()) parsed.searchParams.set(param.key, param.value)
  }
  return { url: parsed.toString(), error: null }
}

// query params round-trip through the url as one urlencoded string, which keeps
// the shareable link short and needs no bespoke serialisation
export function serializeParams(params: QueryParam[]): string {
  const search = new URLSearchParams()
  for (const param of params) {
    if (param.key.trim()) search.append(param.key, param.value)
  }
  return search.toString()
}

export function deserializeParams(serialized: string): QueryParam[] {
  const params: QueryParam[] = []
  new URLSearchParams(serialized).forEach((value, key) => params.push({ key, value }))
  return params
}

export function splitUrl(input: string): { base: string; params: QueryParam[] } | null {
  try {
    const parsed = new URL(input)
    const params: QueryParam[] = []
    parsed.searchParams.forEach((value, key) => params.push({ key, value }))
    return { base: parsed.origin + parsed.pathname, params }
  } catch {
    return null
  }
}
