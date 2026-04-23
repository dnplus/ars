import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { patchClaudeSettings } from '../lib/install';

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
