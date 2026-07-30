"use client"

import { useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { AlertCircle, Zap } from "lucide-react"
import { generateEUI64FromMAC, generateSolicitedNodeMulticast } from "@/lib/network-testing"

export function IPv6Panel() {
  const [address, setAddress] = useState("2001:db8::1")
  const [multicast, setMulticast] = useState<string | null>(null)
  const [multicastError, setMulticastError] = useState<string | null>(null)

  const [mac, setMac] = useState("00:11:22:33:44:55")
  const [prefix, setPrefix] = useState("2001:db8::/64")
  const [eui64, setEui64] = useState<string | null>(null)
  const [eui64Error, setEui64Error] = useState<string | null>(null)

  const generateMulticast = () => {
    try {
      setMulticast(generateSolicitedNodeMulticast(address))
      setMulticastError(null)
    } catch {
      setMulticast(null)
      setMulticastError(
        "Not a valid IPv6 address. Try a full or compressed form such as 2001:db8::1."
      )
    }
  }

  const generateEUI64 = () => {
    try {
      setEui64(generateEUI64FromMAC(mac, prefix))
      setEui64Error(null)
    } catch {
      setEui64(null)
      setEui64Error("Could not build an EUI-64 address. Check the MAC address and the IPv6 prefix.")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Zap className="h-5 w-5" aria-hidden="true" />
          <span>IPv6 Tools</span>
        </CardTitle>
        <CardDescription>
          Derive a solicited-node multicast address (RFC 4291) and a modified EUI-64 interface
          identifier (RFC 4291 appendix A). Local arithmetic, nothing is sent.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <h4 className="mb-3 font-semibold">Solicited-Node Multicast</h4>
          <Label htmlFor="ipv6-address">IPv6 Address</Label>
          <div className="flex space-x-2">
            <Input
              id="ipv6-address"
              placeholder="2001:db8::1"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="flex-1"
              aria-invalid={multicastError !== null}
              aria-describedby={multicastError ? "ipv6-multicast-error" : undefined}
            />
            <Button onClick={generateMulticast}>Generate</Button>
          </div>

          {multicastError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription id="ipv6-multicast-error">{multicastError}</AlertDescription>
            </Alert>
          )}

          <div aria-live="polite">
            {multicast && (
              <div className="bg-muted/50 rounded-md border p-3">
                <p className="text-muted-foreground text-xs">Solicited-node multicast</p>
                <p className="font-mono text-sm break-all">{multicast}</p>
              </div>
            )}
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="mb-3 font-semibold">EUI-64 from MAC</h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="eui64-mac">MAC Address</Label>
              <Input
                id="eui64-mac"
                placeholder="00:11:22:33:44:55"
                value={mac}
                onChange={(e) => setMac(e.target.value)}
                aria-invalid={eui64Error !== null}
                aria-describedby={eui64Error ? "ipv6-eui64-error" : undefined}
              />
            </div>
            <div>
              <Label htmlFor="eui64-prefix">IPv6 Prefix</Label>
              <Input
                id="eui64-prefix"
                placeholder="2001:db8::/64"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                aria-invalid={eui64Error !== null}
                aria-describedby={eui64Error ? "ipv6-eui64-error" : undefined}
              />
            </div>
          </div>
          <Button onClick={generateEUI64} className="mt-4 w-full">
            Generate EUI-64
          </Button>

          {eui64Error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription id="ipv6-eui64-error">{eui64Error}</AlertDescription>
            </Alert>
          )}

          <div aria-live="polite">
            {eui64 && (
              <div className="bg-muted/50 mt-4 rounded-md border p-3">
                <p className="text-muted-foreground text-xs">EUI-64 address</p>
                <p className="font-mono text-sm break-all">{eui64}</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
