"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { IPV6_SPECIAL_RANGES } from "@/lib/reference/ipv6-ranges"
import { filterRows } from "@/lib/reference/search"
import type { IPv6RangeEntry } from "@/lib/reference/types"
import { ReferenceTable, type ReferenceColumn } from "./reference-table"

const columns: ReferenceColumn<IPv6RangeEntry>[] = [
  {
    key: "range",
    header: "Range",
    headClassName: "w-40",
    text: (row) => row.range,
    cell: (row) => <span className="font-mono text-sm font-medium">{row.range}</span>,
    copyLabel: (row) => `Copy IPv6 range ${row.range}`,
  },
  {
    key: "name",
    header: "Name",
    headClassName: "w-44",
    cellClassName: "font-medium",
    text: (row) => row.name,
  },
  {
    key: "routable",
    header: "Routable",
    headClassName: "w-24",
    text: (row) => row.routable,
    cell: (row) => (
      <Badge
        variant={
          row.routable === "Yes" ? "default" : row.routable === "No" ? "secondary" : "outline"
        }
        className="text-xs"
      >
        {row.routable}
      </Badge>
    ),
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

export function IPv6RangesPanel({ searchTerm }: { searchTerm: string }) {
  const rows = useMemo(
    () =>
      filterRows(IPV6_SPECIAL_RANGES, searchTerm, (row) =>
        columns.map((column) => column.text(row))
      ),
    [searchTerm]
  )

  return (
    <ReferenceTable
      title="IPv6 Address Types"
      description="Special IPv6 prefixes from the IANA IPv6 special-purpose registry and RFC 4291"
      rows={rows}
      columns={columns}
      rowKey={(row) => row.range}
    />
  )
}
