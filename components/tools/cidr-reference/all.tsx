"use client"

import { Network } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CIDR_TABLE } from "@/lib/cidr-reference"
import type { PanelProps } from "@/lib/tool-panel"
import { CIDRTable } from "./cidr-table"

export function AllCIDRs({ embedded }: PanelProps) {
  return (
    <div className={embedded ? undefined : "tool-container"}>
      {!embedded && (
        <ToolHeader
          icon={Network}
          title="Complete CIDR Table"
          description="Every IPv4 prefix from /0 to /32 with its mask, wildcard and host counts"
        />
      )}
      <CIDRTable
        title="Complete CIDR Table"
        description="All 33 IPv4 prefix lengths. A /31 has 2 usable addresses per RFC 3021 and a /32 has 1"
        entries={CIDR_TABLE}
        scroll
      />
    </div>
  )
}

export default AllCIDRs
