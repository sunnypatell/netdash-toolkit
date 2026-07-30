import { describe, expect, it } from "vitest"
import {
  formatTokenLifetime,
  inspectJwt,
  readTimeClaims,
  timeClaimLabel,
  base64UrlToUtf8,
} from "@/lib/jwt-decode"

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url")
const token = (header: unknown, payload: unknown, sig = "sig") =>
  `${b64(header)}.${b64(payload)}.${sig}`

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0)
const secs = (ms: number) => Math.floor(ms / 1000)

function decoded(t: string, now = NOW) {
  const result = inspectJwt(t, now)
  if (!result.ok) throw new Error(`expected ok, got ${result.error.code}: ${result.error.message}`)
  return result.jwt
}

function failure(t: string, now = NOW) {
  const result = inspectJwt(t, now)
  if (result.ok) throw new Error("expected failure")
  return result.error
}

describe("time claims never imply validity", () => {
  it("a token with no exp reports no time claims rather than a pass", () => {
    const jwt = decoded(token({ alg: "HS256" }, { sub: "a" }))
    expect(jwt.time.state).toBe("no-time-claims")
    expect(jwt.time.expiresAt).toBeNull()
    expect(timeClaimLabel(jwt.time)).toMatch(/no exp or nbf/i)
  })

  it("separates expired, not-yet-valid and active", () => {
    const expired = decoded(token({ alg: "HS256" }, { exp: secs(NOW) - 60 }))
    expect(expired.time.state).toBe("expired")

    const future = decoded(token({ alg: "HS256" }, { nbf: secs(NOW) + 300, exp: secs(NOW) + 600 }))
    expect(future.time.state).toBe("not-yet-valid")

    const active = decoded(token({ alg: "HS256" }, { nbf: secs(NOW) - 10, exp: secs(NOW) + 600 }))
    expect(active.time.state).toBe("active")
  })

  it("nbf is parsed and reported, not silently dropped", () => {
    const jwt = decoded(token({ alg: "HS256" }, { nbf: secs(NOW) + 120 }))
    expect(jwt.time.notBefore?.getTime()).toBe((secs(NOW) + 120) * 1000)
    expect(jwt.time.msUntilValid).toBe(120_000)
    expect(timeClaimLabel(jwt.time)).toMatch(/not valid for another/i)
  })

  it("exp exactly now counts as expired", () => {
    expect(decoded(token({ alg: "HS256" }, { exp: secs(NOW) })).time.state).toBe("expired")
  })

  it("flags non-numeric time claims instead of trusting them", () => {
    const jwt = decoded(token({ alg: "HS256" }, { exp: "1700000000" }))
    expect(jwt.time.malformed).toEqual(["exp"])
    expect(jwt.time.state).toBe("no-time-claims")
  })
})

describe("aud, jti and header extras surface", () => {
  it("normalizes aud from both string and array forms", () => {
    expect(decoded(token({ alg: "HS256" }, { aud: "api" })).audience).toEqual(["api"])
    expect(decoded(token({ alg: "HS256" }, { aud: ["a", "b"] })).audience).toEqual(["a", "b"])
    expect(decoded(token({ alg: "HS256" }, {})).audience).toEqual([])
  })

  it("exposes jti, kid and crit", () => {
    const jwt = decoded(token({ alg: "RS256", kid: "key-1", crit: ["b64"] }, { jti: "abc-123" }))
    expect(jwt.jwtId).toBe("abc-123")
    expect(jwt.kid).toBe("key-1")
    expect(jwt.crit).toEqual(["b64"])
    expect(jwt.alg).toBe("RS256")
  })

  it("flags alg none and a missing alg distinctly", () => {
    expect(decoded(token({ alg: "none" }, { sub: "a" }, "")).algIsNone).toBe(true)
    const noAlg = decoded(token({ typ: "JWT" }, { sub: "a" }))
    expect(noAlg.alg).toBeNull()
    expect(noAlg.algIsNone).toBe(false)
  })
})

describe("errors are specific", () => {
  it("rejects scalar json instead of rendering undefined fields", () => {
    const error = failure("MQ.MQ.x")
    expect(error.code).toBe("not-object")
    expect(error.message).toMatch(/header must be a JSON object/)
    expect(error.message).toMatch(/number 1/)
  })

  it("rejects an array payload", () => {
    const error = failure(token({ alg: "HS256" }, [1, 2, 3]))
    expect(error.code).toBe("not-object")
    expect(error.message).toMatch(/payload must be a JSON object.*array/)
  })

  it("names JWE by its 5 segments", () => {
    const error = failure("a.b.c.d.e")
    expect(error.code).toBe("jwe")
    expect(error.message).toMatch(/JWE/)
  })

  it("reports the real segment count", () => {
    expect(failure("a.b").message).toMatch(/has 2/)
    expect(failure("a.b.c.d").message).toMatch(/has 4/)
  })

  it("distinguishes base64 from json failures", () => {
    expect(failure("!!!.abc.x").code).toBe("base64")
    const badJson = `${Buffer.from("{oops").toString("base64url")}.${b64({})}.x`
    expect(failure(badJson).code).toBe("json")
  })

  it("empty input is not an error message", () => {
    expect(failure("   ").code).toBe("empty")
  })
})

describe("decoding fidelity", () => {
  it("keeps utf-8 claims intact", () => {
    const jwt = decoded(token({ alg: "HS256" }, { name: "José 中文 🎉" }))
    expect(jwt.payload.name).toBe("José 中文 🎉")
  })

  it("base64UrlToUtf8 handles unpadded segments", () => {
    expect(base64UrlToUtf8(Buffer.from("héllo").toString("base64url"))).toBe("héllo")
  })

  it("keeps the raw signature segment", () => {
    expect(decoded(token({ alg: "HS256" }, {}, "abc123")).signature).toBe("abc123")
    expect(decoded(token({ alg: "none" }, {}, "")).signature).toBe("")
  })
})

describe("formatTokenLifetime keeps seconds", () => {
  it("never rounds sub-minute values away", () => {
    expect(formatTokenLifetime(40_000)).toBe("40s")
    expect(formatTokenLifetime(1_000)).toBe("1s")
    expect(formatTokenLifetime(0)).toBe("0s")
  })

  it("builds up progressively", () => {
    expect(formatTokenLifetime(90_000)).toBe("1m 30s")
    expect(formatTokenLifetime(3_661_000)).toBe("1h 1m 1s")
    expect(formatTokenLifetime(90_061_000)).toBe("1d 1h 1m 1s")
  })

  it("labels a token with 40s left as 40s, not 0m", () => {
    const time = readTimeClaims({ exp: secs(NOW) + 40 }, NOW)
    expect(timeClaimLabel(time)).toBe("Within time window - expires in 40s")
  })
})
