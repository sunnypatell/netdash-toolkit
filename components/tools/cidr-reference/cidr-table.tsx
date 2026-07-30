"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CopyButton } from "@/components/ui/copy-button"
import { formatCompactNumber } from "@/lib/format"
import type { CIDREntry } from "@/lib/cidr-reference"

interface CIDRTableProps {
  title: string
  description: string
  entries: readonly CIDREntry[]
  scroll?: boolean
}

export function CIDRTable({ title, description, entries, scroll = false }: CIDRTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className={scroll ? "max-h-[600px] overflow-auto" : "overflow-x-auto"}>
          <table className="w-full text-sm">
            <caption className="sr-only">{description}</caption>
            <thead className={scroll ? "bg-background sticky top-0" : undefined}>
              <tr className="border-b">
                <th scope="col" className="p-2 text-left font-medium">
                  CIDR
                </th>
                <th scope="col" className="p-2 text-left font-medium">
                  Subnet Mask
                </th>
                <th scope="col" className="p-2 text-left font-medium">
                  Wildcard
                </th>
                <th scope="col" className="p-2 text-right font-medium">
                  Total IPs
                </th>
                <th scope="col" className="p-2 text-right font-medium">
                  Usable Hosts
                </th>
                <th scope="col" className="p-2 font-medium">
                  <span className="sr-only">Copy mask</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.prefix} className="hover:bg-muted/50 border-b">
                  <th scope="row" className="p-2 text-left font-normal">
                    <Badge variant="secondary" className="font-mono">
                      /{entry.prefix}
                    </Badge>
                  </th>
                  <td className="p-2 font-mono text-sm">{entry.mask}</td>
                  <td className="p-2 font-mono text-sm">{entry.wildcard}</td>
                  <td className="p-2 text-right">{formatCompactNumber(entry.totalAddresses)}</td>
                  <td className="p-2 text-right">{formatCompactNumber(entry.usableHosts)}</td>
                  <td className="p-2">
                    <CopyButton value={entry.mask} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
