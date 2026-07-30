"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, Hash, Network } from "lucide-react"
import { flattenEntities, type RDAPASNResponse, type RDAPIPResponse } from "@/lib/rdap"
import { EventList, StatusBadges } from "./shared"

// ip and asn answers are single objects rather than a tabbed view, so they live
// here beside the domain panels instead of inflating the shell

function OrganizationList({ entities }: { entities: RDAPIPResponse["entities"] }) {
  return (
    <div className="grid gap-2">
      {flattenEntities(entities).map((contact, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
          <Building2 className="text-muted-foreground h-4 w-4" aria-hidden="true" />
          <span>{contact.organization || contact.name || contact.handle}</span>
          {contact.roles.map((role, j) => (
            <Badge key={j} variant="outline" className="text-xs capitalize">
              {role}
            </Badge>
          ))}
        </div>
      ))}
    </div>
  )
}

interface ResultProps<T> {
  result: T
  authoritativeUrl?: string
}

export function IPResult({ result, authoritativeUrl }: ResultProps<RDAPIPResponse>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5" aria-hidden="true" />
          IP Block Information
        </CardTitle>
        {authoritativeUrl && (
          <CardDescription className="break-all">Answered by {authoritativeUrl}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.startAddress && (
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Range Start</p>
              <p className="font-mono font-medium break-all">{result.startAddress}</p>
            </div>
          )}
          {result.endAddress && (
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Range End</p>
              <p className="font-mono font-medium break-all">{result.endAddress}</p>
            </div>
          )}
          {result.ipVersion && (
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">IP Version</p>
              <Badge variant="outline">IPv{result.ipVersion.replace(/^v/i, "")}</Badge>
            </div>
          )}
          {result.name && (
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Network Name</p>
              <p className="font-medium">{result.name}</p>
            </div>
          )}
          {result.type && (
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Type</p>
              <Badge variant="secondary">{result.type}</Badge>
            </div>
          )}
          {result.country && (
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Country</p>
              <p className="font-medium">{result.country}</p>
            </div>
          )}
          {result.handle && (
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Handle</p>
              <p className="font-mono text-sm">{result.handle}</p>
            </div>
          )}
          {result.parentHandle && (
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Parent Handle</p>
              <p className="font-mono text-sm">{result.parentHandle}</p>
            </div>
          )}
        </div>

        {result.cidr0_cidrs && result.cidr0_cidrs.length > 0 && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">CIDR Blocks</p>
            <div className="flex flex-wrap gap-2">
              {result.cidr0_cidrs.map((cidr, i) => (
                <Badge key={i} variant="outline" className="font-mono">
                  {cidr.v4prefix || cidr.v6prefix}/{cidr.length}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {result.status && result.status.length > 0 && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">Status</p>
            <StatusBadges statuses={result.status} />
          </div>
        )}

        {result.entities && result.entities.length > 0 && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">Organizations</p>
            <OrganizationList entities={result.entities} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ASNResult({ result, authoritativeUrl }: ResultProps<RDAPASNResponse>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hash className="h-5 w-5" aria-hidden="true" />
          ASN Information
        </CardTitle>
        {authoritativeUrl && (
          <CardDescription className="break-all">Answered by {authoritativeUrl}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.startAutnum !== undefined && (
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">ASN</p>
              <p className="font-mono text-lg font-bold">
                AS{result.startAutnum}
                {result.endAutnum !== undefined && result.endAutnum !== result.startAutnum && (
                  <span className="text-muted-foreground"> - AS{result.endAutnum}</span>
                )}
              </p>
            </div>
          )}
          {result.name && (
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Name</p>
              <p className="font-medium">{result.name}</p>
            </div>
          )}
          {result.type && (
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Type</p>
              <Badge variant="secondary">{result.type}</Badge>
            </div>
          )}
          {result.country && (
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Country</p>
              <p className="font-medium">{result.country}</p>
            </div>
          )}
          {result.handle && (
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Handle</p>
              <p className="font-mono text-sm">{result.handle}</p>
            </div>
          )}
        </div>

        {result.status && result.status.length > 0 && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">Status</p>
            <StatusBadges statuses={result.status} />
          </div>
        )}

        {result.entities && result.entities.length > 0 && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">Organizations</p>
            <OrganizationList entities={result.entities} />
          </div>
        )}

        {result.events && result.events.length > 0 && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">Events</p>
            <EventList events={result.events} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
