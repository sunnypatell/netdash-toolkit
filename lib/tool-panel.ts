// a split tool's panel is a tool in its own right: it owns its own inputs and
// renders its own header. the tabbed shell that composes panels passes
// `embedded` so only one header shows.
export interface PanelProps {
  embedded?: boolean
}
