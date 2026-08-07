import type { SwitchPort, VLAN } from "@/lib/vlan-utils"

// rowId, not the array index or VLAN id: react reused dom nodes on removal, and ids can duplicate
export interface VLANRow extends VLAN {
  rowId: string
}

export interface PortRow extends SwitchPort {
  rowId: string
}

export type Vendor = "cisco-ios" | "aruba-cx"
