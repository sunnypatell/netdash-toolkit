import { describe, expect, it } from "vitest"
import {
  CLASSIC_OPENING,
  LOREM_MAX,
  WORDS,
  countParagraphs,
  countSentences,
  countWords,
  generateLorem,
  loremWords,
} from "@/lib/lorem"

// deterministic so the counts can be asserted exactly; placeholder prose is the one decoration case
function seeded(seed = 1): () => number {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}

describe("the requested count is what you get", () => {
  it("returns exactly n words", () => {
    for (const n of [1, 2, 5, 7, 50, 500]) {
      expect(
        countWords(generateLorem({ mode: "words", count: n, startWithLorem: false }, seeded()))
      ).toBe(n)
    }
  })

  it("still returns exactly n words with the classic opening spliced in", () => {
    // the old implementation pasted the "Lorem ipsum" opener on top of the count, so 50 gave 54
    for (const n of [1, 2, 5, 8, 9, 50]) {
      const text = generateLorem({ mode: "words", count: n, startWithLorem: true }, seeded())
      expect(countWords(text), `${n} words`).toBe(n)
    }
  })

  it("does not mangle a single word", () => {
    const text = generateLorem({ mode: "words", count: 1, startWithLorem: true }, seeded())
    expect(text).toBe("lorem")
  })

  it("returns exactly n sentences", () => {
    for (const n of [1, 3, 10, 25]) {
      const text = generateLorem({ mode: "sentences", count: n, startWithLorem: true }, seeded())
      expect(countSentences(text), `${n} sentences`).toBe(n)
    }
  })

  it("returns exactly n paragraphs", () => {
    for (const n of [1, 3, 5, 20]) {
      const text = generateLorem({ mode: "paragraphs", count: n, startWithLorem: true }, seeded())
      expect(countParagraphs(text), `${n} paragraphs`).toBe(n)
    }
  })

  it("clamps to the mode's ceiling and to at least one", () => {
    for (const mode of ["words", "sentences", "paragraphs"] as const) {
      const over = generateLorem(
        { mode, count: LOREM_MAX[mode] + 100, startWithLorem: false },
        seeded()
      )
      const under = generateLorem({ mode, count: 0, startWithLorem: false }, seeded())
      expect(under.trim().length).toBeGreaterThan(0)
      if (mode === "words") expect(countWords(over)).toBe(LOREM_MAX.words)
      if (mode === "sentences") expect(countSentences(over)).toBe(LOREM_MAX.sentences)
      if (mode === "paragraphs") expect(countParagraphs(over)).toBe(LOREM_MAX.paragraphs)
    }
  })
})

describe("shape of the text", () => {
  it("opens with the classic words when asked", () => {
    expect(loremWords(8, true, seeded())).toEqual(CLASSIC_OPENING)
    expect(loremWords(3, true, seeded())).toEqual(CLASSIC_OPENING.slice(0, 3))
  })

  it("capitalizes each sentence and ends it with a period", () => {
    const text = generateLorem({ mode: "sentences", count: 5, startWithLorem: true }, seeded(7))
    expect(text.startsWith("Lorem ipsum dolor sit amet")).toBe(true)
    for (const sentence of text.split(". ")) {
      expect(sentence.trim()[0]).toMatch(/[A-Z]/)
    }
    expect(text.endsWith(".")).toBe(true)
  })

  it("separates paragraphs with a blank line", () => {
    const text = generateLorem({ mode: "paragraphs", count: 3, startWithLorem: false }, seeded(3))
    expect(text.split("\n\n")).toHaveLength(3)
  })

  it("only ever emits words from its own vocabulary", () => {
    const text = generateLorem({ mode: "words", count: 500, startWithLorem: false }, seeded(11))
    const vocabulary = new Set(WORDS)
    for (const word of text.split(" ")) expect(vocabulary.has(word), word).toBe(true)
  })

  it("varies with the rng, so two runs are not the same text", () => {
    const a = generateLorem({ mode: "words", count: 40, startWithLorem: false }, seeded(1))
    const b = generateLorem({ mode: "words", count: 40, startWithLorem: false }, seeded(2))
    expect(a).not.toBe(b)
  })
})

describe("counters", () => {
  it("counts words, sentences and paragraphs the way a user would", () => {
    expect(countWords("  one   two three ")).toBe(3)
    expect(countWords("")).toBe(0)
    expect(countSentences("One. Two. Three.")).toBe(3)
    expect(countParagraphs("a\n\nb\n\nc")).toBe(3)
    expect(countParagraphs("")).toBe(0)
  })
})
