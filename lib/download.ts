// one blob path for every export; the 23 hand-rolled copies missed revokes and mime types

export type DownloadMime = "text/plain" | "text/csv" | "application/json" | "image/png"

export function downloadTextFile(
  content: string,
  filename: string,
  mime: DownloadMime = "text/plain"
): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// YYYY-MM-DD, for datestamped export filenames
export function dateStamp(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10)
}
