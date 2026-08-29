# Contributing

Thanks for helping build the open editor and renderer. Bug reports, fixes, and new visual
features are all welcome.

## Before you start

- For a bug, open an issue with steps to reproduce, what you expected, and what happened.
- For a feature or a larger change, open an issue first so we agree on the shape before you
  write code.

## Setup

```sh
pnpm install
pnpm -C apps/vcs-editor-service dev        # render API on :3000
pnpm -C apps/vcs-editor-service web:dev     # editor UI on :5180
```

## The rules that keep this repo honest

- **Preview equals render.** A composition renders in the browser (`<Player>`) and headless
  (`renderMedia`) from the same code. Prove parity before you claim a fast-lane `supports()`.
- **Validate at the boundary.** Every render goes through `parseEditDoc`. A bad document is a
  400, not a mid-render crash.
- **Keep `@remotion/*` isolated.** They import only in `remotion-driver.ts` and
  `remotion-entry.ts`, so a license-free backend stays a drop-in swap.
- **New visual features are layers,** added to a composition, not one-off render paths.

## Pull requests

Keep a PR to one thing. Match the surrounding style. Say what changed, why, and how you tested
it. Run `pnpm -r typecheck` before you push. By opening a PR you agree your contribution is
licensed under the repository's MIT license.
