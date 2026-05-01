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
- `npx ars doctor` reports the version metadata in `.ars/.ars-version.json` is stale relative to the installed runtime.
- The user reports the engine, studio, or plugin skills feel out of sync with the current package.

Do **not** run `update` to bootstrap a new repo. For first-time setup use `npx ars init <series>` / `npx -y agentic-remotion-studio init <series>` first, then launch `ars` and run `/ars:onboard` for customization. `update` requires a repo that has already been initialized.

## What it does

`npx ars update` performs these steps in order (see `cli/commands/update.ts`):

1. Resolves the installed ARS package as the source of truth (the package version currently linked under `node_modules/agentic-remotion-studio` or the global install).
2. Snapshots every ARS-owned path the next sync will touch into `.ars/backups/<YYYYMMDD-HHMMSS>/snapshot/` and writes a `manifest.json` describing the backup. Coverage = the same `package.json#files`-driven iterator that drives sync, plus the plugin-derived `.claude/skills/ars:*/`, `.claude/agents/`, and `.ars/hooks/scripts/` siblings. Only the latest **3 backups** are retained — older ones are pruned.
3. Refreshes ARS-owned source from the package: `src/engine/`, all other top-level `src/*` files (Root.tsx, studio-main.tsx, studio/**), root config files (`vite.studio.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `.env.example`, `remotion.config.ts`), CI workflow, and the entire `cli/` tree (so any new CLI command lands automatically).
4. Syncs plugin skills into `.claude/skills/ars:<name>/`.
5. Syncs agents into `.claude/agents/`.
6. Syncs hook scripts into `.ars/hooks/scripts/`.
7. Patches `.claude/settings.json` so Claude Code picks up the synced hooks.
8. Writes `.ars/.ars-version.json` with the runtime version, plugin version, config schema version, and detected install method.

It does **not** touch series content — `src/episodes/<series>/`, `public/episodes/<series>/`, `series-config.ts`, `SERIES_GUIDE.md`, and `.ars/config.json` are left alone (`src/episodes/template/` ships with ARS and is refreshed). The template public assets at `public/episodes/template/` are also refreshed.

It **does** overwrite ARS-owned scaffolding even when the user has customized it locally. Because `.claude/` is in the consumer-repo `.gitignore`, `git restore` cannot recover edits inside those directories — the manifest-driven snapshot in step 2 is the only way to revert customizations there. Use `npx ars rollback` (see Rollback below) to restore.

`CLAUDE.md` is left alone unless the user passes `--force` or `--force-claude-md`. Use those flags only when the repo's CLAUDE.md ARS block is known to be stale.

## Flags

- `--force` — refresh engine, support files, version metadata, **and** rebuild the ARS block in `CLAUDE.md`.
- `--force-engine` — refresh engine and version metadata only (default behavior already overwrites engine; this flag is for parity with `init`).
- `--force-claude-md` — rebuild the ARS block in `CLAUDE.md` only.
- `-q`, `--quiet` — suppress non-error output.

## Behavior in this skill

When the user invokes `/ars:update`:

1. Confirm the repo is initialized: check `.ars/config.json` exists. If it does not, tell the user to run `npx ars init <series>` instead — `update` is not a bootstrap command and `/ars:onboard` needs init output to exist first.
2. Run `npx ars update` from the repo root and surface the output verbatim.
3. After it completes, summarize:
   - the path of the new backup under `.ars/backups/<timestamp>/`
   - the timestamp directory under `.ars/backups/<timestamp>/` and the number of paths snapshotted
   - which categories were synced (engine, skills, agents, hook scripts)
   - whether `CLAUDE.md` was patched (only when `--force` or `--force-claude-md` was passed)
   - the rollback hint at the end (`To revert: npx ars rollback`)

## Rollback

Use `npx ars rollback`. It is cross-platform (pure Node — no shell), reads the manifest the update wrote, and restores every snapshotted path back into place.

```bash
# Roll back the most recent update
npx ars rollback

# See available backups (newest first) before choosing
npx ars rollback --list

# Roll back to a specific timestamp
npx ars rollback --to 2026-04-30T03-19-10.159Z

# Preview what would be restored without changing anything
npx ars rollback --dry-run
```

Notes:

- Backup coverage is now driven by the same `package.json#files`-based iterator that `npx ars update` uses for sync. That means every ARS-owned path the update touches is also in the snapshot — there is no longer a class of "support files NOT snapshotted, recover via git restore".
- Backups older than the latest 3 timestamp folders are deleted automatically on each `update` run. Tell the user to copy a backup elsewhere if they want to keep it long-term.
- Rollback only restores files on disk. The installed npm package version does not change — if the user wants to also pin to the previous package version, they must run `npm i agentic-remotion-studio@<previous-version>` themselves.
- Older backups created before manifest support was added do not have a `manifest.json`. `rollback` will refuse to touch them and ask the user to upgrade ARS or restore manually.

## Common follow-ups

After a successful update, suggest the user:

- Run `npx ars doctor` to confirm the repo is still healthy on the new version.
- Skim `git status` / `git diff` and commit the synced engine, skill, agent, and hook script changes as a single "chore: ars update" commit so the upgrade is reviewable later.
- Re-run `/ars:onboard` only if they want to revisit branding — `update` does not change brand or theme.
