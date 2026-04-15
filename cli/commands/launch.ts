import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import {
  buildTmuxSessionName,
  buildTmuxShellCommand,
  isPrintMode,
  quoteShellArg,
  resolveLaunchPolicy,
  tmuxExec,
  wrapWithLoginShell,
} from '../lib/tmux';
import { getRuntimePackageInfo } from '../lib/runtime-package';

export function normalizeClaudeLaunchArgs(
  args: string[],
  options?: { pluginRoot?: string },
): string[] {
  const normalized: string[] = [];
  const pluginRoot = options?.pluginRoot;
  let hasPluginDir = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    normalized.push(arg);

    if (arg === '--plugin-dir') {
      hasPluginDir = true;
      if (args[index + 1]) {
        normalized.push(args[index + 1]);
        index += 1;
      }
      continue;
    }

    if (arg.startsWith('--plugin-dir=')) {
      hasPluginDir = true;
    }
  }

  if (pluginRoot && !hasPluginDir) {
    normalized.unshift(pluginRoot);
    normalized.unshift('--plugin-dir');
  }

  return normalized;
}

export function runClaude(cwd: string, args: string[]): void {
  if (isPrintMode(args)) {
    runClaudeDirect(cwd, args);
    return;
  }

  switch (resolveLaunchPolicy(process.env, args)) {
    case 'inside-tmux':
      runClaudeInsideTmux(cwd, args);
      return;
    case 'outside-tmux':
      runClaudeOutsideTmux(cwd, args);
      return;
    case 'direct':
    default:
      runClaudeDirect(cwd, args);
  }
}

export async function launchCommand(rawArgs: string[]): Promise<void> {
  const runtime = getRuntimePackageInfo(import.meta.url);
  const pluginManifestPath = path.join(
    runtime.pluginRoot,
    '.claude-plugin',
    'plugin.json',
  );

  if (!fs.existsSync(pluginManifestPath)) {
    throw new Error(`ARS plugin manifest not found: ${pluginManifestPath}`);
  }

  const args = normalizeClaudeLaunchArgs(rawArgs, {
    pluginRoot: runtime.pluginRoot,
  });

  runClaude(process.cwd(), args);
}

function runClaudeInsideTmux(cwd: string, args: string[]): void {
  try {
    tmuxExec(['set-option', 'mouse', 'on'], { stdio: 'ignore' });
  } catch {
    // Non-fatal.
  }

  execClaude(cwd, args);
}

function runClaudeOutsideTmux(cwd: string, args: string[]): void {
  const sessionName = buildTmuxSessionName(cwd);
  const rawClaudeCommand = buildTmuxShellCommand('claude', args);
  const envPrefix = buildEnvExportPrefix(['PATH']);
  const claudeCommand = wrapWithLoginShell(
    `${envPrefix}${rawClaudeCommand}`,
  );

  try {
    tmuxExec(['new-session', '-d', '-s', sessionName, '-c', cwd, claudeCommand], {
      stdio: 'inherit',
    });
  } catch {
    runClaudeDirect(cwd, args);
    return;
  }

  try {
    tmuxExec(['set-option', '-t', sessionName, 'mouse', 'on'], {
      stdio: 'ignore',
    });
  } catch {
    // Non-fatal.
  }

  try {
    tmuxExec(['attach-session', '-t', sessionName], { stdio: 'inherit' });
  } catch {
    try {
      tmuxExec(['has-session', '-t', sessionName], { stdio: 'ignore' });
      return;
    } catch {
      runClaudeDirect(cwd, args);
    }
  }
}

function runClaudeDirect(cwd: string, args: string[]): void {
  execClaude(cwd, args);
}

function execClaude(cwd: string, args: string[]): void {
  try {
    execFileSync('claude', args, {
      cwd,
      stdio: 'inherit',
    });
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { status?: number | null };
    if (err.code === 'ENOENT') {
      console.error('[ars] Error: claude CLI not found in PATH.');
      process.exit(1);
    }

    process.exit(typeof err.status === 'number' ? err.status : 1);
  }
}

function buildEnvExportPrefix(names: string[]): string {
  const exports = names
    .map((name) => {
      const value = process.env[name];
      if (value === undefined) {
        return null;
      }
      return `export ${name}=${quoteShellArg(value)}`;
    })
    .filter(Boolean);

  return exports.length > 0 ? `${exports.join('; ')}; ` : '';
}
