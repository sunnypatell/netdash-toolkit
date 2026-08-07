"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CopyButton } from "@/components/ui/copy-button"
import { Globe2 } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import type { PanelProps } from "@/lib/tool-panel"
import { IPV6_SPECIAL_RANGES } from "@/lib/reference/ipv6-ranges"

// the prefix rows come from the one ipv6 registry table in lib/reference. the
// ipv4 counterpart is the only column that lives here, because it is a teaching
// aid for this panel rather than registry data.
const IPV4_COUNTERPART: Readonly<Record<string, string>> = {
  "::/128": "0.0.0.0",
  "::1/128": "127.0.0.1",
  "2001:db8::/32": "192.0.2.0/24",
  "fe80::/10": "169.254.0.0/16",
  "fc00::/7": "RFC 1918 ranges",
  "fd00::/8": "RFC 1918 ranges",
}

export function IPv6SpecialAddresses({ embedded }: PanelProps) {
  return (
    <div className={embedded ? undefined : "tool-container"}>
      {!embedded && (
        <ToolHeader
          icon={Globe2}
          title="IPv6 Special Addresses"
          description="Special-purpose IPv6 prefixes and their IPv4 counterparts"
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Special Purpose Addresses</CardTitle>
          <CardDescription>
            The IANA special-purpose IPv6 registry, with the RFC that reserved each prefix
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Special-purpose IPv6 prefixes</caption>
              <thead>
                <tr className="border-b">
                  <th scope="col" className="p-2 text-left font-medium">
                    Prefix
                  </th>
                  <th scope="col" className="p-2 text-left font-medium">
                    Name
                  </th>
                  <th scope="col" className="p-2 text-left font-medium">
                    Description
                  </th>
                  <th scope="col" className="p-2 text-left font-medium">
                    Globally Routed
                  </th>
                  <th scope="col" className="p-2 text-left font-medium">
                    IPv4 Equivalent
                  </th>
                  <th scope="col" className="p-2 text-left font-medium">
                    Reference
                  </th>
                  <th scope="col" className="p-2 font-medium">
                    <span className="sr-only">Copy prefix</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {IPV6_SPECIAL_RANGES.map((entry) => (
                  <tr key={entry.range} className="hover:bg-muted/50 border-b">
                    <th scope="row" className="p-2 text-left font-mono font-normal">
                      {entry.range}
                    </th>
                    <td className="p-2">{entry.name}</td>
                    <td className="text-muted-foreground p-2">{entry.description}</td>
                    <td className="p-2">{entry.routable}</td>
                    <td className="p-2 font-mono text-xs">
                      {IPV4_COUNTERPART[entry.range] ?? "-"}
                    </td>
                    <td className="text-muted-foreground p-2 text-xs">{entry.rfc}</td>
                    <td className="p-2">
                      <CopyButton value={entry.range} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default IPv6SpecialAddresses
