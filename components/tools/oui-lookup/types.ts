import type { OuiResult } from "@/lib/oui-vendors"

// outside results.tsx so the shell can build a csv export without statically pulling the panel in
export interface LookupRow extends OuiResult {
  timestamp: number
}

export function sourceLabel(source: OuiResult["source"]): string {
  switch (source) {
    case "offline":
      return "Bundled database"
    case "remote":
      return "api.maclookup.app"
    case "cache":
      return "Session cache"
    default:
      return "Not looked up"
  }
}
