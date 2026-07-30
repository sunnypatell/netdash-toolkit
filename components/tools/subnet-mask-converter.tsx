"use client"

import { useMemo } from "react"
import { parseAsString, useQueryStates } from "nuqs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Binary, AlertTriangle, Info } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import { CopyButton } from "@/components/ui/copy-button"
import { ReferenceTable, type ReferenceColumn } from "@/components/tools/shared/reference-table"
import { maskInfo, parseMaskInput } from "@/lib/mask-convert"
import { SUBNET_MASKS } from "@/lib/reference/subnet-masks"
import { COMMON_SUBNETS } from "@/lib/reference/common-subnets"
import type { SubnetMaskEntry } from "@/lib/reference/types"

const PRESETS = [8, 16, 24, 25, 26, 27, 28, 29, 30, 31, 32]

const USE_CASE_BY_PREFIX = new Map(COMMON_SUBNETS.map((entry) => [entry.prefix, entry.useCase]))

const columns: ReferenceColumn<SubnetMaskEntry>[] = [
  {
    key: "prefix",
    header: "CIDR",
    headClassName: "w-20",
    text: (row) => `/${row.prefix}`,
    cell: (row) => <Badge variant="secondary">/{row.prefix}</Badge>,
  },
  {
    key: "mask",
    header: "Subnet Mask",
    cellClassName: "font-mono",
    text: (row) => row.mask,
  },
  {
    key: "wildcard",
    header: "Wildcard",
    cellClassName: "font-mono",
    text: (row) => row.wildcard,
  },
  {
    key: "hosts",
    header: "Usable Hosts",
    text: (row) => row.usableHosts.toLocaleString(),
  },
  {
    key: "use",
    header: "Typical Use",
    cellClassName: "text-muted-foreground whitespace-normal",
    text: (row) => USE_CASE_BY_PREFIX.get(row.prefix) ?? "",
  },
]

function FormatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="font-mono text-sm break-all">{value}</p>
      </div>
      <CopyButton value={value} size="sm" />
    </div>
  )
}

export function SubnetMaskConverter() {
  const [query, setQuery] = useQueryStates(
    { mask: parseAsString.withDefault("255.255.255.0") },
    // typing should not fill the back button with one entry per keystroke
    { history: "replace" }
  )

  const { mask } = query

  // derived, so an invalid mask cannot leave the previous answer on screen
  const { result, error } = useMemo(() => {
    const prefix = parseMaskInput(mask)
    if (prefix === null) {
      return {
        result: null,
        error: mask.trim()
          ? "Not a valid mask. Enter CIDR (/24), a prefix length (24), a dotted-decimal mask (255.255.255.0) or a wildcard (0.0.0.255). Non-contiguous masks are rejected."
          : "",
      }
    }
    return { result: maskInfo(prefix), error: "" }
  }, [mask])

  return (
    <div className="tool-container">
      <ToolHeader
        icon={Binary}
        title="Subnet Mask Converter"
        description="Convert between CIDR, dotted decimal, wildcard and binary masks"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>Enter a mask in any of the four notations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="mask">Subnet Mask</Label>
              <Input
                id="mask"
                value={mask}
                onChange={(e) => setQuery({ mask: e.target.value })}
                placeholder="/24 or 255.255.255.0"
                className="font-mono"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Accepts /24, 24, 255.255.255.0 or 0.0.0.255
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2 pt-2">
              <p className="text-muted-foreground text-xs">Quick Select</p>
              <div className="flex flex-wrap gap-1">
                {PRESETS.map((prefix) => (
                  <Badge
                    key={prefix}
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => setQuery({ mask: `/${prefix}` })}
                  >
                    /{prefix}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Conversions</CardTitle>
            <CardDescription>
              {result ? `All notations for /${result.prefix}` : "Enter a mask to see conversions"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result ? (
              <>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <FormatRow label="CIDR Notation" value={`/${result.prefix}`} />
                  <FormatRow label="Subnet Mask (dotted decimal)" value={result.netmask} />
                  <FormatRow label="Wildcard Mask" value={result.wildcard} />
                  <FormatRow label="Binary" value={result.binary} />
                  <FormatRow label="Usable Hosts" value={result.usableHosts.toLocaleString()} />
                  <FormatRow
                    label="Total Addresses"
                    value={result.totalAddresses.toLocaleString()}
                  />
                  <FormatRow label="Host Bits" value={String(result.hostBits)} />
                  <FormatRow
                    label={`Blocks of this size in IPv4`}
                    value={result.blocksInIPv4Space.toLocaleString()}
                  />
                </div>

                {(result.prefix === 31 || result.prefix === 32) && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {result.prefix === 31
                        ? "A /31 has no network or broadcast address: both addresses are usable on a point-to-point link (RFC 3021)."
                        : "A /32 addresses a single interface. Used for host routes, loopbacks and ACL entries."}
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <div className="flex h-48 items-center justify-center">
                <p className="text-muted-foreground">Enter a valid subnet mask</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ReferenceTable
        title="Every Prefix Length"
        description="Mask, wildcard and usable host count for /0 through /32"
        rows={SUBNET_MASKS}
        columns={columns}
        rowKey={(row) => String(row.prefix)}
      />
    </div>
  )
}
