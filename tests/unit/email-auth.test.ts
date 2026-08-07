import { describe, expect, it, vi } from "vitest"
import {
  DNS_TYPE,
  analyzeDkim,
  analyzeDmarc,
  analyzeMx,
  analyzeSpf,
  cleanDomain,
  joinTxtStrings,
  looksLikeDomain,
  parseDmarcUri,
  parseTagList,
  queryDns,
  runEmailDiagnostics,
  scoreEmailAuth,
} from "@/lib/email-auth"
import type { DnsAnswer, DnsResponse } from "@/lib/email-auth"

const answer = (type: number, data: string, name = "example.com"): DnsAnswer => ({
  name,
  type,
  TTL: 300,
  data,
})

const txt = (...records: string[]): DnsResponse => ({
  status: 0,
  answers: records.map((record) => answer(DNS_TYPE.TXT, `"${record}"`)),
})

const mx = (...records: string[]): DnsResponse => ({
  status: 0,
  answers: records.map((record) => answer(DNS_TYPE.MX, record)),
})

const transportFailure: DnsResponse = { status: -1, answers: [], error: "network unreachable" }

describe("txt strings", () => {
  it("concatenates multi-string records with nothing in between (rfc 7208 section 3.3)", () => {
    expect(joinTxtStrings('"v=spf1 include:_spf.example.com " "-all"')).toBe(
      "v=spf1 include:_spf.example.com -all"
    )
    expect(joinTxtStrings('"single"')).toBe("single")
    expect(joinTxtStrings("unquoted")).toBe("unquoted")
  })

  it("keeps '=' inside tag values, which a naive split on '=' truncates", () => {
    const tags = parseTagList("v=DKIM1; k=rsa; p=MIIBIjANBgkqAB==")
    expect(tags.get("p")).toBe("MIIBIjANBgkqAB==")
  })
})

describe("domain input", () => {
  it("extracts the domain from urls and addresses", () => {
    expect(cleanDomain(" https://WWW.Example.com/path?q=1 ")).toBe("example.com")
    expect(cleanDomain("user@Example.com")).toBe("example.com")
    expect(cleanDomain("example.com:8080")).toBe("example.com")
    expect(cleanDomain("example.com.")).toBe("example.com")
  })

  it("rejects values that cannot be a domain", () => {
    expect(looksLikeDomain("example.com")).toBe(true)
    expect(looksLikeDomain("mail.example.co.uk")).toBe(true)
    expect(looksLikeDomain("localhost")).toBe(false)
    expect(looksLikeDomain("not a domain")).toBe(false)
    expect(looksLikeDomain("-example.com")).toBe(false)
  })
})

describe("spf (rfc 7208)", () => {
  it("only accepts a record that starts with the version term (section 4.5)", () => {
    const decoy = txt("google-site-verification=v=spf1 nonsense")
    expect(analyzeSpf(decoy).found).toBe(false)
    expect(analyzeSpf(txt("v=spf1 -all")).found).toBe(true)
    expect(analyzeSpf(txt("V=SPF1 -all")).found).toBe(true)
  })

  it("treats more than one spf record as a permerror (section 4.5)", () => {
    const result = analyzeSpf(txt("v=spf1 -all", "v=spf1 include:a.example -all"))
    expect(result.valid).toBe(false)
    expect(result.errors.join(" ")).toMatch(/2 SPF records published/)
  })

  it("reads a bare all as +all, which is as open as it gets (section 4.6.2)", () => {
    const result = analyzeSpf(txt("v=spf1 ip4:192.0.2.1 all"))
    expect(result.all).toBe("+all")
    expect(result.errors.join(" ")).toMatch(/highly insecure/)
  })

  it("recognizes every qualifier on all", () => {
    expect(analyzeSpf(txt("v=spf1 -all")).all).toBe("-all")
    expect(analyzeSpf(txt("v=spf1 ~all")).all).toBe("~all")
    expect(analyzeSpf(txt("v=spf1 ?all")).all).toBe("?all")
    expect(analyzeSpf(txt("v=spf1 +all")).all).toBe("+all")
  })

  it("counts every dns-querying term against the limit of 10 (section 4.6.4)", () => {
    const eleven = analyzeSpf(
      txt(
        "v=spf1 a mx ptr exists:%{i}.example.com include:one.example include:two.example" +
          " include:three.example include:four.example include:five.example include:six.example" +
          " include:seven.example -all"
      )
    )
    expect(eleven.lookupCount).toBe(11)
    expect(eleven.errors.join(" ")).toMatch(/exceed the limit of 10/)

    // ip4 and ip6 cost nothing
    const cheap = analyzeSpf(txt("v=spf1 ip4:192.0.2.0/24 ip6:2001:db8::/32 -all"))
    expect(cheap.lookupCount).toBe(0)
    expect(cheap.valid).toBe(true)
  })

  it("counts the redirect modifier as a lookup and separates modifiers from mechanisms", () => {
    const result = analyzeSpf(txt("v=spf1 redirect=_spf.example.com"))
    expect(result.lookupCount).toBe(1)
    expect(result.all).toBeNull()
    expect(result.mechanisms).toContain("redirect=_spf.example.com")
  })

  it("flags malformed ip4 and unknown mechanisms", () => {
    expect(analyzeSpf(txt("v=spf1 ip4:192.0.2.999 -all")).errors.join(" ")).toMatch(
      /not a valid IPv4/
    )
    expect(analyzeSpf(txt("v=spf1 includes:example.com -all")).errors.join(" ")).toMatch(
      /Unknown mechanism/
    )
  })

  it("warns about terms that can never be reached and about ptr", () => {
    const result = analyzeSpf(txt("v=spf1 -all include:late.example"))
    expect(result.warnings.join(" ")).toMatch(/never be evaluated/)
    expect(analyzeSpf(txt("v=spf1 ptr -all")).warnings.join(" ")).toMatch(/ptr mechanism/)
  })

  it("reports a failed lookup as unknown instead of missing", () => {
    const result = analyzeSpf(transportFailure)
    expect(result.lookupFailed).toBe(true)
    expect(result.errors[0]).toMatch(/DNS lookup failed/)
    expect(result.errors[0]).not.toMatch(/No SPF record/)
  })

  it("reports nxdomain distinctly", () => {
    expect(analyzeSpf({ status: 3, answers: [] }).errors[0]).toMatch(/NXDOMAIN/)
  })
})

describe("dkim (rfc 6376)", () => {
  const record = "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA=="

  it("preserves base64 padding in the public key", () => {
    const result = analyzeDkim("selector1", txt(record))
    expect(result?.publicKey).toBe("MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA==")
    expect(result?.valid).toBe(true)
    expect(result?.keyType).toBe("rsa")
  })

  it("reads the txt record when the selector is a flattened cname", () => {
    const response: DnsResponse = {
      status: 0,
      answers: [
        answer(DNS_TYPE.CNAME, "dkim.provider.example.", "google._domainkey.example.com"),
        answer(DNS_TYPE.TXT, `"${record}"`, "dkim.provider.example"),
      ],
    }
    const result = analyzeDkim("google", response)
    expect(result?.valid).toBe(true)
    expect(result?.errors).toEqual([])
  })

  it("reports a cname that leads nowhere", () => {
    const response: DnsResponse = {
      status: 0,
      answers: [answer(DNS_TYPE.CNAME, "dkim.provider.example.")],
    }
    expect(analyzeDkim("google", response)?.errors.join(" ")).toMatch(/no DKIM TXT record/)
  })

  it("defaults k to rsa and treats an empty p as revoked (section 3.6.1)", () => {
    expect(analyzeDkim("s1", txt("v=DKIM1; p=abc"))?.keyType).toBe("rsa")
    const revoked = analyzeDkim("s1", txt("v=DKIM1; k=rsa; p="))
    expect(revoked?.valid).toBe(false)
    expect(revoked?.errors.join(" ")).toMatch(/revoked/)
  })

  it("requires the version tag and requires it first", () => {
    expect(analyzeDkim("s1", txt("k=rsa; p=abc"))?.errors.join(" ")).toMatch(/Missing v=DKIM1/)
    expect(analyzeDkim("s1", txt("k=rsa; v=DKIM1; p=abc"))?.errors.join(" ")).toMatch(
      /must be the first tag/
    )
  })

  it("surfaces testing mode, which receivers must not enforce", () => {
    const result = analyzeDkim("s1", txt("v=DKIM1; k=rsa; t=y; p=abc"))
    expect(result?.testing).toBe(true)
    expect(result?.warnings.join(" ")).toMatch(/testing/)
  })

  it("returns nothing when the selector does not exist", () => {
    expect(analyzeDkim("s1", { status: 3, answers: [] })).toBeNull()
    expect(analyzeDkim("s1", transportFailure)).toBeNull()
  })

  it("returns nothing for a failure status that still carries answers", () => {
    // the inputs above have answers: [], so the length check decided them and the failure check never did
    const nxdomainWithCname: DnsResponse = {
      status: 3,
      answers: [answer(DNS_TYPE.TXT, '"v=DKIM1; k=rsa; p=abc"')],
    }
    expect(analyzeDkim("s1", nxdomainWithCname)).toBeNull()

    const servfailWithAnswer: DnsResponse = {
      status: 2,
      answers: [answer(DNS_TYPE.TXT, '"v=DKIM1; k=rsa; p=abc"')],
    }
    expect(analyzeDkim("s1", servfailWithAnswer)).toBeNull()

    // and the same record with a clean status is still read, so the guard is
    // rejecting the status rather than the record
    expect(analyzeDkim("s1", txt("v=DKIM1; k=rsa; p=abc"))?.valid).toBe(true)
  })
})

describe("dmarc (rfc 7489)", () => {
  it("requires the version tag first (section 6.3)", () => {
    expect(analyzeDmarc(txt("p=reject; v=DMARC1")).found).toBe(false)
    expect(analyzeDmarc(txt("v=DMARC1; p=reject")).found).toBe(true)
  })

  it("treats multiple records as no dmarc processing at all (section 6.6.3)", () => {
    const result = analyzeDmarc(txt("v=DMARC1; p=reject", "v=DMARC1; p=none"))
    expect(result.valid).toBe(false)
    expect(result.errors.join(" ")).toMatch(/no DMARC processing/)
  })

  it("reads pct=0 as zero, not as the default of 100", () => {
    const result = analyzeDmarc(txt("v=DMARC1; p=reject; pct=0; rua=mailto:a@example.com"))
    expect(result.percentage).toBe(0)
    expect(result.warnings.join(" ")).toMatch(/monitoring only/)
  })

  it("rejects a pct outside 0-100", () => {
    expect(analyzeDmarc(txt("v=DMARC1; p=reject; pct=150")).errors.join(" ")).toMatch(/Invalid pct/)
    expect(analyzeDmarc(txt("v=DMARC1; p=reject; pct=abc")).errors.join(" ")).toMatch(/Invalid pct/)
  })

  it("validates the policy values and normalizes case", () => {
    expect(analyzeDmarc(txt("v=DMARC1; p=Reject")).policy).toBe("reject")
    const bogus = analyzeDmarc(txt("v=DMARC1; p=rejct"))
    expect(bogus.policy).toBeNull()
    expect(bogus.errors.join(" ")).toMatch(/Invalid p=rejct/)
  })

  it("inherits sp from p and flags a weaker sp", () => {
    expect(analyzeDmarc(txt("v=DMARC1; p=reject")).effectiveSubdomainPolicy).toBe("reject")
    const weak = analyzeDmarc(txt("v=DMARC1; p=reject; sp=none"))
    expect(weak.effectiveSubdomainPolicy).toBe("none")
    expect(weak.warnings.join(" ")).toMatch(/subdomains unprotected/)
  })

  it("defaults alignment to relaxed and validates it", () => {
    const strict = analyzeDmarc(txt("v=DMARC1; p=reject; adkim=s; aspf=s"))
    expect(strict.dkimAlignment).toBe("s")
    expect(strict.spfAlignment).toBe("s")
    const relaxed = analyzeDmarc(txt("v=DMARC1; p=reject"))
    expect(relaxed.dkimAlignment).toBe("r")
    expect(analyzeDmarc(txt("v=DMARC1; p=reject; adkim=x")).warnings.join(" ")).toMatch(
      /Invalid adkim/
    )
  })

  it("parses report uris including the size limit suffix", () => {
    expect(parseDmarcUri("mailto:dmarc@example.com!10m")).toEqual({
      address: "dmarc@example.com",
      scheme: "mailto",
      limit: "10m",
    })

    const result = analyzeDmarc(
      txt("v=DMARC1; p=reject; rua=mailto:a@example.com!10m,mailto:b@example.com")
    )
    expect(result.rua).toEqual(["a@example.com", "b@example.com"])
  })

  it("keeps a missing required p tag an error", () => {
    const result = analyzeDmarc(txt("v=DMARC1; rua=mailto:a@example.com"))
    expect(result.errors.join(" ")).toMatch(/Missing required 'p'/)
  })
})

describe("mx (rfc 5321, rfc 7505)", () => {
  it("orders by preference and strips the trailing dot", () => {
    const result = analyzeMx(mx("20 alt.mail.example.com.", "10 mail.example.com."))
    expect(result.records.map((r) => r.exchange)).toEqual([
      "mail.example.com",
      "alt.mail.example.com",
    ])
    expect(result.records[0].priority).toBe(10)
    expect(result.records[0].ttl).toBe(300)
  })

  it("detects a null mx as accepting no mail", () => {
    const result = analyzeMx(mx("0 ."))
    expect(result.nullMx).toBe(true)
    expect(result.records).toEqual([])
    expect(result.errors.join(" ")).toMatch(/null MX/)
  })

  it("ignores non-mx answers in the chain", () => {
    const response: DnsResponse = {
      status: 0,
      answers: [answer(DNS_TYPE.CNAME, "other.example."), answer(DNS_TYPE.MX, "10 mail.example.")],
    }
    expect(analyzeMx(response).records).toHaveLength(1)
  })

  it("warns when the target is an ip address", () => {
    expect(analyzeMx(mx("10 192.0.2.1")).warnings.join(" ")).toMatch(/requires a hostname/)
  })
})

describe("scoring", () => {
  const base = {
    domain: "example.com",
    mx: analyzeMx(mx("10 mail.example.com.")),
    spf: analyzeSpf(txt("v=spf1 -all")),
    dkim: [],
    dmarc: analyzeDmarc(txt("v=DMARC1; p=reject; rua=mailto:a@example.com")),
    incomplete: false,
    timestamp: new Date(0),
  }

  it("gives full marks for mx, strict spf, and p=reject", () => {
    expect(scoreEmailAuth(base)).toBe(70)
  })

  it("does not credit enforcement when pct=0", () => {
    const monitoring = {
      ...base,
      dmarc: analyzeDmarc(txt("v=DMARC1; p=reject; pct=0; rua=mailto:a@example.com")),
    }
    expect(scoreEmailAuth(monitoring)).toBe(scoreEmailAuth(base) - 7)
  })

  it("does not credit a null mx domain with working mail", () => {
    expect(scoreEmailAuth({ ...base, mx: analyzeMx(mx("0 .")) })).toBe(scoreEmailAuth(base) - 20)
  })

  it("does not treat a testing dkim key as enforced", () => {
    const testing = analyzeDkim("s1", txt("v=DKIM1; k=rsa; t=y; p=abc"))!
    const live = analyzeDkim("s1", txt("v=DKIM1; k=rsa; p=abc"))!
    expect(scoreEmailAuth({ ...base, dkim: [testing] })).toBe(
      scoreEmailAuth({ ...base, dkim: [live] }) - 15
    )
  })

  it("pins the dkim weights below the 100 clamp, where they are visible", () => {
    // with p=reject the total lands on the clamp, so the enforcement weight could move unnoticed
    const relaxed = {
      ...base,
      dmarc: analyzeDmarc(txt("v=DMARC1; p=none; rua=mailto:a@example.com")),
    }
    const testing = analyzeDkim("s1", txt("v=DKIM1; k=rsa; t=y; p=abc"))!
    const live = analyzeDkim("s1", txt("v=DKIM1; k=rsa; p=abc"))!

    expect(scoreEmailAuth(relaxed)).toBe(63) // 20 mx + 30 spf + 13 dmarc
    expect(scoreEmailAuth({ ...relaxed, dkim: [testing] })).toBe(78) // + 15 present
    expect(scoreEmailAuth({ ...relaxed, dkim: [live] })).toBe(93) // + 15 enforced
  })

  it("never exceeds 100", () => {
    const live = analyzeDkim("s1", txt("v=DKIM1; k=rsa; p=abc"))!
    expect(scoreEmailAuth({ ...base, dkim: [live] })).toBe(100)
  })
})

describe("doh transport", () => {
  const json = (body: unknown) =>
    ({ ok: true, status: 200, json: async () => body }) as unknown as Response

  it("asks for the dns-json media type and passes name and type", async () => {
    const fetchImpl = vi.fn(async () => json({ Status: 0, Answer: [] }))
    await queryDns("example.com", "TXT", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      resolvers: ["https://resolver.test/dns-query"],
    })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://resolver.test/dns-query?name=example.com&type=TXT")
    expect((init.headers as Record<string, string>).Accept).toBe("application/dns-json")
  })

  it("falls back to the second resolver instead of reporting no records", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("blocked"))
      .mockResolvedValueOnce(json({ Status: 0, Answer: [answer(DNS_TYPE.TXT, '"v=spf1 -all"')] }))
    const response = await queryDns("example.com", "TXT", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      resolvers: ["https://a.test/dns-query", "https://b.test/dns-query"],
    })
    expect(response.error).toBeUndefined()
    expect(analyzeSpf(response).found).toBe(true)
  })

  it("treats a non-2xx resolver as a failure, not as a dns answer", async () => {
    // a 500 still returns a body, read as Status: 0, so an outage reads as "no spf record"
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ Status: 0, Answer: [] }),
      } as unknown as Response)
      .mockResolvedValueOnce(json({ Status: 0, Answer: [answer(DNS_TYPE.TXT, '"v=spf1 -all"')] }))

    const response = await queryDns("example.com", "TXT", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      resolvers: ["https://a.test/dns-query", "https://b.test/dns-query"],
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(response.resolver).toBe("https://b.test/dns-query")
    expect(analyzeSpf(response).found).toBe(true)
  })

  it("reports the http status when every resolver answers non-2xx", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ Status: 0, Answer: [] }),
    } as unknown as Response)
    const response = await queryDns("example.com", "TXT", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      resolvers: ["https://a.test/dns-query"],
    })
    expect(response.error).toMatch(/HTTP 503/)
    expect(response.answers).toEqual([])
  })

  it("reports an error when every resolver fails", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("blocked"))
    const response = await queryDns("example.com", "TXT", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      resolvers: ["https://a.test/dns-query", "https://b.test/dns-query"],
    })
    expect(response.error).toBe("blocked")
    expect(response.answers).toEqual([])
  })
})

describe("full run", () => {
  const respond = (map: Record<string, unknown>) =>
    vi.fn(async (url: string) => {
      const name = new URL(url).searchParams.get("name") ?? ""
      const type = new URL(url).searchParams.get("type") ?? ""
      const body = map[`${type}:${name}`] ?? { Status: 0, Answer: [] }
      return { ok: true, status: 200, json: async () => body } as unknown as Response
    })

  it("assembles a result from one query per record type", async () => {
    const fetchImpl = respond({
      "MX:example.com": { Status: 0, Answer: [answer(DNS_TYPE.MX, "10 mail.example.com.")] },
      "TXT:example.com": {
        Status: 0,
        Answer: [answer(DNS_TYPE.TXT, '"v=spf1 include:_spf.example.com -all"')],
      },
      "TXT:selector1._domainkey.example.com": {
        Status: 0,
        Answer: [answer(DNS_TYPE.TXT, '"v=DKIM1; k=rsa; p=abc"')],
      },
      "TXT:_dmarc.example.com": {
        Status: 0,
        Answer: [answer(DNS_TYPE.TXT, '"v=DMARC1; p=reject; rua=mailto:d@example.com"')],
      },
    })

    const progress: string[] = []
    const result = await runEmailDiagnostics("example.com", {
      selectors: ["selector1", "missing"],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      resolvers: ["https://resolver.test/dns-query"],
      onProgress: (message) => progress.push(message),
    })

    expect(result.mx.records).toHaveLength(1)
    expect(result.spf.all).toBe("-all")
    expect(result.dkim.map((d) => d.selector)).toEqual(["selector1"])
    expect(result.dmarc.policy).toBe("reject")
    expect(result.incomplete).toBe(false)
    expect(result.overallScore).toBe(100)
    expect(progress).toHaveLength(4)
  })

  it("marks the result incomplete when a lookup fails", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("blocked"))
    const result = await runEmailDiagnostics("example.com", {
      selectors: ["selector1"],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      resolvers: ["https://resolver.test/dns-query"],
    })
    expect(result.incomplete).toBe(true)
    expect(result.spf.lookupFailed).toBe(true)
    expect(result.overallScore).toBe(0)
  })

  // the test above rejects every request, so all four disjuncts are true; these fail one each
  it.each([
    ["mx", "MX:example.com"],
    ["spf", "TXT:example.com"],
    ["dmarc", "TXT:_dmarc.example.com"],
    ["dkim", "TXT:selector1._domainkey.example.com"],
  ])("marks the result incomplete when only the %s lookup fails", async (_which, failingKey) => {
    const fetchImpl = vi.fn(async (url: string) => {
      const params = new URL(url).searchParams
      const key = `${params.get("type")}:${params.get("name")}`
      if (key === failingKey) throw new Error("blocked")
      return { ok: true, status: 200, json: async () => ({ Status: 0, Answer: [] }) } as Response
    })
    const result = await runEmailDiagnostics("example.com", {
      selectors: ["selector1"],
      fetchImpl: fetchImpl as unknown as typeof fetch,
      resolvers: ["https://resolver.test/dns-query"],
    })
    expect(result.incomplete).toBe(true)
  })

  it("is complete when every lookup answers, even with nothing configured", () => {
    // the negative side: `incomplete` must not just always be true
    return runEmailDiagnostics("example.com", {
      selectors: ["selector1"],
      fetchImpl: respond({}) as unknown as typeof fetch,
      resolvers: ["https://resolver.test/dns-query"],
    }).then((result) => {
      expect(result.incomplete).toBe(false)
    })
  })
})
