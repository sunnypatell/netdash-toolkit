// symbols follow IEC 80000-13:2008: SI prefixes for powers of 1000, IEC for 1024. "kb" is never
// used because it differs from "kB" only by case, the usual source of an 8x or 1.024x error.

export type UnitBase = "decimal" | "binary"
export type UnitKind = "bit" | "byte"

export interface DataUnit {
  /** stable id: select value and query-string value */
  id: string
  /** symbol shown next to a figure */
  symbol: string
  name: string
  /** exact number of bits in one of this unit */
  bits: number
  base: UnitBase
  kind: UnitKind
}

const DECIMAL_PREFIXES = [
  { p: "", n: "", exp: 0 },
  { p: "k", n: "kilo", exp: 1 },
  { p: "M", n: "mega", exp: 2 },
  { p: "G", n: "giga", exp: 3 },
  { p: "T", n: "tera", exp: 4 },
  { p: "P", n: "peta", exp: 5 },
]

const BINARY_PREFIXES = [
  { p: "Ki", n: "kibi", exp: 1 },
  { p: "Mi", n: "mebi", exp: 2 },
  { p: "Gi", n: "gibi", exp: 3 },
  { p: "Ti", n: "tebi", exp: 4 },
  { p: "Pi", n: "pebi", exp: 5 },
]

const titleCase = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)

function bitUnit(prefix: string, name: string, factor: number, base: UnitBase): DataUnit {
  return {
    id: `${prefix}bit`,
    symbol: `${prefix}bit`,
    name: titleCase(`${name}bit`),
    bits: factor,
    base,
    kind: "bit",
  }
}

function byteUnit(prefix: string, name: string, factor: number, base: UnitBase): DataUnit {
  return {
    id: `${prefix}B`,
    symbol: `${prefix}B`,
    name: titleCase(`${name}byte`),
    bits: 8 * factor,
    base,
    kind: "byte",
  }
}

// every factor below is exactly representable as a double: 10^n for n <= 15 and
// 2^n for n <= 53 both are, and the largest here is PiB at 2^53 bits.
export const DECIMAL_UNITS: DataUnit[] = DECIMAL_PREFIXES.flatMap(({ p, n, exp }) => [
  bitUnit(p, n, 1000 ** exp, "decimal"),
  byteUnit(p, n, 1000 ** exp, "decimal"),
])

export const BINARY_UNITS: DataUnit[] = BINARY_PREFIXES.flatMap(({ p, n, exp }) => [
  bitUnit(p, n, 1024 ** exp, "binary"),
  byteUnit(p, n, 1024 ** exp, "binary"),
])

export const DATA_UNITS: DataUnit[] = [...DECIMAL_UNITS, ...BINARY_UNITS]

const BY_ID = new Map(DATA_UNITS.map((u) => [u.id, u]))

export function findUnit(id: string): DataUnit | null {
  return BY_ID.get(id) ?? null
}

export const DEFAULT_UNIT_ID = "MB"

export interface Conversion {
  unit: DataUnit
  value: number
  display: string
}

/** raw digits, never locale-grouped: this is what a copy button should hand over */
export function exactString(value: number): string {
  if (!Number.isFinite(value)) return "-"
  if (value === 0) return "0"
  const abs = Math.abs(value)
  if (abs >= 1e21 || abs < 1e-6) return value.toExponential(6)
  // 15 significant digits is the most a double can claim honestly
  return Number(value.toPrecision(15)).toString()
}

/** human-facing figure: grouped, and never rounded away to a bare "0" */
export function displayString(value: number): string {
  if (!Number.isFinite(value)) return "-"
  if (value === 0) return "0"
  const abs = Math.abs(value)
  if (abs >= 1e15 || abs < 1e-3) return value.toExponential(3)
  return value.toLocaleString("en-US", { maximumFractionDigits: 6 })
}

export function convertAll(value: number, fromId: string): Conversion[] | null {
  const from = findUnit(fromId)
  if (from === null || !Number.isFinite(value) || value < 0) return null
  const bits = value * from.bits
  return DATA_UNITS.map((unit) => {
    const converted = bits / unit.bits
    return { unit, value: converted, display: displayString(converted) }
  })
}

/** bits in `value` of `fromId`, or null when either input is unusable */
export function toBits(value: number, fromId: string): number | null {
  const from = findUnit(fromId)
  if (from === null || !Number.isFinite(value)) return null
  return value * from.bits
}
