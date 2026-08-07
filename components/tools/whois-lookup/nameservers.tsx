"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CopyButton } from "@/components/ui/copy-button"
import { Server } from "lucide-react"
import type { RDAPDomainResponse } from "@/lib/rdap"

export default function NameserversPanel({ domain }: { domain: RDAPDomainResponse }) {
  const nameservers = domain.nameservers ?? []

  if (nameservers.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">
            The registry returned no nameserver objects. That is the delegation as the registry
            records it, which can differ from what the zone actually serves - query NS records to
            see the live answer.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" aria-hidden="true" />
          Nameservers ({nameservers.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {nameservers.map((ns, index) => (
            <div key={index} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">{ns.ldhName}</p>
                <CopyButton value={ns.ldhName} className="h-6 w-6 p-0" />
              </div>
              {ns.ipAddresses && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {ns.ipAddresses.v4?.map((ip, i) => (
                    <Badge key={`v4-${i}`} variant="outline" className="font-mono text-xs">
                      {ip}
                    </Badge>
                  ))}
                  {ns.ipAddresses.v6?.map((ip, i) => (
                    <Badge key={`v6-${i}`} variant="outline" className="font-mono text-xs">
                      {ip}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-muted-foreground mt-4 text-xs">
          Glue addresses appear only where the registry holds them, which is normally just for
          in-bailiwick nameservers.
        </p>
      </CardContent>
    </Card>
  )
}
