// a control that deletes its own row unmounts itself, and the browser then
// drops focus to <body>. deleting several rows is the normal task in these
// editors, so a keyboard user was thrown to the top of the document every time.
//
// call this in the handler before the state change, while the button is still
// mounted. the anchor survives the re-render, so focus stays inside the tool.
export function anchorFocus(target: EventTarget | null): void {
  if (!(target instanceof Element)) return
  const anchor = target.closest<HTMLElement>("[data-focus-anchor]")
  anchor?.focus()
}
