import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const setupCommand = vi.fn();

vi.mock('../commands/setup', () => ({
  setupCommand,
}));

const tempRoots: string[] = [];

function makeTempRoot(prefix: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

beforeEach(() => {
  setupCommand.mockReset();
  setupCommand.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

describe('postinstallCommand', () => {
  it('skips when ARS_SKIP_POSTINSTALL=1', async () => {
    vi.stubEnv('ARS_SKIP_POSTINSTALL', '1');
    const { postinstallCommand } = await import('../commands/postinstall');
    const result = await postinstallCommand();

    expect(result.skipped).toBe(true);
    expect(setupCommand).not.toHaveBeenCalled();
  });

  it('runs setup against INIT_CWD', async () => {
    const targetRoot = makeTempRoot('ars-postinstall-target-');
    vi.stubEnv('INIT_CWD', targetRoot);

    const { postinstallCommand } = await import('../commands/postinstall');
    const result = await postinstallCommand();

    expect(result).toMatchObject({
      skipped: false,
      root: targetRoot,
    });
    expect(setupCommand).toHaveBeenCalledWith({
      root: targetRoot,
      force: false,
      forceEngine: false,
      forceConfig: false,
      forceClaudeMd: false,
      yes: true,
      quiet: true,
    });
  });
});
