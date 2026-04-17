import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { afterEach, describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const cliPath = path.join(repoRoot, 'cli', 'index.ts');
const tempRoots: string[] = [];

function makeTempRoot(prefix: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function runCli(args: string[], options?: { cwd?: string; env?: NodeJS.ProcessEnv }): string {
  return execFileSync('node', ['--import', 'tsx', cliPath, ...args], {
    cwd: options?.cwd ?? repoRoot,
    env: {
      ...process.env,
      ...options?.env,
    },
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

describe('cli bootstrap', () => {
  it('prints root help', () => {
    const output = runCli(['--help']);
    expect(output).toContain('ARS — Agentic Remotion Studio CLI');
    expect(output).toContain('launch [claude-args...]');
    expect(output).not.toContain('pipeline');
  });

  it('prints package version', () => {
    const output = runCli(['--version']).trim();
    expect(output).toBe('1.0.0');
  });

  it('delegates help to init subcommand', () => {
    const output = runCli(['init', '--help']);
    expect(output).toContain('Usage: npx ars init [series-name] [options]');
    expect(output).toContain('--force-engine');
  });

  it('routes bare print mode to claude passthrough', () => {
    const binDir = makeTempRoot('ars-cli-bin-');
    const claudeLog = path.join(binDir, 'claude.log');
    const claudeBin = path.join(binDir, 'claude');

    fs.writeFileSync(
      claudeBin,
      `#!/bin/sh\nprintf '%s\\n' "$@" > ${JSON.stringify(claudeLog)}\n`,
      'utf-8',
    );
    fs.chmodSync(claudeBin, 0o755);

    runCli(['--print', 'hello'], {
      env: {
        PATH: `${binDir}:${process.env.PATH ?? ''}`,
      },
    });

    const loggedArgs = fs.readFileSync(claudeLog, 'utf-8');
    expect(loggedArgs).toContain('--plugin-dir');
    expect(loggedArgs).toContain('--print');
    expect(loggedArgs).toContain('hello');
  });
});
