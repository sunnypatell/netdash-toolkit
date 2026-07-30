"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CopyButton } from "@/components/ui/copy-button"
import { ipv4Math } from "@/lib/network-math"

interface IPMathPanelProps {
  first: string
  second: string
  onFirstChange: (value: string) => void
  onSecondChange: (value: string) => void
}

export function IPMathPanel({ first, second, onFirstChange, onSecondChange }: IPMathPanelProps) {
  const result = useMemo(() => ipv4Math(first, second), [first, second])

  const rows = result
    ? [
        { label: "Addresses in range (inclusive)", value: result.addressCount.toLocaleString() },
        { label: "Distance", value: result.distance.toLocaleString() },
        { label: "Bitwise AND", value: result.and },
        { label: "Bitwise OR", value: result.or },
        { label: "Bitwise XOR", value: result.xor },
        { label: "Lower address", value: result.lower },
        { label: "Upper address", value: result.upper },
        { label: "Covering supernet", value: result.supernet },
      ]
    : []

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>IPv4 Address Math</CardTitle>
          <CardDescription>Bitwise operations and the smallest block covering both</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="ip1">IP Address 1</Label>
            <Input
              id="ip1"
              value={first}
              onChange={(e) => onFirstChange(e.target.value)}
              placeholder="192.168.1.0"
              className="font-mono"
            />
          </div>
          <div>
            <Label htmlFor="ip2">IP Address 2</Label>
            <Input
              id="ip2"
              value={second}
              onChange={(e) => onSecondChange(e.target.value)}
              placeholder="192.168.1.255"
              className="font-mono"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
        </CardHeader>
        <CardContent>
          {result ? (
            <div className="space-y-2">
              {rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-lg border p-2"
                >
                  <div>
                    <span className="text-muted-foreground text-sm">{row.label}: </span>
                    <span className="font-mono">{row.value}</span>
                  </div>
                  <CopyButton value={row.value} size="sm" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground py-8 text-center">Enter two valid IPv4 addresses</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
