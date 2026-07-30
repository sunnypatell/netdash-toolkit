"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, AlertTriangle, CheckCircle, XCircle } from "lucide-react"
import type { Conflict, ConflictAnalysisResult } from "@/lib/conflict-utils"

export interface ConflictRemediationPanelProps {
  analysis: ConflictAnalysisResult | null
}

const PRIORITIES = [
  {
    severity: "high" as const,
    label: "High Priority",
    className: "text-red-600",
    background: "bg-red-50 dark:bg-red-950/20",
    blurb: "These can cause an outage or indicate spoofing, so fix them first.",
    Icon: XCircle,
  },
  {
    severity: "medium" as const,
    label: "Medium Priority",
    className: "text-orange-600",
    background: "bg-orange-50 dark:bg-orange-950/20",
    blurb: "Plan these into the next change window before they escalate.",
    Icon: AlertCircle,
  },
  {
    severity: "low" as const,
    label: "Low Priority",
    className: "text-yellow-600",
    background: "bg-yellow-50 dark:bg-yellow-950/20",
    blurb: "Worth monitoring, but no immediate action is required.",
    Icon: AlertTriangle,
  },
]

const BEST_PRACTICES = [
  {
    title: "IP address management",
    items: [
      "Keep the IPAM record authoritative, not the spreadsheet",
      "Use DHCP reservations for servers, printers and appliances",
      "Keep static and DHCP ranges in separate, documented blocks",
      "Audit with a scan on a schedule, not only after an incident",
    ],
  },
  {
    title: "Monitoring",
    items: [
      "Alert on ARP table changes for critical addresses",
      "Enable DHCP conflict detection on the server",
      "Enable DHCP snooping and dynamic ARP inspection on access switches",
      "Track MAC to port history so a duplicate can be located physically",
    ],
  },
]

function conflictsBySeverity(conflicts: Conflict[], severity: Conflict["severity"]) {
  return conflicts.filter((conflict) => conflict.severity === severity)
}

export function ConflictRemediationPanel({ analysis }: ConflictRemediationPanelProps) {
  const conflicts = analysis?.conflicts ?? []

  return (
    <div className="space-y-6">
      {conflicts.length === 0 ? (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Nothing to remediate. Keep monitoring and keep the address records current.
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Remediation Priority</CardTitle>
            <CardDescription>Conflicts grouped by severity, worst first</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {PRIORITIES.map(({ severity, label, className, background, blurb, Icon }) => {
              const matching = conflictsBySeverity(conflicts, severity)
              if (matching.length === 0) return null
              return (
                <div key={severity}>
                  <h3 className={`mb-3 flex items-center gap-2 font-semibold ${className}`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {label} ({matching.length})
                  </h3>
                  <p className="text-muted-foreground mb-3 text-sm">{blurb}</p>
                  <div className="space-y-2">
                    {matching.map((conflict, index) => (
                      <div
                        key={`${conflict.type}-${index}`}
                        className={`rounded-lg p-3 ${background}`}
                      >
                        <p className="text-sm font-medium">{conflict.description}</p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          First action: {conflict.remediation[0]}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>General Best Practices</CardTitle>
          <CardDescription>Preventive measures that stop conflicts recurring</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {BEST_PRACTICES.map((group) => (
              <div key={group.title}>
                <h4 className="mb-2 font-medium">{group.title}</h4>
                <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ConflictRemediationPanel
