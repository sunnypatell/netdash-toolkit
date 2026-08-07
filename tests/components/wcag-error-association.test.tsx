import { cleanup, render, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { AuthProvider } from "@/contexts/auth-context"
import { ProjectProvider } from "@/contexts/project-context"
import { settled } from "./settle"

// wcag 2.2 sc 3.3.1 error identification (a) and sc 3.3.3 error suggestion (aa):
// https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html
// https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html
//
// tests/unit/wcag-error-identification.test.ts proves the association is written
// in the source. that is not the same claim as it reaching the accessibility
// tree: an attribute can be dropped by a wrapper that does not spread its props,
// an id can be rendered on an element that unmounts in the same tick, and a
// radix trigger can swallow either. so each case below puts a real invalid value
// into a real tool and then resolves the reference the way a screen reader
// would, following every id to an element and reading it.
//
// the tools hold their input in the query string, which the nuqs testing adapter
// does not write back, so typing into them would assert nothing. those are
// seeded through searchParams instead, which produces the same error state by
// the same code path. the three that keep their input in useState are typed
// into, because for those typing is the only thing that produces the error.

function Providers({ search }: { search?: string }) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <NuqsTestingAdapter searchParams={search ?? ""}>
        <AuthProvider>
          <ProjectProvider>{children}</ProjectProvider>
        </AuthProvider>
      </NuqsTestingAdapter>
    )
  }
}

interface Case {
  slug: string
  load: () => Promise<() => React.JSX.Element>
  // one of the two: an invalid value seeded into the url, or one typed in
  search?: string
  type?: { label: RegExp; value: string }
  // how to find the field that should be marked invalid
  field: { id: string } | { label: RegExp }
  // what the description must actually say, so a resolved but empty or unrelated
  // element cannot satisfy it
  says: RegExp
}

const CASES: Case[] = [
  {
    slug: "cron-parser",
    load: async () => (await import("@/components/tools/cron-parser")).CronParser,
    search: "?cron=not+a+cron+expression",
    field: { id: "cron" },
    says: /field|macro|expression/i,
  },
  {
    slug: "timestamp-converter",
    load: async () => (await import("@/components/tools/timestamp-converter")).TimestampConverter,
    search: "?ts=zzzz",
    field: { id: "timestamp" },
    says: /\w{4,}/,
  },
  {
    slug: "color-converter",
    load: async () => (await import("@/components/tools/color-converter")).ColorConverter,
    search: "?c=notacolour",
    field: { id: "color-input" },
    says: /\w{4,}/,
  },
  {
    slug: "color-converter background",
    load: async () => (await import("@/components/tools/color-converter")).ColorConverter,
    search: "?bg=notacolour",
    field: { id: "bg-input" },
    says: /unrecognised background/i,
  },
  {
    slug: "mac-formatter",
    load: async () => (await import("@/components/tools/mac-formatter")).MACFormatter,
    search: "?mac=zzz",
    field: { id: "mac" },
    says: /12 hex digits/i,
  },
  {
    slug: "subnet-mask-converter",
    load: async () =>
      (await import("@/components/tools/subnet-mask-converter")).SubnetMaskConverter,
    search: "?mask=999.999.999.999",
    field: { id: "mask" },
    says: /\w{4,}/,
  },
  {
    slug: "uptime-calculator",
    load: async () => (await import("@/components/tools/uptime-calculator")).UptimeCalculator,
    search: "?uptime=500",
    field: { id: "uptime" },
    says: /between 0 and 100/i,
  },
  {
    slug: "ip-converter",
    load: async () => (await import("@/components/tools/ip-converter")).IPConverter,
    search: "?value=notanip",
    field: { id: "ip-input" },
    says: /not a valid/i,
  },
  {
    slug: "ip-enumerator",
    load: async () => (await import("@/components/tools/ip-enumerator")).IPEnumerator,
    search: "?cidr=notacidr",
    field: { id: "cidr" },
    says: /\w{4,}/,
  },
  {
    slug: "data-unit-converter",
    load: async () => (await import("@/components/tools/data-unit-converter")).DataUnitConverter,
    search: "?value=-5",
    field: { id: "data-value" },
    says: /zero or more/i,
  },
  {
    // the only case where the field is the shared IPInput primitive, so it also
    // covers the describedBy passthrough that primitive gained for this
    slug: "subnet-calculator",
    load: async () => (await import("@/components/tools/subnet-calculator")).SubnetCalculator,
    search: "?ip=999.1.1.1",
    field: { label: /^IP Address$/ },
    says: /invalid ipv4 address/i,
  },
  {
    slug: "jwt-decoder",
    load: async () => (await import("@/components/tools/jwt-decoder")).JWTDecoder,
    type: { label: /jwt token/i, value: "not.a.jwt" },
    field: { label: /jwt token/i },
    says: /\w{4,}/,
  },
  {
    slug: "json-formatter",
    load: async () => (await import("@/components/tools/json-formatter")).JSONFormatter,
    // user-event reads a brace or a bracket as key syntax, so the invalid value
    // avoids both
    type: { label: /^JSON input$/, value: "not json" },
    field: { id: "json-input" },
    says: /\w{4,}/,
  },
]

afterEach(cleanup)

describe("3.3.1: a real error reaches the field that produced it", () => {
  it("still has cases to drive", () => {
    // a table that silently empties turns every assertion below into no assertion
    expect(CASES.length).toBeGreaterThanOrEqual(12)
  })

  it.each(CASES.map((c) => [c.slug, c] as const))("%s", async (slug, testCase) => {
    const Tool = await testCase.load()
    const { container } = render(<Tool />, { wrapper: Providers({ search: testCase.search }) })
    await settled(container, slug)

    if (testCase.type) {
      const target = within(container).getByLabelText(testCase.type.label)
      await userEvent.type(target, testCase.type.value)
      await settled(container, slug)
    }

    const field =
      "id" in testCase.field
        ? container.querySelector(`#${CSS.escape(testCase.field.id)}`)
        : within(container).getByLabelText(testCase.field.label)
    expect(field, `${slug}: no field matching ${JSON.stringify(testCase.field)}`).not.toBeNull()

    expect(
      field?.getAttribute("aria-invalid"),
      `${slug}: the value is rejected but the field is not marked invalid`
    ).toBe("true")

    const named = (field?.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean)
    expect(named.length, `${slug}: the invalid field points at no description`).toBeGreaterThan(0)

    const described = named
      .map((id) => {
        const el = container.querySelector(`#${CSS.escape(id)}`)
        expect(el, `${slug}: aria-describedby names "${id}" but nothing renders it`).not.toBeNull()
        return el?.textContent ?? ""
      })
      .join(" ")

    expect(
      described,
      `${slug}: the description resolves but says nothing a user could act on`
    ).toMatch(testCase.says)
  })

  // the other half of the contract: the attributes have to come off again, or a
  // field stays permanently invalid and permanently described by a message that
  // is no longer on screen.
  it.each(CASES.filter((c) => c.search).map((c) => [c.slug, c] as const))(
    "%s is clean when the value is valid",
    async (slug, testCase) => {
      const Tool = await testCase.load()
      const { container } = render(<Tool />, { wrapper: Providers({}) })
      await settled(container, slug)

      const field =
        "id" in testCase.field
          ? container.querySelector(`#${CSS.escape(testCase.field.id)}`)
          : within(container).getByLabelText(testCase.field.label)
      expect(field).not.toBeNull()
      expect(
        field?.getAttribute("aria-invalid"),
        `${slug}: the default value is valid but the field still reads invalid`
      ).not.toBe("true")
    }
  )
})
