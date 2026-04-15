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

function makeRepoCopy(): string {
  const tempRoot = makeTempRoot('ars-series-');
  const copyRoot = path.join(tempRoot, 'repo');

  fs.cpSync(repoRoot, copyRoot, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(repoRoot, source);
      if (!relative) return true;
      const top = relative.split(path.sep)[0];
      return top !== '.git' && top !== 'node_modules' && top !== 'dist' && top !== 'output';
    },
  });

  fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(copyRoot, 'node_modules'), 'junction');
  return copyRoot;
}

function writeConfig(repoDir: string): void {
  fs.mkdirSync(path.join(repoDir, '.ars'), { recursive: true });
  fs.writeFileSync(
    path.join(repoDir, '.ars', 'config.json'),
    `${JSON.stringify({
      version: 2,
      tts: { provider: 'none' },
      publish: { youtube: { enabled: false } },
      extensions: {
        analytics: { enabled: false },
      },
      review: {
        preferredUi: 'studio',
      },
      project: {
        visualDensity: 'balanced',
        layoutBias: 'mixed',
      },
    }, null, 2)}\n`,
    'utf-8',
  );
}

function runCli(repoDir: string, args: string[]): string {
  return execFileSync('node', ['--import', 'tsx', path.join(repoDir, 'cli', 'index.ts'), ...args], {
    cwd: repoDir,
    encoding: 'utf-8',
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

describe('single-series workflow', () => {
  it('infers the active series for repo-scoped episode creation', () => {
    const repoDir = makeRepoCopy();
    writeConfig(repoDir);

    runCli(repoDir, ['init', 'demo-series']);
    runCli(repoDir, ['episode', 'create', 'ep001']);

    const config = JSON.parse(fs.readFileSync(path.join(repoDir, '.ars', 'config.json'), 'utf-8'));
    expect(config.project.activeSeries).toBe('demo-series');
    expect(fs.existsSync(path.join(repoDir, 'src', 'episodes', 'demo-series', 'ep001.ts'))).toBe(true);
    expect(fs.existsSync(path.join(repoDir, 'public', 'episodes', 'demo-series', 'ep001', 'audio'))).toBe(true);
  });

  it('rejects initializing a second series in the same repo', () => {
    const repoDir = makeRepoCopy();
    writeConfig(repoDir);

    runCli(repoDir, ['init', 'demo-series']);
    const result = spawnSync(
      'node',
      ['--import', 'tsx', path.join(repoDir, 'cli', 'index.ts'), 'init', 'other-series'],
      {
        cwd: repoDir,
        encoding: 'utf-8',
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('already initialized for series "demo-series"');
    expect(fs.existsSync(path.join(repoDir, 'src', 'episodes', 'other-series'))).toBe(false);
  });
});
