import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeInstalledVersion } from '../lib/version';

const spawnSync = vi.fn();

vi.mock('child_process', () => ({
  spawnSync,
}));

vi.mock('../lib/tmux', () => ({
  isTmuxAvailable: () => true,
}));

const tempRoots: string[] = [];
const originalCwd = process.cwd();

function makeTempRoot(prefix: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function makePluginRoot(): string {
  const root = makeTempRoot('ars-doctor-plugin-');
  fs.mkdirSync(path.join(root, '.claude-plugin'), { recursive: true });
  fs.mkdirSync(path.join(root, 'hooks'), { recursive: true });
  fs.mkdirSync(path.join(root, 'skills', 'onboard'), { recursive: true });
  fs.writeFileSync(path.join(root, '.claude-plugin', 'plugin.json'), '{}\n', 'utf-8');
  fs.writeFileSync(path.join(root, 'hooks', 'hooks.json'), '{}\n', 'utf-8');
  fs.writeFileSync(path.join(root, 'skills', 'onboard', 'SKILL.md'), '---\nname: onboard\n---\n', 'utf-8');
  return root;
}

function writeMinimalArsRepo(root: string): void {
  fs.mkdirSync(path.join(root, '.ars'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', 'engine', 'cards'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', 'episodes', 'template'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', 'episodes', 'demo-series'), { recursive: true });

  fs.writeFileSync(
    path.join(root, 'package.json'),
    `${JSON.stringify({ name: 'ars-doctor-fixture', private: true }, null, 2)}\n`,
    'utf-8',
  );
  fs.mkdirSync(path.join(root, '.git'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.ars', 'config.json'),
    `${JSON.stringify({
      version: 2,
      tts: { provider: 'none' },
      publish: { youtube: { enabled: false } },
      extensions: { analytics: { enabled: false } },
      review: { preferredUi: 'studio' },
      project: {
        activeSeries: 'demo-series',
        visualDensity: 'balanced',
        layoutBias: 'mixed',
      },
    }, null, 2)}\n`,
    'utf-8',
  );
  fs.writeFileSync(path.join(root, 'src', 'engine', 'Composition.tsx'), 'export {};\n', 'utf-8');
  fs.writeFileSync(path.join(root, 'src', 'engine', 'cards', 'registry.ts'), 'export {};\n', 'utf-8');
  fs.writeFileSync(path.join(root, 'src', 'episodes', 'demo-series', 'series-config.ts'), 'export {};\n', 'utf-8');
  fs.writeFileSync(path.join(root, 'CLAUDE.md'), '<!-- ars:begin -->\n<!-- ars:end -->\n', 'utf-8');
  writeInstalledVersion(
    {
      version: '1.0.0',
      installedAt: '2026-04-16T00:00:00.000Z',
      lastUpdatedAt: '2026-04-16T00:00:00.000Z',
      installMethod: 'npm-local',
      configSchemaVersion: 2,
    },
    root,
  );
}

beforeEach(() => {
  vi.resetModules();
  spawnSync.mockReset();
});

afterEach(() => {
  process.chdir(originalCwd);
  vi.doUnmock('../lib/runtime-package');
  vi.unstubAllEnvs();
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

describe('doctor bootstrap checks', () => {
  it('reports missing package.json and git repo before init', async () => {
    const repoRoot = makeTempRoot('ars-doctor-preinit-');
    const pluginRoot = makePluginRoot();
    process.chdir(repoRoot);

    spawnSync.mockImplementation((command: string, args?: string[]) => {
      if (command === 'claude') {
        return { status: 0, stdout: 'claude 1.0.0\n' };
      }
      if (command === 'git' && args?.[0] === '--version') {
        return { status: 0, stdout: 'git version 2.39.0\n' };
      }
      if (command === 'git' && args?.[0] === 'rev-parse') {
        return { status: 128, stdout: '', stderr: 'not a git repository' };
      }
      return { status: 1, stdout: '', stderr: '' };
    });

    vi.doMock('../lib/runtime-package', () => ({
      getRuntimePackageInfo: () => ({
        name: 'agentic-remotion-studio',
        version: '1.0.0',
        packageRoot: '/tmp/pkg',
        pluginRoot,
      }),
    }));

    const { runDoctor } = await import('../commands/doctor');
    const results = runDoctor({ json: false, strict: false });

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'repo.package-json', status: 'warn' }),
        expect.objectContaining({ id: 'repo.git-binary', status: 'pass' }),
        expect.objectContaining({ id: 'repo.git-root', status: 'warn', fixHint: 'Run git init to start versioning this content repo.' }),
        expect.objectContaining({ id: 'config.exists', status: 'fail' }),
      ]),
    );
  });

  it('passes bootstrap checks for a git-backed initialized repo', async () => {
    const repoRoot = makeTempRoot('ars-doctor-ready-');
    const pluginRoot = makePluginRoot();
    writeMinimalArsRepo(repoRoot);
    process.chdir(repoRoot);

    spawnSync.mockImplementation((command: string, args?: string[]) => {
      if (command === 'claude') {
        return { status: 0, stdout: 'claude 1.0.0\n' };
      }
      if (command === 'git' && args?.[0] === '--version') {
        return { status: 0, stdout: 'git version 2.39.0\n' };
      }
      if (command === 'git' && args?.[0] === 'rev-parse') {
        return { status: 0, stdout: 'true\n' };
      }
      return { status: 1, stdout: '', stderr: '' };
    });

    vi.doMock('../lib/runtime-package', () => ({
      getRuntimePackageInfo: () => ({
        name: 'agentic-remotion-studio',
        version: '1.0.0',
        packageRoot: '/tmp/pkg',
        pluginRoot,
      }),
    }));

    const { runDoctor } = await import('../commands/doctor');
    const results = runDoctor({ json: false, strict: false });

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'repo.package-json', status: 'pass' }),
        expect.objectContaining({ id: 'repo.git-binary', status: 'pass' }),
        expect.objectContaining({ id: 'repo.git-root', status: 'pass' }),
      ]),
    );
  });
});
