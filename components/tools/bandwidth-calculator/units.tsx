"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  IEC_SIZE_UNITS,
  SI_SIZE_UNITS,
  SPEED_LABELS,
  SPEED_UNITS,
  type SizeUnit,
  type SpeedUnit,
} from "@/lib/bandwidth"

export function SizeUnitSelect({
  id,
  value,
  onChange,
}: {
  id: string
  value: SizeUnit
  onChange: (unit: SizeUnit) => void
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as SizeUnit)}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SI_SIZE_UNITS.map((unit) => (
          <SelectItem key={unit} value={unit}>
            {unit} (decimal)
          </SelectItem>
        ))}
        {IEC_SIZE_UNITS.map((unit) => (
          <SelectItem key={unit} value={unit}>
            {unit} (binary)
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function SpeedUnitSelect({
  id,
  value,
  onChange,
  units = SPEED_UNITS,
}: {
  id: string
  value: SpeedUnit
  onChange: (unit: SpeedUnit) => void
  units?: readonly SpeedUnit[]
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as SpeedUnit)}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {units.map((unit) => (
          <SelectItem key={unit} value={unit}>
            {SPEED_LABELS[unit]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
