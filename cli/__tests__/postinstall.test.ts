import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const tempRoots: string[] = [];

function makeTempRoot(prefix: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

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
  });

  it('syncs plugin assets against INIT_CWD without bootstrapping the repo', async () => {
    const targetRoot = makeTempRoot('ars-postinstall-target-');
    const homeRoot = makeTempRoot('ars-postinstall-home-');
    vi.stubEnv('INIT_CWD', targetRoot);
    vi.stubEnv('HOME', homeRoot);

    const { postinstallCommand } = await import('../commands/postinstall');
    const result = await postinstallCommand();

    expect(result).toMatchObject({
      skipped: false,
      root: targetRoot,
    });
    expect(fs.existsSync(path.join(targetRoot, '.ars', 'config.json'))).toBe(false);
    expect(fs.existsSync(path.join(homeRoot, '.claude', 'settings.json'))).toBe(false);
  });
});
