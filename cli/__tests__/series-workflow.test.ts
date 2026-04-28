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
  const tempRoot = makeTempRoot('ars-series-');
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

describe('single-series workflow', () => {
  it('bootstraps a repo and infers the active series for repo-scoped episode creation', () => {
    const repoDir = makeConsumerRepo();

    runCli(repoDir, ['init', 'demo-series', '--yes']);
    runCli(repoDir, ['episode', 'create', 'ep001']);

    const config = JSON.parse(fs.readFileSync(path.join(repoDir, '.ars', 'config.json'), 'utf-8'));
    const packageJson = JSON.parse(fs.readFileSync(path.join(repoDir, 'package.json'), 'utf-8'));
    const gitignore = fs.readFileSync(path.join(repoDir, '.gitignore'), 'utf-8');
    const workflow = fs.readFileSync(path.join(repoDir, '.github', 'workflows', 'ci.yml'), 'utf-8');
    const seriesConfig = fs.readFileSync(path.join(repoDir, 'src', 'episodes', 'demo-series', 'series-config.ts'), 'utf-8');
    const demoEpisode = fs.readFileSync(path.join(repoDir, 'src', 'episodes', 'demo-series', 'ep-demo.ts'), 'utf-8');
    expect(config.project.activeSeries).toBe('demo-series');
    expect(fs.existsSync(path.join(repoDir, '.git'))).toBe(true);
    expect(gitignore).toContain('node_modules/');
    expect(gitignore).toContain('.ars/config.json');
    expect(workflow).toContain('npm run lint');
    expect(workflow).toContain('npx ars episode validate template/ep-demo');
    expect(packageJson.scripts.lint).toBe('eslint src && tsc');
    expect(packageJson.scripts.test).toBe('vitest run --passWithNoTests');
    expect(packageJson.dependencies.remotion).toBeDefined();
    expect(packageJson.dependencies.tsx).toBeDefined();
    expect(packageJson.devDependencies.eslint).toBeDefined();
    expect(fs.existsSync(path.join(repoDir, '.env.example'))).toBe(true);
    expect(fs.existsSync(path.join(repoDir, 'cli', 'pronunciation_dict.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(repoDir, 'src', 'engine', 'Composition.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(repoDir, 'src', 'episodes', 'demo-series', 'ep001.ts'))).toBe(true);
    expect(fs.existsSync(path.join(repoDir, 'public', 'episodes', 'demo-series', 'ep001', 'audio'))).toBe(true);
    expect(fs.existsSync(path.join(repoDir, 'eslint.config.mjs'))).toBe(true);
    expect(fs.existsSync(path.join(repoDir, 'cli', 'lib', 'youtube-client.ts'))).toBe(true);
    expect(fs.existsSync(path.join(repoDir, 'cli', 'lib', 'youtube-upload.ts'))).toBe(true);
    expect(seriesConfig).toContain('enabled: false');
    expect(demoEpisode).not.toContain('episodes/template/shared/vtuber');
    expect(demoEpisode).not.toContain('channelName: "人蔘 Try Catch"');
  });

  it('lists card metadata for an explicit target repo root', () => {
    const repoDir = makeConsumerRepo();

    runCli(repoDir, ['init', 'demo-series', '--yes']);
    const output = runCli(repoRoot, ['card', 'list', repoDir, '--json']);
    const cards = JSON.parse(output) as Array<{ type: string; scope: string; specPath: string }>;

    expect(cards.some((card) => card.type === 'markdown' && card.scope === 'engine')).toBe(true);
    expect(cards.some((card) => card.specPath.startsWith(repoDir))).toBe(true);
  });

  it('update restores repo-level support files that older installs may be missing', () => {
    const repoDir = makeConsumerRepo();

    runCli(repoDir, ['init', 'demo-series', '--yes']);

    fs.rmSync(path.join(repoDir, 'eslint.config.mjs'), { force: true });
    fs.rmSync(path.join(repoDir, '.github'), { recursive: true, force: true });
    fs.rmSync(path.join(repoDir, '.env.example'), { force: true });
    fs.rmSync(path.join(repoDir, 'cli', 'pronunciation_dict.yaml'), { force: true });
    fs.rmSync(path.join(repoDir, 'cli', 'lib', 'youtube-client.ts'), { force: true });
    fs.rmSync(path.join(repoDir, 'cli', 'lib', 'youtube-upload.ts'), { force: true });

    runCli(repoDir, ['update']);

    expect(fs.existsSync(path.join(repoDir, 'eslint.config.mjs'))).toBe(true);
    expect(fs.existsSync(path.join(repoDir, '.github', 'workflows', 'ci.yml'))).toBe(true);
    expect(fs.existsSync(path.join(repoDir, '.env.example'))).toBe(true);
    expect(fs.existsSync(path.join(repoDir, 'cli', 'pronunciation_dict.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(repoDir, 'cli', 'lib', 'youtube-client.ts'))).toBe(true);
    expect(fs.existsSync(path.join(repoDir, 'cli', 'lib', 'youtube-upload.ts'))).toBe(true);
  });

  it('rejects initializing a second series in the same repo', () => {
    const repoDir = makeConsumerRepo();

    runCli(repoDir, ['init', 'demo-series', '--yes']);
    const result = spawnSync(
      'node',
      ['--import', 'tsx', path.join(repoRoot, 'cli', 'index.ts'), 'init', 'other-series'],
      {
        cwd: repoDir,
        encoding: 'utf-8',
        env: {
          ...process.env,
          ARS_SKIP_REMOTION_SKILL_INSTALL: '1',
        },
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('already initialized for series "demo-series"');
    expect(fs.existsSync(path.join(repoDir, 'src', 'episodes', 'other-series'))).toBe(false);
  });
});
