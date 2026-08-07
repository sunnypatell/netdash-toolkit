import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import axe from "axe-core"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { AuthProvider } from "@/contexts/auth-context"
import { ProjectProvider } from "@/contexts/project-context"
import { AccountSettingsDialog } from "@/components/ui/account-settings-dialog"
import { LoadFromProject } from "@/components/ui/load-from-project"
import { PasteParser } from "@/components/ui/paste-parser"
import { ResultCard } from "@/components/ui/result-card"
import { SaveToProject } from "@/components/ui/save-to-project"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// the tool axe run covers tool components only, so these shared surfaces sat outside every gate

const AXE_OPTIONS: axe.RunOptions = {
  runOnly: {
    type: "tag",
    values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
  },
  // no layout engine, so contrast is asserted from the tokens instead
  rules: { "color-contrast": { enabled: false } },
}

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsTestingAdapter>
      <AuthProvider>
        <ProjectProvider>{children}</ProjectProvider>
      </AuthProvider>
    </NuqsTestingAdapter>
  )
}

async function violationsOf(root: HTMLElement) {
  // radix's focus guards are aria-hidden with tabindex=0, and this app neither owns nor can reach them
  const results = await axe.run(
    { include: [root], exclude: [["[data-radix-focus-guard]"]] } as unknown as HTMLElement,
    AXE_OPTIONS
  )
  return results.violations.map((v) => ({
    id: v.id,
    help: v.help,
    nodes: v.nodes.slice(0, 3).map((n) => n.html.slice(0, 160)),
  }))
}

const SURFACES: Array<[string, () => React.ReactElement]> = [
  ["account settings dialog", () => <AccountSettingsDialog open onOpenChange={() => {}} />],
  ["paste parser", () => <PasteParser onDataParsed={() => {}} />],
  [
    "result card",
    () => (
      <ResultCard
        title="Subnet"
        description="Derived from the address and mask"
        badges={[{ label: "IPv4" }, { label: "/24", variant: "secondary" }]}
        data={[{ label: "Network", value: "10.0.0.0", copyable: true }]}
      />
    ),
  ],
  [
    "save to project",
    () => (
      <SaveToProject
        itemType="subnet"
        itemName="10.0.0.0/24"
        itemData={{ cidr: "10.0.0.0/24" }}
        toolSource="network-calculator"
      />
    ),
  ],
  ["load from project", () => <LoadFromProject itemType="subnet" onLoad={() => {}} />],
  [
    "alert, both variants",
    () => (
      <div>
        <Alert>
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription>Your project was saved.</AlertDescription>
        </Alert>
        <Alert variant="destructive">
          <AlertTitle>Failed</AlertTitle>
          <AlertDescription>That email is already in use.</AlertDescription>
        </Alert>
      </div>
    ),
  ],
]

afterEach(cleanup)

// radix portals to body, so scanning `container` handed axe zero nodes; this floor makes that fail
const MINIMUM_NODES: Record<string, number> = {
  "account settings dialog": 40,
  "paste parser": 5,
  "result card": 10,
  "save to project": 2,
  "load from project": 2,
  "alert, both variants": 8,
}

describe("wcag 2.2 aa: the shared surfaces the tool suite never renders", () => {
  it.each(SURFACES)("%s has no detectable violations", async (name, mount) => {
    const { baseElement } = render(<Providers>{mount()}</Providers>)
    const scanned = baseElement.querySelectorAll("*").length
    expect(scanned, `${name}: axe was handed ${scanned} nodes`).toBeGreaterThanOrEqual(
      MINIMUM_NODES[name]
    )
    const violations = await violationsOf(baseElement)
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([])
  })
})

describe("4.1.2 name, role, value: names that survive a narrow viewport", () => {
  // the tab labels are `hidden sm:inline`, so under 640px only the aria-label remains
  it("every account settings tab is named without relying on a breakpoint", () => {
    render(
      <Providers>
        <AccountSettingsDialog open onOpenChange={() => {}} />
      </Providers>
    )
    const tabs = screen.getAllByRole("tab")
    expect(tabs.length).toBe(3)
    for (const tab of tabs) {
      const label = tab.getAttribute("aria-label")
      expect(
        label,
        `a tab labelled only by "hidden sm:inline" text is unnamed under 640px: ${tab.outerHTML.slice(0, 120)}`
      ).toBeTruthy()
    }
  })
})

describe("2.4.7 focus visible: the tab panel is a real tab stop", () => {
  it("a TabsContent draws a focus indicator rather than only clearing the outline", async () => {
    const { container } = render(
      <Tabs defaultValue="one">
        <TabsList>
          <TabsTrigger value="one">One</TabsTrigger>
        </TabsList>
        <TabsContent value="one">
          <p>static text with no focusable child</p>
        </TabsContent>
      </Tabs>
    )
    const panel = container.querySelector('[data-slot="tabs-content"]') as HTMLElement
    expect(panel.getAttribute("tabindex")).toBe("0")
    expect(panel.className).toMatch(/focus-visible:ring/)
  })
})

describe("2.1.1 / 4.1.2: a named scroll region names the element that takes focus", () => {
  it("ScrollArea puts its name on the viewport, not on the root", async () => {
    const { container } = render(
      <ScrollArea aria-label="People with access" className="h-8">
        <p>a long list of collaborators</p>
      </ScrollArea>
    )
    const root = container.querySelector('[data-slot="scroll-area"]')
    const viewport = container.querySelector('[data-slot="scroll-area-viewport"]')
    expect(
      root?.getAttribute("aria-label"),
      "the root is not focusable and cannot be reached"
    ).toBe(null)
    expect(viewport?.getAttribute("aria-label")).toBe("People with access")
    // a name needs a role that permits one; generic prohibits it
    expect(viewport?.getAttribute("role")).toBe("group")

    await userEvent.tab()
    expect(document.activeElement).toBe(viewport)
  })

  it("an unnamed ScrollArea takes no role, so it is not announced as an empty group", () => {
    const { container } = render(
      <ScrollArea className="h-8">
        <p>reference material</p>
      </ScrollArea>
    )
    const viewport = container.querySelector('[data-slot="scroll-area-viewport"]')
    expect(viewport?.getAttribute("role")).toBe(null)
  })
})

describe("3.3.1 / 4.1.3: the shared dialogs identify their own errors", () => {
  it("a mismatched password is tied to the field and announced", async () => {
    const user = userEvent.setup()
    render(
      <Providers>
        <AccountSettingsDialog open onOpenChange={() => {}} />
      </Providers>
    )

    await user.click(screen.getByRole("tab", { name: /password/i }))
    const next = screen.getByLabelText(/^new password$/i)
    const confirm = screen.getByLabelText(/confirm new password/i)
    await user.type(next, "correct horse battery")
    await user.type(confirm, "correct horse batteries")

    expect(confirm.getAttribute("aria-invalid")).toBe("true")
    const id = confirm.getAttribute("aria-describedby")
    expect(id, "the rejected field points at no description").toBeTruthy()

    const message = document.getElementById(id!)
    expect(message, `aria-describedby names "${id}" but nothing renders it`).not.toBeNull()
    expect(message?.textContent).toMatch(/do not match/i)
    // and it has to be in something that announces, or it is only visible
    expect(message?.closest('[role="status"], [role="alert"], [aria-live]')).not.toBeNull()
  })

  // the destructive variant already announced; the default carried no role, so success was silent
  it("a non-destructive Alert is a polite live region", () => {
    const { container } = render(
      <Alert>
        <AlertTitle>Saved</AlertTitle>
      </Alert>
    )
    expect(container.querySelector("[data-slot=alert]")?.getAttribute("role")).toBe("status")
  })

  it("a destructive Alert still interrupts, because it reports a failure", () => {
    const { container } = render(
      <Alert variant="destructive">
        <AlertTitle>Failed</AlertTitle>
      </Alert>
    )
    expect(container.querySelector("[data-slot=alert]")?.getAttribute("role")).toBe("alert")
  })

  it("the paste parser says why an input was rejected instead of doing nothing", async () => {
    const user = userEvent.setup()
    render(
      <Providers>
        <PasteParser onDataParsed={() => {}} />
      </Providers>
    )
    await user.type(screen.getByLabelText(/network data to parse/i), "this is not network data")
    await user.click(screen.getByRole("button", { name: /parse data/i }))

    const message = await screen.findByRole("alert")
    expect(message.textContent).toMatch(/could not be parsed|nothing recognisable/i)
  })
})
