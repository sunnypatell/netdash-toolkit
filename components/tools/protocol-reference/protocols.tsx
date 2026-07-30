"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { DataTable, searchableText, type DataColumn } from "@/components/tools/reference-table"
import { IP_PROTOCOL_NUMBERS } from "@/lib/reference/protocol-numbers"
import { filterRows } from "@/lib/reference/search"
import type { ProtocolNumberEntry } from "@/lib/reference/types"

const columns: DataColumn<ProtocolNumberEntry>[] = [
  {
    key: "number",
    header: "Number",
    headerClassName: "w-24 p-2 text-left font-medium",
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
    cellClassName: "p-2 font-mono font-medium",
    text: (row) => row.name,
  },
  {
    key: "description",
    header: "Description",
    cellClassName: "text-muted-foreground p-2",
    text: (row) => row.description,
  },
  {
    key: "rfc",
    header: "Defining RFC",
    headerClassName: "w-32 p-2 text-left font-medium",
    text: (row) => row.rfc,
    cell: (row) => <Badge variant="outline">{row.rfc}</Badge>,
  },
  {
    key: "ext",
    header: "IPv6 Ext Header",
    headerClassName: "w-32 p-2 text-left font-medium",
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
    <DataTable
      title="IP Protocol Numbers"
      description="Values of the IPv4 Protocol field and the IPv6 Next Header field, with the current defining RFC"
      rows={rows}
      columns={columns}
      rowKey={(row) => String(row.number)}
      emptyMessage="No protocols match your search"
    />
  )
}
