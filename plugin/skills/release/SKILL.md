---
name: ars:release
description: Prepare and verify an ARS package release, including semver choice, migration notes, release gate, npm dist-tag guidance, and tag/publish safety checks.
argument-hint: "[patch|minor|major|prerelease|0.x.y]"
model: claude-sonnet-4-6
effort: medium
---

Use this skill when the user wants to cut, prepare, verify, or reason about an ARS release.

## Source of truth

Read `docs/release-process.md` first. It defines the public version policy, release-sensitive compatibility surface, release gate, and npm dist-tag rules.

Read `CONTRIBUTING.md` when preparing a release from merged PRs or checking whether a contributor change included the expected verification and migration notes.

Read `AGENTS.md` when merged changes were agent-authored. Agent PRs should include compatibility, migration, verification, Studio notes, and known-risk evidence.

Also inspect:

- `package.json`
- `package-lock.json`
- `plugin/.claude-plugin/plugin.json`
- `git status --short --branch`
- `git tag --list --sort=-v:refname`
- commits since the latest relevant tag

## Default policy

- Current public beta line: `0.1.x`.
- First public open-source version: `0.1.0`.
- During `0.x`, breaking workflow or generated-repo changes bump the minor version.
- Use npm `next` for beta/dogfood prereleases.
- Use npm `latest` only when the README recommends npm as the primary install path.

## Workflow

1. Refuse to release from a dirty tree unless the dirty files are exactly the release edits being prepared and the user asked you to make them.
2. Identify the latest tag. If no tag exists, compare against the initial public baseline or the user's chosen baseline.
3. Review commits since the baseline and classify the bump:
   - `patch`: fixes, docs, skill wording, package surface corrections with no migration.
   - `minor`: new CLI/Studio/card/generated-repo capability, or any `0.x` breaking workflow contract change.
   - `major`: post-`1.0` breaking changes only.
   - `prerelease`: beta or release candidate, usually published with `--tag next`.
4. Check whether `ars update` needs a migration:
   - generated support files changed
   - `.ars/config.json`, workstate, Studio intent, or `.ars/version.json` shape changed
   - copied engine/Studio/skill/hook files need consumer repo refresh
5. For merged contributor PRs, confirm the PR met `CONTRIBUTING.md` expectations or document the maintainer follow-up:
   - focused scope
   - migration decision for release-sensitive surfaces
   - verification evidence
   - Studio notes/screenshots for UI changes
   - agent-authored PR body follows `AGENTS.md`
6. Update versions consistently:
   - `package.json`
   - `package-lock.json`
   - `plugin/.claude-plugin/plugin.json`
7. Draft release notes with:
   - Summary
   - Added
   - Changed
   - Fixed
   - Migration
   - Verification
   - Known risks
8. Run the release gate:

   ```bash
   npm run lint
   npm run build:studio
   npm test
   npx ars episode validate template/ep-demo
   npm pack --dry-run
   ```

9. Inspect `npm pack --dry-run` output. Confirm the tarball includes CLI/plugin/template/runtime files and excludes repo-local artifacts such as `.ars/`, `.codex/`, `.cache/`, `output/`, and local tests.
10. Ask for explicit confirmation before `npm publish`, `git tag`, or pushing tags. These are public release actions.

## Commands

Use exact version when the user already chose it:

```bash
npm version 0.1.0 --no-git-tag-version
```

Use prerelease for beta candidates:

```bash
npm version prerelease --preid beta --no-git-tag-version
```

Publish channels:

```bash
npm publish --tag next
npm publish --tag latest
```

Do not publish automatically. Show the command and wait for explicit user confirmation.

## Output

Report:

- chosen version and bump reason
- changed version files
- migration decision
- release gate results
- recommended npm tag
- exact next command for tag/publish, if the user wants to proceed
