"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, Download, Info, CheckCircle2, Lightbulb } from "lucide-react"
import { ResultCard } from "@/components/ui/result-card"
import { SaveToProject } from "@/components/ui/save-to-project"
import { LoadFromProject } from "@/components/ui/load-from-project"
import type { ProjectItem } from "@/contexts/project-context"

// Fiber specifications per TIA-568.3-D
const FIBER_SPECS = {
  "os1-1310": {
    name: "OS1 Single-mode",
    wavelength: "1310nm",
    lossPerKm: 1.0,
    connectorLoss: 0.75,
  },
  "os1-1550": {
    name: "OS1 Single-mode",
    wavelength: "1550nm",
    lossPerKm: 1.0,
    connectorLoss: 0.75,
  },
  "os2-1310": {
    name: "OS2 Single-mode",
    wavelength: "1310nm",
    lossPerKm: 0.4,
    connectorLoss: 0.75,
  },
  "os2-1550": {
    name: "OS2 Single-mode",
    wavelength: "1550nm",
    lossPerKm: 0.4,
    connectorLoss: 0.75,
  },
  om1: { name: "OM1 Multi-mode", wavelength: "850nm", lossPerKm: 3.5, connectorLoss: 0.75 },
  om2: { name: "OM2 Multi-mode", wavelength: "850nm", lossPerKm: 3.5, connectorLoss: 0.75 },
  om3: { name: "OM3 Multi-mode", wavelength: "850nm", lossPerKm: 3.0, connectorLoss: 0.75 },
  om4: { name: "OM4 Multi-mode", wavelength: "850nm", lossPerKm: 3.0, connectorLoss: 0.75 },
  om5: { name: "OM5 Multi-mode", wavelength: "850nm/953nm", lossPerKm: 3.0, connectorLoss: 0.75 },
} as const

// Copper specifications per TIA-568-D
const COPPER_SPECS = {
  cat5e: { name: "Cat5e", maxChannel: 100, max10G: 0, maxSpeed: "1 Gbps", permanent: 90 },
  cat6: { name: "Cat6", maxChannel: 100, max10G: 55, maxSpeed: "10 Gbps", permanent: 90 },
  cat6a: { name: "Cat6a", maxChannel: 100, max10G: 100, maxSpeed: "10 Gbps", permanent: 90 },
  cat7: { name: "Cat7", maxChannel: 100, max10G: 100, maxSpeed: "10 Gbps", permanent: 90 },
  cat8: { name: "Cat8", maxChannel: 30, max10G: 30, maxSpeed: "25/40 Gbps", permanent: 24 },
} as const

const SPLICE_LOSS = { fusion: 0.1, mechanical: 0.5 } as const

type FiberType = keyof typeof FIBER_SPECS
type CopperType = keyof typeof COPPER_SPECS
type SpliceType = keyof typeof SPLICE_LOSS

interface FiberResult {
  cableLoss: number
  connectorLoss: number
  spliceLoss: number
  totalLoss: number
  withinBudget: boolean
  powerBudget: number
  margin: number
  warnings: string[]
}

interface CopperResult {
  withinSpec: boolean
  maxDistance: number
  supports10G: boolean
  max10GDistance: number
  warnings: string[]
}

export function CableCalculator() {
  const [activeTab, setActiveTab] = useState("fiber")

  // Fiber state
  const [fiberType, setFiberType] = useState<FiberType>("os2-1310")
  const [fiberLength, setFiberLength] = useState("500")
  const [lengthUnit, setLengthUnit] = useState<"m" | "ft" | "km">("m")
  const [connectorPairs, setConnectorPairs] = useState("2")
  const [spliceCount, setSpliceCount] = useState("0")
  const [spliceType, setSpliceType] = useState<SpliceType>("fusion")
  const [powerBudget, setPowerBudget] = useState("10")

  // Copper state
  const [copperType, setCopperType] = useState<CopperType>("cat6a")
  const [copperLength, setCopperLength] = useState("90")
  const [patchCordLength, setPatchCordLength] = useState("10")

  // Convert length to km for fiber calculations
  const getLengthInKm = (length: string, unit: string): number => {
    const len = parseFloat(length) || 0
    switch (unit) {
      case "ft":
        return len * 0.0003048
      case "km":
        return len
      default:
        return len / 1000 // meters
    }
  }

  // Fiber calculation
  const fiberResult = useMemo((): FiberResult | null => {
    const lengthKm = getLengthInKm(fiberLength, lengthUnit)
    const connectors = parseInt(connectorPairs) || 0
    const splices = parseInt(spliceCount) || 0
    const budget = parseFloat(powerBudget) || 10

    if (lengthKm <= 0) return null

    const spec = FIBER_SPECS[fiberType]
    const cableLoss = lengthKm * spec.lossPerKm
    const connectorLoss = connectors * spec.connectorLoss
    const spliceLoss = splices * SPLICE_LOSS[spliceType]
    const totalLoss = cableLoss + connectorLoss + spliceLoss
    const margin = budget - totalLoss

    const warnings: string[] = []

    if (margin < 3) {
      warnings.push("Link margin below 3 dB - consider higher power budget or shorter run")
    }
    if (margin < 0) {
      warnings.push("Total loss exceeds power budget - link will not function")
    }
    if (lengthKm > 10 && fiberType.startsWith("om")) {
      warnings.push("Multi-mode fiber typically limited to shorter distances")
    }
    if (connectors > 6) {
      warnings.push("High connector count - consider consolidation")
    }

    return {
      cableLoss: Math.round(cableLoss * 1000) / 1000,
      connectorLoss: Math.round(connectorLoss * 1000) / 1000,
      spliceLoss: Math.round(spliceLoss * 1000) / 1000,
      totalLoss: Math.round(totalLoss * 1000) / 1000,
      withinBudget: margin >= 0,
      powerBudget: budget,
      margin: Math.round(margin * 1000) / 1000,
      warnings,
    }
  }, [fiberType, fiberLength, lengthUnit, connectorPairs, spliceCount, spliceType, powerBudget])

  // Copper calculation
  const copperResult = useMemo((): CopperResult | null => {
    const length = parseFloat(copperLength) || 0
    const patchLength = parseFloat(patchCordLength) || 0
    const totalLength = length + patchLength

    if (length <= 0) return null

    const spec = COPPER_SPECS[copperType]
    const withinSpec = totalLength <= spec.maxChannel && length <= spec.permanent
    const supports10G = spec.max10G > 0 && totalLength <= spec.max10G

    const warnings: string[] = []

    if (totalLength > spec.maxChannel) {
      warnings.push(`Total channel length exceeds ${spec.maxChannel}m maximum`)
    }
    if (length > spec.permanent) {
      warnings.push(`Permanent link exceeds ${spec.permanent}m maximum`)
    }
    if (patchLength > 10) {
      warnings.push("Total patch cord length should not exceed 10m per TIA standards")
    }
    if (copperType === "cat6" && totalLength > 55) {
      warnings.push("10GBASE-T limited to 55m on Cat6 due to alien crosstalk")
    }

    return {
      withinSpec,
      maxDistance: spec.maxChannel,
      supports10G,
      max10GDistance: spec.max10G,
      warnings,
    }
  }, [copperType, copperLength, patchCordLength])

  // Generate contextual tips based on configuration
  const fiberTips = useMemo((): string[] => {
    const tips: string[] = []
    const lengthKm = getLengthInKm(fiberLength, lengthUnit)

    // Fiber type tips
    if (fiberType.startsWith("os2")) {
      tips.push("OS2 fiber is ideal for long-distance runs and high-bandwidth applications")
    } else if (fiberType.startsWith("os1")) {
      tips.push("Consider OS2 for better attenuation (0.4 vs 1.0 dB/km) on longer runs")
    } else if (fiberType === "om1" || fiberType === "om2") {
      tips.push("OM1/OM2 are legacy grades - OM3+ recommended for 10G+ applications")
    } else if (fiberType === "om4" || fiberType === "om5") {
      tips.push("OM4/OM5 support 100G at short distances with MPO/MTP connectors")
    }

    // Distance tips
    if (lengthKm > 0.5 && fiberType.startsWith("om")) {
      tips.push("Multi-mode typically used for <500m; single-mode for campus/WAN")
    }
    if (lengthKm > 2 && fiberType.startsWith("os")) {
      tips.push("For runs >2km, consider OTDR testing and fusion splicing")
    }

    // Connector tips
    const connectors = parseInt(connectorPairs) || 0
    if (connectors >= 4) {
      tips.push("Each connector adds loss - consolidate patch panels where possible")
    }
    if (connectors === 0) {
      tips.push("Typical links have 2+ connector pairs (TX and RX at each end)")
    }

    // Splice tips
    const splices = parseInt(spliceCount) || 0
    if (splices > 0 && spliceType === "mechanical") {
      tips.push("Fusion splicing has 5x lower loss than mechanical (0.1 vs 0.5 dB)")
    }

    // Power budget tips
    const budget = parseFloat(powerBudget) || 10
    if (budget < 7) {
      tips.push("Low power budget - verify transceiver specs support your link loss")
    }
    if (budget > 15) {
      tips.push("High power budget suggests long-reach optics or amplified link")
    }

    return tips.slice(0, 3) // Limit to 3 tips
  }, [fiberType, fiberLength, lengthUnit, connectorPairs, spliceCount, spliceType, powerBudget])

  const copperTips = useMemo((): string[] => {
    const tips: string[] = []
    const length = parseFloat(copperLength) || 0
    const patchLength = parseFloat(patchCordLength) || 0
    const totalLength = length + patchLength

    // Category tips
    if (copperType === "cat5e") {
      tips.push("Cat5e limited to 1 Gbps - upgrade to Cat6a for 10G support")
    } else if (copperType === "cat6") {
      tips.push("Cat6 supports 10G only to 55m due to alien crosstalk limitations")
    } else if (copperType === "cat6a") {
      tips.push("Cat6a fully supports 10GBASE-T to 100m with proper installation")
    } else if (copperType === "cat7") {
      tips.push("Cat7 requires GG45 or TERA connectors for full shielding benefits")
    } else if (copperType === "cat8") {
      tips.push("Cat8 designed for data centers - 30m max supports 25G/40G speeds")
    }

    // Distance tips
    if (length > 80 && length <= 90) {
      tips.push("Near max permanent link - leave margin for future moves/adds")
    }
    if (totalLength > 90 && totalLength <= 100) {
      tips.push("Near channel limit - consider shorter patch cords")
    }

    // Patch cord tips
    if (patchLength < 3) {
      tips.push("Very short patch cords may cause bend radius issues at patch panels")
    }
    if (patchLength > 7) {
      tips.push("Long patch cords reduce permanent link allowance")
    }

    // General tips
    if (copperType !== "cat8" && length <= 50) {
      tips.push("Short runs are ideal for PoE applications (less voltage drop)")
    }

    return tips.slice(0, 3) // Limit to 3 tips
  }, [copperType, copperLength, patchCordLength])

  // Load from project handler with validation
  const handleLoadFromProject = (data: Record<string, unknown>, _item: ProjectItem) => {
    const savedType = data.type as string

    if (savedType === "fiber") {
      setActiveTab("fiber")
      // Validate fiberType exists in FIBER_SPECS
      const loadedFiberType = data.fiberType as string
      if (loadedFiberType && loadedFiberType in FIBER_SPECS) {
        setFiberType(loadedFiberType as FiberType)
      }
      // Validate and sanitize numeric values
      if (data.fiberLength !== undefined) {
        const val = parseFloat(String(data.fiberLength))
        setFiberLength(isNaN(val) || val < 0 ? "0" : String(val))
      }
      // Validate lengthUnit
      const loadedUnit = data.lengthUnit as string
      if (loadedUnit && ["m", "ft", "km"].includes(loadedUnit)) {
        setLengthUnit(loadedUnit as "m" | "ft" | "km")
      }
      if (data.connectorPairs !== undefined) {
        const val = parseInt(String(data.connectorPairs))
        setConnectorPairs(isNaN(val) || val < 0 ? "0" : String(Math.min(val, 20)))
      }
      if (data.spliceCount !== undefined) {
        const val = parseInt(String(data.spliceCount))
        setSpliceCount(isNaN(val) || val < 0 ? "0" : String(Math.min(val, 50)))
      }
      // Validate spliceType
      const loadedSpliceType = data.spliceType as string
      if (loadedSpliceType && loadedSpliceType in SPLICE_LOSS) {
        setSpliceType(loadedSpliceType as SpliceType)
      }
      if (data.powerBudget !== undefined) {
        const val = parseFloat(String(data.powerBudget))
        setPowerBudget(isNaN(val) || val < 1 ? "10" : String(Math.min(val, 50)))
      }
    } else if (savedType === "copper") {
      setActiveTab("copper")
      // Validate copperType exists in COPPER_SPECS
      const loadedCopperType = data.copperType as string
      if (loadedCopperType && loadedCopperType in COPPER_SPECS) {
        setCopperType(loadedCopperType as CopperType)
      }
      if (data.copperLength !== undefined) {
        const val = parseFloat(String(data.copperLength))
        setCopperLength(isNaN(val) || val < 0 ? "0" : String(Math.min(val, 150)))
      }
      if (data.patchCordLength !== undefined) {
        const val = parseFloat(String(data.patchCordLength))
        setPatchCordLength(isNaN(val) || val < 0 ? "0" : String(Math.min(val, 20)))
      }
    }
  }

  const exportResults = () => {
    const data =
      activeTab === "fiber"
        ? {
            type: "fiber",
            config: {
              fiberType,
              fiberLength,
              lengthUnit,
              connectorPairs,
              spliceCount,
              spliceType,
              powerBudget,
            },
            result: fiberResult,
          }
        : {
            type: "copper",
            config: { copperType, copperLength, patchCordLength },
            result: copperResult,
          }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `cable-calculation-${activeTab}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getSaveData = () => ({
    type: activeTab,
    ...(activeTab === "fiber"
      ? {
          fiberType,
          fiberLength,
          lengthUnit,
          connectorPairs,
          spliceCount,
          spliceType,
          powerBudget,
          result: fiberResult,
        }
      : { copperType, copperLength, patchCordLength, result: copperResult }),
  })

  const getSaveName = () => {
    if (activeTab === "fiber") {
      return `${FIBER_SPECS[fiberType].name} - ${fiberLength}${lengthUnit}`
    }
    return `${COPPER_SPECS[copperType].name} - ${copperLength}m`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground mb-2 text-3xl font-bold">
          Cable Length & Signal Loss Calculator
        </h1>
        <p className="text-muted-foreground">
          Calculate signal attenuation for fiber optic and copper network cables per TIA/IEEE
          standards.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="fiber">Fiber Optic</TabsTrigger>
          <TabsTrigger value="copper">Copper Ethernet</TabsTrigger>
        </TabsList>

        <TabsContent value="fiber" className="mt-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Fiber Configuration</CardTitle>
                <CardDescription>TIA-568.3-D compliant loss calculations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="fiber-type">Fiber Type</Label>
                  <Select value={fiberType} onValueChange={(v) => setFiberType(v as FiberType)}>
                    <SelectTrigger id="fiber-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="os2-1310">OS2 Single-mode @ 1310nm (0.4 dB/km)</SelectItem>
                      <SelectItem value="os2-1550">OS2 Single-mode @ 1550nm (0.4 dB/km)</SelectItem>
                      <SelectItem value="os1-1310">OS1 Single-mode @ 1310nm (1.0 dB/km)</SelectItem>
                      <SelectItem value="os1-1550">OS1 Single-mode @ 1550nm (1.0 dB/km)</SelectItem>
                      <SelectItem value="om5">OM5 Multi-mode (3.0 dB/km)</SelectItem>
                      <SelectItem value="om4">OM4 Multi-mode (3.0 dB/km)</SelectItem>
                      <SelectItem value="om3">OM3 Multi-mode (3.0 dB/km)</SelectItem>
                      <SelectItem value="om2">OM2 Multi-mode (3.5 dB/km)</SelectItem>
                      <SelectItem value="om1">OM1 Multi-mode (3.5 dB/km)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fiber-length">Cable Length</Label>
                    <Input
                      id="fiber-length"
                      type="number"
                      min="0"
                      step="0.1"
                      value={fiberLength}
                      onChange={(e) => setFiberLength(e.target.value)}
                      placeholder="500"
                    />
                  </div>
                  <div>
                    <Label htmlFor="length-unit">Unit</Label>
                    <Select
                      value={lengthUnit}
                      onValueChange={(v) => setLengthUnit(v as "m" | "ft" | "km")}
                    >
                      <SelectTrigger id="length-unit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="m">Meters</SelectItem>
                        <SelectItem value="ft">Feet</SelectItem>
                        <SelectItem value="km">Kilometers</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="connectors">Connector Pairs</Label>
                    <Input
                      id="connectors"
                      type="number"
                      min="0"
                      max="20"
                      value={connectorPairs}
                      onChange={(e) => setConnectorPairs(e.target.value)}
                      placeholder="2"
                    />
                    <p className="text-muted-foreground mt-1 text-xs">
                      Mated connector pairs (0.75 dB each)
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="splices">Splice Count</Label>
                    <Input
                      id="splices"
                      type="number"
                      min="0"
                      max="50"
                      value={spliceCount}
                      onChange={(e) => setSpliceCount(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="splice-type">Splice Type</Label>
                    <Select
                      value={spliceType}
                      onValueChange={(v) => setSpliceType(v as SpliceType)}
                    >
                      <SelectTrigger id="splice-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fusion">Fusion (0.1 dB)</SelectItem>
                        <SelectItem value="mechanical">Mechanical (0.5 dB)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="power-budget">Power Budget (dB)</Label>
                    <Input
                      id="power-budget"
                      type="number"
                      min="1"
                      max="50"
                      step="0.5"
                      value={powerBudget}
                      onChange={(e) => setPowerBudget(e.target.value)}
                      placeholder="10"
                    />
                  </div>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Standards Reference</AlertTitle>
                  <AlertDescription className="text-xs">
                    Values per TIA-568.3-D. Typical SFP modules: 1G = 5-7 dB budget, 10G = 6-10 dB
                    budget.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {fiberResult && (
                <>
                  <ResultCard
                    title="Loss Analysis"
                    badges={[
                      {
                        label: fiberResult.withinBudget ? "Within Budget" : "Over Budget",
                        variant: fiberResult.withinBudget ? "default" : "destructive",
                      },
                    ]}
                    data={[
                      { label: "Cable Attenuation", value: `${fiberResult.cableLoss} dB` },
                      { label: "Connector Loss", value: `${fiberResult.connectorLoss} dB` },
                      { label: "Splice Loss", value: `${fiberResult.spliceLoss} dB` },
                      {
                        label: "Total Loss",
                        value: `${fiberResult.totalLoss} dB`,
                        highlight: true,
                      },
                      { label: "Power Budget", value: `${fiberResult.powerBudget} dB` },
                      {
                        label: "Link Margin",
                        value: `${fiberResult.margin} dB`,
                        highlight: fiberResult.margin >= 3,
                      },
                    ]}
                  />

                  {fiberResult.warnings.length > 0 && (
                    <Card className="border-yellow-500/50">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-sm font-medium">Warnings</span>
                        </div>
                        <ul className="mt-2 space-y-1 text-xs">
                          {fiberResult.warnings.map((warning, i) => (
                            <li key={i} className="text-muted-foreground">
                              • {warning}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {fiberTips.length > 0 && (
                <Card className="border-blue-500/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                      <Lightbulb className="h-4 w-4" />
                      <span className="text-sm font-medium">Tips</span>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs">
                      {fiberTips.map((tip, i) => (
                        <li key={i} className="text-muted-foreground">
                          • {tip}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-2">
                <LoadFromProject
                  itemType="cable"
                  onLoad={handleLoadFromProject}
                  className="flex-1"
                />
                <Button onClick={exportResults} variant="outline" className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
                <SaveToProject
                  itemType="cable"
                  itemName={getSaveName()}
                  itemData={getSaveData()}
                  toolSource="cable-calculator"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="copper" className="mt-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Copper Configuration</CardTitle>
                <CardDescription>TIA-568-D structured cabling limits</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="copper-type">Cable Category</Label>
                  <Select value={copperType} onValueChange={(v) => setCopperType(v as CopperType)}>
                    <SelectTrigger id="copper-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cat8">Cat8 (25/40 Gbps, 30m max)</SelectItem>
                      <SelectItem value="cat7">Cat7 (10 Gbps, 100m)</SelectItem>
                      <SelectItem value="cat6a">Cat6a (10 Gbps, 100m)</SelectItem>
                      <SelectItem value="cat6">Cat6 (10 Gbps @ 55m, 1G @ 100m)</SelectItem>
                      <SelectItem value="cat5e">Cat5e (1 Gbps, 100m)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="copper-length">Permanent Link Length (m)</Label>
                  <Input
                    id="copper-length"
                    type="number"
                    min="0"
                    max="150"
                    value={copperLength}
                    onChange={(e) => setCopperLength(e.target.value)}
                    placeholder="90"
                  />
                  <p className="text-muted-foreground mt-1 text-xs">
                    Horizontal cable from patch panel to outlet
                  </p>
                </div>

                <div>
                  <Label htmlFor="patch-length">Total Patch Cord Length (m)</Label>
                  <Input
                    id="patch-length"
                    type="number"
                    min="0"
                    max="20"
                    value={patchCordLength}
                    onChange={(e) => setPatchCordLength(e.target.value)}
                    placeholder="10"
                  />
                  <p className="text-muted-foreground mt-1 text-xs">
                    Equipment + work area cords (max 10m combined)
                  </p>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>TIA-568-D Channel Model</AlertTitle>
                  <AlertDescription className="text-xs">
                    Channel = Permanent Link + Patch Cords. Permanent link max 90m, total channel
                    max 100m (except Cat8).
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {copperResult && (
                <>
                  <ResultCard
                    title="Distance Analysis"
                    badges={[
                      {
                        label: copperResult.withinSpec ? "Compliant" : "Non-Compliant",
                        variant: copperResult.withinSpec ? "default" : "destructive",
                      },
                      ...(copperResult.supports10G
                        ? [{ label: "10G Capable", variant: "secondary" as const }]
                        : []),
                    ]}
                    data={[
                      { label: "Permanent Link", value: `${copperLength} m` },
                      { label: "Patch Cords", value: `${patchCordLength} m` },
                      {
                        label: "Total Channel",
                        value: `${(parseFloat(copperLength) || 0) + (parseFloat(patchCordLength) || 0)} m`,
                        highlight: true,
                      },
                      { label: "Max Channel Distance", value: `${copperResult.maxDistance} m` },
                      { label: "Max Speed", value: COPPER_SPECS[copperType].maxSpeed },
                      ...(copperResult.max10GDistance > 0
                        ? [
                            {
                              label: "10GBASE-T Max Distance",
                              value: `${copperResult.max10GDistance} m`,
                            },
                          ]
                        : []),
                    ]}
                  />

                  {copperResult.warnings.length > 0 && (
                    <Card className="border-yellow-500/50">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-sm font-medium">Warnings</span>
                        </div>
                        <ul className="mt-2 space-y-1 text-xs">
                          {copperResult.warnings.map((warning, i) => (
                            <li key={i} className="text-muted-foreground">
                              • {warning}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {copperResult.withinSpec && copperResult.warnings.length === 0 && (
                    <div className="flex items-center gap-2 rounded-md border border-green-500/50 bg-green-500/10 px-3 py-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
                      <span className="text-sm text-green-700 dark:text-green-400">
                        TIA-568-D compliant for {COPPER_SPECS[copperType].name}
                      </span>
                    </div>
                  )}
                </>
              )}

              {copperTips.length > 0 && (
                <Card className="border-blue-500/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                      <Lightbulb className="h-4 w-4" />
                      <span className="text-sm font-medium">Tips</span>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs">
                      {copperTips.map((tip, i) => (
                        <li key={i} className="text-muted-foreground">
                          • {tip}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-2">
                <LoadFromProject
                  itemType="cable"
                  onLoad={handleLoadFromProject}
                  className="flex-1"
                />
                <Button onClick={exportResults} variant="outline" className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
                <SaveToProject
                  itemType="cable"
                  itemName={getSaveName()}
                  itemData={getSaveData()}
                  toolSource="cable-calculator"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
