"use client"

import { useMemo } from "react"
import { filterRows } from "@/lib/reference/search"
import { SUBNET_MASKS } from "@/lib/reference/subnet-masks"
import type { SubnetMaskEntry } from "@/lib/reference/types"
import { ReferenceTable, type ReferenceColumn } from "./reference-table"

const columns: ReferenceColumn<SubnetMaskEntry>[] = [
  {
    key: "cidr",
    header: "CIDR",
    headClassName: "w-20",
    cellClassName: "font-mono font-bold",
    text: (row) => `/${row.prefix}`,
  },
  {
    key: "mask",
    header: "Subnet Mask",
    headClassName: "w-44",
    text: (row) => row.mask,
    cell: (row) => <span className="font-mono">{row.mask}</span>,
    copyLabel: (row) => `Copy subnet mask ${row.mask}`,
  },
  {
    key: "wildcard",
    header: "Wildcard",
    headClassName: "w-44",
    text: (row) => row.wildcard,
    cell: (row) => <span className="text-muted-foreground font-mono">{row.wildcard}</span>,
    copyLabel: (row) => `Copy wildcard mask ${row.wildcard}`,
  },
  {
    key: "hosts",
    header: "Usable Hosts",
    headClassName: "w-32",
    cellClassName: "font-mono",
    text: (row) => row.usableHosts.toLocaleString(),
  },
]

export function CIDRPanel({ searchTerm }: { searchTerm: string }) {
  const rows = useMemo(
    () => filterRows(SUBNET_MASKS, searchTerm, (row) => columns.map((column) => column.text(row))),
    [searchTerm]
  )

  return (
    <ReferenceTable
      title="CIDR Notation Cheat Sheet"
      description="Subnet masks, wildcard masks and usable hosts for every prefix length; /31 is RFC 3021 and /32 is a host route"
      rows={rows}
      columns={columns}
      rowKey={(row) => `/${row.prefix}`}
    />
  )
}
