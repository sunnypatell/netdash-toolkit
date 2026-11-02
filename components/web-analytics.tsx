"use client"

import { Analytics } from "@vercel/analytics/react"
import { isElectron } from "@/lib/electron"

// the desktop app serves out/ over loopback, where /_vercel/insights/script.js 404s on every load
export function WebAnalytics() {
  return isElectron() ? null : <Analytics />
}
