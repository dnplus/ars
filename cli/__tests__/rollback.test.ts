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
  const tempRoot = makeTempRoot('ars-rollback-');
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

describe('npx ars rollback', () => {
  it('restores files that update overwrote, using the manifest only (no shell)', () => {
    const repoDir = makeConsumerRepo();
    runCli(repoDir, ['init', 'demo-series', '--yes']);

    // Customise an ARS-owned file that update will overwrite.
    const eslintPath = path.join(repoDir, 'eslint.config.mjs');
    fs.writeFileSync(eslintPath, '// USER-CUSTOMISED CONTENT\n', 'utf-8');

    runCli(repoDir, ['update', '--quiet']);

    // After update, the customisation is gone (overwritten by package version).
    expect(fs.readFileSync(eslintPath, 'utf-8')).not.toContain('USER-CUSTOMISED');

    // Roll back. No --to means latest.
    const rollbackOutput = runCli(repoDir, ['rollback']);
    expect(rollbackOutput).toContain('restored eslint.config.mjs');
    expect(rollbackOutput).toContain('Rollback complete');

    // Customisation is back.
    expect(fs.readFileSync(eslintPath, 'utf-8')).toContain('USER-CUSTOMISED');
  });

  it('--list prints available backups newest first with manifest summaries', () => {
    const repoDir = makeConsumerRepo();
    runCli(repoDir, ['init', 'demo-series', '--yes']);
    // Each update adds a new backup directory.
    runCli(repoDir, ['update', '--quiet']);
    runCli(repoDir, ['update', '--quiet']);

    const out = runCli(repoDir, ['rollback', '--list']);
    const lines = out.split('\n').filter((l) => l.match(/^\s+\d{4}-\d{2}-\d{2}T/));
    expect(lines.length).toBeGreaterThanOrEqual(2);
    // Sorted newest first → first entry timestamp is later than second.
    const ts1 = lines[0].trim().split(/\s+/)[0];
    const ts2 = lines[1].trim().split(/\s+/)[0];
    expect(ts1.localeCompare(ts2)).toBeGreaterThan(0);
    // Manifest summary appears (e.g. "N path(s) from update").
    expect(out).toMatch(/path\(s\) from update/);
  });

  it('--dry-run reports the plan without changing the filesystem', () => {
    const repoDir = makeConsumerRepo();
    runCli(repoDir, ['init', 'demo-series', '--yes']);

    const eslintPath = path.join(repoDir, 'eslint.config.mjs');
    fs.writeFileSync(eslintPath, '// USER-CUSTOMISED CONTENT\n', 'utf-8');
    runCli(repoDir, ['update', '--quiet']);

    // Mid-state: customisation overwritten.
    const midContent = fs.readFileSync(eslintPath, 'utf-8');
    expect(midContent).not.toContain('USER-CUSTOMISED');

    const out = runCli(repoDir, ['rollback', '--dry-run']);
    expect(out).toContain('would restore');
    expect(out).toContain('Dry run complete');

    // Filesystem unchanged after dry-run.
    expect(fs.readFileSync(eslintPath, 'utf-8')).toBe(midContent);
  });

  it('--to <ts> rolls back to a specific backup, ignoring newer ones', () => {
    const repoDir = makeConsumerRepo();
    runCli(repoDir, ['init', 'demo-series', '--yes']);

    const eslintPath = path.join(repoDir, 'eslint.config.mjs');
    fs.writeFileSync(eslintPath, '// V1\n', 'utf-8');
    runCli(repoDir, ['update', '--quiet']);  // backup #1 captured V1
    fs.writeFileSync(eslintPath, '// V2\n', 'utf-8');
    runCli(repoDir, ['update', '--quiet']);  // backup #2 captured V2

    const backupsRoot = path.join(repoDir, '.ars', 'backups');
    const stamps = fs.readdirSync(backupsRoot).sort();
    expect(stamps.length).toBeGreaterThanOrEqual(2);
    const oldest = stamps[0];

    runCli(repoDir, ['rollback', '--to', oldest, '-q']);
    // Specifying the older timestamp restores V1.
    expect(fs.readFileSync(eslintPath, 'utf-8')).toContain('V1');
  });

  it('errors gracefully when no backups exist', () => {
    const repoDir = makeConsumerRepo();
    fs.mkdirSync(path.join(repoDir, 'src', 'engine'), { recursive: true });

    const result = spawnSync(
      'node',
      ['--import', 'tsx', path.join(repoRoot, 'cli', 'index.ts'), 'rollback'],
      { cwd: repoDir, encoding: 'utf-8' },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('No backups found');
  });

  it('errors when a backup directory has no manifest (older snapshot)', () => {
    const repoDir = makeConsumerRepo();
    runCli(repoDir, ['init', 'demo-series', '--yes']);

    // Fabricate an older-style backup dir with no manifest.
    const fakeStamp = '1970-01-01T00-00-00.000Z';
    fs.mkdirSync(path.join(repoDir, '.ars', 'backups', fakeStamp, 'engine'), { recursive: true });

    const result = spawnSync(
      'node',
      ['--import', 'tsx', path.join(repoRoot, 'cli', 'index.ts'), 'rollback', '--to', fakeStamp],
      { cwd: repoDir, encoding: 'utf-8' },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('manifest not found');
  });
});
