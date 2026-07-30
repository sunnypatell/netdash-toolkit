# Contributing to NetDash Toolkit

thanks for your interest in contributing! this guide will help you get started.
participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Development Setup

### Prerequisites

- Node.js 20+ (the major is pinned in `.nvmrc`, so `nvm use` picks it up)
- pnpm 10+ (the exact version is pinned in `package.json`'s `packageManager` field, so `corepack enable` is enough)

### Getting Started

```bash
git clone https://github.com/sunnypatell/netdash-toolkit.git
cd netdash-toolkit

pnpm install     # root deps; docs/ installs its own on first `pnpm build`
pnpm dev         # next dev server on http://localhost:3000
pnpm validate    # the gate
```

there is no `pnpm start`. the web app is a static export (`output: "export"` in
`next.config.mjs`), so `next start` refuses to serve it. `pnpm build` writes the
site to `out/`; point any static file server at that directory if you need to
check production output.

## Scripts

### the gate

| command              | what it does                                                          |
| -------------------- | --------------------------------------------------------------------- |
| `pnpm validate`      | format check, lint, typecheck, electron typecheck, both test projects |
| `pnpm validate:full` | `validate` plus the full web build (docs + next)                      |

`pnpm validate` is the CI `Quality` job, same checks in the same order. run it
before every push. it
deliberately does not build, because the build is a separate CI job and takes
minutes; use `pnpm validate:full` if you touched `app/`, `next.config.mjs`, or
anything else the build consumes.

### quality

| command             | what it does                                                           |
| ------------------- | ---------------------------------------------------------------------- |
| `pnpm typecheck`    | `tsc --noEmit` over the app                                            |
| `pnpm lint`         | eslint over every source dir, including `electron/`, `tests/`, `docs/` |
| `pnpm lint:fix`     | same, with `--fix`                                                     |
| `pnpm format`       | prettier, write                                                        |
| `pnpm format:check` | prettier, check only (what CI runs)                                    |

### tests

| command                | what it does                                           |
| ---------------------- | ------------------------------------------------------ |
| `pnpm test`            | both vitest projects                                   |
| `pnpm test:unit`       | `tests/unit/` only, node environment, pure logic       |
| `pnpm test:components` | `tests/components/` only, happy-dom, mounts every tool |
| `pnpm test:watch`      | vitest in watch mode                                   |

both projects are configured in `vitest.config.mts`. the `components` project
mounts every registered tool to catch render crashes, which is the cheap
substitute for clicking through the whole tool directory by hand.

### build and desktop

| command                 | what it does                                                        |
| ----------------------- | ------------------------------------------------------------------- |
| `pnpm build`            | `build:docs` then `next build` (static export to `out/`)            |
| `pnpm build:app`        | `next build` only, skips the astro docs build                       |
| `pnpm build:docs`       | builds the astro site in `docs/` and copies it to `public/docs/`    |
| `pnpm electron:dev`     | next dev server plus electron, both watching                        |
| `pnpm electron:compile` | typechecks and emits electron main/preload to `dist-electron/`      |
| `pnpm electron:pack`    | packs an unpacked app dir for the host platform (the CI smoke test) |
| `pnpm electron:build`   | full web build then a real electron-builder run                     |
| `pnpm dist:mac`         | `electron:build --mac`; same for `:win`, `:linux`, `:all`           |

`pnpm electron:pack` packs whatever is currently in `out/`, so run `pnpm build`
first if the web output is stale.

## Project Structure

```
netdash-toolkit/
├── app/                    # next.js app router (static export)
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   └── tools/              # one file per single-panel tool, one directory
│                           # per multi-panel tool (index.tsx + panel files)
├── contexts/               # react context providers (auth, projects)
├── lib/                    # networking math, parsers, and tool logic
│   └── reference/          # static reference data (ports, ranges, protocols)
├── electron/               # electron main + preload, compiled separately
├── tests/
│   ├── unit/               # node, pure logic
│   ├── components/         # happy-dom, render and accessibility
│   └── fixtures/           # captured vendor and OS command output
├── docs/                   # astro starlight site, its own pnpm project
├── data/                   # static data shipped with the app
├── types/                  # shared ambient types
└── public/                 # static assets (`public/docs/` is generated)
```

`lib/tool-registry.ts` is the single source of truth for the tool directory. it
holds every tool's id, category, metadata, and a lazy `load()` import. the
sidebar, search, URL routing, and the generated docs pages all read it, so a
tool that is not in the registry does not exist.

## Adding a New Tool

1. put the logic in `lib/` as pure functions. the networking math and the
   vendor-output parsers are the load-bearing parts of this app, and pure
   functions are cheap to test.
2. add tests in `tests/unit/`. new logic in `lib/` without tests will be asked
   for tests.
3. build the component in `components/tools/`. a single-panel tool is one
   `.tsx` file; a multi-panel tool is a directory with `index.tsx` plus one
   file per panel.
4. register it in `lib/tool-registry.ts` with a lazy `load()`. that is what
   wires up the sidebar, search, deep links, and the docs page.
5. run `pnpm validate`. the `components` project will mount your tool
   automatically, because it walks the registry.

## Code Style

- typescript for all new code
- prettier owns formatting; do not hand-format, run `pnpm format`
- follow existing patterns rather than introducing new ones
- keep components focused and single-purpose
- comments explain the non-obvious "why", not the "what"

### lint warnings

`pnpm lint` reports a small number of pre-existing warnings (unused bindings,
a few `any` casts at the electron IPC and DOM boundaries). they do not fail CI,
but the pre-commit hook runs `eslint --max-warnings=0` over the files you
staged, so you cannot add new ones, and if you touch a file that already has
one you are expected to clear it. that is deliberate: the count only goes down.

if a binding genuinely has to exist unused, prefix it with `_`. unused `catch`
bindings are not reported at all.

## Git

### Branch Naming

- `feat/description` for new features
- `fix/description` for bug fixes
- `docs/description` for documentation
- `refactor/description` for refactoring

### Commit Messages

we use [conventional commits](https://www.conventionalcommits.org/):

```
type(scope): description

- bullet point explaining change
- another point if needed
```

types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`

a husky pre-commit hook runs `lint-staged` over the staged files only: eslint
with `--fix`, then prettier. it takes a second or two on a normal commit, and
it is not a substitute for `pnpm validate`.

### Pull Requests

1. fork the repo and branch from `main`
2. make your changes
3. run `pnpm validate`, and `pnpm validate:full` if you touched the build
4. open a PR using the template

CI runs the same gate, plus the web build and an electron packaging smoke test,
as two parallel jobs. if `pnpm validate` is green locally the `Quality` job
will be green too.

## Reporting Issues

- use the appropriate [issue template](https://github.com/sunnypatell/netdash-toolkit/issues/new/choose)
- include reproduction steps for bugs
- check existing issues before creating new ones
- for security vulnerabilities follow [SECURITY.md](.github/SECURITY.md) rather than opening an issue

## License

by contributing, you agree that your contributions will be licensed under the MIT License.
