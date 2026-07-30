"use client"

import { Network } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { COMMON_CIDR_TABLE } from "@/lib/cidr-reference"
import type { PanelProps } from "@/lib/tool-panel"
import { CIDRTable } from "./cidr-table"

export function CommonCIDRs({ embedded }: PanelProps) {
  return (
    <div className={embedded ? undefined : "tool-container"}>
      {!embedded && (
        <ToolHeader
          icon={Network}
          title="Common CIDR Blocks"
          description="Subnet masks, wildcard masks and host counts for the prefixes used day to day"
        />
      )}
      <CIDRTable
        title="Commonly Used CIDR Blocks"
        description="The subnet sizes that come up in real designs, from /8 down to a /32 host route"
        entries={COMMON_CIDR_TABLE}
      />
    </div>
  )
}

export default CommonCIDRs
