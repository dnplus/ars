import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../..');
const tempRoots: string[] = [];

function makeTempRoot(prefix: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function makeConsumerRepo(): string {
  const tempRoot = makeTempRoot('ars-workstate-');
  const repoDir = path.join(tempRoot, 'repo');
  fs.mkdirSync(repoDir, { recursive: true });
  fs.writeFileSync(
    path.join(repoDir, 'package.json'),
    `${JSON.stringify({ name: 'ars-consumer-test', private: true }, null, 2)}\n`,
    'utf-8',
  );
  fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(repoDir, 'node_modules'), 'junction');
  return repoDir;
}

function runCli(repoDir: string, args: string[]): string {
  return execFileSync('node', ['--import', 'tsx', path.join(repoRoot, 'cli', 'index.ts'), ...args], {
    cwd: repoDir,
    encoding: 'utf-8',
    env: {
      ...process.env,
      ARS_SKIP_REMOTION_SKILL_INSTALL: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

describe('npx ars workstate', () => {
  it('stamp --field customized writes project.customizedAt without touching the workstate stage', () => {
    const repoDir = makeConsumerRepo();
    runCli(repoDir, ['init', 'demo-series', '--yes']);
    runCli(repoDir, ['workstate', 'set', '--stage', 'onboard-customize']);

    const before = JSON.parse(
      fs.readFileSync(path.join(repoDir, '.ars', 'config.json'), 'utf-8'),
    );
    expect(before.project.customizedAt).toBeUndefined();
    expect(before.project.onboardedAt).toBeUndefined();

    const output = runCli(repoDir, ['workstate', 'stamp', '--field', 'customized']);
    expect(output).toMatch(/customizedAt = /);

    const after = JSON.parse(
      fs.readFileSync(path.join(repoDir, '.ars', 'config.json'), 'utf-8'),
    );
    expect(typeof after.project.customizedAt).toBe('string');
    // P2a invariant: stamping customized must NOT auto-stamp onboardedAt —
    // onboardedAt is the SSOT for "Phase 4 verify passed".
    expect(after.project.onboardedAt).toBeUndefined();

    // Workstate stage stays untouched so the next /ars:onboard advance
    // (typically to onboard-verify) can be deterministic.
    const workstate = JSON.parse(
      fs.readFileSync(path.join(repoDir, '.ars', 'state', 'workstate.json'), 'utf-8'),
    );
    expect(workstate.stage).toBe('onboard-customize');
    expect(workstate.active).toBe(true);
  });

  it('stamp --field rejects unknown fields with a non-zero exit', () => {
    const repoDir = makeConsumerRepo();
    runCli(repoDir, ['init', 'demo-series', '--yes']);

    const result = spawnSync(
      'node',
      ['--import', 'tsx', path.join(repoRoot, 'cli', 'index.ts'), 'workstate', 'stamp', '--field', 'finished'],
      {
        cwd: repoDir,
        encoding: 'utf-8',
        env: {
          ...process.env,
          ARS_SKIP_REMOTION_SKILL_INSTALL: '1',
        },
      },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/unsupported stamp field/);
  });

  it('clear --onboarded still stamps project.onboardedAt independently of customizedAt', () => {
    const repoDir = makeConsumerRepo();
    runCli(repoDir, ['init', 'demo-series', '--yes']);

    runCli(repoDir, ['workstate', 'stamp', '--field', 'customized']);
    runCli(repoDir, ['workstate', 'clear', '--onboarded']);

    const config = JSON.parse(
      fs.readFileSync(path.join(repoDir, '.ars', 'config.json'), 'utf-8'),
    );
    expect(typeof config.project.customizedAt).toBe('string');
    expect(typeof config.project.onboardedAt).toBe('string');
  });
});
