---
title: Code conventions
description: Formatting, commit style, the comment discipline NetDash Toolkit follows, and the exact steps to add a tool to the registry.
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

`pnpm validate` is the whole CI chain locally: `typecheck`, `lint`, `format:check`, `test`, `build`. [`CONTRIBUTING.md`](https://github.com/sunnypatell/netdash-toolkit/blob/main/CONTRIBUTING.md) puts it directly: if it passes locally it passes there.

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

The fourth rule is the one with history. The comment on the `ToolRuntime` interface explains it: the dashboard hardcoded "100% offline ready" while 12 tools did network I/O, and nothing in the registry could contradict it. The test now derives the truth from the source so the metadata cannot drift again.

Adding a **category** is a bigger change than adding a tool. The docs sidebar is manual by design, so `docs/scripts/generate-tool-pages.mjs` fails the docs build if the registry's categories and the sidebar in `docs/astro.config.mjs` disagree, and tells you which one is unaccounted for. Add the sidebar entry and update `SIDEBAR_CATEGORIES` in the same change.

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
- **Every claim traces to code.** Link the implementation and, where one exists, the test that guards it. If something cannot be verified, say so in the page rather than rounding it up.

:::tip[The Bar for a Claim]
If you write that the app does something, link the file. If you write that it keeps doing it, link the test. If you cannot do either, write that you did not verify it. A documented uncertainty is worth more than a confident guess, because the next person can close it.
:::
