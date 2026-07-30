import type { SwitchPort, VLAN } from "@/lib/vlan-utils"

// nextId rather than the array index or the VLAN id itself: removing a row in
// the middle made react reuse the wrong dom node, and a loaded project can
// legitimately contain two rows with the same VLAN id while it is being fixed
export interface VLANRow extends VLAN {
  rowId: string
}

export interface PortRow extends SwitchPort {
  rowId: string
}

export type Vendor = "cisco-ios" | "aruba-cx"
