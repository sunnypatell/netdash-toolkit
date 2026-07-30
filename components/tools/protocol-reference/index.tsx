"use client"

import { Suspense, lazy } from "react"
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Search } from "lucide-react"
import { ToolHeader } from "@/components/ui/tool-header"

// one chunk per tab: opening the tool no longer downloads all three tables
const ProtocolsPanel = lazy(() =>
  import("./protocols").then((m) => ({ default: m.ProtocolsPanel }))
)
const ICMPPanel = lazy(() => import("./icmp").then((m) => ({ default: m.ICMPPanel })))
const UnreachablePanel = lazy(() =>
  import("./unreachable").then((m) => ({ default: m.UnreachablePanel }))
)

const TRANSPORTS = [
  {
    label: "TCP (6)",
    heading: "Connection-oriented",
    rfc: "RFC 9293",
    traits: ["Reliable delivery", "Flow and congestion control", "Ordered byte stream"],
  },
  {
    label: "UDP (17)",
    heading: "Connectionless",
    rfc: "RFC 768",
    traits: ["Best-effort delivery", "No ordering or retransmission", "8-byte header"],
  },
  {
    label: "SCTP (132)",
    heading: "Message-oriented",
    rfc: "RFC 9260",
    traits: ["Multi-homing", "Multi-streaming", "Preserves message boundaries"],
  },
]

function PanelFallback() {
  return (
    <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
      Loading table...
    </p>
  )
}

export function ProtocolReference() {
  const [query, setQuery] = useQueryStates(
    {
      tab: parseAsStringLiteral(["protocols", "icmp", "unreachable"] as const).withDefault(
        "protocols"
      ),
      q: parseAsString.withDefault(""),
    },
    // typing should not fill the back button with one entry per keystroke
    { history: "replace" }
  )

  return (
    <div className="tool-container">
      <ToolHeader
        icon={FileText}
        title="Protocol Reference"
        description="IP protocol numbers and ICMP types, checked against the IANA registries"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" aria-hidden="true" />
            Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <Label htmlFor="protocol-search">Search by number or name</Label>
            <Input
              id="protocol-search"
              value={query.q}
              onChange={(e) => setQuery({ q: e.target.value })}
              placeholder="TCP, 6, ICMP..."
              className="max-w-md"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs
        value={query.tab}
        onValueChange={(value) => setQuery({ tab: value as typeof query.tab })}
        className="space-y-6"
      >
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="protocols">IP Protocol Numbers</TabsTrigger>
          <TabsTrigger value="icmp">ICMP Types</TabsTrigger>
          <TabsTrigger value="unreachable">ICMP Unreachable Codes</TabsTrigger>
        </TabsList>

        <TabsContent value="protocols">
          <Suspense fallback={<PanelFallback />}>
            <ProtocolsPanel searchTerm={query.q} />
          </Suspense>
        </TabsContent>

        <TabsContent value="icmp">
          <Suspense fallback={<PanelFallback />}>
            <ICMPPanel searchTerm={query.q} />
          </Suspense>
        </TabsContent>

        <TabsContent value="unreachable">
          <Suspense fallback={<PanelFallback />}>
            <UnreachablePanel searchTerm={query.q} />
          </Suspense>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Transport Protocol Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {TRANSPORTS.map((transport) => (
              <div key={transport.label} className="rounded-lg border p-4">
                <Badge className="mb-2">{transport.label}</Badge>
                <h4 className="font-semibold">{transport.heading}</h4>
                <ul className="text-muted-foreground mt-2 list-inside list-disc text-sm">
                  {transport.traits.map((trait) => (
                    <li key={trait}>{trait}</li>
                  ))}
                </ul>
                <p className="text-muted-foreground mt-2 text-xs">{transport.rfc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
