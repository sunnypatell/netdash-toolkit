"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Server, Wifi } from "lucide-react"
import { electronNetwork } from "@/lib/electron"

interface NetworkInterface {
  name: string
  mac: string
  ipv4?: string
  ipv6?: string
  netmask?: string
  internal: boolean
}

// desktop only: a browser has no api that can enumerate local interfaces, so this
// panel is never rendered on the web build
export default function InterfacesPanel() {
  const [interfaces, setInterfaces] = useState<NetworkInterface[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    electronNetwork
      .getNetworkInterfaces()
      .then((result) => {
        if (!cancelled) setInterfaces(result ?? [])
      })
      .catch(() => {
        if (!cancelled) setError("Could not read network interfaces from the system")
      })
    return () => {
      cancelled = true
    }
  }, [])

  const ordered = interfaces
    ? interfaces.filter((i) => !i.internal).concat(interfaces.filter((i) => i.internal))
    : []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Server className="h-5 w-5" />
          <span>Network Interfaces</span>
        </CardTitle>
        <CardDescription>Read from this machine by the desktop app</CardDescription>
      </CardHeader>
      <CardContent>
        <div aria-live="polite" aria-busy={interfaces === null && !error}>
          {error && <p className="text-destructive text-sm">{error}</p>}
          {!error && interfaces === null && (
            <div className="text-muted-foreground py-8 text-center">
              <Server className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>Reading network interfaces...</p>
            </div>
          )}
          {!error && interfaces !== null && interfaces.length === 0 && (
            <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
              No interfaces were reported
            </p>
          )}
          {ordered.length > 0 && (
            <div className="space-y-4">
              {ordered.map((iface, index) => (
                <div
                  key={index}
                  className={`rounded-lg border p-4 ${iface.internal ? "bg-muted/30" : "bg-muted/50"}`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Wifi className="text-primary h-5 w-5" />
                      <span className="font-semibold">{iface.name}</span>
                      {iface.internal && (
                        <Badge variant="secondary" className="text-xs">
                          Internal
                        </Badge>
                      )}
                    </div>
                    <span className="text-muted-foreground font-mono text-xs">{iface.mac}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                    {iface.ipv4 && (
                      <div>
                        <span className="text-muted-foreground">IPv4:</span>{" "}
                        <span className="font-mono">{iface.ipv4}</span>
                        {iface.netmask && (
                          <span className="text-muted-foreground ml-2 text-xs">
                            / {iface.netmask}
                          </span>
                        )}
                      </div>
                    )}
                    {iface.ipv6 && (
                      <div>
                        <span className="text-muted-foreground">IPv6:</span>{" "}
                        <span className="font-mono text-xs break-all">{iface.ipv6}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
