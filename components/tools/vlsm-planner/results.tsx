"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle } from "lucide-react"
import type { VLSMPlan } from "@/lib/vlsm-utils"

export function ResultsPanel({ plan }: { plan: VLSMPlan | null }) {
  if (!plan) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Enter a base network and at least one requirement to see a plan.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            {plan.success ? (
              <CheckCircle className="h-5 w-5 text-green-600" aria-hidden="true" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" aria-hidden="true" />
            )}
            <span>VLSM Plan Summary</span>
          </CardTitle>
        </CardHeader>
        {/* the figures change in place as the inputs change, with no other cue */}
        <CardContent aria-live="polite">
          {plan.success && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="text-center">
                <div className="text-primary text-2xl font-bold">{plan.totalHosts}</div>
                <div className="text-muted-foreground text-sm">Total Hosts</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{plan.allocatedHosts}</div>
                <div className="text-muted-foreground text-sm">Allocated</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{plan.wastedHosts}</div>
                <div className="text-muted-foreground text-sm">Unallocated</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {plan.utilizationPercent.toFixed(1)}%
                </div>
                <div className="text-muted-foreground text-sm">Address Space Used</div>
              </div>
            </div>
          )}
          {!plan.success && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription id="vlsm-plan-error">{plan.errorMessage}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {plan.success && (
        <Card>
          <CardHeader>
            <CardTitle>Subnet Allocations</CardTitle>
            <CardDescription>
              Allocated largest first, each aligned to its own block boundary
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {plan.allocations.map((allocation) => (
                <div key={allocation.id} className="rounded-lg border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">{allocation.name}</h4>
                      <p className="text-muted-foreground text-sm">{allocation.cidr}</p>
                    </div>
                    <div className="flex space-x-2">
                      <Badge variant="secondary">/{allocation.prefix}</Badge>
                      <Badge variant="outline">{allocation.hostsAllocated} hosts</Badge>
                      {allocation.slackHosts > 0 && (
                        <Badge variant="secondary">+{allocation.slackHosts} slack</Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                    <div>
                      <span className="text-muted-foreground">Network:</span>
                      <div className="font-mono break-all">{allocation.network}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">First Host:</span>
                      <div className="font-mono break-all">{allocation.firstHost}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Last Host:</span>
                      <div className="font-mono break-all">{allocation.lastHost}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Broadcast:</span>
                      <div className="font-mono break-all">{allocation.broadcast}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
