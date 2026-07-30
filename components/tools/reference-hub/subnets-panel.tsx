"use client"

import { useMemo } from "react"
import { COMMON_SUBNETS } from "@/lib/reference/common-subnets"
import { filterRows } from "@/lib/reference/search"
import { subnetMaskFor } from "@/lib/reference/subnet-masks"
import type { CommonSubnetEntry } from "@/lib/reference/types"
import { ReferenceTable, type ReferenceColumn } from "./reference-table"

interface SubnetRow extends CommonSubnetEntry {
  mask: string
  usableHosts: number
}

// mask and host count come from the mask table, so the two tabs cannot disagree
const rowsWithMasks: SubnetRow[] = COMMON_SUBNETS.flatMap((subnet) => {
  const mask = subnetMaskFor(subnet.prefix)
  return mask ? [{ ...subnet, mask: mask.mask, usableHosts: mask.usableHosts }] : []
})

const columns: ReferenceColumn<SubnetRow>[] = [
  {
    key: "name",
    header: "Name",
    headClassName: "w-40",
    cellClassName: "font-medium",
    text: (row) => row.name,
  },
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
    key: "hosts",
    header: "Usable Hosts",
    headClassName: "w-28",
    cellClassName: "font-mono",
    text: (row) => row.usableHosts.toLocaleString(),
  },
  {
    key: "useCase",
    header: "Use Case",
    cellClassName: "text-muted-foreground text-sm",
    text: (row) => row.useCase,
  },
]

export function SubnetsPanel({ searchTerm }: { searchTerm: string }) {
  const rows = useMemo(
    () => filterRows(rowsWithMasks, searchTerm, (row) => columns.map((column) => column.text(row))),
    [searchTerm]
  )

  return (
    <ReferenceTable
      title="Common Subnet Sizes"
      description="Prefix lengths you actually deploy, with the size they give you"
      rows={rows}
      columns={columns}
      rowKey={(row) => `/${row.prefix}`}
    />
  )
}
