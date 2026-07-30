"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle, Search } from "lucide-react"
import { lookupOUI } from "@/lib/network-testing"
import type { OUIResult } from "@/lib/network-testing"

export function OUIPanel() {
  const [mac, setMac] = useState("")
  const [result, setResult] = useState<OUIResult | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Search className="h-5 w-5" aria-hidden="true" />
          <span>OUI Lookup</span>
        </CardTitle>
        <CardDescription>
          Match the first three octets of a MAC against a bundled subset of the IEEE OUI registry.
          Offline, so a miss means the prefix is not in the bundled list rather than unassigned.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="oui-mac">MAC Address</Label>
          <div className="flex space-x-2">
            <Input
              id="oui-mac"
              placeholder="00:11:22:33:44:55"
              value={mac}
              onChange={(e) => setMac(e.target.value)}
              className="flex-1"
            />
            <Button onClick={() => setResult(lookupOUI(mac))} disabled={!mac.trim()}>
              Lookup
            </Button>
          </div>
        </div>

        <div aria-live="polite">
          {!result && (
            <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
              Enter a MAC address to look up its OUI and vendor.
            </p>
          )}

          {result && (
            <Card className="p-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  {result.found ? (
                    <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-orange-600" aria-hidden="true" />
                  )}
                  <span className="font-mono">{result.mac}</span>
                </div>
                <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">OUI:</span>
                    <div className="font-mono">{result.oui || "Could not read three octets"}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Vendor:</span>
                    <div>{result.vendor || "Not in the bundled OUI list"}</div>
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
