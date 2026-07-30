"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Copy, Globe } from "lucide-react"
import { copyText } from "@/lib/clipboard"
import type { RDAPDomainResponse } from "@/lib/rdap"
import { toast } from "sonner"
import { EventList, StatusBadges } from "./shared"

interface InfoPanelProps {
  domain: RDAPDomainResponse
  // the rdap server that actually answered, per the rfc 9083 self link
  authoritativeUrl?: string
}

export default function InfoPanel({ domain, authoritativeUrl }: InfoPanelProps) {
  const copy = async (value: string) => {
    if (await copyText(value)) toast.success("Copied to clipboard")
    else toast.error("Copy failed")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          {domain.ldhName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-muted-foreground text-sm">Domain Name</p>
            <div className="flex items-center gap-2">
              <p className="font-medium">{domain.ldhName}</p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => copy(domain.ldhName)}
                aria-label={`Copy ${domain.ldhName}`}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          {domain.unicodeName && domain.unicodeName !== domain.ldhName && (
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Unicode Name</p>
              <p className="font-medium">{domain.unicodeName}</p>
            </div>
          )}
          {domain.handle && (
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Handle</p>
              <p className="font-mono text-sm">{domain.handle}</p>
            </div>
          )}
          {domain.secureDNS && (
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">DNSSEC delegation</p>
              <Badge variant={domain.secureDNS.delegationSigned ? "default" : "secondary"}>
                {domain.secureDNS.delegationSigned ? "Signed (DS in parent)" : "Unsigned"}
              </Badge>
            </div>
          )}
        </div>

        {domain.status && domain.status.length > 0 && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">Status</p>
            <StatusBadges statuses={domain.status} />
          </div>
        )}

        {domain.events && domain.events.length > 0 && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">Events</p>
            <EventList events={domain.events} />
          </div>
        )}

        {authoritativeUrl && (
          <p className="text-muted-foreground text-xs break-all">
            Answered by <span className="font-mono">{authoritativeUrl}</span>. rdap.org only
            followed the RFC 9224 bootstrap registry to that server; the data above is the
            registry&apos;s.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
