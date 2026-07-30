"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, Download, Info, Settings } from "lucide-react"
import { CopyButton } from "@/components/ui/copy-button"
import { ResultCard } from "@/components/ui/result-card"
import { toast } from "sonner"
import { dateStamp, downloadTextFile } from "@/lib/download"
import {
  buildStaticRoutesConfig,
  emptyStaticRoute,
  evaluateStaticRoute,
  type StaticRoute,
} from "@/lib/routing"

interface StaticRoutesPanelProps {
  routes: StaticRoute[]
  onRoutesChange: (next: StaticRoute[]) => void
}

export function StaticRoutesPanel({ routes, onRoutesChange }: StaticRoutesPanelProps) {
  const evaluations = useMemo(() => routes.map((route) => evaluateStaticRoute(route)), [routes])
  const configText = useMemo(
    () => buildStaticRoutesConfig(routes, evaluations),
    [routes, evaluations]
  )

  const issues = useMemo(() => {
    const errors: string[] = []
    const warnings: string[] = []
    evaluations.forEach((evaluation, index) => {
      const label = routes[index]?.destination || `Route ${index + 1}`
      if (evaluation.error) {
        errors.push(`${label}: ${evaluation.error}`)
      } else if (evaluation.isValid) {
        evaluation.warnings.forEach((warning) => warnings.push(`${label}: ${warning}`))
      }
    })
    return { errors, warnings }
  }, [routes, evaluations])

  const validCount = evaluations.filter((evaluation) => evaluation.isValid).length
  const defaultRouteCount = evaluations.filter(
    (evaluation) =>
      evaluation.isValid && evaluation.destination === "0.0.0.0" && evaluation.mask === "0.0.0.0"
  ).length
  const floatingRouteCount = evaluations.filter((evaluation, index) => {
    if (!evaluation.isValid) return false
    const distance = Number.parseInt(routes[index].adminDistance || "1", 10)
    return !isNaN(distance) && distance > 1
  }).length

  const patchRoute = <K extends keyof StaticRoute>(
    index: number,
    field: K,
    value: StaticRoute[K]
  ) =>
    onRoutesChange(routes.map((route, i) => (i === index ? { ...route, [field]: value } : route)))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" aria-hidden="true" />
              Static Route Configuration
            </CardTitle>
            <CardDescription>Generate multiple static routes with advanced options</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4" role="group" aria-labelledby="static-routes-label">
            <div className="flex items-center justify-between">
              <Label id="static-routes-label">Static Routes</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRoutesChange([...routes, { ...emptyStaticRoute }])}
              >
                Add Route
              </Button>
            </div>

            {routes.map((route, index) => (
              <Card key={index} className="p-4" role="group" aria-label={`Route ${index + 1}`}>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor={`static-route-${index}-destination`} className="text-sm">
                        Destination
                      </Label>
                      <Input
                        id={`static-route-${index}-destination`}
                        placeholder="192.168.2.0"
                        value={route.destination}
                        onChange={(e) => patchRoute(index, "destination", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`static-route-${index}-mask`} className="text-sm">
                        Subnet Mask
                      </Label>
                      <Input
                        id={`static-route-${index}-mask`}
                        placeholder="255.255.255.0"
                        value={route.mask}
                        onChange={(e) => patchRoute(index, "mask", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor={`static-route-${index}-next-hop`} className="text-sm">
                        Next Hop IP
                      </Label>
                      <Input
                        id={`static-route-${index}-next-hop`}
                        placeholder="192.168.1.1"
                        value={route.nextHop}
                        onChange={(e) => patchRoute(index, "nextHop", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`static-route-${index}-interface`} className="text-sm">
                        Or Exit Interface
                      </Label>
                      <Input
                        id={`static-route-${index}-interface`}
                        placeholder="GigabitEthernet0/0"
                        value={route.interface}
                        onChange={(e) => patchRoute(index, "interface", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor={`static-route-${index}-admin-distance`} className="text-sm">
                        Admin Distance
                      </Label>
                      <Select
                        value={route.adminDistance}
                        onValueChange={(value) => patchRoute(index, "adminDistance", value)}
                      >
                        <SelectTrigger id={`static-route-${index}-admin-distance`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 (Default)</SelectItem>
                          <SelectItem value="5">5 (Backup)</SelectItem>
                          <SelectItem value="10">10 (Custom)</SelectItem>
                          <SelectItem value="50">50 (Low Priority)</SelectItem>
                          <SelectItem value="100">100 (Very Low)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`static-route-${index}-track`} className="text-sm">
                        Track Object
                      </Label>
                      <Input
                        id={`static-route-${index}-track`}
                        placeholder="100"
                        value={route.track}
                        onChange={(e) => patchRoute(index, "track", e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor={`static-route-${index}-description`} className="text-sm">
                      Description
                    </Label>
                    <Input
                      id={`static-route-${index}-description`}
                      placeholder="Route to branch office"
                      value={route.description}
                      onChange={(e) => patchRoute(index, "description", e.target.value)}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`static-route-${index}-permanent`}
                      checked={route.permanent}
                      onCheckedChange={(checked) => patchRoute(index, "permanent", !!checked)}
                    />
                    <Label htmlFor={`static-route-${index}-permanent`} className="text-sm">
                      Permanent Route
                    </Label>
                  </div>
                </div>
              </Card>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4" aria-live="polite">
          {(issues.errors.length > 0 || issues.warnings.length > 0) && (
            <Alert variant={issues.errors.length ? "destructive" : "default"}>
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription className="space-y-1 text-sm">
                <strong>
                  {issues.errors.length > 0
                    ? "Resolve the following static route issues before deployment:"
                    : "Static route warnings detected:"}
                </strong>
                <ul className="list-inside list-disc space-y-1">
                  {(issues.errors.length > 0 ? issues.errors : issues.warnings).map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <ResultCard
            title="Static Routes Summary"
            data={[
              { label: "Valid Routes", value: `${validCount}/${routes.length}` },
              { label: "Default Routes", value: defaultRouteCount.toString() },
              { label: "Floating Static", value: floatingRouteCount.toString() },
            ]}
          />

          <Card>
            <CardHeader>
              <CardTitle>Generated Commands</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Textarea
                  aria-label="Generated static route commands"
                  value={configText}
                  readOnly
                  className="min-h-[300px] font-mono text-sm"
                />
                <CopyButton
                  value={configText}
                  variant="outline"
                  className="absolute top-2 right-2"
                />
              </div>
              <div className="mt-4 flex space-x-2">
                <Button
                  onClick={() => {
                    downloadTextFile(configText, `static-routes-${dateStamp()}.txt`)
                    toast.success("Configuration exported")
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                  Export Routes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" aria-hidden="true" />
        <AlertDescription>
          <strong>Static Route Tips:</strong> Use 0.0.0.0 0.0.0.0 for default routes, higher AD for
          backup routes, and track objects for high availability.
        </AlertDescription>
      </Alert>
    </div>
  )
}

export default StaticRoutesPanel
