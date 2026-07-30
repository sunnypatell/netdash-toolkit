"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { COMMON_PORTS } from "@/lib/reference/ports"
import { filterRows } from "@/lib/reference/search"
import type { PortEntry } from "@/lib/reference/types"
import { ReferenceTable, searchableText, type ReferenceColumn } from "../shared/reference-table"

const columns: ReferenceColumn<PortEntry>[] = [
  {
    key: "port",
    header: "Port",
    headClassName: "w-20",
    text: (row) => String(row.port),
    cell: (row) => <span className="font-mono font-medium">{row.port}</span>,
    copyLabel: (row) => `Copy port ${row.port}`,
  },
  {
    key: "protocol",
    header: "Protocol",
    headClassName: "w-24",
    text: (row) => row.protocol,
    cell: (row) => (
      <Badge variant="outline" className="text-xs">
        {row.protocol}
      </Badge>
    ),
  },
  {
    key: "service",
    header: "Service",
    headClassName: "w-32",
    cellClassName: "font-medium",
    text: (row) => row.service,
  },
  {
    key: "iana",
    header: "IANA Name",
    headClassName: "w-32",
    cellClassName: "text-muted-foreground font-mono text-xs",
    text: (row) => row.ianaName,
  },
  {
    key: "description",
    header: "Description",
    cellClassName: "text-muted-foreground text-sm",
    text: (row) => row.description,
  },
]

export function PortsPanel({ searchTerm }: { searchTerm: string }) {
  const rows = useMemo(
    () => filterRows(COMMON_PORTS, searchTerm, (row) => searchableText(columns, row)),
    [searchTerm]
  )

  return (
    <ReferenceTable
      title="Common Port Numbers"
      description={`Well-known and frequently used TCP/UDP ports, with the registered IANA service name (${rows.length} shown)`}
      rows={rows}
      columns={columns}
      rowKey={(row) => String(row.port)}
      maxHeight="h-[500px]"
    />
  )
}
