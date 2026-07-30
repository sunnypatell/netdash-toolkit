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
  COPPER_CATEGORIES,
  COPPER_SPECS,
  MAX_CHANNEL_DELAY_NS,
  MAX_PATCH_CORD_TOTAL_M,
  MAX_PERMANENT_LINK_DELAY_NS,
  computeCopperLink,
  type CopperCategory,
} from "@/lib/cable-specs"
import type { PanelProps } from "@/lib/tool-panel"
import { WarningList } from "./warning-list"

export function CopperPanel({ embedded }: PanelProps) {
  const [query, setQuery] = useQueryStates(
    {
      category: parseAsStringLiteral(COPPER_CATEGORIES).withDefault("cat6a"),
      permanentLink: parseAsString.withDefault("90"),
      patchCord: parseAsString.withDefault("10"),
      nvp: parseAsString.withDefault("0.65"),
    },
    { history: "replace" }
  )

  const { category, permanentLink, patchCord, nvp } = query
  const spec = COPPER_SPECS[category]

  const { result, error } = useMemo(
    () => computeCopperLink({ category, permanentLink, patchCord, nvp }),
    [category, permanentLink, patchCord, nvp]
  )

  const saveData = {
    type: "copper",
    copperType: category,
    copperLength: permanentLink,
    patchCordLength: patchCord,
    nvp,
    result,
  }

  const handleLoadFromProject = (data: Record<string, unknown>) => {
    if (data.type !== "copper") return
    void setQuery({
      ...(COPPER_CATEGORIES.includes(data.copperType as CopperCategory)
        ? { category: data.copperType as CopperCategory }
        : {}),
      ...(data.copperLength !== undefined ? { permanentLink: String(data.copperLength) } : {}),
      ...(data.patchCordLength !== undefined ? { patchCord: String(data.patchCordLength) } : {}),
      ...(data.nvp !== undefined ? { nvp: String(data.nvp) } : {}),
    })
  }

  const exportResults = () => {
    downloadTextFile(
      JSON.stringify(saveData, null, 2),
      `cable-calculation-copper-${dateStamp()}.json`,
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
          itemName={`${spec.name} channel, ${result.channelM} m`}
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
          title="Copper Channel Calculator"
          description="Channel length, supported BASE-T rate and propagation delay per category"
          actions={actions}
        />
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Copper Configuration</CardTitle>
            <CardDescription>{spec.source}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="copper-category">Cable Category</Label>
              <Select
                value={category}
                onValueChange={(next) => void setQuery({ category: next as CopperCategory })}
              >
                <SelectTrigger id="copper-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COPPER_CATEGORIES.map((each) => (
                    <SelectItem key={each} value={each}>
                      {COPPER_SPECS[each].name} ({COPPER_SPECS[each].bandwidthMhz} MHz,{" "}
                      {COPPER_SPECS[each].maxChannelM} m channel)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground mt-1 text-xs">
                {spec.class}, up to {spec.fullLengthBaseT} over a full-length channel
              </p>
            </div>

            <div>
              <Label htmlFor="copper-length">Permanent Link Length (m)</Label>
              <Input
                id="copper-length"
                type="number"
                min="0"
                max="150"
                step="any"
                value={permanentLink}
                onChange={(event) => void setQuery({ permanentLink: event.target.value })}
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Horizontal cable from the patch panel to the outlet, {spec.maxPermanentLinkM} m
                maximum
              </p>
            </div>

            <div>
              <Label htmlFor="patch-length">Total Patch Cord Length (m)</Label>
              <Input
                id="patch-length"
                type="number"
                min="0"
                max="20"
                step="any"
                value={patchCord}
                onChange={(event) => void setQuery({ patchCord: event.target.value })}
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Equipment and work area cords combined, {MAX_PATCH_CORD_TOTAL_M} m maximum
              </p>
            </div>

            <div>
              <Label htmlFor="copper-nvp">Nominal Velocity of Propagation</Label>
              <Input
                id="copper-nvp"
                type="number"
                min="0.1"
                max="1"
                step="0.01"
                value={nvp}
                onChange={(event) => void setQuery({ nvp: event.target.value })}
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Fraction of the speed of light in the cable. Typical UTP is 0.64 to 0.70; the
                printed value is on the cable sheath or datasheet.
              </p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>TIA-568.2-D Channel Model</AlertTitle>
              <AlertDescription className="text-xs">
                Channel = permanent link + cords. Propagation delay at 10 MHz must not exceed{" "}
                {MAX_CHANNEL_DELAY_NS} ns for a channel or {MAX_PERMANENT_LINK_DELAY_NS} ns for a
                permanent link, and delay skew must stay under 50 ns and 44 ns respectively.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <div className="space-y-4" aria-live="polite">
          {result ? (
            <>
              <ResultCard
                title="Channel Analysis"
                description={spec.source}
                badges={[
                  {
                    label: result.withinSpec ? "Compliant" : "Non-Compliant",
                    variant: result.withinSpec ? "default" : "destructive",
                  },
                  {
                    label: result.supports10G ? "10GBASE-T Capable" : "No 10GBASE-T",
                    variant: result.supports10G ? "secondary" : "outline",
                  },
                ]}
                data={[
                  { label: "Permanent Link", value: `${result.permanentLinkM} m` },
                  { label: "Patch Cords", value: `${result.patchCordM} m` },
                  { label: "Total Channel", value: `${result.channelM} m`, highlight: true },
                  { label: "Maximum Channel", value: `${spec.maxChannelM} m` },
                  { label: "Full-Length Rate", value: spec.fullLengthBaseT },
                  {
                    label: "10GBASE-T Reach",
                    value: spec.tenGigMaxM > 0 ? `${spec.tenGigMaxM} m` : "Not supported",
                  },
                  {
                    label: "Channel Delay",
                    value: `${result.channelDelayNs} ns`,
                    description: `TIA-568.2-D limit ${MAX_CHANNEL_DELAY_NS} ns at 10 MHz`,
                  },
                  {
                    label: "Permanent Link Delay",
                    value: `${result.permanentLinkDelayNs} ns`,
                    description: `TIA-568.2-D limit ${MAX_PERMANENT_LINK_DELAY_NS} ns at 10 MHz`,
                  },
                ]}
              />

              <WarningList
                title="Warnings"
                items={result.warnings}
                emptyLabel={`Compliant channel for ${spec.name}`}
              />
            </>
          ) : (
            <Card>
              <CardContent className="flex h-48 items-center justify-center">
                <p className="text-muted-foreground text-center">
                  Enter a permanent link length above 0
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Category Notes</CardTitle>
              <CardDescription>{spec.name}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
                {spec.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default CopperPanel
