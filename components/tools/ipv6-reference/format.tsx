"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Globe2 } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import type { PanelProps } from "@/lib/tool-panel"

const STEPS = [
  {
    label: "Full form, 8 groups of 4 hex digits",
    value: "2001:0db8:0000:0000:0000:ff00:0042:8329",
  },
  { label: "RFC 5952 4.1: leading zeros suppressed", value: "2001:db8:0:0:0:ff00:42:8329" },
  { label: "RFC 5952 4.2.1: longest zero run replaced by ::", value: "2001:db8::ff00:42:8329" },
]

const RULES = [
  {
    id: "4.1",
    title: "Suppress leading zeros",
    detail: "0db8 becomes db8, and 0000 becomes 0. A group is never written empty.",
  },
  {
    id: "4.2.1",
    title: "Shorten as much as possible",
    detail: "Any run of two or more all-zero groups must be replaced by ::.",
  },
  {
    id: "4.2.2",
    title: "Never :: a single group",
    detail: "2001:db8:0:1:1:1:1:1 must not be written 2001:db8::1:1:1:1:1.",
  },
  {
    id: "4.2.3",
    title: "Longest run wins, ties go to the first",
    detail: "2001:db8:0:0:1:0:0:1 is 2001:db8::1:0:0:1, not 2001:db8:0:0:1::1.",
  },
  {
    id: "4.3",
    title: "Lowercase hexadecimal",
    detail: "2001:DB8::1 must be written 2001:db8::1.",
  },
  {
    id: "5",
    title: "Keep the dotted quad for IPv4-mapped",
    detail: "::ffff:192.0.2.1, not ::ffff:c000:201.",
  },
]

const WRONG = [
  { bad: "2001::db8::1", why: ":: appears twice, so the group count is ambiguous" },
  { bad: "2001:db8::1:1:1:1:1", why: "a single zero group was compressed (4.2.2)" },
  { bad: "2001:DB8::1", why: "uppercase hexadecimal (4.3)" },
  { bad: "2001:db8:0:0:0:0:0:1", why: "legal but not the canonical form: use 2001:db8::1" },
]

export function IPv6FormatRules({ embedded }: PanelProps) {
  return (
    <div className={embedded ? "space-y-6" : "tool-container"}>
      {!embedded && (
        <ToolHeader
          icon={Globe2}
          title="IPv6 Format Rules"
          description="The canonical text representation of an IPv6 address, per RFC 5952"
        />
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Address Format</CardTitle>
            <CardDescription>128 bits, written as 8 groups of 16</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {STEPS.map((step) => (
              <div key={step.value} className="rounded-lg border p-4">
                <p className="text-muted-foreground text-sm">{step.label}</p>
                <p className="mt-2 font-mono text-sm break-all">{step.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Canonical Form (RFC 5952)</CardTitle>
            <CardDescription>Every rule is a MUST, not a preference</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {RULES.map((rule) => (
              <div key={rule.id} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono">
                    {rule.id}
                  </Badge>
                  <span className="text-sm font-medium">{rule.title}</span>
                </div>
                <p className="text-muted-foreground mt-1 text-sm">{rule.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Forms to Avoid</CardTitle>
          <CardDescription>Common non-canonical or invalid spellings</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {WRONG.map((entry) => (
              <li key={entry.bad} className="rounded-lg border p-3">
                <code className="bg-muted rounded px-1 font-mono text-sm">{entry.bad}</code>
                <p className="text-muted-foreground mt-1 text-sm">{entry.why}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

export default IPv6FormatRules
