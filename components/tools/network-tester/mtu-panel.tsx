"use client"

import { useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { AlertCircle, CheckCircle2, Wifi } from "lucide-react"
import { calculateMTU, protocolOverheads } from "@/lib/network-testing"
import type { MTUCalculation } from "@/lib/network-testing"

export function MTUPanel() {
  const [linkMTU, setLinkMTU] = useState("1500")
  const [selected, setSelected] = useState<string[]>(["Ethernet II", "IPv4", "TCP"])
  const [calculation, setCalculation] = useState<MTUCalculation | null>(null)

  const calculate = () => {
    const protocols = selected.map((name) => ({
      name,
      size: protocolOverheads[name as keyof typeof protocolOverheads] || 0,
    }))
    setCalculation(calculateMTU(Number.parseInt(linkMTU, 10) || 1500, protocols))
  }

  const toggle = (protocol: string) => {
    setSelected((previous) =>
      previous.includes(protocol)
        ? previous.filter((name) => name !== protocol)
        : [...previous, protocol]
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Wifi className="h-5 w-5" aria-hidden="true" />
          <span>MTU Calculator</span>
        </CardTitle>
        <CardDescription>
          Subtract header overhead from a link MTU to get the payload MTU. Arithmetic only, nothing
          is sent.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="link-mtu">Link MTU</Label>
            <Input
              id="link-mtu"
              type="number"
              value={linkMTU}
              onChange={(e) => setLinkMTU(e.target.value)}
              placeholder="1500"
            />
          </div>
          <div>
            <Label id="protocol-stack-label">Protocol Stack</Label>
            <div
              role="group"
              aria-labelledby="protocol-stack-label"
              className="mt-2 flex flex-wrap gap-2"
            >
              {Object.keys(protocolOverheads).map((protocol) => (
                <Badge
                  key={protocol}
                  variant={selected.includes(protocol) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggle(protocol)}
                >
                  {protocol} ({protocolOverheads[protocol as keyof typeof protocolOverheads]}B)
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <Button onClick={calculate} className="w-full">
          Calculate MTU
        </Button>

        <div aria-live="polite">
          {!calculation && (
            <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
              Set a link MTU, pick the protocols in the path, then calculate - the payload MTU and
              per-header breakdown appear here.
            </p>
          )}

          {calculation && (
            <Card className="p-4">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="text-center">
                    <div className="text-primary text-2xl font-bold">{calculation.linkMTU}</div>
                    <div className="text-muted-foreground text-sm">Link MTU</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {calculation.totalOverhead}
                    </div>
                    <div className="text-muted-foreground text-sm">Total Overhead</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {calculation.payloadMTU}
                    </div>
                    <div className="text-muted-foreground text-sm">Payload MTU</div>
                  </div>
                </div>

                {/* sc 1.4.1: the green payload figure above is the same colour
                    whatever the verdict, so the verdict is stated in words */}
                {calculation.fragmentationWarning ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" aria-hidden="true" />
                    <AlertDescription>
                      Payload MTU is below the IPv6 minimum of 1280 bytes (RFC 8200 section 5), so
                      IPv6 traffic on this path needs fragmentation by the source.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <AlertDescription>
                      Payload MTU is at or above the IPv6 minimum of 1280 bytes (RFC 8200 section
                      5), so no source fragmentation is needed.
                    </AlertDescription>
                  </Alert>
                )}

                <Separator />

                <div>
                  <h5 className="mb-2 font-medium">Protocol Breakdown</h5>
                  <div className="space-y-1">
                    {calculation.headers.map((header, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>{header.name}</span>
                        <span className="font-mono">{header.size} bytes</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
