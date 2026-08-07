// crypto.getRandomValues only. rejection sampling because modulo folding a 32-bit draw biases
// the first (2^32 % n) characters, and entropy is quoted from the charset left after exclusions.

export interface PasswordOptions {
  length: number
  uppercase: boolean
  lowercase: boolean
  numbers: boolean
  symbols: boolean
  excludeAmbiguous: boolean
  excludeSimilar: boolean
}

export const CHARS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?",
  ambiguous: "{}[]()/\\'\"`~,;:.<>",
  similar: "il1Lo0O",
} as const

export type RandomFill = (buffer: Uint32Array) => void

const defaultFill: RandomFill = (buffer) => {
  crypto.getRandomValues(buffer)
}

/** the charset actually drawn from, after exclusions. may be empty. */
export function buildCharset(options: PasswordOptions): string {
  let pool = ""
  if (options.uppercase) pool += CHARS.uppercase
  if (options.lowercase) pool += CHARS.lowercase
  if (options.numbers) pool += CHARS.numbers
  if (options.symbols) pool += CHARS.symbols

  const excluded = new Set<string>()
  if (options.excludeAmbiguous) for (const c of CHARS.ambiguous) excluded.add(c)
  if (options.excludeSimilar) for (const c of CHARS.similar) excluded.add(c)

  const seen = new Set<string>()
  let charset = ""
  for (const c of pool) {
    if (excluded.has(c) || seen.has(c)) continue
    seen.add(c)
    charset += c
  }
  return charset
}

// draws at or above the largest multiple of size under 2^32 are discarded, not folded
export function uniformIndex(size: number, fill: RandomFill = defaultFill): number {
  if (size <= 0) throw new Error("size must be positive")
  if (size === 1) return 0
  const limit = Math.floor(0x100000000 / size) * size
  const buffer = new Uint32Array(1)
  // expected iterations < 2 for every size we use; unbounded only in theory
  for (;;) {
    fill(buffer)
    if (buffer[0] < limit) return buffer[0] % size
  }
}

export class EmptyCharsetError extends Error {
  constructor() {
    super("No characters left to choose from. Enable a character type or relax the exclusions.")
    this.name = "EmptyCharsetError"
  }
}

export function generatePassword(options: PasswordOptions, fill: RandomFill = defaultFill): string {
  const charset = buildCharset(options)
  if (charset.length === 0) throw new EmptyCharsetError()

  const length = Math.max(1, Math.floor(options.length))
  let password = ""
  for (let i = 0; i < length; i++) {
    password += charset[uniformIndex(charset.length, fill)]
  }
  return password
}

export interface PasswordStrength {
  score: number
  label: string
  color: string
  entropy: number
  charsetSize: number
}

/** log2(size^length), computed as length * log2(size) so large lengths stay finite */
export function entropyBits(charsetSize: number, length: number): number {
  if (charsetSize <= 1 || length <= 0) return 0
  return length * Math.log2(charsetSize)
}

export function strengthOf(charsetSize: number, length: number): PasswordStrength {
  const entropy = entropyBits(charsetSize, length)

  let score = 0
  let label = "Very Weak"
  let color = "bg-red-500"

  if (entropy >= 128) {
    score = 100
    label = "Excellent"
    color = "bg-green-600"
  } else if (entropy >= 80) {
    score = 80
    label = "Strong"
    color = "bg-green-500"
  } else if (entropy >= 60) {
    score = 60
    label = "Good"
    color = "bg-yellow-500"
  } else if (entropy >= 40) {
    score = 40
    label = "Fair"
    color = "bg-orange-500"
  } else if (entropy >= 28) {
    score = 20
    label = "Weak"
    color = "bg-red-500"
  }

  return { score, label, color, entropy: Math.round(entropy), charsetSize }
}
