"use client"

import { useMemo } from "react"
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
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
import { AlertTriangle, Cable, Download, Info } from "lucide-react"
import { ResultCard } from "@/components/ui/result-card"
import { ToolHeader } from "@/components/ui/tool-header"
import { SaveToProject } from "@/components/ui/save-to-project"
import { LoadFromProject } from "@/components/ui/load-from-project"
import { dateStamp, downloadTextFile } from "@/lib/download"
import {
  FIBER_GRADES,
  FIBER_SPECS,
  LENGTH_UNITS,
  MAX_CONNECTOR_PAIR_LOSS_DB,
  MAX_SPLICE_LOSS_DB,
  SPLICE_LOSS_DB,
  SPLICE_TYPES,
  computeFiberLink,
  wavelengthsFor,
  type FiberGrade,
  type LengthUnit,
  type SpliceType,
} from "@/lib/cable-specs"
import type { PanelProps } from "@/lib/tool-panel"
import { WarningList } from "./warning-list"

const LENGTH_LABELS: Record<LengthUnit, string> = {
  m: "Metres",
  ft: "Feet",
  km: "Kilometres",
}

// blank counts as 0 in computeFiberLink, so the check has to agree
const isWholeCount = (text: string) => {
  const value = Number(text || "0")
  return Number.isInteger(value) && value >= 0
}

const SPLICE_LABELS: Record<SpliceType, string> = {
  fusion: `Fusion (typical ${SPLICE_LOSS_DB.fusion} dB)`,
  mechanical: `Mechanical (typical ${SPLICE_LOSS_DB.mechanical} dB)`,
}

export function FiberPanel({ embedded }: PanelProps) {
  const [query, setQuery] = useQueryStates(
    {
      grade: parseAsStringLiteral(FIBER_GRADES).withDefault("os2"),
      wavelength: parseAsString.withDefault("1310"),
      length: parseAsString.withDefault("500"),
      lengthUnit: parseAsStringLiteral(LENGTH_UNITS).withDefault("m"),
      connectors: parseAsString.withDefault("2"),
      splices: parseAsString.withDefault("0"),
      spliceType: parseAsStringLiteral(SPLICE_TYPES).withDefault("fusion"),
      budget: parseAsString.withDefault("10"),
    },
    { history: "replace" }
  )

  const { grade, wavelength, length, lengthUnit, connectors, splices, spliceType, budget } = query
  const spec = FIBER_SPECS[grade]
  const wavelengths = useMemo(() => wavelengthsFor(grade), [grade])

  // changing grade changes which wavelengths exist, so fall back to the first
  const wavelengthNm = wavelengths.includes(Number(wavelength))
    ? Number(wavelength)
    : wavelengths[0]

  const { result, error } = useMemo(
    () =>
      computeFiberLink({
        grade,
        wavelengthNm,
        length,
        lengthUnit,
        connectorPairs: connectors,
        spliceCount: splices,
        spliceType,
        powerBudget: budget,
      }),
    [grade, wavelengthNm, length, lengthUnit, connectors, splices, spliceType, budget]
  )

  // computeFiberLink returns one message at a time, so mirror its order to name the field
  const invalidField = useMemo(() => {
    if (!error) return null
    if (spec.attenuation[wavelengthNm] === undefined) return "wavelength"
    if (!(Number(length) > 0)) return "length"
    if (!isWholeCount(connectors)) return "connectors"
    if (!isWholeCount(splices)) return "splices"
    return "budget"
  }, [error, spec, wavelengthNm, length, connectors, splices])

  const selectGrade = (next: FiberGrade) => {
    const allowed = wavelengthsFor(next)
    void setQuery({
      grade: next,
      wavelength: String(allowed.includes(wavelengthNm) ? wavelengthNm : allowed[0]),
    })
  }

  const saveData = {
    type: "fiber",
    fiberType: grade,
    wavelengthNm,
    fiberLength: length,
    lengthUnit,
    connectorPairs: connectors,
    spliceCount: splices,
    spliceType,
    powerBudget: budget,
    result,
  }

  const handleLoadFromProject = (data: Record<string, unknown>) => {
    if (data.type !== "fiber") return
    const loadedGrade = String(data.fiberType ?? "").replace(/-\d+$/, "")
    void setQuery({
      ...(FIBER_GRADES.includes(loadedGrade as FiberGrade)
        ? { grade: loadedGrade as FiberGrade }
        : {}),
      ...(data.fiberLength !== undefined ? { length: String(data.fiberLength) } : {}),
      ...(LENGTH_UNITS.includes(data.lengthUnit as LengthUnit)
        ? { lengthUnit: data.lengthUnit as LengthUnit }
        : {}),
      ...(data.connectorPairs !== undefined ? { connectors: String(data.connectorPairs) } : {}),
      ...(data.spliceCount !== undefined ? { splices: String(data.spliceCount) } : {}),
      ...(SPLICE_TYPES.includes(data.spliceType as SpliceType)
        ? { spliceType: data.spliceType as SpliceType }
        : {}),
      ...(data.powerBudget !== undefined ? { budget: String(data.powerBudget) } : {}),
    })
  }

  const exportResults = () => {
    downloadTextFile(
      JSON.stringify(saveData, null, 2),
      `cable-calculation-fiber-${dateStamp()}.json`,
      "application/json"
    )
  }

  const actions = (
    <>
      <LoadFromProject itemType="cable" onLoad={handleLoadFromProject} size="sm" />
      <Button onClick={exportResults} variant="outline" size="sm" disabled={!result}>
        <Download className="mr-2 h-4 w-4" />
        Export
      </Button>
      {result && (
        <SaveToProject
          itemType="cable"
          itemName={`${spec.name} ${wavelengthNm} nm, ${length}${lengthUnit}`}
          itemData={saveData}
          toolSource="Cable Calculator"
          size="sm"
        />
      )}
    </>
  )

  return (
    <div className={embedded ? "space-y-4" : "tool-container"}>
      {embedded ? (
        <div className="flex flex-wrap justify-end gap-2">{actions}</div>
      ) : (
        <ToolHeader
          icon={Cable}
          title="Fiber Loss Budget"
          description="Attenuation, connector and splice loss against a transceiver power budget"
          actions={actions}
        />
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription id="fiber-error">{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Fiber Configuration</CardTitle>
            <CardDescription>{spec.attenuationSource}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fiber-grade">Fiber Grade</Label>
                <Select value={grade} onValueChange={(next) => selectGrade(next as FiberGrade)}>
                  <SelectTrigger id="fiber-grade">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIBER_GRADES.map((each) => (
                      <SelectItem key={each} value={each}>
                        {FIBER_SPECS[each].name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground mt-1 text-xs">{spec.core}</p>
              </div>
              <div>
                <Label htmlFor="fiber-wavelength">Wavelength</Label>
                <Select
                  value={String(wavelengthNm)}
                  onValueChange={(next) => void setQuery({ wavelength: next })}
                >
                  <SelectTrigger
                    id="fiber-wavelength"
                    aria-invalid={invalidField === "wavelength"}
                    aria-describedby={invalidField === "wavelength" ? "fiber-error" : undefined}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {wavelengths.map((nm) => (
                      <SelectItem key={nm} value={String(nm)}>
                        {nm} nm ({spec.attenuation[nm]} dB/km)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fiber-length">Cable Length</Label>
                <Input
                  id="fiber-length"
                  type="number"
                  min="0"
                  step="any"
                  value={length}
                  onChange={(event) => void setQuery({ length: event.target.value })}
                  aria-invalid={invalidField === "length"}
                  aria-describedby={invalidField === "length" ? "fiber-error" : undefined}
                />
              </div>
              <div>
                <Label htmlFor="length-unit">Unit</Label>
                <Select
                  value={lengthUnit}
                  onValueChange={(next) => void setQuery({ lengthUnit: next as LengthUnit })}
                >
                  <SelectTrigger id="length-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LENGTH_UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {LENGTH_LABELS[unit]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="connectors">Mated Connector Pairs</Label>
                <Input
                  id="connectors"
                  type="number"
                  min="0"
                  max="20"
                  step="1"
                  value={connectors}
                  onChange={(event) => void setQuery({ connectors: event.target.value })}
                  aria-invalid={invalidField === "connectors"}
                  aria-describedby={invalidField === "connectors" ? "fiber-error" : undefined}
                />
                <p className="text-muted-foreground mt-1 text-xs">
                  {MAX_CONNECTOR_PAIR_LOSS_DB} dB each, the TIA-568.3-D maximum
                </p>
              </div>
              <div>
                <Label htmlFor="splices">Splice Count</Label>
                <Input
                  id="splices"
                  type="number"
                  min="0"
                  max="50"
                  step="1"
                  value={splices}
                  onChange={(event) => void setQuery({ splices: event.target.value })}
                  aria-invalid={invalidField === "splices"}
                  aria-describedby={invalidField === "splices" ? "fiber-error" : undefined}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="splice-type">Splice Type</Label>
                <Select
                  value={spliceType}
                  onValueChange={(next) => void setQuery({ spliceType: next as SpliceType })}
                >
                  <SelectTrigger id="splice-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPLICE_TYPES.map((each) => (
                      <SelectItem key={each} value={each}>
                        {SPLICE_LABELS[each]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="power-budget">Power Budget (dB)</Label>
                <Input
                  id="power-budget"
                  type="number"
                  min="0"
                  max="50"
                  step="0.5"
                  value={budget}
                  onChange={(event) => void setQuery({ budget: event.target.value })}
                  aria-invalid={invalidField === "budget"}
                  aria-describedby={invalidField === "budget" ? "fiber-error" : undefined}
                />
              </div>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Standards Reference</AlertTitle>
              <AlertDescription className="text-xs">
                TIA-568.3-D caps a mated connector pair at {MAX_CONNECTOR_PAIR_LOSS_DB} dB and any
                splice at {MAX_SPLICE_LOSS_DB} dB. Typical transceiver budgets: 1000BASE-LX 7.5 dB,
                10GBASE-SR 2.9 dB, 10GBASE-LR 6.2 dB.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* ResultCard owns the announcement; a wrapper here nests one live region in another */}
        <div className="space-y-4">
          {result ? (
            <>
              <ResultCard
                title="Loss Analysis"
                description={`${spec.name} at ${wavelengthNm} nm, ${result.lossPerKm} dB/km`}
                badges={[
                  {
                    label: result.withinBudget ? "Within Budget" : "Over Budget",
                    variant: result.withinBudget ? "default" : "destructive",
                  },
                ]}
                data={[
                  { label: "Cable Length", value: `${result.lengthKm} km` },
                  { label: "Cable Attenuation", value: `${result.cableLoss} dB` },
                  { label: "Connector Loss", value: `${result.connectorLoss} dB` },
                  { label: "Splice Loss", value: `${result.spliceLoss} dB` },
                  { label: "Total Loss", value: `${result.totalLoss} dB`, highlight: true },
                  { label: "Power Budget", value: `${result.powerBudget} dB` },
                  {
                    label: "Link Margin",
                    value: `${result.margin} dB`,
                    highlight: result.margin >= 3,
                  },
                  {
                    label: "One-Way Propagation Delay",
                    value: `${result.propagationDelayUs} us`,
                    description: "Silica group index 1.4682, about 4.9 us per km",
                  },
                ]}
              />

              <WarningList
                title="IEEE 802.3 Reach"
                items={result.reachWarnings}
                emptyLabel={`Within the specified reach for every ${spec.name} port type listed`}
              />
              <WarningList title="Warnings" items={result.warnings} />
            </>
          ) : (
            <Card>
              <CardContent className="flex h-48 items-center justify-center">
                <p className="text-muted-foreground text-center">
                  Enter a cable length above 0 to see the loss budget
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Specified Reach (IEEE 802.3)</CardTitle>
              <CardDescription>{spec.name}</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                {Object.entries(spec.reach).map(([port, metres]) => (
                  <div key={port} className="flex justify-between gap-2">
                    <dt className="text-muted-foreground font-mono">{port}</dt>
                    <dd>{metres >= 1000 ? `${metres / 1000} km` : `${metres} m`}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default FiberPanel
