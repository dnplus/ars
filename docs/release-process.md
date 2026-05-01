# ARS Release Process

ARS is versioned as a CLI, Claude Code plugin, generated repo template, and Remotion engine bundle. A release is only ready when those surfaces can be installed, updated, and verified together.

Contributor PR rules live in `CONTRIBUTING.md`. Agent-authored PR rules live in `AGENTS.md`. This document is the maintainer release process.

## Current Channel

The first public open-source line is `0.1.x`.

- `0.1.0` is the first public beta.
- `0.1.x` is for fixes that keep the same public beta contract.
- `0.2.0` is for meaningful workflow, CLI, Studio, engine, card, or generated-repo capability changes.
- Stay on `0.x` until source install is no longer the primary documented path and `ars init` / `ars update` are stable enough for normal users.

If `1.0.0` was never published to npm, do not keep the local package at `1.0.0`. Use `0.1.0` for the public beta line.

## Semver Rules

Use SemVer, but define compatibility by ARS user workflows rather than TypeScript imports alone.

Patch releases:

- bug fixes in CLI, Studio, skills, hooks, or engine rendering
- docs and skill wording that do not change required workflow
- package surface fixes that do not require migration
- small UI polish that does not change generated repo contracts

Minor releases during `0.x`:

- new CLI commands or flags
- new Studio workflow surfaces
- new card capabilities or generated template behavior
- changes to generated repo files that users receive through `ars update`
- any breaking workflow or generated-repo contract change before `1.0`

Major releases:

- reserve for post-`1.0` breaking changes.

Prereleases:

- use `0.x.y-beta.N` with npm `next` when dogfooding a release candidate.
- promote to a stable `0.x.y` only after the release gate passes on a clean tree.

## Compatibility Surface

Treat these as release-sensitive:

- `ars init`, `ars update`, `ars studio`, `ars prepare`, `ars publish`
- `.ars/config.json`, `.ars/.ars-version.json`, workstate, and Studio intent schemas
- `src/engine/shared/types.ts`
- card `spec.ts` and registry contracts
- generated support files copied by `syncEngineFiles`
- plugin skills, agents, hooks, and statusline scripts
- package `files` allowlist and npm tarball contents

If a change modifies any of these, the release notes must include either "No migration required" or explicit migration steps.

## Release Gate

Run this gate before tagging or publishing:

```bash
npm run lint
npm run build:studio
npm test
npx ars episode validate template/ep-demo
npm pack --dry-run
```

`npm pack --dry-run` is required because ARS ships a curated runtime surface. Check that the tarball includes CLI/plugin/template/runtime assets and excludes repo-local artifacts like `.ars/`, `.codex/`, tests not meant for consumers, local outputs, and internal caches.

## PR Merge Gate

Before merging a contributor PR, check:

- the PR has a focused scope and explains changed behavior
- release-sensitive surfaces list a migration decision
- UI changes include screenshots or Studio notes
- the verification baseline from `CONTRIBUTING.md` passed
- package-surface changes include `npm pack --dry-run`
- generated repo changes are supported by `ars update` when possible
- agent-authored PRs follow the `AGENTS.md` PR body and boundary rules

Do not require every contributor to understand npm publishing. Version bumps, tags, dist-tags, and release notes stay maintainer-owned unless the PR is explicitly a release PR.

## Dist Tags

Use two npm channels:

- `next` for beta or dogfood releases
- `latest` for the recommended stable release

Examples:

```bash
npm version prerelease --preid beta
npm publish --tag next
```

```bash
npm version patch
npm publish --tag latest
git push --follow-tags
```

For the first public beta, use `0.1.0`. Publish with `next` unless the README install path has been updated to recommend npm directly.

## Release Notes

Every release should include:

- Summary
- Added
- Changed
- Fixed
- Migration
- Verification
- Known risks

For `Migration`, write `No migration required.` only after checking whether `ars update` needs a state or file migration.

## `ars update` Responsibility

When a release changes generated repo state or copied support files, prefer implementing the upgrade in `ars update`.

Use `ars update` for:

- refreshing engine, Studio, skills, agents, hook scripts, and support files
- normalizing old workstate or Studio intent data
- writing `.ars/.ars-version.json`
- printing rollback instructions for snapshotted assets

Do not rely on release notes alone when a deterministic migration can be implemented safely.
