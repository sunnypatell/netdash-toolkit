import { describe, expect, it } from "vitest"
import {
  computeHash,
  computeHashes,
  cryptoAvailability,
  encodeText,
  HASH_ALGORITHMS,
  UNAVAILABLE_ALGORITHMS,
  verifyHash,
} from "@/lib/hash"

describe("only the algorithms Web Crypto actually registers are offered", () => {
  it("lists exactly the four WebCryptoAPI digest algorithms", () => {
    expect(HASH_ALGORITHMS.map((a) => a.name).sort()).toEqual([
      "SHA-1",
      "SHA-256",
      "SHA-384",
      "SHA-512",
    ])
  })

  it("offers no algorithm crypto.subtle would reject", async () => {
    for (const algo of HASH_ALGORITHMS) {
      await expect(computeHash(encodeText("abc"), algo.name)).resolves.toMatch(/^[0-9a-f]+$/)
    }
  })

  it("names MD5 as unavailable with the reason, rather than claiming it", () => {
    const md5 = UNAVAILABLE_ALGORITHMS.find((a) => a.name === "MD5")
    expect(md5?.reason).toMatch(/not in the Web Crypto spec/i)
    expect(HASH_ALGORITHMS.some((a) => /md5/i.test(a.name))).toBe(false)
  })

  it("confirms crypto.subtle really does reject the unavailable names", async () => {
    for (const name of ["MD5", "SHA3-256", "CRC32"]) {
      await expect(computeHash(encodeText("abc"), name)).rejects.toThrow()
    }
  })

  it("marks SHA-1 deprecated but keeps it, since it is in the spec", () => {
    const sha1 = HASH_ALGORITHMS.find((a) => a.name === "SHA-1")
    expect(sha1?.status).toBe("deprecated")
    expect(sha1?.description).toMatch(/collision/i)
  })
})

describe("published test vectors", () => {
  // FIPS 180-4 and RFC 3174 for the input "abc"
  it.each([
    ["SHA-1", "a9993e364706816aba3e25717850c26c9cd0d89d"],
    ["SHA-256", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    [
      "SHA-384",
      "cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7",
    ],
    [
      "SHA-512",
      "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
    ],
  ])("%s of 'abc'", async (algorithm, expected) => {
    expect(await computeHash(encodeText("abc"), algorithm)).toBe(expected)
  })

  it("hashes the empty input to the published empty-string digests", async () => {
    expect(await computeHash(encodeText(""), "SHA-256")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    )
  })

  it("hashes the utf-8 bytes of non-ascii text", async () => {
    // "café" is 5 utf-8 bytes, so the digest must differ from the 4-byte latin-1 reading
    const utf8 = await computeHash(encodeText("café"), "SHA-256")
    const latin1 = await computeHash(new Uint8Array([0x63, 0x61, 0x66, 0xe9]), "SHA-256")
    expect(utf8).not.toBe(latin1)
    expect(encodeText("café")).toHaveLength(5)
  })

  it("produces a digest of the documented hex width", async () => {
    const results = await computeHashes(encodeText("abc"))
    for (const result of results) {
      const algo = HASH_ALGORITHMS.find((a) => a.name === result.algorithm)
      expect(result.hash).toHaveLength(algo?.hexChars ?? 0)
      expect(result.bits).toBe(algo?.bits)
    }
  })
})

describe("cryptoAvailability", () => {
  it("reports available in this environment, which has crypto.subtle", () => {
    expect(cryptoAvailability()).toBe("available")
  })
})

describe("verifyHash", () => {
  it("names the algorithm that matched", async () => {
    const hashes = await computeHashes(encodeText("abc"))
    const outcome = verifyHash(
      hashes,
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    )
    expect(outcome).toEqual({ state: "match", algorithm: "SHA-256" })
  })

  it("is case insensitive and tolerates surrounding space and an 0x prefix", async () => {
    const hashes = await computeHashes(encodeText("abc"))
    expect(verifyHash(hashes, "  A9993E364706816ABA3E25717850C26C9CD0D89D  ")?.algorithm).toBe(
      "SHA-1"
    )
    expect(verifyHash(hashes, "0xa9993e364706816aba3e25717850c26c9cd0d89d")?.algorithm).toBe(
      "SHA-1"
    )
  })

  it("reports a mismatch without naming an algorithm", async () => {
    const hashes = await computeHashes(encodeText("abc"))
    expect(verifyHash(hashes, "deadbeef")).toEqual({ state: "mismatch", algorithm: null })
  })

  it("distinguishes 'not a hash' from 'does not match'", async () => {
    const hashes = await computeHashes(encodeText("abc"))
    expect(verifyHash(hashes, "not a hash at all")?.state).toBe("not-a-hash")
  })

  it("returns null for an empty candidate", async () => {
    expect(verifyHash(await computeHashes(encodeText("abc")), "   ")).toBeNull()
  })
})
