<!--
Keep this short. A few well-written bullets beat a wall of checked boxes.
Delete any section that does not apply.
-->

## What and why

<!-- What changed, and what problem it solves. The diff shows the "what" on its
     own, so spend the words on the "why". -->

-

Fixes #

## How you verified it

<!-- Reproducible signal, not "looks fine". Paste the command, the failing input
     that now passes, the log line, whatever you actually ran. -->

-

- [ ] `pnpm validate` passes (typecheck, lint, format, electron typecheck, both test projects)
- [ ] `pnpm validate:full` passes, or this PR does not touch the build
- [ ] new logic in `lib/` has tests in `tests/unit/`

## Platforms exercised

<!-- Only if the change can behave differently per platform (electron main,
     packaging, native networking). Skip it otherwise. -->

- [ ] macOS
- [ ] Windows
- [ ] Linux
- [ ] Web

## Anything a reviewer should know

<!-- Breaking changes, follow-up work you deliberately left out, decisions you
     are unsure about, screenshots for UI changes. -->
