import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const execFileSync = vi.fn();
const spawnSync = vi.fn(() => ({ status: 0 }));
const spawn = vi.fn(() => ({
  on: vi.fn(),
  kill: vi.fn(),
}));

vi.mock('child_process', () => ({
  execFileSync,
  spawnSync,
  spawn,
}));

const tempRoots: string[] = [];

function makePluginRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ars-launch-test-'));
  fs.mkdirSync(path.join(root, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ version: '1.0.0' }),
  );
  tempRoots.push(root);
  return root;
}

beforeEach(() => {
  vi.resetModules();
  execFileSync.mockReset();
  spawn.mockReset();
  spawn.mockImplementation(() => ({
    on: vi.fn(),
    kill: vi.fn(),
  }));
  execFileSync.mockImplementation((command: string, args?: string[]) => {
    if (command === 'tmux' && args?.[0] === '-V') {
      return 'tmux 3.4';
    }
    if (command === 'git') {
      return 'main\n';
    }
    return '';
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock('../lib/runtime-package');
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

describe('launch command', () => {
  it('injects --plugin-dir when missing', async () => {
    const pluginRoot = makePluginRoot();
    vi.doMock('../lib/runtime-package', () => ({
      getRuntimePackageInfo: () => ({
        version: '1.0.0',
        packageRoot: '/tmp/pkg',
        pluginRoot,
      }),
    }));

    const { normalizeClaudeLaunchArgs } = await import('../commands/launch');
    expect(normalizeClaudeLaunchArgs(['--print', 'hello'], { pluginRoot })).toEqual([
      '--plugin-dir',
      pluginRoot,
      '--print',
      'hello',
    ]);
  });

  it('uses direct claude exec for print mode', async () => {
    const pluginRoot = makePluginRoot();
    vi.doMock('../lib/runtime-package', () => ({
      getRuntimePackageInfo: () => ({
        version: '1.0.0',
        packageRoot: '/tmp/pkg',
        pluginRoot,
      }),
    }));

    const { launchCommand } = await import('../commands/launch');
    await launchCommand(['--print', 'hello']);

    expect(execFileSync).toHaveBeenCalledWith(
      'claude',
      ['--plugin-dir', pluginRoot, '--print', 'hello'],
      expect.objectContaining({ stdio: 'inherit' }),
    );
    expect(
      execFileSync.mock.calls.some(
        ([command, args]) => command === 'tmux' && Array.isArray(args) && args[0] === 'new-session',
      ),
    ).toBe(false);
  });

  it('uses current tmux pane when already inside tmux', async () => {
    const pluginRoot = makePluginRoot();
    vi.stubEnv('TMUX', '/tmp/socket');
    vi.doMock('../lib/runtime-package', () => ({
      getRuntimePackageInfo: () => ({
        version: '1.0.0',
        packageRoot: '/tmp/pkg',
        pluginRoot,
      }),
    }));

    const { launchCommand } = await import('../commands/launch');
    await launchCommand(['hello']);

    expect(execFileSync.mock.calls[0]?.[0]).toBe('tmux');
    expect(execFileSync).toHaveBeenCalledWith(
      'claude',
      ['--plugin-dir', pluginRoot],
      expect.objectContaining({ stdio: 'inherit' }),
    );
    expect(spawn).toHaveBeenCalled();
  });
});
