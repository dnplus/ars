import path from 'path';
import { describe, expect, it } from 'vitest';
import { iterArsOwnedFiles, isArsOwnedPath } from '../lib/sync-paths';

const repoRoot = path.resolve(__dirname, '../..');

describe('iterArsOwnedFiles (single source of truth: package.json#files)', () => {
  const owned = iterArsOwnedFiles(repoRoot);
  const ownedPaths = new Set(owned.map((entry) => entry.relPath));

  it('includes every CLI command file so a new command auto-syncs to consumer repos', () => {
    // The whole point of the refactor: dropping a new file under cli/commands/
    // should land in consumers via `npx ars update` without anyone having to
    // touch the install allow-list.
    expect(ownedPaths.has('cli/commands/init.ts')).toBe(true);
    expect(ownedPaths.has('cli/commands/update.ts')).toBe(true);
    expect(ownedPaths.has('cli/commands/episode.ts')).toBe(true);
    expect(ownedPaths.has('cli/commands/analytics.ts')).toBe(true);
    expect(ownedPaths.has('cli/commands/workstate.ts')).toBe(true);
  });

  it('includes the CLI entry point and lib helpers', () => {
    expect(ownedPaths.has('cli/index.ts')).toBe(true);
    expect(ownedPaths.has('cli/lib/install.ts')).toBe(true);
    expect(ownedPaths.has('cli/lib/sync-paths.ts')).toBe(true);
    expect(ownedPaths.has('cli/lib/youtube-client.ts')).toBe(true);
    expect(ownedPaths.has('cli/lib/context.ts')).toBe(true);
  });

  it('includes engine source and root support files', () => {
    expect(ownedPaths.has('src/Root.tsx')).toBe(true);
    expect(ownedPaths.has('vite.studio.config.ts')).toBe(true);
    expect(ownedPaths.has('tsconfig.json')).toBe(true);
    expect(ownedPaths.has('eslint.config.mjs')).toBe(true);
    expect(ownedPaths.has('.env.example')).toBe(true);
    expect(ownedPaths.has('.github/workflows/ci.yml')).toBe(true);
  });

  it('includes the template series carve-back-in even though src/episodes/ is excluded', () => {
    // src/episodes/ is in SYNC_EXCLUDES (user content), but template/ is the
    // ARS-shipped reference series and must still ship via init/update.
    const templateFiles = owned.filter((entry) =>
      entry.relPath.startsWith('src/episodes/template/'),
    );
    expect(templateFiles.length).toBeGreaterThan(0);
    expect(ownedPaths.has('src/episodes/template/series-config.ts')).toBe(true);
    expect(ownedPaths.has('src/episodes/template/episode.template.ts')).toBe(true);
  });

  it('includes the template public assets carve-back-in', () => {
    // public/episodes/ is excluded as user content; only template/ subtree ships.
    const templatePublicAssets = owned.filter((entry) =>
      entry.relPath.startsWith('public/episodes/template/'),
    );
    expect(templatePublicAssets.length).toBeGreaterThan(0);
  });

  it('NEVER includes dev-only test infrastructure', () => {
    // These ship in the npm tarball so source maps and tsc work, but consumers
    // run their own tests and must not receive ARS test fixtures.
    const dev = owned.filter((entry) => {
      return /^(cli|src)\/(?:__tests__|__fixtures__|test-utils)\//.test(entry.relPath);
    });
    expect(dev).toEqual([]);
  });

  it('NEVER includes the package-relative plugin/ directory (it goes to .claude/ via dedicated syncs)', () => {
    const plugin = owned.filter((entry) => entry.relPath.startsWith('plugin/'));
    expect(plugin).toEqual([]);
  });

  it('NEVER includes any non-template episodes', () => {
    // The exclude+override pair must shield user content. If anything under
    // src/episodes/ that is NOT template/ leaks in, syncEngineFiles would
    // overwrite a consumer's series on every update — that is the catastrophic
    // case this whole refactor is built to prevent.
    const leaked = owned.filter(
      (entry) =>
        entry.relPath.startsWith('src/episodes/') &&
        !entry.relPath.startsWith('src/episodes/template/'),
    );
    expect(leaked).toEqual([]);
  });

  it('categorises src/engine/* as engine and everything else as support', () => {
    for (const entry of owned) {
      if (entry.relPath.startsWith('src/engine/')) {
        expect(entry.category).toBe('engine');
      } else {
        expect(entry.category).toBe('support');
      }
    }
  });

  it('isArsOwnedPath agrees with the iterator for both included and excluded paths', () => {
    expect(isArsOwnedPath(repoRoot, 'cli/commands/init.ts')).toBe(true);
    expect(isArsOwnedPath(repoRoot, 'cli/__tests__/install.test.ts')).toBe(false);
    expect(isArsOwnedPath(repoRoot, 'src/engine/Composition.tsx')).toBe(true);
    expect(isArsOwnedPath(repoRoot, 'src/episodes/template/series-config.ts')).toBe(true);
    expect(isArsOwnedPath(repoRoot, 'src/episodes/some-user-series/ep001.ts')).toBe(false);
  });
});
