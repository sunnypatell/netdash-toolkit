---
title: Local development
description: Set up NetDash Toolkit locally, understand the build scripts, and see how these docs are built into the app's static output.
---

Node 20 and pnpm 10, then one install. The app has no backend and no required environment variables, so a clean clone runs immediately.

## Setup

```bash
# node version is pinned in .nvmrc
git clone https://github.com/sunnypatell/netdash-toolkit.git
cd netdash-toolkit
pnpm install
pnpm dev
```

`pnpm install` also installs husky hooks through the `prepare` script, so staged files get linted on commit. If you want the app without the docs while iterating, use `pnpm build:app`.

## The scripts that matter

| Script               | What it runs                                                     | When to use it                                     |
| -------------------- | ---------------------------------------------------------------- | -------------------------------------------------- |
| `pnpm dev`           | `next dev`                                                       | day-to-day work on the app                         |
| `pnpm build`         | `pnpm build:docs` then `next build`                              | the full artifact, docs included                   |
| `pnpm build:app`     | `next build` only                                                | fast app-only rebuild; leaves `public/docs/` alone |
| `pnpm build:docs`    | installs and builds `docs/`, copies `docs/dist` to `public/docs` | when you change anything under `docs/`             |
| `pnpm test`          | `vitest run` across both projects                                | before every push                                  |
| `pnpm validate`      | format:check, lint, typecheck, electron:compile, test            | the exact chain the CI `Quality` job runs          |
| `pnpm validate:full` | `validate` plus the full build                                   | before pushing a change the build consumes         |

`pnpm validate` is the one to trust, because it is the same sequence, in the same order, as the CI `Quality` job in `.github/workflows/ci.yml`. It deliberately does not build, since the build is a separate CI job and takes minutes; `pnpm validate:full` adds it. Note that `next.config.mjs` sets both `eslint.ignoreDuringBuilds` and `typescript.ignoreBuildErrors` to `true`, so a build passing does not mean types pass; the separate `pnpm typecheck` and `pnpm lint` steps are the real gates.

## How the docs end up inside the app

`docs/` is its own pnpm project with its own lockfile, not a workspace package. It builds an Astro Starlight site with `base: '/docs'`, and the output is copied into `public/docs/`. Next then copies everything in `public/` verbatim into `out/`, so `out/docs/index.html` exists without Next knowing anything about Astro.

```bash
# what pnpm build:docs does, step by step
cd docs && pnpm install && pnpm build
cd .. && rm -rf public/docs && cp -r docs/dist public/docs
```

That layering is the reason the docs also work offline. The desktop app serves `out/` from a loopback HTTP server, so `/docs/` resolves against the same local origin as the app itself, with no internet involved. Nothing in the docs loads a remote font, script, or stylesheet, which is a deliberate constraint rather than a happy accident.

`public/docs/` is gitignored because it is a build artifact, and `docs/src/content/docs/tools/` is gitignored too because those pages are generated from `lib/tool-registry.ts` on every docs build.

## Working on the docs alone

```bash
# live reload at http://localhost:4321/docs/
cd docs
pnpm install
pnpm dev
```

The dev and build scripts both run `scripts/generate-tool-pages.mjs` first, which reads `lib/tool-registry.ts` and rewrites the whole `tools/` directory. If you add a tool category to the registry without adding it to the sidebar in `docs/astro.config.mjs`, the docs build fails with a message telling you which category is unaccounted for. That is deliberate: a silent gap in the sidebar is worse than a broken build.

## Deploying the web build

`vercel.json` sets `"buildCommand": "pnpm build"`, so a Vercel deploy runs the docs build first and would fail rather than publish a site with missing docs. The output is plain static files, so any static host works: copy `out/` behind a server that serves `index.html` for directory paths.

`vercel.json` also sets seven response headers on every path: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, a two-year `Strict-Transport-Security`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, and a Content-Security-Policy whose value is asserted identical to the desktop build's by `tests/unit/csp.test.ts`.

Those headers are Vercel configuration, not part of the static output, so a self-hosted deployment gets **none** of them unless its own web server adds them. If you are copying `out/` behind nginx or Caddy, copy the `headers` block out of `vercel.json` as well; the CSP in particular is what keeps `object-src` and `frame-ancestors` shut.
