import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { backupArsAssets, patchClaudeSettings } from '../lib/install';

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

describe('backupArsAssets', () => {
  function seedFile(filePath: string, contents: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents, 'utf-8');
  }

  it('snapshots engine plus .claude skills/agents and hook scripts into one timestamp directory', () => {
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

    const result = backupArsAssets(root);

    expect(fs.readFileSync(path.join(result.engineDir, 'marker.txt'), 'utf-8')).toBe('engine');
    expect(result.claudeSkillsDir).toBeDefined();
    expect(
      fs.readFileSync(path.join(result.claudeSkillsDir!, 'ars:onboard', 'SKILL.md'), 'utf-8'),
    ).toBe('# customised');
    expect(
      fs.readFileSync(path.join(result.claudeSkillsDir!, 'ars:plan', 'SKILL.md'), 'utf-8'),
    ).toBe('# plan-customised');
    expect(fs.existsSync(path.join(result.claudeSkillsDir!, 'other'))).toBe(false);
    expect(result.claudeAgentsDir).toBeDefined();
    expect(
      fs.readFileSync(path.join(result.claudeAgentsDir!, 'planner.md'), 'utf-8'),
    ).toBe('# planner');
    expect(result.hookScriptsDir).toBeDefined();
    expect(
      fs.readFileSync(path.join(result.hookScriptsDir!, 'session-start.mjs'), 'utf-8'),
    ).toBe('export {}');

    // All snapshots live in the same timestamp folder so rollback hints stay coherent.
    expect(result.engineDir.startsWith(result.timestampDir)).toBe(true);
    expect(result.claudeSkillsDir!.startsWith(result.timestampDir)).toBe(true);
    expect(result.claudeAgentsDir!.startsWith(result.timestampDir)).toBe(true);
    expect(result.hookScriptsDir!.startsWith(result.timestampDir)).toBe(true);
  });

  it('skips optional asset roots that do not exist yet without crashing', () => {
    const root = makeTempRoot('ars-backup-partial-');
    seedFile(path.join(root, 'src', 'engine', 'marker.txt'), 'engine-only');

    const result = backupArsAssets(root);

    expect(fs.existsSync(result.engineDir)).toBe(true);
    expect(result.claudeSkillsDir).toBeUndefined();
    expect(result.claudeAgentsDir).toBeUndefined();
    expect(result.hookScriptsDir).toBeUndefined();
  });

  it('throws when src/engine/ is missing because the repo was never initialized', () => {
    const root = makeTempRoot('ars-backup-uninit-');
    expect(() => backupArsAssets(root)).toThrow(/Run "npx ars init/);
  });
});
