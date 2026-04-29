---
name: ars:update
description: Upgrade an already-bootstrapped ARS repo to the installed package version with `npx ars update`, including backup and rollback steps.
model: claude-haiku-4-5-20251001
effort: low
---

`/ars:update` is the post-install upgrade flow. Use it whenever a consumer repo needs to pick up a newer ARS engine, plugin skills, agents, or hook scripts after the npm package is bumped.

## When to run

Run `npx ars update` when any of these are true:

- The user upgraded the npm package (`npm i agentic-remotion-studio@latest` or equivalent global install).
- A new ARS release adds engine files, support files, skills, agents, or hook scripts that the repo does not have yet.
- `npx ars doctor` reports the version metadata in `.ars/version.json` is stale relative to the installed runtime.
- The user reports the engine, studio, or plugin skills feel out of sync with the current package.

Do **not** run `update` to bootstrap a new repo. For first-time setup use `/ars:onboard` (interactive) or `npx ars init <series>` / `npx -y agentic-remotion-studio init <series>` (deterministic). `update` requires a repo that has already been initialized.

## What it does

`npx ars update` performs these steps in order (see `cli/commands/update.ts`):

1. Resolves the installed ARS package as the source of truth (the package version currently linked under `node_modules/agentic-remotion-studio` or the global install).
2. Backs up the current `src/engine/` directory into `.ars/backups/<YYYYMMDD-HHMMSS>/engine`. Only the latest **3 backups** are retained — older ones are pruned.
3. Refreshes `src/engine/` from the package and overwrites ARS-owned support files (e.g. `src/studio-main.tsx`, `src/studio/**`, `vite.studio.config.ts`, `tsconfig.json`). These are always overwritten on update so studio entrypoints don't drift.
4. Syncs plugin skills into `.claude/skills/ars/`.
5. Syncs agents into `.claude/agents/`.
6. Syncs hook scripts into `.ars/hooks/scripts/`.
7. Patches `.claude/settings.json` so Claude Code picks up the synced hooks.
8. Writes `.ars/version.json` with the runtime version, plugin version, config schema version, and detected install method.

It does **not** touch `src/episodes/`, `public/episodes/`, `series-config.ts`, `SERIES_GUIDE.md`, `.ars/config.json`, or any user content. Only ARS-owned scaffolding is replaced.

`CLAUDE.md` is left alone unless the user passes `--force` or `--force-claude-md`. Use those flags only when the repo's CLAUDE.md ARS block is known to be stale.

## Flags

- `--force` — refresh engine, support files, version metadata, **and** rebuild the ARS block in `CLAUDE.md`.
- `--force-engine` — refresh engine and version metadata only (default behavior already overwrites engine; this flag is for parity with `init`).
- `--force-claude-md` — rebuild the ARS block in `CLAUDE.md` only.
- `-q`, `--quiet` — suppress non-error output.

## Behavior in this skill

When the user invokes `/ars:update`:

1. Confirm the repo is initialized: check `.ars/config.json` exists. If it does not, tell the user to run `/ars:onboard` or `npx ars init <series>` instead — `update` is not a bootstrap command.
2. Run `npx ars update` from the repo root and surface the output verbatim.
3. After it completes, summarize:
   - the path of the new backup under `.ars/backups/<timestamp>/engine`
   - which categories were synced (engine, skills, agents, hook scripts)
   - whether `CLAUDE.md` was patched (only when `--force` or `--force-claude-md` was passed)
   - the rollback hint (see below)
4. If the user asks for a dry run or wants to see what changed, point them at `git diff` on `src/engine/` and `.claude/` after the command runs — `update` does not have a dry-run mode of its own.

## Rollback

`npx ars update` does not have an `undo` subcommand. To roll back, restore the most recent backup manually. The command itself prints the exact two lines to use; reproduce them when telling the user how to revert:

```bash
rm -rf "<repo>/src/engine"
cp -R "<repo>/.ars/backups/<timestamp>/engine" "<repo>/src/engine"
```

Notes:

- Only `src/engine/` is backed up. Skills, agents, hook scripts, support files (e.g. `vite.studio.config.ts`), and `.ars/version.json` are **not** snapshotted before update. If the user needs to revert those, recover them from git history (`git restore` / `git checkout <ref> -- <path>`).
- Backups older than the latest 3 are deleted automatically on each `update` run. Tell the user to copy a backup elsewhere if they want to keep it long-term.
- Rollback only restores engine code on disk. The installed npm package version does not change — if the user wants to also pin to the previous package version, they must run `npm i agentic-remotion-studio@<previous-version>` themselves.

## Common follow-ups

After a successful update, suggest the user:

- Run `npx ars doctor` to confirm the repo is still healthy on the new version.
- Skim `git status` / `git diff` and commit the synced engine, skill, agent, and hook script changes as a single "chore: ars update" commit so the upgrade is reviewable later.
- Re-run `/ars:onboard` only if they want to revisit branding — `update` does not change brand or theme.
