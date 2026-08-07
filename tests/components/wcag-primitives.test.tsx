import * as React from "react"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { IPInput } from "@/components/ui/ip-input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Slider } from "@/components/ui/slider"

// the static suites assert the class strings in components/ui; these assert the behaviour

afterEach(cleanup)

describe("2.1.1 keyboard / 4.1.2 name, role, value", () => {
  // eight tool call sites put onClick on a Badge; as a span it had no role, tab stop or key handling
  it("a Badge with a click handler is a real button", async () => {
    const onClick = vi.fn()
    render(<Badge onClick={onClick}>/24</Badge>)

    const badge = screen.getByRole("button", { name: "/24" })
    expect(badge.tagName).toBe("BUTTON")
    expect(badge).toHaveProperty("type", "button")

    // reachable, and operable by both keys a button responds to
    await userEvent.tab()
    expect(document.activeElement).toBe(badge)
    await userEvent.keyboard("{Enter}")
    await userEvent.keyboard(" ")
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it("a Badge without a click handler stays a plain span", () => {
    const { container } = render(<Badge>IPv4</Badge>)
    const badge = container.querySelector("[data-slot=badge]")
    expect(badge?.tagName).toBe("SPAN")
    expect(screen.queryByRole("button")).toBeNull()
  })

  // 2.5.8: a clickable badge is a pointer target, a decorative one is not
  it("2.5.8: a clickable Badge carries the 24px minimum height", () => {
    render(<Badge onClick={() => {}}>100</Badge>)
    expect(screen.getByRole("button").className).toContain("min-h-6")
  })
})

describe("2.1.1 keyboard: scrollable regions", () => {
  // a scroll container that cannot take focus strands everything past the fold
  it("a ScrollArea viewport is focusable", async () => {
    const { container } = render(
      <ScrollArea className="h-8">
        <p>a long passage of reference material with no interactive content in it</p>
      </ScrollArea>
    )
    const viewport = container.querySelector("[data-slot=scroll-area-viewport]")
    expect(viewport).not.toBeNull()
    expect(viewport?.getAttribute("tabindex")).toBe("0")

    await userEvent.tab()
    expect(document.activeElement).toBe(viewport)
  })
})

describe("2.5.8 target size (minimum)", () => {
  // both paint under 24px by design; the target is grown with a pseudo-element, the design untouched
  it("a Checkbox grows its hit area to 24px without resizing its box", () => {
    render(<Checkbox aria-label="Include symbols" />)
    const box = screen.getByRole("checkbox").className
    expect(box).toContain("size-4") // still painted at 16px
    expect(box).toContain("relative")
    expect(box).toContain("before:absolute")
    expect(box).toContain("before:-inset-1") // 16 + 4 + 4 = 24
  })

  it("a Slider root is at least 24px tall, since radix makes it the target", () => {
    const { container } = render(<Slider aria-label="Password length" defaultValue={[16]} />)
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toContain("min-h-6")
    // and the thumb's own grab area is grown from 20px to 24px
    expect(screen.getByRole("slider").className).toContain("before:-inset-0.5")
  })

  it("the slider label lands on the thumb, which is the element with the role", () => {
    render(<Slider aria-label="Password length" defaultValue={[16]} />)
    // regression guard: naming the root instead leaves an unnamed slider
    expect(screen.getByRole("slider", { name: "Password length" })).toBeTruthy()
  })
})

describe("2.1.2 no keyboard trap / 2.4.3 focus order", () => {
  it("Escape closes a dialog and focus returns to the trigger", async () => {
    render(
      <Dialog>
        <DialogTrigger>Open settings</DialogTrigger>
        <DialogContent>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Adjust your preferences.</DialogDescription>
        </DialogContent>
      </Dialog>
    )

    const trigger = screen.getByRole("button", { name: "Open settings" })
    await userEvent.click(trigger)
    expect(await screen.findByRole("dialog")).toBeTruthy()

    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    // forwardRef on Button exists for this; without it focus is stranded on the body
    expect(document.activeElement).toBe(trigger)
  })

  it("the dialog close button is reachable and named", async () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Share project</DialogTitle>
          <DialogDescription>Invite a collaborator.</DialogDescription>
        </DialogContent>
      </Dialog>
    )
    const close = await screen.findByRole("button", { name: "Close" })
    // 2.5.8: a 16px glyph padded out to a 24px target
    expect(close.className).toContain("p-1")
  })
})

// IPInput is controlled, so a no-op onChange would swallow every keystroke
function ControlledIPInput() {
  const [value, setValue] = React.useState("")
  return <IPInput label="Network address" value={value} onChange={setValue} />
}

describe("4.1.3 status messages / 3.3.1 error identification", () => {
  it("an invalid address is announced politely and tied to the field", async () => {
    render(<ControlledIPInput />)
    const field = screen.getByLabelText("Network address")

    await userEvent.type(field, "999.1.1.1")

    const message = await screen.findByRole("status")
    expect(message.textContent).toContain("Invalid")
    // 3.3.1 wants the message reachable from the field, not just visible near it
    expect(field.getAttribute("aria-invalid")).toBe("true")
    expect(field.getAttribute("aria-describedby")).toBe(message.id)
    // and polite rather than assertive, because this fires on every keystroke
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("a valid address leaves no error state behind", async () => {
    const { rerender } = render(<IPInput label="Network address" value="" onChange={() => {}} />)
    rerender(<IPInput label="Network address" value="10.0.0.1" onChange={() => {}} />)

    const field = screen.getByLabelText("Network address")
    await waitFor(() => expect(field.getAttribute("aria-invalid")).toBe("false"))
    expect(screen.queryByRole("status")).toBeNull()
  })
})
