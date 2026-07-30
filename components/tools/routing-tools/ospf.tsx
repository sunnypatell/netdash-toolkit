"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, Download, Info, Router } from "lucide-react"
import { CopyButton } from "@/components/ui/copy-button"
import { ResultCard } from "@/components/ui/result-card"
import { toast } from "sonner"
import { dateStamp, downloadTextFile } from "@/lib/download"
import { buildOspfConfig, evaluateNetworkStatement, type OSPFConfig } from "@/lib/routing"

interface OspfPanelProps {
  config: OSPFConfig
  onConfigChange: (next: OSPFConfig) => void
}

export function OspfPanel({ config, onConfigChange }: OspfPanelProps) {
  const evaluations = useMemo(
    () =>
      config.networks.map((network) =>
        evaluateNetworkStatement(network.address, network.wildcardMask)
      ),
    [config.networks]
  )

  const configText = useMemo(() => buildOspfConfig(config, evaluations), [config, evaluations])

  const issues = useMemo(() => {
    const errors: string[] = []
    const warnings: string[] = []
    evaluations.forEach((evaluation, index) => {
      const label = config.networks[index]?.address || `Entry ${index + 1}`
      if (evaluation.error) {
        errors.push(`${label}: ${evaluation.error}`)
      } else if (evaluation.isValid) {
        evaluation.warnings.forEach((warning) => warnings.push(`${label}: ${warning}`))
      }
    })
    return { errors, warnings }
  }, [config.networks, evaluations])

  const validNetworks = evaluations.filter((evaluation) => evaluation.isValid).length

  const patchNetwork = (index: number, field: "address" | "wildcardMask" | "area", value: string) =>
    onConfigChange({
      ...config,
      networks: config.networks.map((network, i) =>
        i === index ? { ...network, [field]: value } : network
      ),
    })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Router className="h-5 w-5" aria-hidden="true" />
              OSPF Configuration
            </CardTitle>
            <CardDescription>Generate comprehensive OSPF router configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ospf-process-id">Process ID</Label>
                <Input
                  id="ospf-process-id"
                  placeholder="1"
                  value={config.processId}
                  onChange={(e) => onConfigChange({ ...config, processId: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="ospf-router-id">Router ID</Label>
                <Input
                  id="ospf-router-id"
                  placeholder="1.1.1.1"
                  value={config.routerId}
                  onChange={(e) => onConfigChange({ ...config, routerId: e.target.value })}
                />
              </div>
            </div>

            <div role="group" aria-labelledby="ospf-networks-label">
              <div className="mb-2 flex items-center justify-between">
                <Label id="ospf-networks-label">Network Statements</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onConfigChange({
                      ...config,
                      networks: [...config.networks, { address: "", wildcardMask: "", area: "0" }],
                    })
                  }
                >
                  Add Network
                </Button>
              </div>
              {config.networks.map((network, index) => (
                <div key={index} className="mb-2 grid grid-cols-3 gap-2">
                  <Input
                    aria-label={`Network ${index + 1} address`}
                    placeholder="192.168.1.0"
                    value={network.address}
                    onChange={(e) => patchNetwork(index, "address", e.target.value)}
                  />
                  <Input
                    aria-label={`Network ${index + 1} wildcard mask`}
                    placeholder="0.0.0.255"
                    value={network.wildcardMask}
                    onChange={(e) => patchNetwork(index, "wildcardMask", e.target.value)}
                  />
                  <Input
                    aria-label={`Network ${index + 1} area`}
                    placeholder="0"
                    value={network.area}
                    onChange={(e) => patchNetwork(index, "area", e.target.value)}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="ospf-redistribute-static"
                  checked={config.redistributeStatic}
                  onCheckedChange={(checked) =>
                    onConfigChange({ ...config, redistributeStatic: !!checked })
                  }
                />
                <Label htmlFor="ospf-redistribute-static">Redistribute Static Routes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="ospf-redistribute-connected"
                  checked={config.redistributeConnected}
                  onCheckedChange={(checked) =>
                    onConfigChange({ ...config, redistributeConnected: !!checked })
                  }
                />
                <Label htmlFor="ospf-redistribute-connected">Redistribute Connected Routes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="ospf-default-originate"
                  checked={config.defaultOriginate}
                  onCheckedChange={(checked) =>
                    onConfigChange({ ...config, defaultOriginate: !!checked })
                  }
                />
                <Label htmlFor="ospf-default-originate">Default Information Originate</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4" aria-live="polite">
          {(issues.errors.length > 0 || issues.warnings.length > 0) && (
            <Alert variant={issues.errors.length ? "destructive" : "default"}>
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription className="space-y-1 text-sm">
                <strong>
                  {issues.errors.length > 0
                    ? "Resolve the following OSPF validation issues:"
                    : "Review OSPF network warnings:"}
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
            title="Generated OSPF Configuration"
            data={[
              { label: "Process ID", value: config.processId },
              { label: "Router ID", value: config.routerId || "Auto-selected" },
              { label: "Valid Networks", value: `${validNetworks}/${config.networks.length}` },
            ]}
          />

          <Card>
            <CardHeader>
              <CardTitle>Configuration Output</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Textarea
                  aria-label="Generated OSPF configuration"
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
                    downloadTextFile(configText, `ospf-config-${dateStamp()}.txt`)
                    toast.success("Configuration exported")
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                  Export Config
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" aria-hidden="true" />
        <AlertDescription>
          <strong>OSPF Best Practices:</strong> Use area 0 as backbone, configure router-id
          manually, and use passive-interface for networks that don't need OSPF neighbors.
        </AlertDescription>
      </Alert>
    </div>
  )
}

export default OspfPanel
