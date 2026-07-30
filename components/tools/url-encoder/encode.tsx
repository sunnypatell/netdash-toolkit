"use client"

import { TransformPanel, type TransformPanelProps } from "./transform-panel"

export type EncodePanelProps = Omit<TransformPanelProps, "direction" | "onParseIntoBuilder">

export function EncodePanel(props: EncodePanelProps) {
  return <TransformPanel direction="encode" {...props} />
}
