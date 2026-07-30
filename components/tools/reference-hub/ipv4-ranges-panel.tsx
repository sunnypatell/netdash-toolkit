"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { IPV4_SPECIAL_RANGES } from "@/lib/reference/ipv4-ranges"
import { filterRows } from "@/lib/reference/search"
import type { IPv4RangeEntry } from "@/lib/reference/types"
import { ReferenceTable, searchableText, type ReferenceColumn } from "../shared/reference-table"

const columns: ReferenceColumn<IPv4RangeEntry>[] = [
  {
    key: "range",
    header: "Range",
    headClassName: "w-44",
    text: (row) => row.range,
    cell: (row) => <span className="font-mono font-medium">{row.range}</span>,
    copyLabel: (row) => `Copy range ${row.range}`,
  },
  {
    key: "type",
    header: "Type",
    headClassName: "w-32",
    text: (row) => row.type,
    cell: (row) => (
      <Badge variant="secondary" className="text-xs">
        {row.type}
      </Badge>
    ),
  },
  {
    key: "addresses",
    header: "Addresses",
    headClassName: "w-28",
    cellClassName: "font-mono text-sm",
    text: (row) => row.addresses.toLocaleString(),
  },
  {
    key: "rfc",
    header: "RFC",
    headClassName: "w-24",
    cellClassName: "text-muted-foreground text-xs",
    text: (row) => row.rfc,
  },
  {
    key: "description",
    header: "Description",
    cellClassName: "text-muted-foreground text-sm",
    text: (row) => row.description,
  },
]

export function IPv4RangesPanel({ searchTerm }: { searchTerm: string }) {
  const rows = useMemo(
    () => filterRows(IPV4_SPECIAL_RANGES, searchTerm, (row) => searchableText(columns, row)),
    [searchTerm]
  )

  return (
    <ReferenceTable
      title="Private and Reserved IPv4 Ranges"
      description={`The IANA IPv4 special-purpose registry, including the RFC 1918 private blocks (${rows.length} shown)`}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.range}
      maxHeight="h-[500px]"
    />
  )
}
