// injectable rng so counts are assertable. Math.random is fine: nothing here is ever a secret.

export type LoremMode = "paragraphs" | "sentences" | "words"

export const LOREM_MAX: Record<LoremMode, number> = {
  paragraphs: 50,
  sentences: 200,
  words: 1000,
}

export const CLASSIC_OPENING = [
  "lorem",
  "ipsum",
  "dolor",
  "sit",
  "amet",
  "consectetur",
  "adipiscing",
  "elit",
]

// kept as one string so prettier does not explode it into 150 lines
export const WORDS = `lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor
incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation
ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate
velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt
culpa qui officia deserunt mollit anim id est laborum ac ante arcu at auctor bibendum blandit
condimentum congue cras cursus diam dictum dignissim donec dui eget eleifend elementum facilisi
faucibus felis fermentum fringilla gravida habitant hendrerit imperdiet integer interdum justo
lacinia lacus laoreet lectus leo libero ligula lobortis luctus maecenas massa mattis mauris
metus morbi nam nec neque nibh nisl nullam nunc odio orci ornare pellentesque pharetra placerat
porta posuere praesent pretium proin pulvinar purus quam risus sagittis sapien scelerisque
semper senectus sodales suspendisse tellus tincidunt tortor tristique turpis ultrices ultricies
urna varius vehicula vel vestibulum vitae vivamus viverra volutpat vulputate`
  .split(/\s+/)
  .filter(Boolean)

/** returns a float in [0, 1); swapped out in tests for a deterministic sequence */
export type Rng = () => number

export interface LoremOptions {
  mode: LoremMode
  count: number
  startWithLorem: boolean
}

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)

function pick(rng: Rng): string {
  return WORDS[Math.floor(rng() * WORDS.length)]
}

function intBetween(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

// the classic opening counts toward n; the old version pasted five extra words on top
export function loremWords(count: number, startWithLorem: boolean, rng: Rng): string[] {
  const n = Math.max(0, Math.floor(count))
  const words: string[] = []
  if (startWithLorem) words.push(...CLASSIC_OPENING.slice(0, n))
  while (words.length < n) words.push(pick(rng))
  return words
}

function sentenceFrom(words: string[]): string {
  if (words.length === 0) return ""
  return `${capitalize(words[0])}${words.length > 1 ? " " + words.slice(1).join(" ") : ""}.`
}

export function loremSentence(rng: Rng, startWithLorem = false): string {
  const length = intBetween(rng, 6, 16)
  return sentenceFrom(loremWords(length, startWithLorem, rng))
}

export function loremParagraph(rng: Rng, startWithLorem = false): string {
  const length = intBetween(rng, 3, 7)
  return Array.from({ length }, (_, i) => loremSentence(rng, startWithLorem && i === 0)).join(" ")
}

export function generateLorem(options: LoremOptions, rng: Rng = Math.random): string {
  const max = LOREM_MAX[options.mode]
  const count = Math.min(Math.max(1, Math.floor(options.count)), max)
  const { mode, startWithLorem } = options

  if (mode === "words") return loremWords(count, startWithLorem, rng).join(" ")
  if (mode === "sentences") {
    return Array.from({ length: count }, (_, i) =>
      loremSentence(rng, startWithLorem && i === 0)
    ).join(" ")
  }
  return Array.from({ length: count }, (_, i) =>
    loremParagraph(rng, startWithLorem && i === 0)
  ).join("\n\n")
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

export function countSentences(text: string): number {
  return text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length
}

export function countParagraphs(text: string): number {
  if (text.trim() === "") return 0
  return text.split(/\n{2,}/).filter((p) => p.trim().length > 0).length
}
