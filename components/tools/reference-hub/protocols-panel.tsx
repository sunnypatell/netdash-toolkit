"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { IP_PROTOCOL_NUMBERS } from "@/lib/reference/protocol-numbers"
import { filterRows } from "@/lib/reference/search"
import type { ProtocolNumberEntry } from "@/lib/reference/types"
import { ReferenceTable, type ReferenceColumn } from "./reference-table"

const columns: ReferenceColumn<ProtocolNumberEntry>[] = [
  {
    key: "number",
    header: "Number",
    headClassName: "w-20",
    cellClassName: "font-mono font-bold",
    text: (row) => String(row.number),
  },
  {
    key: "name",
    header: "Name",
    headClassName: "w-32",
    text: (row) => row.name,
    cell: (row) => <Badge variant="outline">{row.name}</Badge>,
  },
  {
    key: "description",
    header: "Description",
    cellClassName: "text-muted-foreground text-sm",
    text: (row) =>
      row.ipv6ExtensionHeader ? `${row.description} (IPv6 extension header)` : row.description,
  },
  {
    key: "rfc",
    header: "RFC",
    headClassName: "w-24",
    cellClassName: "text-muted-foreground text-xs",
    text: (row) => row.rfc,
  },
]

export function ProtocolsPanel({ searchTerm }: { searchTerm: string }) {
  const rows = useMemo(
    () =>
      filterRows(IP_PROTOCOL_NUMBERS, searchTerm, (row) =>
        columns.map((column) => column.text(row))
      ),
    [searchTerm]
  )

  return (
    <ReferenceTable
      title="IP Protocol Numbers"
      description="Values for the IPv4 protocol field and the IPv6 next header field, from the IANA protocol numbers registry"
      rows={rows}
      columns={columns}
      rowKey={(row) => String(row.number)}
    />
  )
}
