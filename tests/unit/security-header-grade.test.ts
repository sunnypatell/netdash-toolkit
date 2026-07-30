import { describe, expect, it } from "vitest"
import { parseResponseBlocks } from "@/lib/http-header-parse"
import {
  assessBlock,
  effectiveReferrerPolicy,
  gradeBlock,
  hstsIsHonoured,
} from "@/lib/security-header-grade"

function assess(lines: string[]) {
  const block = parseResponseBlocks(["HTTP/2 200", ...lines].join("\n"))[0]
  const assessments = assessBlock(block)
  return {
    block,
    of: (key: string) => {
      const found = assessments.find((a) => a.key === key)
      if (!found) throw new Error(`no assessment for ${key}`)
      return found
    },
  }
}

describe("strict-transport-security (rfc 6797)", () => {
  it("is ineffective without max-age, which 6.1.1 makes required", () => {
    const hsts = assess(["strict-transport-security: includeSubDomains"]).of(
      "strict-transport-security"
    )
    expect(hsts.verdict).toBe("ineffective")
    expect(hsts.detail).toMatch(/max-age/i)
  })

  it("treats max-age=0 as switching hsts off, not as protection", () => {
    const hsts = assess(["strict-transport-security: max-age=0"]).of("strict-transport-security")
    expect(hsts.verdict).toBe("ineffective")
    expect(
      gradeBlock(parseResponseBlocks("HTTP/2 200\nstrict-transport-security: max-age=0")[0]).score
    ).toBe(0)
  })

  it("grades a real policy effective and notes a missing includeSubDomains", () => {
    const hsts = assess(["strict-transport-security: max-age=31536000"]).of(
      "strict-transport-security"
    )
    expect(hsts.verdict).toBe("effective")
    expect(hsts.notes.join(" ")).toMatch(/includeSubDomains is absent/)
  })

  it("grades only the first field line and says so (8.1)", () => {
    const hsts = assess([
      "strict-transport-security: max-age=0",
      "strict-transport-security: max-age=31536000; includeSubDomains",
    ]).of("strict-transport-security")
    expect(hsts.verdict).toBe("ineffective")
    expect(hsts.notes.join(" ")).toMatch(/only the first/)
  })

  it("rejects a repeated directive as an invalid field", () => {
    const hsts = assess(["strict-transport-security: max-age=100; max-age=200"]).of(
      "strict-transport-security"
    )
    expect(hsts.verdict).toBe("ineffective")
  })

  it("accepts a quoted max-age and notes a short one", () => {
    const hsts = assess(['strict-transport-security: max-age="600"']).of(
      "strict-transport-security"
    )
    expect(hsts.verdict).toBe("effective")
    expect(hsts.notes.join(" ")).toMatch(/preload list requires/)
  })

  it("knows an hsts header on a cleartext response is ignored by the browser", () => {
    const block = parseResponseBlocks("HTTP/1.1 200 OK\nstrict-transport-security: max-age=1")[0]
    expect(hstsIsHonoured(block, "http://example.com")).toBe(false)
    expect(hstsIsHonoured(block, "https://example.com")).toBe(true)
  })
})

describe("content-security-policy (csp level 3)", () => {
  it("is ineffective when it only reports", () => {
    const csp = assess(["content-security-policy: report-uri /csp"]).of("content-security-policy")
    expect(csp.verdict).toBe("ineffective")
    expect(csp.detail).toMatch(/only reporting directives/)
  })

  it("counts every policy when several field lines are sent", () => {
    const csp = assess([
      "content-security-policy: default-src 'self'",
      "content-security-policy: frame-ancestors 'none'",
    ]).of("content-security-policy")
    expect(csp.verdict).toBe("effective")
    expect(csp.notes.join(" ")).toMatch(/all of them are enforced/)
  })

  it("flags unsafe-inline with no nonce as not stopping injected script", () => {
    const csp = assess(["content-security-policy: script-src 'self' 'unsafe-inline'"]).of(
      "content-security-policy"
    )
    expect(csp.verdict).toBe("effective")
    expect(csp.notes.join(" ")).toMatch(/inline script executes/)
  })

  it("says unsafe-inline is ignored when a nonce is present too", () => {
    const csp = assess(["content-security-policy: script-src 'nonce-abc' 'unsafe-inline'"]).of(
      "content-security-policy"
    )
    expect(csp.notes.join(" ")).toMatch(/ignores 'unsafe-inline'/)
  })

  it("notes a policy that never restricts script", () => {
    const csp = assess(["content-security-policy: frame-ancestors 'none'"]).of(
      "content-security-policy"
    )
    expect(csp.notes.join(" ")).toMatch(/script loading is unrestricted/)
  })
})

describe("x-frame-options (rfc 7034)", () => {
  it("accepts DENY and SAMEORIGIN case-insensitively", () => {
    expect(assess(["x-frame-options: deny"]).of("x-frame-options").verdict).toBe("effective")
    expect(assess(["x-frame-options: SAMEORIGIN"]).of("x-frame-options").verdict).toBe("effective")
  })

  it("rejects ALLOW-FROM, which no current browser implements", () => {
    const xfo = assess(["x-frame-options: ALLOW-FROM https://example.com"]).of("x-frame-options")
    expect(xfo.verdict).toBe("ineffective")
    expect(xfo.detail).toMatch(/never implemented/)
  })

  it("rejects a repeated field line as invalid", () => {
    expect(
      assess(["x-frame-options: DENY", "x-frame-options: SAMEORIGIN"]).of("x-frame-options").verdict
    ).toBe("ineffective")
  })
})

describe("x-content-type-options", () => {
  it("only nosniff counts", () => {
    expect(assess(["x-content-type-options: nosniff"]).of("x-content-type-options").verdict).toBe(
      "effective"
    )
    expect(assess(["x-content-type-options: NOSNIFF"]).of("x-content-type-options").verdict).toBe(
      "effective"
    )
    const bad = assess(["x-content-type-options: sniff"]).of("x-content-type-options")
    expect(bad.verdict).toBe("ineffective")
    expect(bad.detail).toMatch(/determine nosniff/)
  })
})

describe("referrer-policy", () => {
  it("keeps the last recognised token", () => {
    expect(
      effectiveReferrerPolicy(["no-referrer-when-downgrade, strict-origin-when-cross-origin"])
    ).toBe("strict-origin-when-cross-origin")
    expect(effectiveReferrerPolicy(["strict-origin-when-cross-origin, not-a-policy"])).toBe(
      "strict-origin-when-cross-origin"
    )
    expect(effectiveReferrerPolicy(["nonsense"])).toBeNull()
  })

  it("is ineffective when no token is a policy", () => {
    expect(assess(["referrer-policy: nonsense"]).of("referrer-policy").verdict).toBe("ineffective")
  })

  it("flags a policy that still leaks the full url cross-origin", () => {
    const rp = assess(["referrer-policy: unsafe-url"]).of("referrer-policy")
    expect(rp.verdict).toBe("effective")
    expect(rp.notes.join(" ")).toMatch(/sends referrer information across origins/)
  })
})

describe("cross-origin-opener-policy", () => {
  it("treats unsafe-none as isolating nothing", () => {
    expect(
      assess(["cross-origin-opener-policy: unsafe-none"]).of("cross-origin-opener-policy").verdict
    ).toBe("ineffective")
    expect(
      assess(["cross-origin-opener-policy: same-origin"]).of("cross-origin-opener-policy").verdict
    ).toBe("effective")
  })
})

describe("gradeBlock", () => {
  it("never scores a header that is present but doing nothing", () => {
    const block = parseResponseBlocks(
      [
        "HTTP/2 200",
        "strict-transport-security: max-age=0",
        "content-security-policy: report-uri /r",
        "x-frame-options: ALLOW-FROM https://example.com",
        "x-content-type-options: sniff",
        "referrer-policy: bogus",
        "permissions-policy: ",
        "cross-origin-opener-policy: unsafe-none",
      ].join("\n")
    )[0]
    const grade = gradeBlock(block)
    expect(grade.score).toBe(0)
    expect(grade.grade).toBe("F")
    expect(grade.effectiveCount).toBe(0)
    // every one of them was sent, so "missing" would have been the wrong word
    expect(grade.assessments.filter((a) => a.verdict === "missing")).toEqual([])
  })

  it("gives a fully configured response full marks", () => {
    const block = parseResponseBlocks(
      [
        "HTTP/2 200",
        "strict-transport-security: max-age=63072000; includeSubDomains; preload",
        "content-security-policy: default-src 'self'",
        "x-frame-options: DENY",
        "x-content-type-options: nosniff",
        "referrer-policy: strict-origin-when-cross-origin",
        "permissions-policy: geolocation=(), camera=()",
        "cross-origin-opener-policy: same-origin",
      ].join("\n")
    )[0]
    const grade = gradeBlock(block)
    expect(grade.score).toBe(100)
    expect(grade.grade).toBe("A+")
    expect(grade.effectiveCount).toBe(grade.scoredCount)
  })

  it("does not count the deprecated xss filter either way", () => {
    const absent = gradeBlock(parseResponseBlocks("HTTP/2 200\nx-content-type-options: nosniff")[0])
    const present = gradeBlock(
      parseResponseBlocks(
        "HTTP/2 200\nx-content-type-options: nosniff\nx-xss-protection: 1; mode=block"
      )[0]
    )
    expect(present.score).toBe(absent.score)
    expect(present.assessments.find((a) => a.key === "x-xss-protection")?.verdict).toBe(
      "not-scored"
    )
  })
})
