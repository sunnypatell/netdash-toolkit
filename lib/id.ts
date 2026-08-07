// Date.now() collided within a millisecond, duplicating react keys and the dom ids labels target
let counter = 0

export function nextId(prefix = "row"): string {
  counter += 1
  return `${prefix}-${counter}`
}

// tests only, so a suite can assert on stable ids
export function resetIdCounter() {
  counter = 0
}
