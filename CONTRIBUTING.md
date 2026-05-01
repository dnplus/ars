# Contributing to ARS

Thanks for helping improve ARS. This project is a Claude Code plugin, CLI, generated repo template, and Remotion engine bundle, so small-looking changes can affect installed content repos. Please keep PRs focused and easy to review.

## Before You Start

- Use Node.js `>= 22.12.0`.
- Run `npm install` from the ARS source checkout.
- Prefer one logical change per PR.
- Open an issue or discussion first for broad workflow, schema, generated repo, or public API changes.

## Pull Request Expectations

Every PR should include:

- a short problem statement
- a clear summary of changed behavior
- screenshots or Studio notes for UI changes
- migration notes when generated repos, `.ars/` state, skills, hooks, or CLI behavior changes
- verification commands that were run

Keep unrelated formatting, generated output, local cache files, and dogfood episode changes out of source PRs.

## Agent-Authored PRs

If an agent prepares the PR, it should follow the project contract in [AGENTS.md](./AGENTS.md) and include an auditable PR body:

```markdown
## Summary
- ...

## Compatibility / Migration
- Release-sensitive surfaces touched:
- Migration decision:

## Verification
- [ ] npm run lint
- [ ] npm run build:studio
- [ ] npm test
- [ ] npx ars episode validate template/ep-demo
- [ ] npm pack --dry-run (when package/release surface changed)

## Notes
- Screenshots / Studio notes:
- Known risks:
```

Agents should not publish to npm, create public release tags, or push release tags without explicit maintainer confirmation.

## Compatibility Rules

Treat these as release-sensitive surfaces:

- `ars init`, `ars update`, `ars studio`, `ars prepare`, `ars publish`
- `.ars/config.json`, `.ars/version.json`, workstate, and Studio intent schemas
- `src/engine/shared/types.ts`
- card `spec.ts` and registry contracts
- generated support files copied by `syncEngineFiles`
- plugin skills, agents, hooks, and statusline scripts
- npm package `files` allowlist

If your PR changes one of these surfaces, say whether `ars update` needs a migration. If a deterministic migration is possible, prefer implementing it over relying on release notes.

## Verification

Run the baseline before requesting review:

```bash
npm run lint
npm run build:studio
npm test
npx ars episode validate template/ep-demo
```

For package or release-surface changes, also run:

```bash
npm pack --dry-run
```

For new card types, also verify:

```bash
npx ars episode stats template --all
```

and include a template episode step that renders the card.

## Code Style

- Follow existing patterns before adding new abstractions.
- Keep core engine cards independent from `src/episodes/`.
- Do not import `src/engine/shared/card-catalog.ts` into browser/Remotion code.
- Do not import `src/engine/cards/registry.ts` into CLI/Node code.
- Avoid new dependencies unless the PR explains why the existing stack is insufficient.

## Skill Changes

Skills are part of the shipped product. For changes under `plugin/skills/`:

- keep instructions concise and operational
- avoid stale examples that mention removed commands
- update related docs when the workflow changes
- run `npm test`, because skill-surface tests guard important prompt contracts

## Release Notes

Contributors do not need to publish releases. Maintainers handle version bumps, tags, and npm publishing through the release process in [docs/release-process.md](./docs/release-process.md).
