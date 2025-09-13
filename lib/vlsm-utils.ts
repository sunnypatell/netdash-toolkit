// VLSM (Variable Length Subnet Masking) planning utilities

import { ipv4ToInt, intToIpv4, calculateIPv4Subnet } from "./network-utils"

export interface VLSMRequirement {
  id: string
  name: string
  hostsRequired: number
  description?: string
}

export interface VLSMAllocation {
  id: string
  name: string
  hostsRequired: number
  hostsAllocated: number
  slackHosts: number
  network: string
  prefix: number
  cidr: string
  firstHost: string
  lastHost: string
  broadcast: string
  netmask: string
}

export interface VLSMPlan {
  baseNetwork: string
  basePrefix: number
  totalHosts: number
  allocatedHosts: number
  wastedHosts: number
  utilizationPercent: number
  allocations: VLSMAllocation[]
  success: boolean
  errorMessage?: string
}

export function calculateVLSM(baseNetwork: string, basePrefix: number, requirements: VLSMRequirement[]): VLSMPlan {
  try {
    // Validate base network
    const baseSubnet = calculateIPv4Subnet(baseNetwork, basePrefix)
    const baseNetworkInt = ipv4ToInt(baseSubnet.network)
    const totalAvailableHosts = baseSubnet.hostCount

    // Sort requirements by hosts needed (descending)
    const sortedRequirements = [...requirements].sort((a, b) => b.hostsRequired - a.hostsRequired)

    const allocations: VLSMAllocation[] = []
    let currentNetworkInt = baseNetworkInt
    let totalAllocatedHosts = 0

    for (const req of sortedRequirements) {
      // Calculate the smallest prefix that can accommodate the required hosts
      let prefix = 32
      let blockSize = 1

      // Find the smallest block size that fits the required hosts
      for (let p = 30; p >= 1; p--) {
        const testBlockSize = Math.pow(2, 32 - p)
        const testUsableHosts = p === 31 ? 2 : p === 32 ? 1 : testBlockSize - 2

        if (testUsableHosts >= req.hostsRequired) {
          prefix = p
          blockSize = testBlockSize
          break
        }
      }

      // Check if the block fits within the base network
      const blockEnd = currentNetworkInt + blockSize - 1
      const baseNetworkEnd = baseNetworkInt + Math.pow(2, 32 - basePrefix) - 1

      if (blockEnd > baseNetworkEnd) {
        return {
          baseNetwork: baseSubnet.network,
          basePrefix,
          totalHosts: totalAvailableHosts,
          allocatedHosts: totalAllocatedHosts,
          wastedHosts: 0,
          utilizationPercent: 0,
          allocations: [],
          success: false,
          errorMessage: `Cannot fit requirement "${req.name}" (${req.hostsRequired} hosts) in remaining space`,
        }
      }

      // Align to the appropriate boundary for the prefix
      const alignment = blockSize
      const alignedStart = Math.ceil(currentNetworkInt / alignment) * alignment

      // Check if aligned start still fits
      if (alignedStart + blockSize - 1 > baseNetworkEnd) {
        return {
          baseNetwork: baseSubnet.network,
          basePrefix,
          totalHosts: totalAvailableHosts,
          allocatedHosts: totalAllocatedHosts,
          wastedHosts: 0,
          utilizationPercent: 0,
          allocations: [],
          success: false,
          errorMessage: `Cannot align requirement "${req.name}" to proper boundary`,
        }
      }

      // Calculate subnet details
      const subnetNetwork = intToIpv4(alignedStart)
      const subnet = calculateIPv4Subnet(subnetNetwork, prefix)

      const allocation: VLSMAllocation = {
        id: req.id,
        name: req.name,
        hostsRequired: req.hostsRequired,
        hostsAllocated: subnet.hostCount,
        slackHosts: subnet.hostCount - req.hostsRequired,
        network: subnet.network,
        prefix,
        cidr: subnet.cidr,
        firstHost: subnet.firstHost,
        lastHost: subnet.lastHost,
        broadcast: subnet.broadcast,
        netmask: subnet.netmask,
      }

      allocations.push(allocation)
      totalAllocatedHosts += subnet.hostCount
      currentNetworkInt = alignedStart + blockSize
    }

    const wastedHosts = totalAvailableHosts - totalAllocatedHosts
    const utilizationPercent = (totalAllocatedHosts / totalAvailableHosts) * 100

    return {
      baseNetwork: baseSubnet.network,
      basePrefix,
      totalHosts: totalAvailableHosts,
      allocatedHosts: totalAllocatedHosts,
      wastedHosts,
      utilizationPercent,
      allocations,
      success: true,
    }
  } catch (error) {
    return {
      baseNetwork,
      basePrefix,
      totalHosts: 0,
      allocatedHosts: 0,
      wastedHosts: 0,
      utilizationPercent: 0,
      allocations: [],
      success: false,
      errorMessage: error instanceof Error ? error.message : "VLSM calculation failed",
    }
  }
}

export function generateVLSMHeatmap(
  plan: VLSMPlan,
): Array<{ start: number; end: number; name: string; color: string }> {
  if (!plan.success) return []

  const baseNetworkInt = ipv4ToInt(plan.baseNetwork)
  const totalSize = Math.pow(2, 32 - plan.basePrefix)

  const heatmapData = plan.allocations.map((allocation, index) => {
    const startInt = ipv4ToInt(allocation.network)
    const size = Math.pow(2, 32 - allocation.prefix)
    const colors = ["#0891b2", "#6366f1", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6", "#f97316"]

    return {
      start: ((startInt - baseNetworkInt) / totalSize) * 100,
      end: ((startInt - baseNetworkInt + size) / totalSize) * 100,
      name: allocation.name,
      color: colors[index % colors.length],
    }
  })

  return heatmapData
}

export function exportVLSMPlan(plan: VLSMPlan, format: "csv" | "json" | "text"): string {
  if (format === "json") {
    return JSON.stringify(plan, null, 2)
  }

  if (format === "csv") {
    const headers = [
      "Name",
      "Hosts Required",
      "Hosts Allocated",
      "Slack Hosts",
      "Network",
      "CIDR",
      "First Host",
      "Last Host",
      "Broadcast",
      "Netmask",
    ]

    const rows = plan.allocations.map((alloc) => [
      alloc.name,
      alloc.hostsRequired.toString(),
      alloc.hostsAllocated.toString(),
      alloc.slackHosts.toString(),
      alloc.network,
      alloc.cidr,
      alloc.firstHost,
      alloc.lastHost,
      alloc.broadcast,
      alloc.netmask,
    ])

    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")
  }

  // Text format
  let output = `VLSM Plan for ${plan.baseNetwork}/${plan.basePrefix}\n`
  output += `${"=".repeat(50)}\n\n`
  output += `Total Available Hosts: ${plan.totalHosts}\n`
  output += `Allocated Hosts: ${plan.allocatedHosts}\n`
  output += `Wasted Hosts: ${plan.wastedHosts}\n`
  output += `Utilization: ${plan.utilizationPercent.toFixed(1)}%\n\n`

  if (plan.success) {
    output += `Subnet Allocations:\n`
    output += `${"=".repeat(50)}\n`

    for (const alloc of plan.allocations) {
      output += `\n${alloc.name}:\n`
      output += `  Network: ${alloc.cidr}\n`
      output += `  Hosts Required: ${alloc.hostsRequired}\n`
      output += `  Hosts Allocated: ${alloc.hostsAllocated}\n`
      output += `  Slack Hosts: ${alloc.slackHosts}\n`
      output += `  Range: ${alloc.firstHost} - ${alloc.lastHost}\n`
      output += `  Broadcast: ${alloc.broadcast}\n`
      output += `  Netmask: ${alloc.netmask}\n`
    }
  } else {
    output += `\nError: ${plan.errorMessage}\n`
  }

  return output
}
