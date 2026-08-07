"use client"

import { useMemo } from "react"
import {
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertTriangle, ArrowDown, ArrowUp, Download, List } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"
import { ResultCard } from "@/components/ui/result-card"
import { downloadTextFile, dateStamp } from "@/lib/download"
import { SaveToProject } from "@/components/ui/save-to-project"
import { LoadFromProject } from "@/components/ui/load-from-project"
import {
  enumerateAddresses,
  selectableCount,
  summarizeRange,
  type RangeSummary,
} from "@/lib/ip-enumerate"

const PAGE_SIZE = 256
const MAX_LIMIT = 65536
const ORDERS = ["asc", "desc"] as const

const COMMON_BLOCKS = [
  { prefix: 30, use: "Point-to-point" },
  { prefix: 29, use: "Small office" },
  { prefix: 28, use: "Small subnet" },
  { prefix: 27, use: "Department" },
  { prefix: 26, use: "Medium subnet" },
  { prefix: 25, use: "Large subnet" },
  { prefix: 24, use: "Standard LAN" },
  { prefix: 23, use: "Large LAN" },
  { prefix: 22, use: "Campus" },
  { prefix: 20, use: "Data centre" },
  { prefix: 16, use: "Enterprise" },
  { prefix: 31, use: "RFC 3021 link" },
]

function summarize(cidr: string): { summary: RangeSummary | null; error: string } {
  if (!cidr.trim()) return { summary: null, error: "" }
  try {
    return { summary: summarizeRange(cidr), error: "" }
  } catch (err) {
    return { summary: null, error: err instanceof Error ? err.message : "Invalid CIDR notation" }
  }
}

export function IPEnumerator() {
  const [query, setQuery] = useQueryStates(
    {
      cidr: parseAsString.withDefault("192.168.1.0/28"),
      network: parseAsBoolean.withDefault(false),
      broadcast: parseAsBoolean.withDefault(false),
      order: parseAsStringLiteral(ORDERS).withDefault("asc"),
      limit: parseAsInteger.withDefault(PAGE_SIZE),
    },
    { history: "replace" }
  )

  const { cidr, network, broadcast, order, limit } = query

  const { summary, error } = useMemo(() => summarize(cidr), [cidr])

  // enumeration is bounded by the display limit, so typing a /8 no longer
  // allocates 65k strings per keystroke
  const { addresses, available } = useMemo(() => {
    if (!summary) return { addresses: [] as string[], available: 0 }
    const options = {
      includeNetwork: network,
      includeBroadcast: broadcast,
      order,
      limit: Math.min(Math.max(limit, PAGE_SIZE), MAX_LIMIT),
    }
    return {
      addresses: enumerateAddresses(summary, options),
      available: selectableCount(summary, options),
    }
  }, [summary, network, broadcast, order, limit])

  const exportPayload = summary && {
    cidr: summary.cidr,
    prefix: summary.prefix,
    network: summary.networkAddress,
    broadcast: summary.broadcastAddress,
    netmask: summary.netmask,
    wildcard: summary.wildcard,
    firstUsable: summary.firstUsable,
    lastUsable: summary.lastUsable,
    totalAddresses: summary.totalAddresses,
    usableHosts: summary.usableHosts,
    addresses,
  }

  const fileStem = () => `ip-range-${(summary?.cidr ?? cidr).replace("/", "-")}-${dateStamp()}`

  const exportCSV = () => {
    if (!summary) return
    downloadTextFile(["IP Address", ...addresses].join("\n"), `${fileStem()}.csv`, "text/csv")
  }

  const exportJSON = () => {
    if (!exportPayload) return
    downloadTextFile(
      JSON.stringify(exportPayload, null, 2),
      `${fileStem()}.json`,
      "application/json"
    )
  }

  const handleLoadFromProject = (data: Record<string, unknown>) => {
    const input = data.input as { cidr?: string } | undefined
    if (input?.cidr) void setQuery({ cidr: input.cidr })
  }

  return (
    <div className="tool-container">
      <ToolHeader
        icon={List}
        title="IP Range Enumerator"
        description="List the addresses in a CIDR block, with RFC 3021 /31 and /32 handled correctly"
        actions={
          <>
            <LoadFromProject itemType="ip-range" onLoad={handleLoadFromProject} size="sm" />
            {summary && (
              <SaveToProject
                itemType="ip-range"
                itemName={summary.cidr}
                itemData={{ input: { cidr: summary.cidr }, result: exportPayload }}
                toolSource="IP Range Enumerator"
                size="sm"
              />
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>CIDR Input</CardTitle>
            <CardDescription>
              The list is derived from the block as you type, so there is nothing to submit
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="cidr">Network CIDR</Label>
              <Input
                id="cidr"
                value={cidr}
                onChange={(event) => void setQuery({ cidr: event.target.value })}
                placeholder="192.168.1.0/24"
                className="font-mono"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "cidr-hint cidr-error" : "cidr-hint"}
              />
              <p id="cidr-hint" className="text-muted-foreground mt-1 text-xs">
                A host address is normalised onto its network. Examples: 10.0.0.0/24,
                192.168.1.0/28, 192.0.2.10/31
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription id="cidr-error">{error}</AlertDescription>
              </Alert>
            )}

            {summary && summary.totalAddresses > MAX_LIMIT && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {summary.totalAddresses.toLocaleString("en-US")} addresses in this block. At most{" "}
                  {MAX_LIMIT.toLocaleString("en-US")} are listed.
                </AlertDescription>
              </Alert>
            )}

            {summary && !summary.hasNetworkAndBroadcast && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {summary.prefix === 31
                    ? "A /31 is a point-to-point link per RFC 3021: both addresses are usable, so neither can be excluded."
                    : "A /32 is a host route: it has a single usable address and no broadcast address."}
                </AlertDescription>
              </Alert>
            )}

            <fieldset className="space-y-3" disabled={!summary?.hasNetworkAndBroadcast}>
              <legend className="text-sm font-medium">Options</legend>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-network"
                  checked={network}
                  disabled={!summary?.hasNetworkAndBroadcast}
                  onCheckedChange={(checked) => void setQuery({ network: checked === true })}
                />
                <Label htmlFor="include-network" className="text-sm font-normal">
                  Include network address
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-broadcast"
                  checked={broadcast}
                  disabled={!summary?.hasNetworkAndBroadcast}
                  onCheckedChange={(checked) => void setQuery({ broadcast: checked === true })}
                />
                <Label htmlFor="include-broadcast" className="text-sm font-normal">
                  Include broadcast address
                </Label>
              </div>
            </fieldset>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void setQuery({ order: order === "asc" ? "desc" : "asc" })}
            >
              {order === "asc" ? (
                <ArrowUp className="mr-2 h-4 w-4" aria-hidden="true" />
              ) : (
                <ArrowDown className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {order === "asc" ? "Ascending" : "Descending"}
            </Button>

            {summary && (
              <ResultCard
                title="Network Details"
                data={[
                  { label: "CIDR", value: summary.cidr },
                  { label: "Network Address", value: summary.networkAddress },
                  {
                    label: "Broadcast Address",
                    value: summary.broadcastAddress ?? "None for this prefix",
                  },
                  { label: "Subnet Mask", value: summary.netmask },
                  { label: "Wildcard Mask", value: summary.wildcard },
                  { label: "First Usable", value: summary.firstUsable },
                  { label: "Last Usable", value: summary.lastUsable },
                  {
                    label: "Total Addresses",
                    value: summary.totalAddresses.toLocaleString("en-US"),
                  },
                  {
                    label: "Usable Hosts",
                    value: summary.usableHosts.toLocaleString("en-US"),
                    highlight: true,
                  },
                ]}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span>Address List</span>
              {summary && (
                <span className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {addresses.length.toLocaleString("en-US")} of{" "}
                    {available.toLocaleString("en-US")}
                  </Badge>
                  {addresses.length > 0 && <CopyButton value={addresses.join("\n")} />}
                </span>
              )}
            </CardTitle>
            <CardDescription>
              {summary
                ? `Showing ${addresses.length.toLocaleString("en-US")} of the ${available.toLocaleString("en-US")} addresses the current options select`
                : "Enter a valid CIDR block to enumerate"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4" aria-live="polite">
            {summary && addresses.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={exportCSV}>
                    <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                    Export CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportJSON}>
                    <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                    Export JSON
                  </Button>
                </div>

                <ul className="max-h-96 space-y-1 overflow-y-auto rounded-lg border p-3">
                  {addresses.map((address) => {
                    const isNetwork = address === summary.networkAddress
                    const isBroadcast = address === summary.broadcastAddress
                    const isGateway = !isNetwork && address === summary.firstUsable
                    return (
                      <li
                        key={address}
                        className="hover:bg-muted/50 flex items-center justify-between gap-2 rounded px-2 py-1 font-mono text-sm"
                      >
                        <span
                          className={
                            isNetwork
                              ? "text-blue-600"
                              : isBroadcast
                                ? "text-orange-600"
                                : isGateway
                                  ? "text-green-600"
                                  : undefined
                          }
                        >
                          {address}
                        </span>
                        {isNetwork && (
                          <Badge variant="outline" className="text-xs">
                            Network
                          </Badge>
                        )}
                        {isBroadcast && (
                          <Badge variant="outline" className="text-xs">
                            Broadcast
                          </Badge>
                        )}
                        {isGateway && (
                          <Badge variant="outline" className="text-xs">
                            Typical gateway
                          </Badge>
                        )}
                      </li>
                    )
                  })}
                </ul>

                {addresses.length < Math.min(available, MAX_LIMIT) && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-sm">
                      {(Math.min(available, MAX_LIMIT) - addresses.length).toLocaleString("en-US")}{" "}
                      more available
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void setQuery({
                          limit: Math.min(addresses.length + PAGE_SIZE * 4, MAX_LIMIT),
                        })
                      }
                    >
                      Load More
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-48 items-center justify-center">
                <p className="text-muted-foreground">
                  {summary
                    ? "The current options select no addresses"
                    : "Enter a valid CIDR block to see the address list"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Common CIDR Blocks</CardTitle>
          <CardDescription>
            Usable host counts derived from the prefix, not hardcoded
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4 lg:grid-cols-6">
            {COMMON_BLOCKS.map((block) => {
              const example = summarizeRange(`192.168.0.0/${block.prefix}`)
              return (
                <button
                  key={block.prefix}
                  type="button"
                  onClick={() => void setQuery({ cidr: example.cidr })}
                  className="hover:bg-muted rounded-lg border p-3 text-left transition-colors"
                >
                  <p className="font-mono font-semibold">/{block.prefix}</p>
                  <p className="text-muted-foreground text-xs">
                    {example.usableHosts.toLocaleString("en-US")} usable
                  </p>
                  <p className="text-muted-foreground text-xs">{block.use}</p>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default IPEnumerator
