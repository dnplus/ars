#!/usr/bin/env node
/**
 * ARS statusline wrapper.
 *
 * Reads ~/.claude/ars-statusline-config.json for an optional delegate command.
 * If delegate exists, runs it and prepends its output to the ARS status segment.
 * If not, outputs only the ARS status segment.
 *
 * Config schema:
 *   { "delegate": "<shell command>", "pluginScriptsDir": "/abs/path/to/plugin/scripts" }
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read stdin (Claude Code passes JSON to statusLine commands)
let stdinData = '';
try {
  stdinData = readFileSync('/dev/stdin', 'utf8');
} catch {
  stdinData = '{}';
}

// Load delegate config
const configPath = join(homedir(), '.claude', 'ars-statusline-config.json');
let delegateCommand = null;
let pluginScriptsDir = null;
if (existsSync(configPath)) {
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    if (typeof config.delegate === 'string' && config.delegate.trim()) {
      delegateCommand = config.delegate.trim();
    }
    if (typeof config.pluginScriptsDir === 'string' && config.pluginScriptsDir.trim()) {
      pluginScriptsDir = config.pluginScriptsDir.trim();
    }
  } catch {
    // ignore malformed config
  }
}

// Run delegate and capture output
let delegateOutput = '';
if (delegateCommand) {
  try {
    delegateOutput = execSync(delegateCommand, {
      input: stdinData,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 4000,
    }).trim();
  } catch {
    // delegate failed — skip it
  }
}

// Compute ARS segment
let arsSegment = '';
try {
  const workstateDir = pluginScriptsDir ?? __dirname;
  const { renderStatusLine } = await import(
    join(workstateDir, 'lib', 'ars-workstate.mjs')
  );
  const payload = (() => {
    try { return JSON.parse(stdinData); } catch { return {}; }
  })();
  const cwd = typeof payload.cwd === 'string' && payload.cwd ? payload.cwd : process.cwd();
  const sessionId = payload.session_id ?? payload.sessionId;
  arsSegment = renderStatusLine(cwd, sessionId);
} catch {
  // Not an ARS repo or renderStatusLine unavailable — output nothing
}

// Combine
const parts = [];
if (delegateOutput) parts.push(delegateOutput);
if (arsSegment) parts.push(arsSegment);

if (parts.length > 0) {
  process.stdout.write(parts.join('  ·  ') + '\n');
}
