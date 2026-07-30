"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Globe, Zap } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"
import type { PanelProps } from "@/lib/tool-panel"

const ADDRESS_TYPES = [
  { name: "Unspecified", prefix: "::/128", source: "RFC 4291 2.5.2" },
  { name: "Loopback", prefix: "::1/128", source: "RFC 4291 2.5.3" },
  { name: "IPv4-Mapped", prefix: "::ffff:0:0/96", source: "RFC 4291 2.5.5.2" },
  { name: "Global Unicast", prefix: "2000::/3", source: "RFC 4291 2.5.4" },
  { name: "Documentation", prefix: "2001:db8::/32", source: "RFC 3849" },
  { name: "Unique Local", prefix: "fc00::/7", source: "RFC 4193" },
  { name: "Link-Local", prefix: "fe80::/10", source: "RFC 4291 2.5.6" },
  { name: "Multicast", prefix: "ff00::/8", source: "RFC 4291 2.7" },
]

const COMPRESSION_RULES = [
  "4.1: suppress leading zeros in every group",
  "4.2.1: replace the longest run of all-zero groups with ::",
  "4.2.2: never use :: for a single zero group",
  "4.2.3: on a tie, shorten the first run",
  "4.3: write hexadecimal in lowercase",
  "5: keep the dotted quad in an IPv4-mapped address",
]

const EUI64_STEPS = [
  "Split the 48-bit MAC into two 24-bit halves",
  "Insert fffe between them to make 64 bits",
  "Invert the universal/local bit, which is 0x02 of the first octet",
  "Append the result to a /64 or shorter prefix",
]

const SOLICITED_NODE_FACTS = [
  "Prefix: ff02::1:ff00:0/104",
  "Low 24 bits of the target address are appended",
  "Every configured unicast address joins its own group",
  "Lets neighbour discovery skip nodes that cannot be the target",
]

function FactCard({
  title,
  icon: Icon,
  items,
}: {
  title: string
  icon?: typeof Zap
  items: string[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

export function IPv6ToolsReference({ embedded }: PanelProps) {
  return (
    <div className={embedded ? undefined : "tool-container"}>
      {!embedded && (
        <ToolHeader
          icon={Globe}
          title="IPv6 Quick Reference"
          description="Address prefixes, RFC 5952 compression rules and the EUI-64 procedure"
        />
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              IPv6 Address Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              {ADDRESS_TYPES.map((entry) => (
                <div key={entry.prefix} className="flex items-center justify-between gap-2">
                  <span className="font-medium">{entry.name}</span>
                  <span className="flex items-center gap-2">
                    <code className="bg-muted rounded px-1 text-xs">{entry.prefix}</code>
                    <span className="text-muted-foreground text-xs">{entry.source}</span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <FactCard title="Compression Rules (RFC 5952)" icon={Zap} items={COMPRESSION_RULES} />
        <FactCard title="EUI-64 Procedure (RFC 4291 Appendix A)" items={EUI64_STEPS} />
        <FactCard title="Solicited-Node Multicast (RFC 4291 2.7.1)" items={SOLICITED_NODE_FACTS} />
      </div>
    </div>
  )
}

export default IPv6ToolsReference
