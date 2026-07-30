---
title: Tests and gates
description: The two vitest projects in NetDash Toolkit, the automated axe accessibility gate, the token-based contrast gate, and what each one can and cannot prove.
---

`pnpm test` runs both vitest projects. Two of the suites are gates rather than tests: they fail on properties of the whole app, not on one function, and they are the reason a pull request that renders fine locally can still be rejected.

## The two vitest projects

[`vitest.config.mts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/vitest.config.mts) declares two projects with different environments, because the two kinds of test need different things:

| Project      | Environment | Include glob                     | Setup file                  |
| ------------ | ----------- | -------------------------------- | --------------------------- |
| `unit`       | `node`      | `tests/unit/**/*.test.ts`        | none                        |
| `components` | `happy-dom` | `tests/components/**/*.test.tsx` | `tests/components/setup.ts` |

```bash
# both projects
pnpm test

# one project, when you are iterating
pnpm exec vitest run --project unit
pnpm exec vitest run --project components
```

The split is not cosmetic. `unit` covers pure logic in `lib/` plus the Electron output parsers, and it runs in Node because there is no DOM to need. `components` mounts real React components, and the config comment explains the environment choice: happy-dom over jsdom because it is faster, and because jsdom 30 needs Node 22 through undici while this project pins Node 20.

One config detail that bites people adding tests: the root `tsconfig.json` sets `jsx: "preserve"` for Next, so vitest needs its own transform. That is what `@vitejs/plugin-react` is doing in the config, and without it a `.tsx` test fails to parse rather than fails to pass.

## Gate 1: every tool must mount

[`tests/components/render-all-tools.test.tsx`](https://github.com/sunnypatell/netdash-toolkit/blob/main/tests/components/render-all-tools.test.tsx) enumerates the registry and mounts every entry:

```tsx
it.each(tools.map((t) => [t.slug, t] as const))(
  "%s renders without crashing",
  async (slug, tool) => {
    const mod = await tool.load()
    const Tool = mod.default
    expect(Tool, `${slug} exported no component`).toBeTypeOf("function")
    render(
      <Providers>
        <Tool />
      </Providers>
    )
    expect(document.body.textContent?.trim().length ?? 0).toBeGreaterThan(0)
  }
)
```

Three assertions, each catching a different failure:

| Assertion                | Catches                                      | Why the obvious version misses it                                              |
| ------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------ |
| `toBeTypeOf("function")` | a lazy loader whose named export was renamed | the import resolves, so nothing throws until render                            |
| body text length `> 0`   | a tool that mounts and renders nothing       | an empty mount throws no error and looks like a pass                           |
| no real `console.error`  | a React render error                         | React logs thrown render errors through `console.error` rather than rethrowing |

The third one needs a filter, because happy-dom logs unimplemented-CSS noise on every mount. The test filters on `/not implemented|Not implemented|css|jsdom/i` and treats everything else as a failure. That filter is a judgement call and it is the weak point of the gate: a genuine error whose message happens to contain the word "css" would be swallowed.

A second block asserts every tool exposes at least one heading, because a tool page with no heading is unnavigable by screen reader.

The comment at the top states the intent plainly: this is the cheap rigorous substitute for clicking through 48 tools by hand. Adding a registry entry without a working component fails here in seconds.

## Gate 2: the axe accessibility gate

[`tests/components/wcag.test.tsx`](https://github.com/sunnypatell/netdash-toolkit/blob/main/tests/components/wcag.test.tsx) runs [axe-core](https://github.com/dequelabs/axe-core) against every tool, scoped to exactly the WCAG 2.2 AA tag set:

```tsx
const AXE_OPTIONS: axe.RunOptions = {
  runOnly: {
    type: "tag",
    // wcag2a + wcag2aa + wcag21a + wcag21aa + wcag22aa is exactly the 2.2 AA set
    values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
  },
  rules: {
    "color-contrast": { enabled: false },
  },
}
```

Every tool gets its own test case with a 20 second timeout, and the failure message embeds the violating HTML so you get the node rather than a rule id.

Two scope limits are stated in the file rather than left implicit, and both are worth repeating because they decide what this gate is evidence of:

- **axe cannot prove conformance.** The comment puts it at roughly a third of the success criteria needing human judgement. What the gate proves is the absence of _mechanically detectable_ failures across all 48 tools in one run.
- **`color-contrast` is switched off on purpose.** happy-dom has no layout engine, so axe would compute contrast against a page that never painted. Leaving the rule on would produce confident nonsense in both directions. Contrast is asserted separately, from the tokens.

The criteria axe cannot see are covered by the dedicated suites in `tests/unit/wcag-*.test.ts`: target size, focus indicators, keyboard operability, reflow and text spacing, authentication, state contrast, and an explicit not-applicable record. The full criterion-by-criterion conformance record lives in [the accessibility conformance record](/docs/accessibility-conformance/), which is maintained separately from this page.

## Gate 3: the token contrast gate

[`tests/unit/contrast.test.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/tests/unit/contrast.test.ts) is the interesting one, because it does not test code at all. It parses [`app/globals.css`](https://github.com/sunnypatell/netdash-toolkit/blob/main/app/globals.css) and computes contrast ratios straight from the shipped token values, so the assertion cannot drift from the CSS.

It implements the WCAG formulas directly:

```ts
function channel(c: number) {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

// https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
function luminance(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16)
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  )
}

// https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
function ratio(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
```

Those are [relative luminance](https://www.w3.org/TR/WCAG22/#dfn-relative-luminance) and [contrast ratio](https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio) as WCAG 2.2 defines them, coefficients and all.

### Worked example: the palette change this gate forced

The light-mode primary is `#047857` and the dark-mode primary is `#10b981`. Run the numbers for light-mode `--primary` against a white `--background`, which the `UI_PAIRS` list checks at the 3:1 floor of [1.4.11 non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html):

```text
#047857 -> R=0x04=4  G=0x78=120  B=0x57=87

channel(4)   = (4/255)/12.92                      = 0.001214   # below 0.04045, linear branch
channel(120) = ((120/255 + 0.055)/1.055) ^ 2.4    = 0.187821
channel(87)  = ((87/255  + 0.055)/1.055) ^ 2.4    = 0.095307

L(#047857) = 0.2126(0.001214) + 0.7152(0.187821) + 0.0722(0.095307)
           = 0.000258 + 0.134329 + 0.006881
           = 0.141469

L(#ffffff) = 1.0

ratio = (1.0 + 0.05) / (0.141469 + 0.05)
      = 1.05 / 0.191469
      = 5.48:1
```

5.48 clears both the 3:1 non-text floor and the 4.5:1 text floor, against the light theme's `--background: #ffffff`. Run the same arithmetic on the dark theme's primary `#10b981` over white and you get **2.54:1**, which fails both. That is the whole reason the two themes carry different primaries instead of sharing one value: `#10b981` is fine on the dark `--background: #0f172a` and unusable on white. These docs reuse the same two colours for the same reason.

The green channel dominates both results, which is what the `0.7152` coefficient is for; changing the red or blue component of a green barely moves the ratio, so tuning a failing token means moving its lightness, not its hue.

### What it checks, and what it deliberately does not

| List         | Floor | Criterion                                                                    | Contents                                                                  |
| ------------ | ----- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `TEXT_PAIRS` | 4.5:1 | [1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)   | 15 foreground-on-surface pairs, including the sidebar token family        |
| `UI_PAIRS`   | 3:1   | [1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) | `--input`, `--ring`, `--primary`, `--sidebar-ring` against their surfaces |

Both lists run twice, once per theme, via `describe.each(["light", "dark"])`.

The exclusions are argued rather than assumed. `--border` is **NOT** in `UI_PAIRS`, and the comment gives the reason: it draws decorative separators and card hairlines, which 1.4.11 does not bind, since the criterion covers boundaries required to identify a control or its state. `--input` and `--ring` are in, because a text field's boundary and a focus indicator both carry exactly that required information.

There is also a guard against the gate quietly becoming vacuous: `hex()` asserts each token is an opaque six-digit hex before using it, because a token expressed as `oklch()` or `color-mix()` composites over whatever is behind it and its contrast cannot be reasoned about from the value alone. A separate test asserts both themes define the same colour token set, so a token added to one theme and not the other fails rather than going unchecked.

## Gate 4: the docs cannot state a tool count the registry disagrees with

This one lives in the docs build rather than in vitest, and it exists because the failure already happened. A tool moved from `runtime.offline: false` to `offline: true`, the offline count moved with it, and eleven hand-written sentences across nine pages silently became wrong. The generated pages under `/docs/tools/` re-derive their numbers from the registry on every build and were unaffected; only the prose drifted, which is exactly the failure mode prose has.

[`docs/scripts/check-counts.mjs`](https://github.com/sunnypatell/netdash-toolkit/blob/main/docs/scripts/check-counts.mjs) runs between the page generator and `astro build`. It reads the registry through the same `read-registry.mjs` the generator uses, derives five numbers, then scans every hand-written page for a number sitting in one of the shapes the docs use to state a count:

| Shape in the prose                                   | Must equal                                                                                                     |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `48 tools`, `48-tool dashboard`                      | the total                                                                                                      |
| `36 of the 48`                                       | one of total, offline, networked, saveable, or a per-category count, **and** the denominator must be the total |
| `36 offline`, `36 of them never`, `36 fully working` | the offline count                                                                                              |
| `the other 12`, `12 networked tools`                 | the networked count                                                                                            |
| `7 categories`                                       | the category count                                                                                             |

Two design choices are worth naming. The denominator guard on the second row is what stops it matching `0 of 100`, which is a security-header score rather than a tool fraction. And the generated `tools/` directory is skipped entirely, because a check on a file that is rewritten from the same source on every build proves nothing.

The failure output names the file, the line, the exact text it matched, the number it found, and the numbers the registry can currently justify:

```text
docs/src/content/docs/index.mdx:6
  matched   "36 of them never" as an offline tool count
  found     36
  registry  37
```

The scope limit is real and worth stating: a phrasing the script does not recognise is not checked at all. If you write a count a new way, add its shape to the rules rather than working around the check.

## What CI runs

[`.github/workflows/ci.yml`](https://github.com/sunnypatell/netdash-toolkit/blob/main/.github/workflows/ci.yml) has two jobs, and every action is pinned by commit SHA with `step-security/harden-runner` in egress-audit mode ahead of checkout.

| Job     | Steps, in order                                                                                      |
| ------- | ---------------------------------------------------------------------------------------------------- |
| Quality | `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm electron:compile`, `pnpm test`             |
| Build   | `pnpm build`, then `pnpm electron:pack --linux`, then an assertion that the packaged artifacts exist |

Two things follow from that table. `pnpm electron:compile` is in the Quality job as a typecheck: the Electron main process has its own `tsconfig.json`, so `pnpm typecheck` does not cover it and compiling is how it gets checked. And because the Build job runs the root `pnpm build`, which now chains `pnpm build:docs` first, **CI builds this documentation site on every run**. A docs build failure fails CI, which is the intended behaviour: the alternative is shipping a deploy whose `/docs/` is stale or missing.

`pnpm validate` is the Quality sequence locally, and `pnpm validate:full` adds the build, so the second is the closest local approximation of a full green CI run.

## Adding a test

Put logic in `lib/` and test it in `tests/unit/`. [`CONTRIBUTING.md`](https://github.com/sunnypatell/netdash-toolkit/blob/main/CONTRIBUTING.md) states the rule directly, and the structure of the repo enforces it: a component thin enough to be worth mounting is a component whose logic lives somewhere testable.

Parsers that consume real command output get a fixture rather than an inline string. `tests/fixtures/` holds captured macOS `ping`, `traceroute` and `arp` transcripts, and the Electron parser tests read those files. A fixture from a real machine catches the formatting details a hand-written sample smooths over, which is how the duplicate-`icmp_seq` and unpadded-MAC bugs were found.

:::caution[What a Green Run Does Not Mean]
`next.config.mjs` sets `eslint.ignoreDuringBuilds` and `typescript.ignoreBuildErrors` to `true`, so a passing `next build` proves nothing about types or lint. And axe with `color-contrast` disabled proves nothing about contrast. Each gate is evidence for exactly one property; none of them is evidence for the others.
:::
