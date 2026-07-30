"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import {
  ReferenceTable,
  searchableText,
  type ReferenceColumn,
} from "@/components/tools/shared/reference-table"
import { IP_PROTOCOL_NUMBERS } from "@/lib/reference/protocol-numbers"
import { filterRows } from "@/lib/reference/search"
import type { ProtocolNumberEntry } from "@/lib/reference/types"

const columns: ReferenceColumn<ProtocolNumberEntry>[] = [
  {
    key: "number",
    header: "Number",
    headClassName: "w-24",
    text: (row) => String(row.number),
    cell: (row) => (
      <Badge variant="secondary" className="font-mono">
        {row.number}
      </Badge>
    ),
  },
  {
    key: "name",
    header: "IANA Keyword",
    cellClassName: "font-mono font-medium",
    text: (row) => row.name,
  },
  {
    key: "description",
    header: "Description",
    cellClassName: "text-muted-foreground whitespace-normal",
    text: (row) => row.description,
  },
  {
    key: "rfc",
    header: "Defining RFC",
    headClassName: "w-32",
    text: (row) => row.rfc,
    cell: (row) => <Badge variant="outline">{row.rfc}</Badge>,
  },
  {
    key: "ext",
    header: "IPv6 Ext Header",
    headClassName: "w-32",
    text: (row) => (row.ipv6ExtensionHeader ? "Yes" : "No"),
    cell: (row) =>
      row.ipv6ExtensionHeader ? <Badge variant="secondary">Yes</Badge> : <span>No</span>,
  },
]

export function ProtocolsPanel({ searchTerm }: { searchTerm: string }) {
  const rows = useMemo(
    () => filterRows(IP_PROTOCOL_NUMBERS, searchTerm, (row) => searchableText(columns, row)),
    [searchTerm]
  )

  return (
    <ReferenceTable
      title="IP Protocol Numbers"
      description="Values of the IPv4 Protocol field and the IPv6 Next Header field, with the current defining RFC"
      rows={rows}
      columns={columns}
      rowKey={(row) => String(row.number)}
      emptyMessage="No protocols match your search"
    />
  )
}
