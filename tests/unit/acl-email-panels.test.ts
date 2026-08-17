// @vitest-environment happy-dom
import { createElement } from "react"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import axe from "axe-core"
import { ACLGenerator } from "@/components/tools/acl-generator"
import { EmailDiagnostics } from "@/components/tools/email-diagnostics"
import { StandardACLPanel } from "@/components/tools/acl-generator/standard"
import { ExtendedACLPanel } from "@/components/tools/acl-generator/extended"
import { MXPanel } from "@/components/tools/email-diagnostics/mx"
import { SPFPanel } from "@/components/tools/email-diagnostics/spf"
import { DKIMPanel } from "@/components/tools/email-diagnostics/dkim"
import { DMARCPanel } from "@/components/tools/email-diagnostics/dmarc"
import { SAMPLE_EXTENDED_RULES, SAMPLE_STANDARD_RULES, generateACL, type ACLType } from "@/lib/acl"
import { DNS_TYPE, analyzeDkim, analyzeDmarc, analyzeMx, analyzeSpf } from "@/lib/email-auth"
import type { DnsAnswer, DnsResponse } from "@/lib/email-auth"

// each panel mounted alone on props: the tool level suites only ever see the default tab

// project persistence needs a provider, which the indexes own; these test the wiring around it
vi.mock("@/components/ui/save-to-project", () => ({
  SaveToProject: () => createElement("button", {}, "Save to Project"),
}))
vi.mock("@/components/ui/load-from-project", () => ({
  LoadFromProject: () => createElement("button", {}, "Load from Project"),
}))

for (const name of ["ResizeObserver", "IntersectionObserver"] as const) {
  if (!(name in window)) {
    // @ts-expect-error assigning a test double onto the global
    window[name] = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn()
}

const AXE_OPTIONS: axe.RunOptions = {
  runOnly: {
    type: "tag",
    values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
  },
  rules: { "color-contrast": { enabled: false } },
}

async function violationsOf(container: HTMLElement) {
  const results = await axe.run(container, AXE_OPTIONS)
  return results.violations.map((violation) => ({
    id: violation.id,
    nodes: violation.nodes.slice(0, 3).map((node) => node.html.slice(0, 160)),
  }))
}

const noop = () => {}

const aclConfig = (aclType: ACLType): string =>
  generateACL({
    aclType,
    aclName: aclType === "standard" ? "10" : "101",
    platform: "cisco-ios",
    standardRules: SAMPLE_STANDARD_RULES,
    extendedRules: SAMPLE_EXTENDED_RULES,
    timestamp: "2026-01-01T00:00:00.000Z",
  })

const standardPanel = (overrides: Record<string, unknown> = {}) =>
  createElement(StandardACLPanel, {
    aclName: "10",
    platform: "cisco-ios",
    rules: SAMPLE_STANDARD_RULES,
    config: aclConfig("standard"),
    onAclNameChange: noop,
    onPlatformChange: noop,
    onRulesChange: noop,
    onExport: noop,
    ...overrides,
  })

const extendedPanel = (overrides: Record<string, unknown> = {}) =>
  createElement(ExtendedACLPanel, {
    aclName: "101",
    platform: "cisco-ios",
    rules: SAMPLE_EXTENDED_RULES,
    config: aclConfig("extended"),
    onAclNameChange: noop,
    onPlatformChange: noop,
    onRulesChange: noop,
    onExport: noop,
    ...overrides,
  })

const answer = (type: number, data: string, name = "example.com"): DnsAnswer => ({
  name,
  type,
  TTL: 300,
  data,
})

const txt = (record: string): DnsResponse => ({
  status: 0,
  answers: [answer(DNS_TYPE.TXT, `"${record}"`)],
})

const mxResult = (...records: string[]) =>
  analyzeMx({ status: 0, answers: records.map((record) => answer(DNS_TYPE.MX, record)) })

const panels = [
  ["acl standard", () => standardPanel()],
  ["acl extended", () => extendedPanel()],
  [
    "email mx",
    () => createElement(MXPanel, { domain: "example.com", result: mxResult("10 a.b.") }),
  ],
  ["email mx (none)", () => createElement(MXPanel, { domain: "example.com", result: mxResult() })],
  ["email spf", () => createElement(SPFPanel, { result: analyzeSpf(txt("v=spf1 mx -all")) })],
  [
    "email spf (missing)",
    () => createElement(SPFPanel, { result: analyzeSpf({ status: 0, answers: [] }) }),
  ],
  [
    "email dkim",
    () =>
      createElement(DKIMPanel, {
        results: [analyzeDkim("selector1", txt("v=DKIM1; k=rsa; p=abc"))!],
      }),
  ],
  ["email dkim (none)", () => createElement(DKIMPanel, { results: [] })],
  [
    "email dmarc",
    () =>
      createElement(DMARCPanel, {
        domain: "example.com",
        result: analyzeDmarc(txt("v=DMARC1; p=reject; rua=mailto:d@example.com")),
      }),
  ],
  [
    "email dmarc (missing)",
    () =>
      createElement(DMARCPanel, {
        domain: "example.com",
        result: analyzeDmarc({ status: 0, answers: [] }),
      }),
  ],
] as const

afterEach(cleanup)

describe("panels render standalone", () => {
  it.each(panels)("%s mounts on its own with no axe violations", async (name, element) => {
    const { container } = render(element())
    expect(container.textContent?.trim().length ?? 0, `${name} rendered nothing`).toBeGreaterThan(0)
    const violations = await violationsOf(container)
    expect(violations, `${name}:\n${JSON.stringify(violations, null, 2)}`).toEqual([])
  })
})

describe("acl panels drive themselves from props", () => {
  it("renders the generated config it was handed", () => {
    render(standardPanel())
    const output = screen.getByLabelText("Generated standard ACL configuration")
    expect(output).toHaveProperty("value")
    expect((output as HTMLTextAreaElement).value).toContain(
      "access-list 10 permit 192.168.1.0 0.0.0.255"
    )
  })

  it("flags an acl number that belongs to the other type, with no parent involved", () => {
    render(standardPanel({ aclName: "101" }))
    expect(screen.getByText(/101 is an extended ACL number/)).toBeTruthy()
  })

  it("reports a rule level error only after validate is pressed", () => {
    render(
      extendedPanel({
        rules: [
          {
            id: "1",
            action: "permit",
            protocol: "tcp",
            sourceNetwork: "any",
            destNetwork: "any",
            destPortOperator: "range",
            description: "broken range",
          },
        ],
      })
    )
    expect(screen.queryByText(/Invalid destination port range/)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /Validate Rules/ }))
    expect(screen.getByText(/Invalid destination port range/)).toBeTruthy()
    expect(screen.getByLabelText("Rule 1 has errors")).toBeTruthy()
  })

  it("adds rows with collision-free ids, not Date.now", () => {
    const onRulesChange = vi.fn()
    render(extendedPanel({ onRulesChange }))
    fireEvent.click(screen.getByRole("button", { name: /Add Rule/ }))
    const added = onRulesChange.mock.calls[0][0]
    expect(added).toHaveLength(SAMPLE_EXTENDED_RULES.length + 1)
    expect(added[added.length - 1].id).toMatch(/^acl-\d+$/)
  })

  it("hands sample rules back to the parent instead of holding its own copy", () => {
    const onRulesChange = vi.fn()
    render(standardPanel({ rules: [], onRulesChange }))
    fireEvent.click(screen.getByRole("button", { name: /Load Sample Rules/ }))
    expect(onRulesChange).toHaveBeenCalledWith(SAMPLE_STANDARD_RULES)
  })

  it("keeps every rule control labelled per row", () => {
    render(extendedPanel())
    expect(screen.getByLabelText("Destination port operator for rule 1")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Delete rule 1" })).toBeTruthy()
    // one label per row, so ids cannot collide between rules
    const sources = screen.getAllByLabelText("Source Network")
    expect(sources.map((input) => input.id)).toEqual(
      SAMPLE_EXTENDED_RULES.map((rule) => `acl-ext-source-${rule.id}`)
    )
  })
})

describe("email panels state what they actually found", () => {
  it("orders mx records by preference and explains the ordering", () => {
    const { container } = render(
      createElement(MXPanel, {
        domain: "example.com",
        result: mxResult("20 alt.example.com.", "10 mail.example.com."),
      })
    )
    const html = container.innerHTML
    expect(html.indexOf(">mail.example.com<")).toBeLessThan(html.indexOf(">alt.example.com<"))
    expect(screen.getByText(/Lower preference values are tried first/)).toBeTruthy()
  })

  it("says a null mx domain accepts no mail rather than listing a blank server", () => {
    render(createElement(MXPanel, { domain: "example.com", result: mxResult("0 .") }))
    expect(screen.getByText(/null MX/)).toBeTruthy()
  })

  it("shows the spf lookup budget", () => {
    render(
      createElement(SPFPanel, { result: analyzeSpf(txt("v=spf1 a mx include:x.example -all")) })
    )
    expect(screen.getByText("3 of 10")).toBeTruthy()
    expect(screen.getByText("-all")).toBeTruthy()
  })

  it("marks a dkim key in testing mode", () => {
    render(
      createElement(DKIMPanel, {
        results: [analyzeDkim("selector1", txt("v=DKIM1; k=rsa; t=y; p=abc"))!],
      })
    )
    expect(screen.getByText("testing")).toBeTruthy()
  })

  it("shows the inherited subdomain policy and the real pct", () => {
    render(
      createElement(DMARCPanel, {
        domain: "example.com",
        result: analyzeDmarc(txt("v=DMARC1; p=reject; pct=0; rua=mailto:d@example.com")),
      })
    )
    expect(screen.getByText("Inherited from p")).toBeTruthy()
    expect(screen.getByText("0%")).toBeTruthy()
    expect(screen.getByText(/monitoring only/)).toBeTruthy()
  })
})

describe("acl-generator index", () => {
  // each acl type is its own lazy chunk, so the textarea exists only once the open tab resolves
  const configOf = async (aclType: string) =>
    (
      (await screen.findByLabelText(
        `Generated ${aclType} ACL configuration`
      )) as HTMLTextAreaElement
    ).value

  it("swaps the untouched acl number when the tab changes", async () => {
    render(createElement(ACLGenerator))
    expect(await configOf("extended")).toContain("access-list 101 permit tcp")

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Standard ACL/ }))
    const standard = await configOf("standard")
    expect(standard).toContain("access-list 10 permit 192.168.1.0 0.0.0.255")
    expect(standard).not.toContain("WARNING")
  })

  it("keeps a number the user typed, and then says it is wrong for the tab", async () => {
    render(createElement(ACLGenerator))
    await configOf("extended")
    fireEvent.change(screen.getByLabelText("ACL Name/Number"), { target: { value: "150" } })
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Standard ACL/ }))
    expect(await configOf("standard")).toContain("! WARNING: 150 is an extended ACL number")
  })

  it("regenerates for the selected platform", async () => {
    render(createElement(ACLGenerator))
    await configOf("extended")
    fireEvent.change(screen.getByLabelText("ACL Name/Number"), { target: { value: "WEB-ACL" } })
    expect(await configOf("extended")).toContain("ip access-list extended WEB-ACL")
  })
})

describe("email-diagnostics index", () => {
  const doh = (map: Record<string, unknown>) =>
    vi.fn(async (input: string) => {
      const url = new URL(input)
      const key = `${url.searchParams.get("type")}:${url.searchParams.get("name")}`
      return {
        ok: true,
        status: 200,
        json: async () => map[key] ?? { Status: 0, Answer: [] },
      } as unknown as Response
    })

  it("runs the lookups and loads the result panels on demand", async () => {
    const fetchImpl = doh({
      "MX:example.com": {
        Status: 0,
        Answer: [answer(DNS_TYPE.MX, "10 mail.example.com.")],
      },
      "TXT:example.com": { Status: 0, Answer: [answer(DNS_TYPE.TXT, '"v=spf1 mx -all"')] },
      "TXT:_dmarc.example.com": {
        Status: 0,
        Answer: [answer(DNS_TYPE.TXT, '"v=DMARC1; p=reject; rua=mailto:d@example.com"')],
      },
    })
    vi.stubGlobal("fetch", fetchImpl)

    render(createElement(EmailDiagnostics))
    fireEvent.change(screen.getByLabelText("Domain"), { target: { value: "example.com" } })
    fireEvent.click(screen.getByRole("button", { name: /Run Diagnostics/ }))

    // the mx panel is a lazy chunk, so it only appears once the import resolves
    await waitFor(() => expect(screen.getByText("mail.example.com")).toBeTruthy())
    // the score card is its own chunk too, and resolves independently of the mx panel
    expect(await screen.findByText("Email Security Score")).toBeTruthy()
    vi.unstubAllGlobals()
  })

  it("refuses input that is not a domain instead of querying dns", () => {
    const fetchImpl = doh({})
    vi.stubGlobal("fetch", fetchImpl)

    render(createElement(EmailDiagnostics))
    fireEvent.change(screen.getByLabelText("Domain"), { target: { value: "not a domain" } })
    fireEvent.click(screen.getByRole("button", { name: /Run Diagnostics/ }))

    expect(screen.getByText(/is not a valid domain name/)).toBeTruthy()
    expect(fetchImpl).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it("says the data is incomplete when every resolver fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("blocked")
      })
    )

    render(createElement(EmailDiagnostics))
    fireEvent.change(screen.getByLabelText("Domain"), { target: { value: "example.com" } })
    fireEvent.click(screen.getByRole("button", { name: /Run Diagnostics/ }))

    await waitFor(() => expect(screen.getByText(/based on incomplete data/)).toBeTruthy())
    vi.unstubAllGlobals()
  })
})
