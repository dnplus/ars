import { execFileSync, spawnSync } from 'child_process';
import path from 'path';

export type ClaudeLaunchPolicy = 'inside-tmux' | 'outside-tmux' | 'direct';

export function resolveLaunchPolicy(
  env: NodeJS.ProcessEnv = process.env,
  args: string[] = [],
): ClaudeLaunchPolicy {
  if (isPrintMode(args)) {
    return 'direct';
  }

  if (env.TMUX) {
    return 'inside-tmux';
  }

  if (env.CMUX_SURFACE_ID) {
    return 'direct';
  }

  return isTmuxAvailable() ? 'outside-tmux' : 'direct';
}

export function isTmuxAvailable(): boolean {
  try {
    execFileSync('tmux', ['-V'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function buildTmuxSessionName(cwd: string): string {
  const dirToken = sanitizeTmuxToken(path.basename(cwd));
  const branchToken = getGitBranchToken(cwd);
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+$/, '')
    .toLowerCase();

  return `ars-${dirToken}-${branchToken}-${timestamp}`.slice(0, 120);
}

export function buildTmuxShellCommand(bin: string, args: string[]): string {
  return [quoteShellArg(bin), ...args.map(quoteShellArg)].join(' ');
}

export function wrapWithLoginShell(command: string): string {
  const shell = process.env.SHELL?.trim() || '/bin/bash';
  return `exec ${quoteShellArg(shell)} -lc ${quoteShellArg(command)}`;
}

export function tmuxExec(args: string[], options?: { stdio?: 'ignore' | 'inherit' | 'pipe' }): string {
  return execFileSync('tmux', args, {
    encoding: 'utf-8',
    stdio: options?.stdio ?? 'pipe',
  });
}

export function quoteShellArg(value: string): string {
  if (value.length === 0) {
    return "''";
  }

  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function isPrintMode(args: string[]): boolean {
  return args.some((arg) => arg === '--print' || arg === '-p');
}

function sanitizeTmuxToken(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-');
  return normalized.replace(/^-|-$/g, '') || 'workspace';
}

function getGitBranchToken(cwd: string): string {
  try {
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return sanitizeTmuxToken(branch || 'detached');
  } catch {
    return 'detached';
  }
}

export function tmuxSupportsSessionCreation(): boolean {
  const result = spawnSync('tmux', ['start-server'], { stdio: 'ignore' });
  return result.status === 0;
}
