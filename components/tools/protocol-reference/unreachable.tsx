"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Info } from "lucide-react"
import {
  ReferenceTable,
  searchableText,
  type ReferenceColumn,
} from "@/components/tools/shared/reference-table"
import { ICMP_UNREACHABLE_CODES, PMTUD_NOTE } from "@/lib/reference/icmp"
import type { ICMPCodeEntry } from "@/lib/reference/icmp"
import { filterRows } from "@/lib/reference/search"

const columns: ReferenceColumn<ICMPCodeEntry>[] = [
  {
    key: "code",
    header: "Code",
    headClassName: "w-20",
    text: (row) => String(row.code),
    cell: (row) => (
      <Badge variant="secondary" className="font-mono">
        {row.code}
      </Badge>
    ),
  },
  {
    key: "name",
    header: "IANA Description",
    text: (row) => row.name,
  },
  {
    key: "rfc",
    header: "RFC",
    headClassName: "w-36",
    text: (row) => row.rfc,
    cell: (row) => <Badge variant="outline">{row.rfc}</Badge>,
  },
]

export function UnreachablePanel({ searchTerm }: { searchTerm: string }) {
  const rows = useMemo(
    () => filterRows(ICMP_UNREACHABLE_CODES, searchTerm, (row) => searchableText(columns, row)),
    [searchTerm]
  )

  return (
    <div className="space-y-4">
      <ReferenceTable
        title="ICMP Destination Unreachable Codes"
        description="Every code defined for type 3, from 0 to 15"
        rows={rows}
        columns={columns}
        rowKey={(row) => String(row.code)}
        emptyMessage="No codes match your search"
      />

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">{PMTUD_NOTE}</AlertDescription>
      </Alert>
    </div>
  )
}
