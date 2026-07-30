"use client"

import { TransformPanel, type TransformPanelProps } from "./transform-panel"

export type DecodePanelProps = Omit<TransformPanelProps, "direction">

export function DecodePanel(props: DecodePanelProps) {
  return <TransformPanel direction="decode" {...props} />
}
