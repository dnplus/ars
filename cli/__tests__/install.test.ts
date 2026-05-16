import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { backupArsAssets, patchClaudeSettings, syncSkills } from '../lib/install';

const tempRoots: string[] = [];

function makeTempRoot(prefix: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

describe('patchClaudeSettings', () => {
  it('installs a repo-local ARS statusline and preserves non-ARS hooks', () => {
    const root = makeTempRoot('ars-install-');
    const claudeDir = path.join(root, '.claude');
    const settingsPath = path.join(claudeDir, 'settings.json');

    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      settingsPath,
      `${JSON.stringify({
        statusLine: {
          type: 'command',
          command: 'node "./existing-statusline.mjs"',
        },
        SessionStart: [
          {
            matcher: '*',
            hooks: [
              { type: 'command', command: 'node ".ars/hooks/scripts/session-start.mjs"', timeout: 5 },
            ],
          },
          {
            matcher: 'custom',
            hooks: [
              { type: 'command', command: 'node "./keep-me.mjs"', timeout: 1 },
            ],
          },
        ],
      }, null, 2)}\n`,
      'utf-8',
    );

    patchClaudeSettings({ root });

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as Record<string, unknown>;
    expect(settings.statusLine).toEqual({
      type: 'command',
      command: 'node ".ars/hooks/scripts/ars-statusline.mjs"',
    });
    expect(
      JSON.parse(
        fs.readFileSync(path.join(root, '.ars', 'hooks', 'ars-statusline-config.json'), 'utf-8'),
      ),
    ).toMatchObject({
      delegate: 'node "./existing-statusline.mjs"',
      arsVersion: '',
    });

    const sessionStart = settings.SessionStart as Array<Record<string, unknown>>;
    expect(sessionStart).toHaveLength(2);
    expect(sessionStart[0]).toEqual({
      matcher: '*',
      hooks: [
        { type: 'command', command: 'node ".ars/hooks/scripts/session-start.mjs"', timeout: 5 },
      ],
    });
    expect(sessionStart[1]).toEqual({
      matcher: 'custom',
      hooks: [
        { type: 'command', command: 'node "./keep-me.mjs"', timeout: 1 },
      ],
    });

    const stopHooks = settings.Stop as Array<Record<string, unknown>>;
    expect(stopHooks[0]).toEqual({
      matcher: '*',
      hooks: [
        { type: 'command', command: 'node ".ars/hooks/scripts/studio-intent-stop.mjs"', timeout: 3 },
      ],
    });
  });
});

describe('syncSkills', () => {
  it('syncs episode-check into the repo-scoped Claude Code skill namespace', () => {
    const root = makeTempRoot('ars-sync-skills-');
    const pluginRoot = path.join(path.resolve(__dirname, '../..'), 'plugin');

    const installed = syncSkills({ root, pluginRoot, overwrite: true });

    expect(installed).toContain('episode-check');
    expect(
      fs.readFileSync(
        path.join(root, '.claude', 'skills', 'ars:episode-check', 'SKILL.md'),
        'utf-8',
      ),
    ).toContain('name: ars:episode-check');
  });
});

describe('backupArsAssets', () => {
  function seedFile(filePath: string, contents: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents, 'utf-8');
  }

  it('snapshots plugin-derived paths into snapshot/<targetRelPath> with a manifest', () => {
    const root = makeTempRoot('ars-backup-');
    seedFile(path.join(root, 'src', 'engine', 'marker.txt'), 'engine');
    // Each plugin skill lives at `.claude/skills/ars:<name>/SKILL.md`; the
    // backup walks every `ars:*` sibling under .claude/skills/.
    seedFile(path.join(root, '.claude', 'skills', 'ars:onboard', 'SKILL.md'), '# customised');
    seedFile(path.join(root, '.claude', 'skills', 'ars:plan', 'SKILL.md'), '# plan-customised');
    // A non-ARS skill must NOT leak into the backup.
    seedFile(path.join(root, '.claude', 'skills', 'other', 'SKILL.md'), '# unrelated');
    seedFile(path.join(root, '.claude', 'agents', 'planner.md'), '# planner');
    seedFile(path.join(root, '.ars', 'hooks', 'scripts', 'session-start.mjs'), 'export {}');

    // Without sourceRoot, only plugin-derived paths get snapshotted (engine
    // requirement is satisfied by the seed file existing on disk; the
    // package-mirror coverage is the sourceRoot path tested elsewhere).
    const result = backupArsAssets({ root });

    // Manifest file lives at the timestamp root and lists every snapshotted entry.
    expect(fs.existsSync(result.manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf-8'));
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.source).toBe('update');

    const targetPaths = new Set(manifest.entries.map((e: { targetRelPath: string }) => e.targetRelPath));
    expect(targetPaths.has('.claude/skills/ars:onboard')).toBe(true);
    expect(targetPaths.has('.claude/skills/ars:plan')).toBe(true);
    expect(targetPaths.has('.claude/agents')).toBe(true);
    expect(targetPaths.has('.ars/hooks/scripts')).toBe(true);
    // Non-ARS skill must not be in the manifest.
    expect(targetPaths.has('.claude/skills/other')).toBe(false);

    // Snapshot copies live under <timestampDir>/snapshot/<targetRelPath>/.
    expect(
      fs.readFileSync(
        path.join(result.timestampDir, 'snapshot', '.claude', 'skills', 'ars:onboard', 'SKILL.md'),
        'utf-8',
      ),
    ).toBe('# customised');
    expect(
      fs.readFileSync(
        path.join(result.timestampDir, 'snapshot', '.claude', 'agents', 'planner.md'),
        'utf-8',
      ),
    ).toBe('# planner');

    // entryCount agrees with the manifest length.
    expect(result.entryCount).toBe(manifest.entries.length);
  });

  it('skips optional asset roots that do not exist yet without crashing', () => {
    const root = makeTempRoot('ars-backup-partial-');
    seedFile(path.join(root, 'src', 'engine', 'marker.txt'), 'engine-only');

    const result = backupArsAssets({ root });

    // Manifest exists even when only engine seeded.
    expect(fs.existsSync(result.manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf-8'));
    expect(manifest.entries).toEqual([]); // no plugin-derived paths existed yet
  });

  it('throws when src/engine/ is missing because the repo was never initialized', () => {
    const root = makeTempRoot('ars-backup-uninit-');
    expect(() => backupArsAssets({ root })).toThrow(/Run "npx ars init/);
  });
});
