// one matcher for every reference table: rows are searched on the same strings
// the table renders, so anything visible is findable.

export function matchesTerm(values: readonly string[], term: string): boolean {
  const needle = term.trim().toLowerCase()
  if (!needle) return true
  return values.some((value) => value.toLowerCase().includes(needle))
}

export function filterRows<T>(
  rows: readonly T[],
  term: string,
  fields: (row: T) => readonly string[]
): T[] {
  if (!term.trim()) return [...rows]
  return rows.filter((row) => matchesTerm(fields(row), term))
}
