"use client"

import { Badge } from "@/components/ui/badge"
import { Calendar } from "lucide-react"
import { classifyStatus, type RDAPEvent } from "@/lib/rdap"

export function formatRdapDate(dateString: string): string {
  const ts = Date.parse(dateString)
  if (Number.isNaN(ts)) return dateString
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function StatusBadges({ statuses }: { statuses: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map((status, i) => {
        const tone = classifyStatus(status)
        return (
          <Badge
            key={i}
            variant={
              tone === "positive"
                ? "default"
                : tone === "negative"
                  ? "destructive"
                  : tone === "warning"
                    ? "secondary"
                    : "outline"
            }
          >
            {status.replace(/_/g, " ")}
          </Badge>
        )
      })}
    </div>
  )
}

export function EventList({ events }: { events: RDAPEvent[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {events.map((event, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg border p-2">
          <Calendar className="text-muted-foreground h-4 w-4" aria-hidden="true" />
          <div>
            <p className="text-xs font-medium capitalize">{event.eventAction.replace(/_/g, " ")}</p>
            <p className="text-muted-foreground text-xs">{formatRdapDate(event.eventDate)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
