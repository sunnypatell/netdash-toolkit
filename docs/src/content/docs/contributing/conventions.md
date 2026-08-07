---
title: Code conventions
description: Formatting, commit style, the comment discipline NetDash Toolkit follows, the shared copy, export, error-string and disclosure vocabulary across the 48 tools, and the exact steps to add a tool to the registry.
---

The mechanical conventions are enforced by tooling, so you do not have to remember them. The one convention that is not automated, and that the codebase leans on heavily, is what a comment is for.

## Enforced automatically

| Rule                      | Enforced by                     | Value                                                                                                                                 |
| ------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Formatting                | Prettier via `.prettierrc`      | no semicolons, double quotes, 2-space indent, 100-column print width, ES5 trailing commas                                             |
| Tailwind class order      | `prettier-plugin-tailwindcss`   | applied on every format run                                                                                                           |
| Lint                      | ESLint via `eslint-config-next` | `pnpm lint`                                                                                                                           |
| Encoding and line endings | `.editorconfig`                 | UTF-8, LF, final newline, trimmed trailing whitespace except in Markdown                                                              |
| Pre-commit                | husky plus lint-staged          | `eslint --fix` then `prettier --write` on staged JS and TS; `prettier --write` on staged `.cjs`, `.mjs`, JSON, Markdown, YAML and CSS |

The `.cjs` and `.mjs` line in [`.lintstagedrc`](https://github.com/sunnypatell/netdash-toolkit/blob/main/.lintstagedrc) exists because of a real failure: `format:check` in the release pipeline caught a `.cjs` file the pre-commit hook did not cover, which failed a release for a formatting reason. The glob list is now the same set Prettier checks.

```bash
# fix everything mechanical before you push
pnpm format
pnpm lint
pnpm validate
```

`pnpm validate` is the CI `Quality` job locally, in the same order: `format:check`, `lint`, `typecheck`, `electron:compile`, `test`. It stops short of the build on purpose, because the build is a separate CI job; `pnpm validate:full` adds it. [`CONTRIBUTING.md`](https://github.com/sunnypatell/netdash-toolkit/blob/main/CONTRIBUTING.md) puts it directly: if it passes locally it passes there.

## Comments explain why, never what

This is the convention with the highest payoff in this repository, and it is visible everywhere in the source. Comments are lowercase, short, and they document a decision or a bug, not the mechanics of the line below them.

```ts
// classify from the host address, not the network: 192.168.1.5/8 lives in
// network 192.0.0.0 but the address itself is still rfc1918 private
```

```ts
// rfc 3597 numeric escapes, plus the "UNKNOWN_n" spelling dns-packet decodes to
```

```ts
// the app had two toast systems and mounted neither, so every
// "copied"/"saved"/"failed" message was silent. one system now.
```

Each of those answers a question a reader would otherwise have to reconstruct: why classification uses the host rather than the network, why an extra spelling is accepted, why there is exactly one `Toaster` in the layout. None of them restates the code.

The pattern to copy, when you fix something subtle: state what was broken, then what the fix is. Those comments are the reason much of this documentation could be written accurately, because the code carries its own history.

Do not write a comment that a reader could derive from the identifier. Most code needs none.

## Commits

Conventional Commits, lowercase, imperative:

```text
type(scope): description

- bullet explaining the change
- another if needed
```

Types in use across the history: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`. Breaking changes take a `!`, as in `feat(api)!:`. A squash merge appends the pull request number so the commit links back, as in `fix(security): next 15 + patch transitive dev CVEs (#31)`.

## Adding a tool

Every tool is one entry in [`lib/tool-registry.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/tool-registry.ts). There is no second list to update: the sidebar, the command palette, the static routes, and the tools pages in these docs all read from it.

```ts
{
  slug: "mtu-calculator",              // url segment under /tools/, and the only tool id anywhere
  label: "MTU Calculator",             // sidebar label
  title: "MTU Calculator",             // full title for the dashboard and about page
  description: "Calculate MTU and header overhead for various network stacks",
  icon: Wifi,
  category: "calculators",
  features: ["Protocol stacks", "Overhead calculation", "Fragmentation warnings"],
  keywords: ["mtu", "packet", "fragmentation", "overhead", "header"],
  load: () => import("@/components/tools/mtu-calculator").then((m) => ({ default: m.MTUCalculator })),
}
```

Five rules, each with a gate behind it:

| Rule                                                                                | What happens if you break it                                                  |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| The `load` thunk must resolve to a component under `default`                        | `render-all-tools.test.tsx` fails with "exported no component"                |
| The component must render something and expose a heading                            | the same suite fails on empty body text or zero headings                      |
| The component must have no axe-detectable WCAG 2.2 AA violation                     | `wcag.test.tsx` fails with the offending HTML                                 |
| Set `runtime.offline: false` and list `thirdParty` hosts if it does any network I/O | `tool-registry.test.ts` fails, because it derives network I/O from the source |
| Set `projectItemType` only if the component actually renders `SaveToProject`        | the registry would promise persistence the tool does not implement            |

The fourth rule is the one with history. The comment on the `ToolRuntime` interface explains it: the dashboard hardcoded "100% offline ready" while a dozen tools did network I/O, and nothing in the registry could contradict it. The test now derives the truth from the source so the metadata cannot drift again.

Adding a **category** is a bigger change than adding a tool. The docs sidebar is manual by design, so `docs/scripts/generate-tool-pages.mjs` fails the docs build if the registry's categories and the sidebar in `docs/astro.config.mjs` disagree, and tells you which one is unaccounted for. Add the sidebar entry and update `SIDEBAR_CATEGORIES` in the same change.

## Shared UI vocabulary

A directory of 48 tools drifts into 48 dialects unless the shared surfaces are actually shared. Four conventions were unified across the whole set, and each one is stated below with the exceptions that still exist, because a convention described as universal when it is not is worse than one described accurately.

### Copying

Every copy in the app goes through `copyText` in [`lib/clipboard.ts`](https://github.com/sunnypatell/netdash-toolkit/blob/main/lib/clipboard.ts), which tries the secure-context `navigator.clipboard.writeText` and falls back to `document.execCommand("copy")` for a non-secure origin. **No copy raises a toast anywhere in the app**, which is the change worth knowing: a toast for an action whose result is already visible on the button is noise, and 51 of them used to fire into a `Toaster` that was never mounted.

[`components/ui/copy-button.tsx`](https://github.com/sunnypatell/netdash-toolkit/blob/main/components/ui/copy-button.tsx) is the component to reach for. It swaps its own accessible name rather than announcing through a live region:

```tsx
aria-label={copied ? "Copied!" : "Copy to clipboard"}
```

52 tool files import it. Three surfaces copy without it, and each is a deliberate variant rather than an oversight:

| Surface                                                                                                                                               | Why it is not `CopyButton`                                                                                                                                   | Announcement                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| [`components/ui/result-card.tsx`](https://github.com/sunnypatell/netdash-toolkit/blob/main/components/ui/result-card.tsx)                             | copy is per result row, inside a card the tool does not compose button-by-button                                                                             | `aria-live="polite"` on the card plus an `sr-only` "Copied" |
| [`components/tools/shared/reference-table.tsx`](https://github.com/sunnypatell/netdash-toolkit/blob/main/components/tools/shared/reference-table.tsx) | a 33-row table would otherwise put 33 buttons all named "Copy to clipboard" in the tab order, so `RowCopyButton` carries a per-row name                      | none, same as `CopyButton`                                  |
| [`components/project-manager.tsx`](https://github.com/sunnypatell/netdash-toolkit/blob/main/components/project-manager.tsx)                           | a share link, not a tool result. It calls `navigator.clipboard.writeText` directly, which is the one remaining raw clipboard call outside `lib/clipboard.ts` | none, and no `execCommand` fallback either                  |

So the accurate summary is: copy is silent everywhere except `ResultCard`, which announces politely, and it runs through one helper everywhere except the project share link. Eight tools reach copy only through `ResultCard` or `ReferenceTable` and therefore never import `CopyButton` at all: bandwidth calculator, cable calculator, IPv6 tools, MTU calculator, port reference, protocol reference, reference hub and subnet calculator.

### Export labels

The rule is that the label names the format only when the format is a choice:

| Situation                    | Label                        | Examples                                                                                                                                   |
| ---------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| One export from that surface | bare `Export`                | whois lookup, network tester, security headers, redirect checker, email diagnostics, DNS tools, ACL generator, JSON formatter, and 16 more |
| Two formats side by side     | `Export CSV` / `Export JSON` | IP enumerator, OUI lookup, subnet calculator                                                                                               |

Two tools sit beside that second row with a non-JSON second format, which is the rule applied rather than broken: the VLSM planner offers `Export CSV` and `Export Text`, and the conflict checker offers `Export CSV` and `Export Report`, where the report is a `text/plain` remediation write-up rather than a serialisation format. The one genuine exception is the Wi-Fi QR generator, whose two downloads are labelled `PNG` and `SVG` with the word "Export" absent entirely.

Where a bare `Export` would be ambiguous to a screen reader out of context, the visible label stays bare and the accessible name is extended instead, which keeps the visual convention intact:

```tsx
// components/tools/random-generator/result-list.tsx
Export<span className="sr-only"> {kind}</span>

// components/tools/port-scanner/scan-results.tsx
aria-label={`Export the scan of ${session.target}`}
```

Two exports also carry their own provenance into the file rather than only onto the screen: the security-header report and the redirect chain both write `source` and `verified: input.source !== "relay"` into the JSON, so a relayed result stays labelled unverified after it leaves the app.

### Error strings

Validation errors that **reject a malformed value** converged on `Invalid X`, with no trailing period, so the string is a fragment that a caller can compose rather than a sentence:

```ts
throw new Error("Invalid IPv4 address")
throw new Error("Invalid prefix length (must be 0-32)")
throw new Error("Invalid prefix length (must be 0-128)")
```

Three other families exist and are not the same thing, which is why they were not folded in:

| Shape           | Means                                | Example                                        |
| --------------- | ------------------------------------ | ---------------------------------------------- |
| `Invalid X`     | you supplied a value and it is wrong | `Invalid CIDR prefix`                          |
| `Enter a X`     | you supplied nothing yet             | `Enter a domain, IP address, or ASN`           |
| `X must be ...` | a numeric or structural range        | `Subnet mask must have contiguous 1 bits`      |
| `X is required` | a required field of a config object  | used across the ACL, routing and VLAN builders |

The convergence is not complete, and the remainder is where it is worth knowing: the auth and project-sharing dialogs ([`components/ui/account-settings-dialog.tsx`](https://github.com/sunnypatell/netdash-toolkit/blob/main/components/ui/account-settings-dialog.tsx), [`components/ui/share-project-dialog.tsx`](https://github.com/sunnypatell/netdash-toolkit/blob/main/components/ui/share-project-dialog.tsx) and [`components/ui/user-menu.tsx`](https://github.com/sunnypatell/netdash-toolkit/blob/main/components/ui/user-menu.tsx)) still use full sentences with terminal periods, as do a handful of parse failures that need to say what they expected instead. Those are prose addressed to a person mid-task rather than fragments composed into a field, so the divergence is defensible; it is simply not yet a single rule.

Nothing enforces any of this. There is no lint rule and no test over error-message shape, so treat the table as the convention to follow rather than as a gate that will catch you.

### The runtime disclosure is written once

`ToolShell` renders [`RuntimeDisclosure`](https://github.com/sunnypatell/netdash-toolkit/blob/main/components/ui/runtime-badge.tsx) above the tool for any tool the registry marks `offline: false`, as a sibling of the `<Suspense>` boundary rather than inside its fallback. That placement matters: the disclosure previously sat inside the fallback, so it was visible only while the tool's chunk was still downloading and disappeared the moment the tool it was warning you about became usable.

Because the shell states it once, a tool must not restate it. Three tools carry a comment where their duplicate sentence used to be, which is the pattern to copy when you remove one:

```tsx
// the shared disclosure is rendered once by ToolShell; this card used to
// repeat the same sentence a second time
```

A tool-level disclosure is still right when it says something the shared sentence cannot: the DNS tools spell out the DoH threat model, the network tester's DNS panel names the specific resolver you picked, and the OUI lookup explains that only the first three octets ever leave. Those are additive. A restatement of "your input goes to a third party" is not.

## Working on these docs

`docs/` is a separate pnpm project with its own lockfile, deliberately not a workspace package, so an Astro dependency can never enter the app's tree.

```bash
# live reload at http://localhost:4321/docs/
cd docs
pnpm install
pnpm dev
```

Four constraints the docs hold to, all of them load-bearing:

- **No remote assets.** No CDN script, no external stylesheet, no webfont. The same build is served offline by the desktop app, so anything remote would break it.
- **Internal links are absolute and base-prefixed**, with a trailing slash: `/docs/diagnostics/browser-limits/`. `pnpm build` crawls the built HTML and fails on any internal link that does not resolve.
- **Pages under `/docs/tools/` are generated.** Edit the registry, not the markdown.
- **Tool counts in prose are checked against the registry.** `scripts/check-counts.mjs` runs during `pnpm build` and fails on any sentence stating a count the registry no longer supports, naming the file, the line and the matched text. If you phrase a count a way the script does not recognise, add the shape to its rules rather than routing around it. [Tests and gates](/docs/contributing/tests-and-gates/) has the detail.
- **Every claim traces to code.** Link the implementation and, where one exists, the test that guards it. If something cannot be verified, say so in the page rather than rounding it up.

:::tip[The bar for a claim]
If you write that the app does something, link the file. If you write that it keeps doing it, link the test. If you cannot do either, write that you did not verify it. A documented uncertainty is worth more than a confident guess, because the next person can close it.
:::
