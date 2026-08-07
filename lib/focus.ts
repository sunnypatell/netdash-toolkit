// a control that deletes its own row unmounts itself and focus falls to <body>. call this in
// the handler before the state change, while the button is still mounted.
export function anchorFocus(target: EventTarget | null): void {
  if (!(target instanceof Element)) return
  const anchor = target.closest<HTMLElement>("[data-focus-anchor]")
  anchor?.focus()
}
