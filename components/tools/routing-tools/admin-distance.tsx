"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Info } from "lucide-react"
import { administrativeDistances } from "@/lib/routing"

const PRIORITY_TINT: Record<string, string> = {
  Highest: "bg-green-100 text-green-800",
  High: "bg-blue-100 text-blue-800",
  Medium: "bg-cyan-100 text-cyan-800",
  Low: "bg-yellow-100 text-yellow-800",
  Never: "bg-red-100 text-red-800",
}

function priorityOf(distance: number): string {
  if (distance === 255) return "Never"
  if (distance === 0) return "Highest"
  if (distance <= 20) return "High"
  if (distance <= 110) return "Medium"
  return "Low"
}

export function AdminDistancePanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Administrative Distance Reference</CardTitle>
        <CardDescription>
          Understanding route preference and administrative distances in Cisco routers
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>
              Administrative Distance (AD) determines route preference. Lower values are preferred.
              When multiple routes to the same destination exist, the route with the lowest AD is
              installed.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            {administrativeDistances.map((item) => {
              const priority = priorityOf(item.distance)
              return (
                <div
                  key={item.protocol}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="px-3 py-1 font-mono text-base">
                      {item.distance}
                    </Badge>
                    <div>
                      <p className="font-medium">{item.protocol}</p>
                      <p className="text-muted-foreground text-sm">{item.description}</p>
                    </div>
                  </div>
                  <Badge className={PRIORITY_TINT[priority]}>
                    {priority === "Never" ? "Never installed" : `${priority} Priority`}
                  </Badge>
                </div>
              )
            })}
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Bridge Priority (STP) Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <h5 className="mb-2 font-medium">Priority Values</h5>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Default Priority:</span>
                      <Badge variant="secondary">32768</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Range:</span>
                      <span className="font-mono">0-61440</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Increment:</span>
                      <span className="font-mono">4096</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h5 className="mb-2 font-medium">Common Values</h5>
                  <div className="flex flex-wrap gap-1">
                    {[4096, 8192, 12288, 16384, 20480, 24576, 28672, 32768].map((priority) => (
                      <Badge key={priority} variant="outline" className="text-xs">
                        {priority}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="bg-muted/50 mt-4 rounded-lg p-3">
                <p className="font-mono text-sm break-all">
                  spanning-tree vlan [vlan-id] priority [priority]
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  )
}

export default AdminDistancePanel
