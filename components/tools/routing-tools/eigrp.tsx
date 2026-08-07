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
import { AlertTriangle, Download, Info, Network } from "lucide-react"
import { CopyButton } from "@/components/ui/copy-button"
import { ResultCard } from "@/components/ui/result-card"
import { toast } from "sonner"
import { dateStamp, downloadTextFile } from "@/lib/download"
import { buildEigrpConfig, evaluateNetworkStatement, type EIGRPConfig } from "@/lib/routing"

interface EigrpPanelProps {
  config: EIGRPConfig
  onConfigChange: (next: EIGRPConfig) => void
}

export function EigrpPanel({ config, onConfigChange }: EigrpPanelProps) {
  const evaluations = useMemo(
    () =>
      config.networks.map((network) =>
        evaluateNetworkStatement(network.address, network.wildcardMask)
      ),
    [config.networks]
  )

  const configText = useMemo(() => buildEigrpConfig(config, evaluations), [config, evaluations])

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

  const patchNetwork = (index: number, field: "address" | "wildcardMask", value: string) =>
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
              <Network className="h-5 w-5" aria-hidden="true" />
              EIGRP Configuration
            </CardTitle>
            <CardDescription>
              Generate Enhanced Interior Gateway Routing Protocol configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="eigrp-as">AS Number</Label>
                <Input
                  id="eigrp-as"
                  placeholder="100"
                  value={config.asNumber}
                  onChange={(e) => onConfigChange({ ...config, asNumber: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="eigrp-router-id">Router ID</Label>
                <Input
                  id="eigrp-router-id"
                  placeholder="1.1.1.1"
                  value={config.routerId}
                  onChange={(e) => onConfigChange({ ...config, routerId: e.target.value })}
                />
              </div>
            </div>

            <div role="group" aria-labelledby="eigrp-networks-label">
              <div className="mb-2 flex items-center justify-between">
                <Label id="eigrp-networks-label">Network Statements</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onConfigChange({
                      ...config,
                      networks: [...config.networks, { address: "", wildcardMask: "" }],
                    })
                  }
                >
                  Add Network
                </Button>
              </div>
              {config.networks.map((network, index) => (
                <div key={index} className="mb-2 grid grid-cols-2 gap-2">
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
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="eigrp-variance">Variance</Label>
                <Select
                  value={config.variance}
                  onValueChange={(value) => onConfigChange({ ...config, variance: value })}
                >
                  <SelectTrigger id="eigrp-variance">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 (Default)</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="eigrp-maximum-paths">Maximum Paths</Label>
                <Select
                  value={config.maximumPaths}
                  onValueChange={(value) => onConfigChange({ ...config, maximumPaths: value })}
                >
                  <SelectTrigger id="eigrp-maximum-paths">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="4">4 (Default)</SelectItem>
                    <SelectItem value="6">6</SelectItem>
                    <SelectItem value="8">8</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="eigrp-redistribute-static"
                  checked={config.redistributeStatic}
                  onCheckedChange={(checked) =>
                    onConfigChange({ ...config, redistributeStatic: !!checked })
                  }
                />
                <Label htmlFor="eigrp-redistribute-static">Redistribute Static Routes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="eigrp-redistribute-connected"
                  checked={config.redistributeConnected}
                  onCheckedChange={(checked) =>
                    onConfigChange({ ...config, redistributeConnected: !!checked })
                  }
                />
                <Label htmlFor="eigrp-redistribute-connected">Redistribute Connected Routes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="eigrp-auto-summary"
                  checked={config.autoSummary}
                  onCheckedChange={(checked) =>
                    onConfigChange({ ...config, autoSummary: !!checked })
                  }
                />
                <Label htmlFor="eigrp-auto-summary">Auto-Summary (Not Recommended)</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ResultCard owns the announcement; a wrapper here nests one live region in another */}
        <div className="space-y-4">
          {(issues.errors.length > 0 || issues.warnings.length > 0) && (
            <Alert variant={issues.errors.length ? "destructive" : "default"}>
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription className="space-y-1 text-sm">
                <strong>
                  {issues.errors.length > 0
                    ? "Resolve the following EIGRP validation issues:"
                    : "Review EIGRP network warnings:"}
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
            title="Generated EIGRP Configuration"
            data={[
              { label: "AS Number", value: config.asNumber || "Not set" },
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
                  aria-label="Generated EIGRP configuration"
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
                    downloadTextFile(configText, `eigrp-config-${dateStamp()}.txt`)
                    toast.success("Configuration exported")
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                  Export
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" aria-hidden="true" />
        <AlertDescription>
          <strong>EIGRP Best Practices:</strong> Disable auto-summary, use same AS number on all
          routers, and configure authentication for security.
        </AlertDescription>
      </Alert>
    </div>
  )
}

export default EigrpPanel
