// row ids for editable lists. `Date.now().toString()` collided whenever two
// rows were added inside the same millisecond, which duplicated both the react
// key and the per-row dom ids that labels point at.
let counter = 0

export function nextId(prefix = "row"): string {
  counter += 1
  return `${prefix}-${counter}`
}

// tests only, so a suite can assert on stable ids
export function resetIdCounter() {
  counter = 0
}
