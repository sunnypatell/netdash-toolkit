"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { DataTable, searchableText, type DataColumn } from "@/components/tools/reference-table"
import { ICMP_TYPES } from "@/lib/reference/icmp"
import type { ICMPTypeEntry } from "@/lib/reference/icmp"
import { filterRows } from "@/lib/reference/search"

const columns: DataColumn<ICMPTypeEntry>[] = [
  {
    key: "type",
    header: "Type",
    headerClassName: "w-20 p-2 text-left font-medium",
    text: (row) => String(row.type),
    cell: (row) => (
      <Badge variant="secondary" className="font-mono">
        {row.type}
      </Badge>
    ),
  },
  {
    key: "name",
    header: "IANA Name",
    cellClassName: "p-2 font-medium",
    text: (row) => `${row.name} ${row.commonName ?? ""}`.trim(),
    cell: (row) => (
      <span>
        {row.name}
        {row.commonName && (
          <span className="text-muted-foreground block text-xs font-normal">
            commonly called {row.commonName}
          </span>
        )}
      </span>
    ),
  },
  {
    key: "description",
    header: "Description",
    cellClassName: "text-muted-foreground p-2",
    text: (row) => row.description,
  },
  {
    key: "status",
    header: "Status",
    headerClassName: "w-28 p-2 text-left font-medium",
    text: (row) => (row.deprecated ? "Deprecated" : "Current"),
    cell: (row) =>
      row.deprecated ? (
        <Badge variant="destructive">Deprecated</Badge>
      ) : (
        <Badge variant="outline">Current</Badge>
      ),
  },
  {
    key: "rfc",
    header: "RFC",
    headerClassName: "w-28 p-2 text-left font-medium",
    text: (row) => row.rfc,
    cell: (row) => <Badge variant="outline">{row.rfc}</Badge>,
  },
]

export function ICMPPanel({ searchTerm }: { searchTerm: string }) {
  const rows = useMemo(
    () => filterRows(ICMP_TYPES, searchTerm, (row) => searchableText(columns, row)),
    [searchTerm]
  )

  return (
    <DataTable
      title="ICMP Message Types"
      description="ICMP for IPv4, with the registry's own wording. Deprecated types are marked rather than dropped."
      rows={rows}
      columns={columns}
      rowKey={(row) => String(row.type)}
      emptyMessage="No ICMP types match your search"
    />
  )
}
