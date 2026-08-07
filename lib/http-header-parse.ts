// one parser for three tools that each carried a copy with its own rfc 9110/9112 bugs

export interface HeaderField {
  name: string
  value: string
}

export interface ResponseBlock {
  // 0 when the paste carried header lines with no status line above them
  status: number
  statusText: string
  // "" when the status line was absent; "2" for h2, which prints no minor version
  httpVersion: string
  fields: HeaderField[]
}

// rfc 9112 4; the minor version is optional because h2/h3 print "HTTP/2 200"
const STATUS_LINE = /^HTTP\/(\d+(?:\.\d+)?)\s+(\d{3})(?:\s+(.*))?$/i

// rfc 9110 5.6.2: token = 1*tchar
const FIELD_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

export function isValidFieldName(name: string): boolean {
  return FIELD_NAME.test(name)
}

export function parseResponseBlocks(raw: string): ResponseBlock[] {
  const blocks: ResponseBlock[] = []
  let current: ResponseBlock | null = null
  // rfc 9112 2.1: an empty line ends the header section, everything after it is
  // body. parsing on past it turned body lines containing a colon into headers.
  let inBody = false

  for (const line of raw.split(/\r?\n/)) {
    const status = STATUS_LINE.exec(line.trim())
    if (status) {
      current = {
        status: Number(status[2]),
        statusText: (status[3] ?? "").trim(),
        httpVersion: status[1],
        fields: [],
      }
      blocks.push(current)
      inBody = false
      continue
    }

    if (!line.trim()) {
      if (current && current.fields.length > 0) inBody = true
      continue
    }
    if (inBody) continue

    if (!current) {
      current = { status: 0, statusText: "", httpVersion: "", fields: [] }
      blocks.push(current)
    }

    // rfc 9112 5.2: obs-fold is deprecated, and a recipient that does not reject
    // it must replace it with SP before interpreting the value
    if (/^[ \t]/.test(line) && current.fields.length > 0) {
      current.fields[current.fields.length - 1].value += ` ${line.trim()}`
      continue
    }

    const split = line.indexOf(":")
    if (split <= 0) continue
    // rfc 9110 5.1: no space before the colon, so prose like "Note : see below" is not a field
    const name = line.slice(0, split)
    if (!isValidFieldName(name)) continue
    current.fields.push({ name, value: line.slice(split + 1).trim() })
  }

  return blocks.filter((block) => block.fields.length > 0 || block.status > 0)
}

// rfc 9110 5.1: field names are case-insensitive
export function fieldValues(block: ResponseBlock, name: string): string[] {
  const key = name.toLowerCase()
  return block.fields.filter((field) => field.name.toLowerCase() === key).map((f) => f.value)
}

// use where the spec says "process only the first", e.g. rfc 6797 8.1 for hsts
export function firstFieldValue(block: ResponseBlock, name: string): string | undefined {
  return fieldValues(block, name)[0]
}

// rfc 9110 5.3: repeated field lines may be combined by appending values in
// order, separated by a comma. only valid for list-based fields.
export function combinedFieldValue(block: ResponseBlock, name: string): string | undefined {
  const values = fieldValues(block, name)
  return values.length > 0 ? values.join(", ") : undefined
}

export function hasField(block: ResponseBlock, name: string): boolean {
  return fieldValues(block, name).length > 0
}

// rfc 9110 15: the reason phrase is optional and carries no meaning, so fall
// back to the class rather than printing a bare number
export function describeStatus(block: ResponseBlock): string {
  if (block.status === 0) return "no status line"
  return block.statusText ? `${block.status} ${block.statusText}` : String(block.status)
}
