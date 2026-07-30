// user-agent analysis for the parser tool.
//
// bowser (MIT, 7.9kB) owns browser/os/engine detection - the hand-rolled regex
// stack it replaced called every iOS browser Safari, legacy Edge Chrome, and
// tested /Samsung/i against UAs that only ever say "SM-S918B". ua-parser-js is
// deliberately NOT used: v2 is AGPL-3.0 and this repo is MIT.
//
// bowser does not do bots, in-app webviews, or device models beyond Apple, and no
// UA can separate Windows 10 from 11 or macOS >= 11. those live here.

import Bowser from "bowser"

export interface UaClientHints {
  platform?: string
  platformVersion?: string
  model?: string
  mobile?: boolean
  architecture?: string
  fullVersionList?: { brand: string; version: string }[]
}

export type UaDeviceType = "desktop" | "mobile" | "tablet" | "tv" | "bot" | "unknown"

export interface UaReport {
  browser: { name: string; version: string }
  os: { name: string; version: string }
  engine: { name: string; version: string }
  device: { type: UaDeviceType; vendor: string; model: string }
  isBot: boolean
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  /** webview / in-app / headless / reduced-UA observations */
  notes: string[]
  /** true when the OS version cannot be pinned down from this input alone */
  osVersionAmbiguous: boolean
  /** why it is ambiguous, or how it was resolved */
  precisionNote: string | null
  usedClientHints: boolean
}

// explicit names carry most of the weight; the generic pattern below only fires
// on a token boundary so device brands like "CUBOT NOTE 20" are not swept in.
const BOT_NAMES = [
  "googlebot",
  "google-inspectiontool",
  "storebot-google",
  "mediapartners-google",
  "adsbot-google",
  "apis-google",
  "feedfetcher-google",
  "bingbot",
  "bingpreview",
  "adidxbot",
  "msnbot",
  "yandexbot",
  "yandeximages",
  "baiduspider",
  "duckduckbot",
  "duckduckgo-favicons-bot",
  "exabot",
  "seznambot",
  "yeti/",
  "petalbot",
  "applebot",
  "facebookexternalhit",
  "facebookcatalog",
  "facebot",
  "meta-externalagent",
  "twitterbot",
  "linkedinbot",
  "slackbot",
  "slack-imgproxy",
  "discordbot",
  "telegrambot",
  "skypeuripreview",
  "redditbot",
  "embedly",
  "quora link preview",
  "vkshare",
  "outbrain",
  "nuzzel",
  "gptbot",
  "chatgpt-user",
  "oai-searchbot",
  "claudebot",
  "claude-web",
  "claude-user",
  "claude-searchbot",
  "anthropic-ai",
  "perplexitybot",
  "perplexity-user",
  "google-extended",
  "ccbot",
  "bytespider",
  "amazonbot",
  "youbot",
  "diffbot",
  "omgili",
  "timpibot",
  "img2dataset",
  "semrushbot",
  "ahrefsbot",
  "ahrefssiteaudit",
  "mj12bot",
  "dotbot",
  "blexbot",
  "dataforseobot",
  "seokicks",
  "screaming frog",
  "sitebulb",
  "barkrowler",
  "zoominfobot",
  "serpstatbot",
  "headlesschrome",
  "phantomjs",
  "puppeteer",
  "playwright",
  "selenium",
  "webdriver",
  "chrome-lighthouse",
  "lighthouse",
  "pagespeed",
  "gtmetrix",
  "pingdom",
  "uptimerobot",
  "statuscake",
  "site24x7",
  "newrelicpinger",
  "datadog",
  "prerender",
  "w3c_validator",
  "validator.nu",
  "curl/",
  "wget",
  "libcurl",
  "python-requests",
  "python-urllib",
  "aiohttp",
  "httpx",
  "scrapy",
  "go-http-client",
  "java/",
  "apache-httpclient",
  "okhttp",
  "axios/",
  "node-fetch",
  "undici",
  "guzzlehttp",
  "libwww-perl",
  "postmanruntime",
  "insomnia",
  "restsharp",
  "zgrab",
  "masscan",
  "nmap",
  "nuclei",
  "wpscan",
]

// "bot" must be followed by a delimiter, not whitespace: phone models like
// "CUBOT NOTE 20" would otherwise classify as crawlers.
// "archiver" has no leading \b because ia_archiver's underscore is a word char.
const GENERIC_BOT_RE =
  /bot(?:[/;)\]]|$)|compatible;\s*[a-z][\w.-]*bot\b|\bcrawl(?:er)?\b|\bspider\b|\bscraper\b|\bslurp\b|archiver\b|\bfetcher\b|\bmonitoring\b/i

// tokens a company uses for BOTH its link-preview fetcher and its in-app browser.
// treating them as unconditional bots reported every Pinterest, WhatsApp, NAVER
// and Sogou user as a crawler.
const AMBIGUOUS_BOT_NAMES = ["pinterest", "whatsapp/", "naver", "sogou", "yahoo"]

// a fetcher does not carry a rendering engine token; an in-app browser does
const BROWSER_SHAPE = /AppleWebKit\/|\bGecko\/|\bTrident\/|\bPresto\//i

function looksLikeBrowser(ua: string): boolean {
  return BROWSER_SHAPE.test(ua)
}

export function isBotUserAgent(ua: string): boolean {
  const lower = ua.toLowerCase()
  if (BOT_NAMES.some((name) => lower.includes(name))) return true
  if (GENERIC_BOT_RE.test(ua)) return true
  if (AMBIGUOUS_BOT_NAMES.some((name) => lower.includes(name))) return !looksLikeBrowser(ua)
  return false
}

/** the token a bot/tool UA identifies itself by, e.g. GPTBot 1.2, curl 8.4.0 */
function botIdentity(ua: string): { name: string; version: string } | null {
  const named = ua.match(
    /([A-Za-z][A-Za-z0-9._-]*(?:bot|crawler|spider|fetch|hit|preview|agent))[/ ]?v?([\d.]+)?/i
  )
  if (named) return { name: named[1], version: named[2] ?? "" }
  // not Mozilla: every browser-shaped UA starts "Mozilla/5.0", and reporting
  // "Identifies as Mozilla 5.0" told the user nothing
  const tool = ua.match(/^(?!Mozilla\/)([A-Za-z][A-Za-z0-9._-]*)\/([\d.]+)/)
  if (tool) return { name: tool[1], version: tool[2] }
  return null
}

// "Google Chrome" and "Chrome" are the same brand; "Chromium" is not
function sameBrand(brand: string, name: string): boolean {
  const norm = (value: string) =>
    value
      .toLowerCase()
      .replace(/^(google|microsoft)\s+/, "")
      .replace(/\s+/g, "")
  const a = norm(brand)
  const b = norm(name)
  return a === b || a.includes(b) || b.includes(a)
}

// brand tokens bowser reports as plain Chrome/Safari
const BRAND_OVERRIDES: { re: RegExp; name: string }[] = [
  { re: /\bBrave\/([\d.]+)/i, name: "Brave" },
  { re: /\bVivaldi\/([\d.]+)/i, name: "Vivaldi" },
  { re: /\bDuckDuckGo\/([\d.]+)/i, name: "DuckDuckGo" },
  { re: /\bYaBrowser\/([\d.]+)/i, name: "Yandex Browser" },
  { re: /\bUCBrowser\/([\d.]+)/i, name: "UC Browser" },
  { re: /\bSamsungBrowser\/([\d.]+)/i, name: "Samsung Internet" },
  { re: /\bOPR\/([\d.]+)/i, name: "Opera" },
  { re: /\bElectron\/([\d.]+)/i, name: "Electron" },
]

const IN_APP: { re: RegExp; label: string }[] = [
  { re: /FBAN|FBAV|FB_IAB|FBIOS/i, label: "Facebook in-app browser" },
  { re: /\bInstagram\b/i, label: "Instagram in-app browser" },
  { re: /\bLine\/|\bLIFF\b/i, label: "LINE in-app browser" },
  { re: /musical_ly|BytedanceWebview|\bTikTok\b/i, label: "TikTok in-app browser" },
  { re: /Snapchat/i, label: "Snapchat in-app browser" },
  { re: /Twitter for/i, label: "X/Twitter in-app browser" },
  { re: /\bGSA\/([\d.]+)/i, label: "Google app in-app browser" },
  { re: /\bPinterest\b/i, label: "Pinterest in-app browser" },
]

const DEVICE_MODELS: { re: RegExp; vendor: string }[] = [
  { re: /\b(SM-[A-Z0-9]+)\b/i, vendor: "Samsung" },
  { re: /\b(GT-[A-Z0-9]+)\b/i, vendor: "Samsung" },
  { re: /\b(Pixel(?:\s+[\dA-Za-z]+)*(?:\s+(?:Pro|XL|Fold|a))?)\b/i, vendor: "Google" },
  { re: /\b(Nexus\s+[\dA-Za-z]+)\b/i, vendor: "Google" },
  { re: /\b(ONEPLUS\s*[A-Z0-9]+|CPH\d{4})\b/i, vendor: "OnePlus" },
  { re: /\b(Redmi[\w\s]*|POCO[\w\s]*|Mi\s+\d+[\w\s]*)\b/i, vendor: "Xiaomi" },
  { re: /\b(moto\s+[\w\s]+|XT\d{4}-\d+)\b/i, vendor: "Motorola" },
  { re: /\b(LM-[A-Z0-9]+)\b/i, vendor: "LG" },
  { re: /\b(Nokia\s+[\w.]+)\b/i, vendor: "Nokia" },
]

// per microsoft's UA-CH guidance: platformVersion 13+ means windows 11
function windowsFromPlatformVersion(platformVersion: string): string | null {
  const major = Number.parseInt(platformVersion.split(".")[0] ?? "", 10)
  if (Number.isNaN(major)) return null
  if (major >= 13) return "11"
  if (major >= 1) return "10"
  return "8.1 or earlier"
}

function emptyReport(): UaReport {
  return {
    browser: { name: "Unknown", version: "" },
    os: { name: "Unknown", version: "" },
    engine: { name: "Unknown", version: "" },
    device: { type: "unknown", vendor: "", model: "" },
    isBot: false,
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    notes: [],
    osVersionAmbiguous: false,
    precisionNote: null,
    usedClientHints: false,
  }
}

export function parseUa(ua: string, hints?: UaClientHints): UaReport {
  const report = emptyReport()
  const trimmed = ua.trim()
  if (!trimmed) return report

  const bot = isBotUserAgent(trimmed)

  let parsed: Bowser.Parser.ParsedResult | null = null
  try {
    parsed = Bowser.parse(trimmed)
  } catch {
    parsed = null
  }

  report.browser = {
    name: parsed?.browser.name || "Unknown",
    version: parsed?.browser.version || "",
  }
  report.engine = {
    name: parsed?.engine.name || "Unknown",
    version: parsed?.engine.version || "",
  }
  report.os = { name: parsed?.os.name || "Unknown", version: parsed?.os.version || "" }
  report.device = {
    type: (parsed?.platform.type as UaDeviceType) || "unknown",
    vendor: parsed?.platform.vendor || "",
    model: parsed?.platform.model || "",
  }

  // brand tokens bowser folds into Chrome/Safari
  for (const { re, name } of BRAND_OVERRIDES) {
    const match = trimmed.match(re)
    if (match) {
      report.browser = { name, version: match[1] || report.browser.version }
      break
    }
  }

  // bowser reports EdgeHTML for EdgiOS; every iOS browser is WebKit by policy
  if (report.os.name === "iOS" || report.os.name === "iPadOS") {
    report.engine = {
      name: "WebKit",
      version: report.engine.name === "WebKit" ? report.engine.version : "",
    }
    if (report.device.model === "iPad") report.os.name = "iPadOS"
  }

  // os version normalisation + the windows 10/11 problem
  if (report.os.name === "Windows") {
    const named = parsed?.os.versionName
    report.os.version = named || report.os.version.replace(/^NT\s*/i, "")
    if (/Windows NT 10\.0/i.test(trimmed)) {
      // stating the range beats asserting "10" when the string cannot say
      report.os.version = "10 or 11"
      report.osVersionAmbiguous = true
      report.precisionNote =
        "Windows NT 10.0 is sent by both Windows 10 and Windows 11 - the UA string cannot tell them apart."
    }
  } else if (report.os.name === "macOS" && /10[._]15[._]7/.test(trimmed)) {
    report.osVersionAmbiguous = true
    report.precisionNote =
      "Safari and Chrome freeze macOS at 10.15.7, so any macOS 11 or newer reports this value."
  } else if (report.os.name === "Android" && !report.os.version) {
    report.precisionNote = "This Android UA omits the OS version."
  }

  // device model - bowser only names Apple hardware
  if (!report.device.model) {
    for (const { re, vendor } of DEVICE_MODELS) {
      const match = trimmed.match(re)
      if (match) {
        report.device.vendor = report.device.vendor || vendor
        report.device.model = match[1].trim()
        break
      }
    }
  }

  // webview / in-app / automation notes
  if (/;\s*wv\)/i.test(trimmed) || (/Version\/4\.0/.test(trimmed) && /Android/i.test(trimmed))) {
    report.notes.push("Android WebView (embedded, not the standalone browser)")
  }
  if (/\bHeadlessChrome\b/i.test(trimmed)) {
    report.notes.push("Headless Chrome (automation)")
  }
  if (/\bElectron\//i.test(trimmed)) {
    report.notes.push("Electron desktop app shell")
  }
  for (const { re, label } of IN_APP) {
    if (re.test(trimmed)) {
      report.notes.push(label)
      break
    }
  }
  if (/Chrome\/\d+\.0\.0\.0/.test(trimmed)) {
    report.notes.push("Reduced UA - Chrome freezes the minor version; use Client Hints for detail")
  }

  // bowser's own bot rules include bare vendor names like /yahoo/i, which flags
  // YahooMobileClient on a real iPhone. only trust them when nothing else says
  // this is a browser.
  const bowserBot = report.device.type === "bot"
  if (bowserBot && !bot && looksLikeBrowser(trimmed)) {
    report.device.type = /\bMobi/i.test(trimmed) ? "mobile" : "desktop"
  }

  // bots last: it overrides the device classification, never the other way round
  if (bot || report.device.type === "bot") {
    report.isBot = true
    report.device.type = "bot"
    const identity = botIdentity(trimmed)
    if (identity && (report.browser.name === "Unknown" || !report.browser.name)) {
      report.browser = identity
    } else if (identity && parsed?.platform.type === "bot") {
      report.browser = identity
    } else if (identity && isBotUserAgent(identity.name)) {
      // a crawler wearing a browser UA: name the crawler, keep the disguise as a note
      report.notes.push(`Renders as ${report.browser.name} ${report.browser.version}`.trimEnd())
      report.browser = identity
    } else if (identity) {
      report.notes.push(
        `Identifies as ${identity.name}${identity.version ? ` ${identity.version}` : ""}`
      )
    }
  } else if (report.browser.name === "Unknown") {
    const identity = botIdentity(trimmed)
    if (identity) report.browser = identity
  }

  report.isMobile = report.device.type === "mobile"
  report.isTablet = report.device.type === "tablet"
  report.isDesktop = report.device.type === "desktop"

  return hints ? applyClientHints(report, hints) : report
}

/**
 * layers navigator.userAgentData high-entropy values over the UA reading. this is
 * the only way to resolve Windows 10 vs 11 or macOS >= 11, and only works on the
 * live-browser path (Chromium, secure context).
 */
export function applyClientHints(report: UaReport, hints: UaClientHints): UaReport {
  const next: UaReport = {
    ...report,
    browser: { ...report.browser },
    os: { ...report.os },
    engine: { ...report.engine },
    device: { ...report.device },
    notes: [...report.notes],
    usedClientHints: true,
  }

  const platform = hints.platform ?? ""
  const platformVersion = hints.platformVersion ?? ""

  if (platformVersion) {
    if (/windows/i.test(platform) || next.os.name === "Windows") {
      const resolved = windowsFromPlatformVersion(platformVersion)
      if (resolved) {
        next.os = { name: "Windows", version: resolved }
        next.osVersionAmbiguous = false
        next.precisionNote = `Resolved from Client Hints platformVersion ${platformVersion}.`
      }
    } else if (/macos/i.test(platform) || next.os.name === "macOS") {
      next.os = { name: "macOS", version: platformVersion.replace(/(\.0)+$/, "") }
      next.osVersionAmbiguous = false
      next.precisionNote = `Resolved from Client Hints platformVersion ${platformVersion}.`
    } else if (platform) {
      next.os = { name: platform, version: platformVersion.replace(/(\.0)+$/, "") }
      next.osVersionAmbiguous = false
      next.precisionNote = `Resolved from Client Hints platformVersion ${platformVersion}.`
    }
  }

  if (hints.model) {
    next.device.model = hints.model
  }

  // fullVersionList carries the real build; the UA only has xxx.0.0.0
  const real = (hints.fullVersionList ?? []).filter((b) => !/not.a.brand/i.test(b.brand))
  // UA-CH uses marketing names, so real Chrome sends "Google Chrome" and never
  // "Chrome". requiring an exact match against bowser's name meant no brand ever
  // matched, the Chromium fallback won, and every Chrome user was relabelled.
  const brand = real.find((b) => sameBrand(b.brand, next.browser.name))
  const chosen = brand ?? real.find((b) => !/^chromium$/i.test(b.brand)) ?? real[0]
  if (chosen) {
    next.browser = {
      // only adopt a brand name when there was nothing to keep; guessing one off
      // this list is what produced "Chromium" for Chrome
      name: next.browser.name === "Unknown" ? chosen.brand : next.browser.name,
      version: chosen.version,
    }
    next.notes = next.notes.filter((n) => !n.startsWith("Reduced UA"))
  }

  if (hints.mobile !== undefined && !next.isBot) {
    if (hints.mobile && next.device.type === "desktop") {
      next.device.type = "mobile"
    } else if (!hints.mobile && next.device.type === "mobile") {
      next.device.type = "desktop"
    }
    next.isMobile = next.device.type === "mobile"
    next.isTablet = next.device.type === "tablet"
    next.isDesktop = next.device.type === "desktop"
  }

  return next
}

/** single label for the device badge - the old UI concatenated flags into "MobileTablet" */
export function deviceLabel(report: UaReport): string {
  switch (report.device.type) {
    case "bot":
      return "Bot / Crawler"
    case "mobile":
      return "Mobile"
    case "tablet":
      return "Tablet"
    case "tv":
      return "TV"
    case "desktop":
      return "Desktop"
    default:
      return "Unknown"
  }
}

export interface HighEntropyReader {
  getHighEntropyValues(hints: string[]): Promise<UaClientHints>
}

/** reads UA-CH from the live browser; null when unsupported (Safari, Firefox) */
export async function readClientHints(): Promise<UaClientHints | null> {
  const data = (
    navigator as Navigator & { userAgentData?: HighEntropyReader & { toJSON?: () => unknown } }
  ).userAgentData
  if (!data || typeof data.getHighEntropyValues !== "function") return null
  try {
    return await data.getHighEntropyValues(["platformVersion", "fullVersionList", "model"])
  } catch {
    return null
  }
}
