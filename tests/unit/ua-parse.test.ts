import { describe, expect, it } from "vitest"
import { applyClientHints, deviceLabel, isBotUserAgent, parseUa } from "@/lib/ua-parse"

const UA = {
  chromeWin:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  safariMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  iosChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1",
  iosFirefox:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120.0 Mobile/15E148 Safari/605.1.15",
  iosEdge:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 EdgiOS/120.0.2210.126 Mobile/15E148 Safari/604.1",
  legacyEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36 Edge/18.17763",
  ipad: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  samsung:
    "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
  samsungChrome:
    "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  androidNoVersion:
    "Mozilla/5.0 (Linux; Android; SM-A515F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  brave:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Brave/120",
  vivaldi:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Vivaldi/6.5",
  yandex:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 YaBrowser/23.11.0.0 Safari/537.36",
  uc: "Mozilla/5.0 (Linux; U; Android 13; en-US; SM-S918B Build/TP1A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.58 UCBrowser/13.4.0.1306 Mobile Safari/537.36",
  chromium:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chromium/120.0.6099.109 Chrome/120.0.6099.109 Safari/537.36",
  electron:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) netdash/3.0.1 Chrome/126.0.6478.234 Electron/31.7.7 Safari/537.36",
  webview:
    "Mozilla/5.0 (Linux; Android 13; SM-S918B Build/TP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/115.0.0.0 Mobile Safari/537.36",
  facebook:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBDV/iPhone14,2]",
  instagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 302.0.0.23.113",
  pixel:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  firefox: "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
}

const BOTS = {
  googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  gptbot:
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot",
  claudebot: "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
  applebot: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Applebot/0.1",
  facebookexternalhit: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  headless:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36",
  curl: "curl/8.4.0",
  wget: "Wget/1.21.4",
  python: "python-requests/2.31.0",
  ahrefs: "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
  bytespider: "Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)",
  perplexity: "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
  semrush: "Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)",
  uptime: "Mozilla/5.0 (compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)",
  postman: "PostmanRuntime/7.36.0",
}

describe("iOS third-party browsers are not Safari", () => {
  it("CriOS is Chrome", () => {
    const report = parseUa(UA.iosChrome)
    expect(report.browser.name).toBe("Chrome")
    expect(report.browser.version).toBe("120.0.6099.119")
    expect(report.os.name).toBe("iOS")
  })

  it("FxiOS is Firefox", () => {
    expect(parseUa(UA.iosFirefox).browser.name).toBe("Firefox")
  })

  it("EdgiOS is Edge, and its engine is WebKit not EdgeHTML", () => {
    const report = parseUa(UA.iosEdge)
    expect(report.browser.name).toMatch(/Edge/)
    expect(report.engine.name).toBe("WebKit")
  })

  it("real Safari on iOS is still Safari", () => {
    const report = parseUa(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    )
    expect(report.browser.name).toBe("Safari")
    expect(report.engine.name).toBe("WebKit")
  })
})

describe("desktop browser identification", () => {
  it("legacy Edge 12-18 is Edge, not Chrome", () => {
    const report = parseUa(UA.legacyEdge)
    expect(report.browser.name).toMatch(/Edge/)
    expect(report.browser.version).toBe("18.17763")
    expect(report.engine.name).toBe("EdgeHTML")
  })

  it("names Blink", () => {
    expect(parseUa(UA.chromeWin).engine.name).toBe("Blink")
    expect(parseUa(UA.vivaldi).engine.name).toBe("Blink")
  })

  it("names Gecko and WebKit", () => {
    expect(parseUa(UA.firefox).engine.name).toBe("Gecko")
    expect(parseUa(UA.safariMac).engine.name).toBe("WebKit")
  })

  it.each([
    ["brave", UA.brave, "Brave"],
    ["vivaldi", UA.vivaldi, "Vivaldi"],
    ["yandex", UA.yandex, "Yandex Browser"],
    ["uc", UA.uc, "UC Browser"],
    ["samsung internet", UA.samsung, "Samsung Internet"],
    ["chromium", UA.chromium, "Chromium"],
    ["electron", UA.electron, "Electron"],
  ])("detects %s", (_label, ua, expected) => {
    expect(parseUa(ua).browser.name).toBe(expected)
  })
})

describe("device classification", () => {
  it("an iPad is a tablet only - never MobileTablet", () => {
    const report = parseUa(UA.ipad)
    expect(report.isTablet).toBe(true)
    expect(report.isMobile).toBe(false)
    expect(report.isDesktop).toBe(false)
    expect(deviceLabel(report)).toBe("Tablet")
  })

  it("an iPhone is mobile only", () => {
    const report = parseUa(UA.iosChrome)
    expect(report.isMobile).toBe(true)
    expect(report.isTablet).toBe(false)
    expect(deviceLabel(report)).toBe("Mobile")
  })

  it("Android without a version stays Android, not Linux", () => {
    const report = parseUa(UA.androidNoVersion)
    expect(report.os.name).toBe("Android")
    expect(report.os.version).toBe("")
    expect(report.precisionNote).toMatch(/omits the OS version/)
  })

  it("finds the Samsung model from SM-xxxx alone", () => {
    for (const ua of [UA.samsung, UA.samsungChrome]) {
      const report = parseUa(ua)
      expect(report.device.vendor, ua).toBe("Samsung")
      expect(report.device.model, ua).toBe("SM-S918B")
    }
  })

  it("finds a Pixel model", () => {
    const report = parseUa(UA.pixel)
    expect(report.device.vendor).toBe("Google")
    expect(report.device.model).toMatch(/^Pixel 8/)
  })
})

describe("webviews and in-app browsers", () => {
  it("flags Android WebView", () => {
    expect(parseUa(UA.webview).notes.join(" ")).toMatch(/Android WebView/)
  })

  it("flags the Facebook in-app browser", () => {
    expect(parseUa(UA.facebook).notes.join(" ")).toMatch(/Facebook in-app/)
  })

  it("flags the Instagram in-app browser", () => {
    expect(parseUa(UA.instagram).notes.join(" ")).toMatch(/Instagram in-app/)
  })

  it("flags Electron", () => {
    expect(parseUa(UA.electron).notes.join(" ")).toMatch(/Electron/)
  })
})

describe("bot detection", () => {
  it.each(Object.entries(BOTS))("classifies %s as a bot", (_name, ua) => {
    const report = parseUa(ua)
    expect(report.isBot).toBe(true)
    expect(report.device.type).toBe("bot")
    expect(report.isDesktop).toBe(false)
    expect(deviceLabel(report)).toBe("Bot / Crawler")
  })

  it("names the crawler rather than calling it Unknown", () => {
    expect(parseUa(BOTS.gptbot).browser.name).toMatch(/GPTBot/i)
    expect(parseUa(BOTS.curl).browser.name).toBe("curl")
    expect(parseUa(BOTS.curl).browser.version).toBe("8.4.0")
  })

  it.each(Object.entries(UA))("does not misclassify %s as a bot", (_name, ua) => {
    expect(parseUa(ua).isBot).toBe(false)
  })

  it("does not treat a phone brand containing 'bot' as a bot", () => {
    expect(
      isBotUserAgent(
        "Mozilla/5.0 (Linux; Android 11; CUBOT NOTE 20) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.74 Mobile Safari/537.36"
      )
    ).toBe(false)
  })
})

describe("os version precision", () => {
  it("marks Windows NT 10.0 as ambiguous without hints", () => {
    const report = parseUa(UA.chromeWin)
    expect(report.os.name).toBe("Windows")
    expect(report.osVersionAmbiguous).toBe(true)
    expect(report.precisionNote).toMatch(/cannot tell them apart/)
    expect(report.usedClientHints).toBe(false)
    // states the range instead of asserting one - the old code hardcoded "10/11"
    expect(report.os.version).toBe("10 or 11")
    expect(report.os.version).not.toContain("/")
  })

  it("resolves Windows 11 from platformVersion >= 13", () => {
    const report = parseUa(UA.chromeWin, { platform: "Windows", platformVersion: "15.0.0" })
    expect(report.os.version).toBe("11")
    expect(report.osVersionAmbiguous).toBe(false)
    expect(report.usedClientHints).toBe(true)
  })

  it("resolves Windows 10 from platformVersion < 13", () => {
    expect(
      parseUa(UA.chromeWin, { platform: "Windows", platformVersion: "10.0.0" }).os.version
    ).toBe("10")
  })

  it("marks the frozen macOS 10.15.7 as ambiguous, then resolves it", () => {
    const base = parseUa(UA.safariMac)
    expect(base.osVersionAmbiguous).toBe(true)
    const resolved = applyClientHints(base, { platform: "macOS", platformVersion: "15.3.1" })
    expect(resolved.os).toEqual({ name: "macOS", version: "15.3.1" })
    expect(resolved.osVersionAmbiguous).toBe(false)
  })

  it("uses fullVersionList for the real build and drops the reduced-UA note", () => {
    const report = parseUa(UA.chromeWin, {
      platform: "Windows",
      platformVersion: "15.0.0",
      fullVersionList: [
        { brand: "Not.A/Brand", version: "99" },
        { brand: "Chrome", version: "120.0.6099.129" },
      ],
    })
    expect(report.browser).toEqual({ name: "Chrome", version: "120.0.6099.129" })
    expect(report.notes.join(" ")).not.toMatch(/Reduced UA/)
  })

  it("notes the reduced UA when no hints are available", () => {
    expect(parseUa(UA.chromeWin).notes.join(" ")).toMatch(/Reduced UA/)
  })

  it("applies the hinted device model", () => {
    const report = parseUa(UA.androidNoVersion, { model: "SM-A515F" })
    expect(report.device.model).toBe("SM-A515F")
  })
})

// real UAs, all of which were previously misclassified
describe("bot detection against real strings", () => {
  const HUMANS = {
    // these four share a token with their company's link-preview fetcher
    pinterestInApp:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21E236 [Pinterest/iOS]",
    whatsappInApp:
      "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.5.78",
    naverInApp:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 NAVER(inapp; search; 2000; 12.9.4)",
    sogouMobile:
      "Mozilla/5.0 (Linux; Android 13; V2166A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/114.0.0.0 Mobile Safari/537.36 SogouMSE,SogouMobileBrowser/5.30.4",
    yahooClient:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 YahooMobileClient/1.0",
  }

  it.each(Object.entries(HUMANS))("does not call %s a bot", (_name, ua) => {
    const report = parseUa(ua)
    expect(report.isBot).toBe(false)
    expect(report.device.type).not.toBe("bot")
    expect(deviceLabel(report)).not.toMatch(/bot/i)
  })

  const FETCHERS = {
    pinterestFetcher: "Pinterest/0.2 (+https://www.pinterest.com/bot.html)",
    whatsappFetcher: "WhatsApp/2.19.81 A",
    sogouSpider: "Sogou web spider/4.0(+http://www.sogou.com/docs/help/webmasters.htm#07)",
    iaArchiver: "ia_archiver (+http://www.alexa.com/site/help/webmasters)",
    // contains Chrome and Mobile and Googlebot all at once
    googlebotSmartphone:
      "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.76 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    bingbot: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  }

  it.each(Object.entries(FETCHERS))("still calls %s a bot", (_name, ua) => {
    const report = parseUa(ua)
    expect(report.isBot).toBe(true)
    expect(report.device.type).toBe("bot")
    expect(report.isDesktop).toBe(false)
    expect(report.isMobile).toBe(false)
  })

  it("names the crawler rather than the browser it is disguised as", () => {
    // applebot wears a full safari UA
    const report = parseUa(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)"
    )
    expect(report.isBot).toBe(true)
    expect(report.browser.name).toMatch(/applebot/i)
    expect(report.notes.join(" ")).toMatch(/Renders as Safari/)
  })

  it("does not emit a note that a UA identifies as Mozilla", () => {
    for (const ua of Object.values(HUMANS)) {
      expect(parseUa(ua).notes.join(" ")).not.toMatch(/Mozilla/)
    }
  })

  // the old \bcrawler?\b read as "crawle" plus an optional r, so a bare "crawl"
  // token never matched
  it("detects a bare crawl token as well as crawler", () => {
    expect(isBotUserAgent("Mozilla/5.0 (compatible; Acme crawl 1.0; +http://acme.test)")).toBe(true)
    expect(isBotUserAgent("Y!J-BRW/1.0 crawler (http://help.yahoo.co.jp/)")).toBe(true)
  })

  it("does not sweep in a device model that merely contains bot", () => {
    expect(
      isBotUserAgent(
        "Mozilla/5.0 (Linux; Android 11; CUBOT NOTE 20) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36"
      )
    ).toBe(false)
  })
})

describe("client hints brand resolution", () => {
  // the brand list chrome actually sends: "Google Chrome", never "Chrome"
  const REAL_CHROME_HINTS = {
    fullVersionList: [
      { brand: "Not/A)Brand", version: "8.0.0.0" },
      { brand: "Chromium", version: "125.0.6422.60" },
      { brand: "Google Chrome", version: "125.0.6422.60" },
    ],
  }

  it("keeps calling Chrome Chrome when given the real brand list", () => {
    const report = parseUa(UA.chromeWin, REAL_CHROME_HINTS)
    expect(report.browser.name).toBe("Chrome")
    expect(report.browser.version).toBe("125.0.6422.60")
  })

  it("does not relabel Chrome as Chromium via applyClientHints either", () => {
    const report = applyClientHints(parseUa(UA.chromeWin), REAL_CHROME_HINTS)
    expect(report.browser.name).toBe("Chrome")
    expect(report.browser.version).toBe("125.0.6422.60")
  })

  it("keeps Microsoft Edge on its own brand string", () => {
    const edge =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.2535.51"
    const report = parseUa(edge, {
      fullVersionList: [
        { brand: "Not/A)Brand", version: "8.0.0.0" },
        { brand: "Chromium", version: "125.0.6422.60" },
        { brand: "Microsoft Edge", version: "125.0.2535.51" },
      ],
    })
    expect(report.browser.name).toBe("Microsoft Edge")
    expect(report.browser.version).toBe("125.0.2535.51")
  })
})

describe("degenerate input", () => {
  it("empty string does not throw", () => {
    const report = parseUa("")
    expect(report.browser.name).toBe("Unknown")
    expect(report.device.type).toBe("unknown")
    expect(deviceLabel(report)).toBe("Unknown")
  })

  it("garbage does not throw", () => {
    expect(() => parseUa("????")).not.toThrow()
  })
})
